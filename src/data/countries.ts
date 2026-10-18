import { geoArea, geoCentroid, geoContains } from 'd3-geo';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import countriesIso from 'i18n-iso-countries';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';
import type { Lang, Stream } from './types';
import streamsJson from './streams.json';

export const streams = streamsJson as Stream[];

export interface Country {
  /** ISO alpha-2, or null for the few disputed areas without one */
  code: string | null;
  englishName: string;
  feature: Feature<Polygon | MultiPolygon>;
  /** Centre of the largest landmass, used to aim the camera */
  center: { lat: number; lng: number };
  streams: Stream[];
}

// Areas in world-atlas without an ISO numeric id
const CODE_BY_NAME: Record<string, string> = { Kosovo: 'XK' };

function mainCenter(f: Feature<Polygon | MultiPolygon>) {
  let target: Feature<Polygon | MultiPolygon> = f;
  if (f.geometry.type === 'MultiPolygon') {
    const parts = f.geometry.coordinates.map((coordinates) => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'Polygon' as const, coordinates },
    }));
    target = parts.reduce((a, b) => (geoArea(b) > geoArea(a) ? b : a));
  }
  const [lng, lat] = geoCentroid(target);
  return { lat, lng };
}

const topology = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const features = feature(topology, topology.objects.countries).features as Feature<
  Polygon | MultiPolygon,
  { name: string }
>[];

export const countries: Country[] = features.map((f) => {
  const englishName = f.properties.name;
  const code =
    f.id != null ? (countriesIso.numericToAlpha2(String(f.id)) ?? null) : (CODE_BY_NAME[englishName] ?? null);
  return {
    code,
    englishName,
    feature: f,
    center: mainCenter(f),
    streams: code ? streams.filter((s) => s.country === code) : [],
  };
});

export const countryByCode = new Map(countries.filter((c) => c.code).map((c) => [c.code!, c]));

export const countriesWithStreams = countries.filter((c) => c.streams.length > 0);

const displayNames: Partial<Record<Lang, Intl.DisplayNames>> = {};

export function countryName(c: Country, lang: Lang): string {
  if (!c.code) return c.englishName;
  displayNames[lang] ??= new Intl.DisplayNames([lang], { type: 'region' });
  return displayNames[lang]!.of(c.code) ?? c.englishName;
}

export function countryAt(lat: number, lng: number): Country | null {
  return countries.find((c) => geoContains(c.feature, [lng, lat])) ?? null;
}
