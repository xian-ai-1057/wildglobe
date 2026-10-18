#!/usr/bin/env node
// Checks every stream in src/data/streams.json: is it live right now, and can it be embedded?
// For a stream that is down, lists the channel's current live videos so you can pick a replacement.
//
// How: each channel's /streams page tells us which of its videos are live, and YouTube's oEmbed endpoint
// tells us whether a video may be embedded. Neither is normally bot-checked, so this also works from CI.
// Only when a video isn't in its channel's live list (usually: the broadcaster restarted the stream under
// a new ID) do we fall back to its watch page. YouTube often bot-checks that page on datacenter IPs, but the
// page data behind its "LIVE" / "Streamed live on …" line still comes through, so we read liveness from it.
// Anything we still can't verify is reported as "blocked", not "down".
//
// Exit codes: 0 = all OK, 1 = at least one stream is down, 2 = nothing down but some checks were blocked,
// 3 = every check was blocked (the checker itself is probably broken).
// Usage: npm run check-streams [-- path/to/streams.json]

import { readFile } from 'node:fs/promises';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
  'Accept-Language': 'en-US',
  Cookie: 'SOCS=CAI; CONSENT=YES+1',
};
const DELAY_MS = 1500;
const RETRY_DELAY_MS = 5000;
const RETRIES = 2;

// playabilityStatus values that mean "YouTube wants proof you're human", not "the video is gone"
const BLOCKED_STATUSES = new Set(['LOGIN_REQUIRED']);

class BlockedError extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  await sleep(DELAY_MS);
  try {
    return await fetch(url, { headers: HEADERS });
  } catch (err) {
    throw new BlockedError(`network error: ${err.cause?.message ?? err.message}`);
  }
}

async function fetchHtml(url) {
  const res = await get(url);
  if (res.status === 429 || res.status === 403) throw new BlockedError(`HTTP ${res.status}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const host = new URL(res.url).hostname;
  if (host !== 'www.youtube.com') throw new BlockedError(`redirected to ${host}`);
  return res.text();
}

/** Runs fn, retrying when YouTube blocks it; occasional one-off blocks happen even from home IPs. */
async function withRetry(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await fn();
      if (result?.state !== 'blocked' || attempt === RETRIES) return result;
    } catch (err) {
      if (!(err instanceof BlockedError) || attempt === RETRIES) throw err;
    }
    await sleep(RETRY_DELAY_MS);
  }
}

function parseInitialData(html, name) {
  const m = html.match(new RegExp(`var ${name} = (\\{.*?\\});(?:var |</script>)`, 's'));
  return m ? JSON.parse(m[1]) : null;
}

const channelCache = new Map();

/** The channel's currently live videos, fetched once per channel. */
function channelLives(channelId) {
  if (!channelCache.has(channelId))
    channelCache.set(
      channelId,
      withRetry(() => fetchChannelLives(channelId)),
    );
  return channelCache.get(channelId);
}

async function fetchChannelLives(channelId) {
  const html = await fetchHtml(`https://www.youtube.com/channel/${channelId}/streams`);
  const data = parseInitialData(html, 'ytInitialData');
  if (!data) throw new BlockedError('no channel data in page');
  const lives = [];
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (o.lockupViewModel) {
      const v = o.lockupViewModel;
      if (JSON.stringify(v).includes('THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE')) {
        lives.push({ videoId: v.contentId, title: v.metadata?.lockupMetadataViewModel?.title?.content });
      }
      return;
    }
    for (const k in o) walk(o[k]);
  };
  walk(data);
  return lives;
}

/** oEmbed answers 200 for embeddable videos, 401 when the owner disabled embedding, 400/404 when gone. */
async function embedStatus(videoId) {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
  const res = await get(url);
  if (res.ok) return { state: 'ok', title: (await res.json()).title };
  if (res.status === 401) return { state: 'down', reason: 'embedding disabled' };
  if (res.status === 400 || res.status === 404) return { state: 'down', reason: 'video not found' };
  throw new BlockedError(`oEmbed HTTP ${res.status}`);
}

