#!/usr/bin/env node
// Checks every stream in src/data/streams.json: is it live right now, and can it be embedded?
// For a stream that fails, lists the channel's current live videos so you can pick a replacement.
// Usage: npm run check-streams

import { readFile } from 'node:fs/promises';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
  'Accept-Language': 'en-US',
  Cookie: 'SOCS=CAI; CONSENT=YES+1',
};
const DELAY_MS = 1500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseInitialData(html, name) {
  const m = html.match(new RegExp(`var ${name} = (\\{.*?\\});(?:var |</script>)`, 's'));
  return m ? JSON.parse(m[1]) : null;
}

async function checkVideo(videoId) {
  const html = await fetchHtml(`https://www.youtube.com/watch?v=${videoId}`);
  const player = parseInitialData(html, 'ytInitialPlayerResponse');
  if (!player) return { ok: false, reason: 'no player data' };
  const details = player.videoDetails ?? {};
  const live = player.microformat?.playerMicroformatRenderer?.liveBroadcastDetails?.isLiveNow === true;
  const embeddable = player.playabilityStatus?.playableInEmbed !== false;
  const status = player.playabilityStatus?.status;
  if (status !== 'OK') return { ok: false, reason: `status ${status}`, title: details.title };
  if (!live) return { ok: false, reason: 'not live now', title: details.title };
  if (!embeddable) return { ok: false, reason: 'embedding disabled', title: details.title };
  return { ok: true, title: details.title };
}

async function channelLives(channelId) {
  const html = await fetchHtml(`https://www.youtube.com/channel/${channelId}/streams`);
  const data = parseInitialData(html, 'ytInitialData');
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

const streams = JSON.parse(await readFile(new URL('../src/data/streams.json', import.meta.url), 'utf8'));
let failures = 0;

for (const s of streams) {
  const { videoId, channelId } = s.youtube;
  let result;
  try {
    if (videoId) {
      result = await checkVideo(videoId);
    } else {
      const lives = await channelLives(channelId);
      result = lives.length ? await checkVideo(lives[0].videoId) : { ok: false, reason: 'channel has no live stream' };
    }
  } catch (err) {
    result = { ok: false, reason: err.message };
  }

  if (result.ok) {
    console.log(`✅ ${s.id}  —  ${result.title}`);
  } else {
    failures++;
    console.log(`❌ ${s.id}  —  ${result.reason}${result.title ? `  (${result.title})` : ''}`);
    if (channelId) {
      await sleep(DELAY_MS);
      try {
        const lives = await channelLives(channelId);
        for (const l of lives) console.log(`     ↳ live on channel: ${l.videoId}  ${l.title}`);
        if (!lives.length) console.log('     ↳ channel has no live streams right now');
      } catch (err) {
        console.log(`     ↳ could not list channel: ${err.message}`);
      }
    }
  }
  await sleep(DELAY_MS);
}

console.log(`\n${streams.length - failures}/${streams.length} streams OK`);
process.exit(failures ? 1 : 0);
