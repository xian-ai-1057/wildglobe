export type Lang = 'zh-TW' | 'en';

export type Localized = Record<Lang, string>;

export interface Stream {
  id: string;
  /** ISO 3166-1 alpha-2 */
  country: string;
  /** Approximate camera location */
  lat: number;
  lng: number;
  name: Localized;
  animals: Localized;
  /**
   * videoId wins when present; otherwise the channel's current live stream is embedded.
   * match: text in the video title that tells this camera apart from the channel's other live streams.
   */
  youtube: { videoId?: string; channelId: string; match?: string };
  source: string;
  /**
   * Set by scripts/update-streams.mjs: 'replay' while the camera is off air and videoId is its latest recording,
   * 'offline' when there is no recording to fall back on. Absent while live.
   */
  status?: 'replay' | 'offline';
}
