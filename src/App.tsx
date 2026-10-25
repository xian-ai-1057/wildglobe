import { useCallback, useState } from 'react';
import CountryPanel from './components/CountryPanel';
import CountrySearch from './components/CountrySearch';
import Globe from './components/Globe';
import LangToggle from './components/LangToggle';
import PlayerModal from './components/PlayerModal';
import { countriesWithStreams, countryByCode, streams, type Country } from './data/countries';
import type { Stream } from './data/types';
import { useI18n } from './i18n/I18nContext';

export default function App() {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Country | null>(null);
  const [playing, setPlaying] = useState<Stream | null>(null);

  const playStream = useCallback((s: Stream) => {
    setSelected(countryByCode.get(s.country) ?? null);
    setPlaying(s);
  }, []);

  const closePlayer = useCallback(() => setPlaying(null), []);

  const playRandom = () => {
    const onAir = streams.filter((s) => s.status !== 'offline');
    playStream(onAir[Math.floor(Math.random() * onAir.length)]);
  };

  return (
    <>
      <Globe selected={selected} onSelectCountry={setSelected} onSelectStream={playStream} />

      <header className="topbar">
        <div className="brand">
          <h1>{t.title}</h1>
          <p className="muted">{t.tagline(streams.length, countriesWithStreams.length)}</p>
        </div>
        <div className="controls">
          <CountrySearch onSelect={setSelected} />
          <button className="pill-button" onClick={playRandom} aria-label={t.random} title={t.random}>
            🎲 <span className="label">{t.random}</span>
          </button>
          <LangToggle />
        </div>
      </header>

      {!selected && <p className="hint">{t.hint}</p>}

      {selected && <CountryPanel country={selected} onClose={() => setSelected(null)} onSelectStream={setPlaying} />}

      {playing && <PlayerModal stream={playing} onClose={closePlayer} />}
    </>
  );
}