/** The block that renders the title and "LIVE" / "Streamed live on …" line under a watch page's player. */
function primaryInfo(html) {
  let found = null;
  const walk = (o) => {
    if (found || !o || typeof o !== 'object') return;
    if (o.videoPrimaryInfoRenderer) {
      found = o.videoPrimaryInfoRenderer;
      return;
    }
    for (const k in o) walk(o[k]);
  };
  walk(parseInitialData(html, 'ytInitialData'));
  return found;
}

/** Fallback for a video missing from its channel's live list: an ID gone stale, or a cut-off list. */
async function watchPageStatus(videoId) {
  const html = await fetchHtml(`https://www.youtube.com/watch?v=${videoId}`);
  const player = parseInitialData(html, 'ytInitialPlayerResponse');
  const status = player?.playabilityStatus?.status;

  if (!player || BLOCKED_STATUSES.has(status)) {
    // Bot-checked: the player data is withheld, but the page data still says whether it's live.
    const info = primaryInfo(html);
    if (!info) return { state: 'blocked', reason: player ? `status ${status}` : 'no player data in page' };
    const title = info.title?.runs?.map((r) => r.text).join('');
    if (info.viewCount?.videoViewCountRenderer?.isLive === true) return { state: 'ok', title };
    const when = info.dateText?.simpleText;
    return { state: 'down', reason: `not live now${when ? ` (${when})` : ''}`, title };
  }

  const title = player.videoDetails?.title;
  if (status !== 'OK') return { state: 'down', reason: `status ${status}`, title };
  const live = player.microformat?.playerMicroformatRenderer?.liveBroadcastDetails?.isLiveNow === true;
  if (!live) return { state: 'down', reason: 'not live now', title };
  return { state: 'ok', title };
}

async function checkStream({ youtube: { videoId, channelId } }) {
  let lives = null;
  try {
    lives = await channelLives(channelId);
  } catch (err) {
    if (!(err instanceof BlockedError)) throw err;
  }

  const target = videoId ?? lives?.[0]?.videoId;
  if (!target)
    return {
      state: lives ? 'down' : 'blocked',
      reason: lives ? 'channel has no live stream' : 'channel page blocked',
      lives,
    };

  const listedLive = lives?.some((l) => l.videoId === target);
  const live = listedLive ? { state: 'ok' } : await withRetry(() => watchPageStatus(target));
  if (live.state !== 'ok') return { ...live, lives };

  return { ...(await embedStatus(target)), lives };
}

const ICONS = { ok: '✅', down: '❌', blocked: '⚠️' };
const streamsPath = process.argv[2] ?? new URL('../src/data/streams.json', import.meta.url);
const streams = JSON.parse(await readFile(streamsPath, 'utf8'));
const counts = { ok: 0, down: 0, blocked: 0 };

for (const s of streams) {
  let result;
  try {
    result = await checkStream(s);
  } catch (err) {
    result = { state: err instanceof BlockedError ? 'blocked' : 'down', reason: err.message };
  }
  counts[result.state]++;
  const detail =
    result.state === 'ok' ? (result.title ?? '') : `${result.reason}${result.title ? `  (${result.title})` : ''}`;
  console.log(`${ICONS[result.state]} ${s.id}  —  ${detail}`);

  if (result.state === 'down' && result.lives) {
    for (const l of result.lives) console.log(`     ↳ live on channel: ${l.videoId}  ${l.title}`);
    if (!result.lives.length) console.log('     ↳ channel has no live streams right now');
  }
}

console.log(`\n${counts.ok}/${streams.length} streams OK, ${counts.down} down, ${counts.blocked} blocked`);
process.exit(counts.down ? 1 : counts.ok === 0 ? 3 : counts.blocked ? 2 : 0);
