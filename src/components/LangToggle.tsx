import { useI18n } from '../i18n/I18nContext';

export default function LangToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <button className="pill-button" onClick={() => setLang(lang === 'zh-TW' ? 'en' : 'zh-TW')}>
      {t.switchLang}
    </button>
  );
}
