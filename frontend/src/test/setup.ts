import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from '../i18n/locales/fr.json';
import en from '../i18n/locales/en.json';

expect.extend(matchers);

// Initialize i18n for tests
i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: 'fr',
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
});

afterEach(() => {
  cleanup();
});
