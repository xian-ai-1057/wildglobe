#!/usr/bin/env node
// Keeps every stream in src/data/streams.json pointed at something playable, so the site never shows a dead player.
//
// Many cameras don't run one endless broadcast: they stream a few hours a day (e.g. the Norway feeder) or restart
// every few days, and each broadcast gets a new video ID. For each stream whose video is no longer live, this:
//   1. switches to the channel's live broadcast of the same camera, if one is on air;
//   2. otherwise switches to the camera's most recent recorded broadcast and marks it "replay";
//   3. otherwise marks it "offline" and leaves the video as is.
// A stream that is live again loses its status. Run it on a schedule (.github/workflows/update-streams.yml).
//
// "The same camera" is the live/recorded video whose title best matches the current video's title (dates and
// weekdays ignored), or, when the stream sets youtube.match, the first one whose title contains that text. Use
// match for channels that run several similar cameras at once.
//
// Talks to YouTube's InnerTube API (the JSON behind youtube.com pages), which doesn't bot-check like the watch page.
// Anything it can't verify is left unchanged.
//
// Usage: npm run update-streams [-- --dry-run] [-- path/to/streams.json]
// Prints one line per change; with --summary FILE also writes them there (used as the commit message body).

import { readFile, writeFile } from 'node:fs/promises';

const API = 'https://youtubei.googleapis.com/youtubei/v1';
const CLIENT = { clientName: 'WEB', clientVersion: '2.20261001.00.00', hl: 'en', gl: 'US' };
const DELAY_MS = 500;
const RETRIES = 2;
const RETRY_DELAY_MS = 5000;
// The channel's "Live" tab
const STREAMS_TAB = 'EgdzdHJlYW1z8gYECgJ6AA%3D%3D';

// Title similarity needed to treat another video as the same camera, and how far ahead of the runner-up a live
// candidate must be (a channel's simultaneous lives are different cameras, often with near-identical titles).
const MIN_SIMILARITY = 0.5;
const MIN_LEAD = 0.15;
// Restarted streams leave short fragments behind; a replay should be a real broadcast that keeps playing.
const MIN_REPLAY_SECONDS = 30 * 60;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function innertube(endpoint, body) {
  for (let attempt = 0; ; attempt++) {
    await sleep(DELAY_MS);
    try {
      const res = await fetch(`${API}/${endpoint}?prettyPrint=false`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: { client: CLIENT }, ...body }),
      });
      if (res.ok) return await res.json();
      if (res.status < 500 && res.status !== 429) throw new Error(`${endpoint} HTTP ${res.status}`);
      if (attempt === RETRIES) throw new Error(`${endpoint} HTTP ${res.status}`);
    } catch (err) {
      if (attempt === RETRIES || err.message.startsWith(`${endpoint} HTTP`)) throw err;
    }
    await sleep(RETRY_DELAY_MS);
  }
}

/** Yields every object under o that has key k, without descending into matches. */
function* findAll(o, k) {
  if (!o || typeof o !== 'object') return;
  if (k in o) {
    yield o[k];
    return;
  }
  for (const v of Object.values(o)) yield* findAll(v, k);
}

const channelCache = new Map();

/** The channel's live broadcasts and its recorded past broadcasts (newest first). Scheduled ones are skipped. */
function channelStreams(channelId) {
  if (!channelCache.has(channelId)) channelCache.set(channelId, fetchChannelStreams(channelId));
  return channelCache.get(channelId);
}

async function fetchChannelStreams(channelId) {
  const data = await innertube('browse', { browseId: channelId, params: STREAMS_TAB });
  const lives = [];
  const recordings = [];
  for (const v of findAll(data, 'lockupViewModel')) {
    const title = v.metadata?.lockupMetadataViewModel?.title?.content ?? '';
    const json = JSON.stringify(v);
    if (json.includes('THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE')) lives.push({ videoId: v.contentId, title });
    else if (/"content":"Streamed /.test(json)) {
      const [, h = 0, m, s] = json.match(/"text":"(?:(\d+):)?(\d+):(\d\d)"/) ?? [];
      recordings.push({ videoId: v.contentId, title, seconds: m == null ? null : h * 3600 + m * 60 + +s });
    }
  }
  if (!lives.length && !recordings.length && !JSON.stringify(data).includes('"channel.streams"'))
    throw new Error('unrecognised channel response');
  return { lives, recordings };
}

/** Title and liveness of one video, or null if YouTube has nothing on it (deleted or private). */
async function videoInfo(videoId) {
  const data = await innertube('next', { videoId });
  const [info] = findAll(data, 'videoPrimaryInfoRenderer');
  if (!info) return null;
  return {
    title: info.title?.runs?.map((r) => r.text).join('') ?? '',
    live: info.viewCount?.videoViewCountRenderer?.isLive === true,
  };
}

