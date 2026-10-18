import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Lang } from '../data/types';
import { strings, type Strings } from './strings';

const STORAGE_KEY = 'wildglobe.lang';

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Strings;
}

const I18nContext = createContext<I18n | null>(null);

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'zh-TW' || saved === 'en') return saved;
  } catch {
    // storage unavailable; fall through to default
  }
  return 'zh-TW';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = strings[lang].title;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  }, [lang]);

  return <I18nContext.Provider value={{ lang, setLang, t: strings[lang] }}>{children}</I18nContext.Provider>;
}

// oxlint-disable-next-line react/only-export-components
export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
