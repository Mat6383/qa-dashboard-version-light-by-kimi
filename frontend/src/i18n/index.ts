import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

export const initI18n = async () => {
  const cacheBust = import.meta.env.DEV ? `?t=${Date.now()}` : '';
  const frUrl = new URL('./locales/fr.json', import.meta.url).href + cacheBust;
  const enUrl = new URL('./locales/en.json', import.meta.url).href + cacheBust;

  const [frData, enData] = await Promise.all([
    fetch(frUrl).then((r) => r.json()),
    fetch(enUrl).then((r) => r.json()),
  ]);

  await i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        fr: { translation: frData },
        en: { translation: enData },
      },
      fallbackLng: 'fr',
      interpolation: { escapeValue: false },
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage'],
      },
    });

  if (import.meta.env.DEV) {
    console.log('[i18n] loaded via fetch');
    console.log('[i18n] notifications.tabs.channels =', frData.notifications?.tabs?.channels);
  }

  return i18n;
};

export default i18n;
