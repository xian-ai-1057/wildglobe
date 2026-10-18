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
  /** videoId wins when present; otherwise the channel's current live stream is embedded. */
  youtube: { videoId?: string; channelId: string };
  source: string;
}
