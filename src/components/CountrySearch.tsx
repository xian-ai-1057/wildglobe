import { useMemo, useState } from 'react';
import { countries, countriesWithStreams, countryName, type Country } from '../data/countries';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  onSelect: (country: Country) => void;
}

export default function CountrySearch({ onSelect }: Props) {
  const { lang, t } = useI18n();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? countries.filter((c) =>
          [countryName(c, 'zh-TW'), countryName(c, 'en'), c.englishName, c.code ?? ''].some((n) =>
            n.toLowerCase().includes(q),
          ),
        )
      : countriesWithStreams;
    return [...pool]
      .sort(
        (a, b) => b.streams.length - a.streams.length || countryName(a, lang).localeCompare(countryName(b, lang), lang),
      )
      .slice(0, 12);
  }, [query, lang]);

  const pick = (c: Country) => {
    onSelect(c);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="search" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <input
        type="search"
        value={query}
        placeholder={t.searchPlaceholder}
        aria-label={t.searchPlaceholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) pick(results[0]);
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && (
        <ul className="search-results">
          {results.length === 0 && <li className="muted empty">{t.noResults}</li>}
          {results.map((c) => (
            <li key={c.code ?? c.englishName}>
              <button onClick={() => pick(c)}>
                <span>{countryName(c, lang)}</span>
                {c.streams.length > 0 && <span className="count">{c.streams.length}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
