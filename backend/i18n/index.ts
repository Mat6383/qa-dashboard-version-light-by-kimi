import i18n from 'i18next';
import fr from './locales/fr.json';
import en from './locales/en.json';

const resources = {
  fr: { translation: fr },
  en: { translation: en },
};

i18n.init({
  resources,
  lng: process.env.DEFAULT_LANGUAGE || 'fr',
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
});

export default i18n;