const IGNORED_WORDS = new Set(
  (
    'live stream streaming streamed now cam camera webcam the a an and of in at on from by with to for ' +
    'january february march april may june july august september october november december ' +
    'jan feb mar apr jun jul aug sep sept oct nov dec ' +
    'monday tuesday wednesday thursday friday saturday sunday'
  ).split(' '),
);
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/** A title's distinguishing words: no dates, numbers or filler; CJK runs split into character pairs. */
function words(title) {
  const out = new Set();
  for (const [w] of title.toLowerCase().matchAll(/[\p{L}\p{N}]+/gu)) {
    if (/\d/.test(w) || IGNORED_WORDS.has(w)) continue;
    if (CJK.test(w)) {
      for (let i = 0; i < Math.max(1, w.length - 1); i++) out.add(w.slice(i, i + 2));
    } else {
      out.add(w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);
    }
  }
  return out;
}

/** Dice coefficient of two titles' word sets, 0–1. */
function similarity(a, b) {
  const wa = words(a);
  const wb = words(b);
  if (!wa.size || !wb.size) return a === b ? 1 : 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return (2 * shared) / (wa.size + wb.size);
}

/**
 * Picks the video in `videos` that is the same camera as the stream. `lead` requires the best match to beat the
 * runner-up by that margin. With no title to compare against, only a channel-only stream may take the first video.
 */
function pickSameCamera(videos, { match, title, channelOnly }, lead) {
  if (match) return videos.find((v) => v.title.toLowerCase().includes(match.toLowerCase())) ?? null;
  if (title == null) return channelOnly ? (videos[0] ?? null) : null;
  const scored = videos.map((v) => ({ v, score: similarity(title, v.title) }));
  const best = scored.reduce((a, b) => (b.score > a.score ? b : a), { v: null, score: -1 });
  if (best.score < MIN_SIMILARITY) return null;
  const runnerUp = Math.max(-1, ...scored.filter((s) => s !== best).map((s) => s.score));
  // An identical title is the strongest signal there is, even when a sibling camera's differs by one word.
  if (lead && runnerUp >= (best.score === 1 ? 1 : best.score - lead)) return null;
  return best.v;
}

/** Decides what a stream should point at now. Returns { videoId, status, note } or null to leave it alone. */
async function resolve(stream) {
  const { videoId, channelId, match } = stream.youtube;
  const { lives, recordings } = await channelStreams(channelId);

  if (videoId && lives.some((l) => l.videoId === videoId)) return { videoId, status: undefined, note: 'live' };

  let title = null;
  if (videoId) {
    // Not in the channel's live list: either it ended, or the list is cut off (channels with dozens of cameras).
    const info = await videoInfo(videoId);
    if (info?.live) return { videoId, status: undefined, note: 'live' };
    title = info?.title ?? recordings.find((r) => r.videoId === videoId)?.title ?? null;
  }
  const camera = { match, title, channelOnly: !videoId };

  const live = pickSameCamera(lives, camera, MIN_LEAD);
  if (live) return { videoId: live.videoId, status: undefined, note: `live: ${live.title}` };

  // Recordings of a daily stream all share a title, so take the newest good match rather than demanding a lead.
  const ownRecording = recordings.find((r) => r.videoId === videoId);
  const newest = pickNewest(recordings, camera, ownRecording);
  if (newest) return { videoId: newest.videoId, status: 'replay', note: `replay: ${newest.title}` };

  return { videoId, status: 'offline', note: 'off air, no recording available' };
}

/**
 * The newest full-length recording of the same camera, else its newest fragment. The stream's own recording
 * counts as a match whatever its title.
 */
function pickNewest(recordings, camera, ownRecording) {
  const same = recordings.filter((r) => r === ownRecording || pickSameCamera([r], camera, 0));
  return same.find((r) => r.seconds == null || r.seconds >= MIN_REPLAY_SECONDS) ?? same[0] ?? null;
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const summaryIndex = args.indexOf('--summary');
const summaryPath = summaryIndex >= 0 ? args[summaryIndex + 1] : null;
const streamsPath =
  args.find((a, i) => !a.startsWith('--') && i !== summaryIndex + 1) ??
  new URL('../src/data/streams.json', import.meta.url);

const streams = JSON.parse(await readFile(streamsPath, 'utf8'));
const changes = [];
let failures = 0;

for (const s of streams) {
  let next;
  try {
    next = await resolve(s);
  } catch (err) {
    failures++;
    console.log(`⚠️ ${s.id}  —  skipped: ${err.message}`);
    continue;
  }
  const changed = next.videoId !== s.youtube.videoId || next.status !== s.status;
  console.log(`${changed ? '🔄' : '  '} ${s.id}  —  ${next.note}`);
  if (!changed) continue;

  const from = `${s.youtube.videoId ?? 'channel'}${s.status ? ` (${s.status})` : ''}`;
  const to = `${next.videoId ?? 'channel'}${next.status ? ` (${next.status})` : ''}`;
  changes.push(`${s.id}: ${from} → ${to}`);
  if (next.videoId) s.youtube.videoId = next.videoId;
  if (next.status) s.status = next.status;
  else delete s.status;
}

console.log(`\n${changes.length} changed, ${failures} skipped, ${streams.length} streams`);
if (changes.length && !dryRun) await writeFile(streamsPath, `${JSON.stringify(streams, null, 2)}\n`);
if (summaryPath) await writeFile(summaryPath, changes.map((c) => `- ${c}\n`).join(''));
// Every stream failing means the API or its response format changed; fail loudly instead of silently idling.
process.exit(failures === streams.length ? 1 : 0);
