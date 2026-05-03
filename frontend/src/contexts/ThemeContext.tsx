import React, { createContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';

export const ThemeContext = createContext(null);

function getSystemPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
}

export function ThemeProvider({ children }) {
  const manualOverrideRef = useRef(false);

  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('testmo_darkMode');
    return saved !== null ? saved === 'true' : getSystemPrefersDark();
  });
  const [tvMode, setTvMode] = useState(() => localStorage.getItem('testmo_tvMode') !== 'false');

  const toggleDark = useCallback(() => {
    manualOverrideRef.current = true;
    setIsDark((prev) => !prev);
  }, []);
  const toggleTv = useCallback(() => setTvMode((prev) => !prev), []);

  useEffect(() => {
    try {
      localStorage.setItem('testmo_darkMode', String(isDark));
      localStorage.setItem('testmo_tvMode', String(tvMode));
    } catch (err) {
      console.warn('localStorage quota exceeded:', err);
    }
  }, [isDark, tvMode]);

  // Sync cross-onglets via événement storage
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'testmo_darkMode') {
        setIsDark(e.newValue === 'true');
      }
      if (e.key === 'testmo_tvMode') {
        setTvMode(e.newValue !== 'false');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Suivi de la préférence système quand aucun override manuel
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const handler = (e) => {
      if (!manualOverrideRef.current) {
        setIsDark(e.matches);
      }
    };
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  const value = useMemo(() => ({ isDark, toggleDark, tvMode, toggleTv }), [isDark, toggleDark, tvMode, toggleTv]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
