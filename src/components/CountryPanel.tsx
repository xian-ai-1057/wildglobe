import { countryName, type Country } from '../data/countries';
import type { Stream } from '../data/types';
import { useI18n } from '../i18n/I18nContext';

const REPO_ISSUES = 'https://github.com/xian-ai-1057/wildglobe/issues/new';

interface Props {
  country: Country;
  onClose: () => void;
  onSelectStream: (stream: Stream) => void;
}

function thumbnailUrl(stream: Stream) {
  const { videoId } = stream.youtube;
  if (!videoId) return null;
  return `https://i.ytimg.com/vi/${videoId}/${stream.status ? 'mqdefault.jpg' : 'mqdefault_live.jpg'}`;
}

export default function CountryPanel({ country, onClose, onSelectStream }: Props) {
  const { lang, t } = useI18n();
  const name = countryName(country, lang);

  return (
    <aside className="panel" aria-label={name}>
      <header className="panel-header">
        <div>
          <h2>{name}</h2>
          <p className="muted">{country.streams.length ? t.streamCount(country.streams.length) : t.noStreams}</p>
        </div>
        <button className="icon-button" onClick={onClose} aria-label={t.close}>
          ✕
        </button>
      </header>

      {country.streams.length > 0 ? (
        <ul className="stream-list">
          {country.streams.map((s) => {
            const thumb = thumbnailUrl(s);
            return (
              <li key={s.id}>
                <button className="stream-card" onClick={() => onSelectStream(s)}>
                  <div className="thumb">
                    {thumb && <img src={thumb} alt="" loading="lazy" />}
                    <span className={`live-badge ${s.status ?? ''}`}>{s.status ? t[s.status] : `● ${t.live}`}</span>
                  </div>
                  <div className="stream-info">
                    <strong>{s.name[lang]}</strong>
                    <span>{s.animals[lang]}</span>
                    <span className="muted small">
                      {t.source}: {s.source}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <a className="suggest-link" href={REPO_ISSUES} target="_blank" rel="noreferrer">
          {t.suggest} →
        </a>
      )}
    </aside>
  );
}
