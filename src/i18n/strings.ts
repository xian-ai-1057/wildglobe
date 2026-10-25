import type { Lang } from '../data/types';

const zhTW = {
  title: 'WildGlobe 野生地球',
  tagline: (streams: number, countries: number) => `${countries} 個國家・${streams} 個野生動物直播`,
  searchPlaceholder: '搜尋國家…',
  noResults: '找不到這個國家',
  streamCount: (n: number) => `${n} 個直播`,
  noStreams: '這個國家還沒有收錄直播。',
  suggest: '推薦一個直播',
  close: '關閉',
  live: '直播中',
  replay: '重播',
  offline: '離線',
  replayNote: '目前不在直播時段，正在播放最近一次直播的錄影。',
  offlineNote: '這個攝影機目前離線，恢復直播後會自動更新。',
  source: '來源',
  openOnYouTube: '在 YouTube 開啟',
  random: '隨機看一個',
  hint: '拖曳旋轉地球，點選發光的國家',
  switchLang: 'English',
};

export type Strings = typeof zhTW;

const en: Strings = {
  title: 'WildGlobe',
  tagline: (streams, countries) => `${streams} wildlife live streams in ${countries} countries`,
  searchPlaceholder: 'Search a country…',
  noResults: 'No country found',
  streamCount: (n) => `${n} live stream${n === 1 ? '' : 's'}`,
  noStreams: 'No live streams listed for this country yet.',
  suggest: 'Suggest a stream',
  close: 'Close',
  live: 'LIVE',
  replay: 'REPLAY',
  offline: 'OFF AIR',
  replayNote: 'Off air right now — playing the latest broadcast.',
  offlineNote: 'This camera is off air right now; it will be back once it goes live again.',
  source: 'Source',
  openOnYouTube: 'Open on YouTube',
  random: 'Surprise me',
  hint: 'Drag to spin the globe, tap a glowing country',
  switchLang: '中文',
};

export const strings: Record<Lang, Strings> = { 'zh-TW': zhTW, en };
