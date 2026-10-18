import { useEffect, useRef, useState, type MouseEvent } from 'react';
import ReactGlobe, { type GlobeMethods, type GlobeProps } from 'react-globe.gl';
import { countries, countryAt, countryName, streams, type Country } from '../data/countries';
import type { Stream } from '../data/types';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  selected: Country | null;
  onSelectCountry: (country: Country) => void;
  onSelectStream: (stream: Stream) => void;
}

// Pointer travel (px) beyond which a press counts as a drag, not a tap
const TAP_SLOP = 6;

const COLORS = {
  cap: 'rgba(74, 222, 128, 0.32)',
  capHover: 'rgba(74, 222, 128, 0.55)',
  capSelected: 'rgba(250, 204, 21, 0.55)',
  capEmpty: 'rgba(255, 255, 255, 0.02)',
  capEmptyHover: 'rgba(255, 255, 255, 0.12)',
  stroke: 'rgba(255, 255, 255, 0.25)',
  side: 'rgba(0, 0, 0, 0.15)',
  point: '#bbf7d0',
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

// globe.gl's typings declare coordinates as number[]; real GeoJSON geometry is what it expects at runtime.
const geometryOf = ((d: object) => (d as Country).feature.geometry) as unknown as GlobeProps['polygonGeoJsonGeometry'];

function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

export default function Globe({ selected, onSelectCountry, onSelectStream }: Props) {
  const { lang, t } = useI18n();
  const globeRef = useRef<GlobeMethods>(undefined);
  const [hovered, setHovered] = useState<Country | null>(null);
  const pressAt = useRef<{ x: number; y: number } | null>(null);
  const { width, height } = useWindowSize();
  const isMobile = width < 768;

  // Keep the picked country visible beside the side panel (desktop) or above the bottom sheet (mobile).
  const globeOffset: [number, number] = !selected ? [0, 0] : isMobile ? [0, -height * 0.12] : [-200, 0];

  // Spin slowly until a country is picked; fly the camera to the pick.
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    controls.autoRotate = !selected;
    controls.autoRotateSpeed = 0.35;
    if (selected) {
      const altitude = window.innerWidth < 768 ? 3 : 1.7;
      globe.pointOfView({ ...selected.center, altitude }, 1200);
    }
  }, [selected]);

  const capColor = (c: Country) => {
    if (c === selected) return COLORS.capSelected;
    if (c.streams.length) return c === hovered ? COLORS.capHover : COLORS.cap;
    return c === hovered ? COLORS.capEmptyHover : COLORS.capEmpty;
  };

  // globe.gl resolves clicks from its throttled hover raycast, which can be stale on a quick touch tap.
  // Resolve the tapped country ourselves from the exact pointer position instead.
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const start = pressAt.current;
    if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP_SLOP) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const coords = globeRef.current?.toGlobeCoords(e.clientX - rect.left, e.clientY - rect.top);
    const country = coords && countryAt(coords.lat, coords.lng);
    if (country) onSelectCountry(country);
  };

  return (
    <div onPointerDown={(e) => (pressAt.current = { x: e.clientX, y: e.clientY })} onClick={handleClick}>
      <ReactGlobe
        ref={globeRef}
        width={width}
        height={height}
        globeOffset={globeOffset}
        globeImageUrl="/earth-blue-marble.jpg"
        bumpImageUrl="/earth-topology.png"
        backgroundImageUrl="/night-sky.png"
        atmosphereColor="#7dd3fc"
        atmosphereAltitude={0.18}
        onGlobeReady={() => {
          const controls = globeRef.current?.controls();
          if (controls) {
            controls.autoRotate = true;
            controls.autoRotateSpeed = 0.35;
          }
          globeRef.current?.pointOfView({ lat: 15, lng: 20, altitude: window.innerWidth < 768 ? 3.4 : 2.4 });
        }}
        polygonsData={countries}
        polygonGeoJsonGeometry={geometryOf}
        polygonCapColor={(d) => capColor(d as Country)}
        polygonSideColor={() => COLORS.side}
        polygonStrokeColor={() => COLORS.stroke}
        polygonAltitude={(d) => (d === hovered || d === selected ? 0.025 : 0.008)}
        polygonsTransitionDuration={250}
        polygonLabel={(d) => {
          const c = d as Country;
          const count = c.streams.length ? t.streamCount(c.streams.length) : t.noStreams;
          return `<div class="globe-tooltip"><b>${escapeHtml(countryName(c, lang))}</b><span>${escapeHtml(count)}</span></div>`;
        }}
        onPolygonHover={(d) => setHovered((d as Country) ?? null)}
        pointsData={streams}
        pointColor={() => COLORS.point}
        pointAltitude={0.03}
        pointRadius={0.32}
        pointsMerge={false}
        pointLabel={(d) => {
          const s = d as Stream;
          return `<div class="globe-tooltip"><b>${escapeHtml(s.name[lang])}</b><span>${escapeHtml(s.animals[lang])}</span></div>`;
        }}
        onPointClick={(d) => onSelectStream(d as Stream)}
        ringsData={streams}
        ringColor={() => (tt: number) => `rgba(134, 239, 172, ${1 - tt})`}
        ringMaxRadius={2.6}
        ringPropagationSpeed={1.6}
        ringRepeatPeriod={1400}
      />
    </div>
  );
}
