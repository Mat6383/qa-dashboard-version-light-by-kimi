import React, { createContext, useState, useEffect, useMemo } from 'react';

export const PreferencesContext = createContext(null);

export function PreferencesProvider({ children }) {
  const [useBusinessTerms, setUseBusinessTerms] = useState(
    () => localStorage.getItem('testmo_useBusinessTerms') !== 'false'
  );
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedPreprodMilestones, setSelectedPreprodMilestones] = useState(() => {
    const saved = localStorage.getItem('testmo_selectedPreprodMilestones');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedProdMilestones, setSelectedProdMilestones] = useState(() => {
    const saved = localStorage.getItem('testmo_selectedProdMilestones');
    return saved ? JSON.parse(saved) : [];
  });
  const [showProductionSection, setShowProductionSection] = useState(() => {
    const saved = localStorage.getItem('testmo_showProductionSection');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    try {
      localStorage.setItem('testmo_useBusinessTerms', String(useBusinessTerms));
      localStorage.setItem('testmo_selectedPreprodMilestones', JSON.stringify(selectedPreprodMilestones));
      localStorage.setItem('testmo_selectedProdMilestones', JSON.stringify(selectedProdMilestones));
      localStorage.setItem('testmo_showProductionSection', String(showProductionSection));
    } catch (err) {
      console.warn('localStorage quota exceeded:', err);
    }
  }, [useBusinessTerms, selectedPreprodMilestones, selectedProdMilestones, showProductionSection]);

  // Sync cross-onglets via événement storage
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'testmo_useBusinessTerms') {
        setUseBusinessTerms(e.newValue !== 'false');
      }
      if (e.key === 'testmo_selectedPreprodMilestones') {
        try {
          setSelectedPreprodMilestones(JSON.parse(e.newValue || '[]'));
        } catch {
          /* ignore */
        }
      }
      if (e.key === 'testmo_selectedProdMilestones') {
        try {
          setSelectedProdMilestones(JSON.parse(e.newValue || '[]'));
        } catch {
          /* ignore */
        }
      }
      if (e.key === 'testmo_showProductionSection') {
        setShowProductionSection(e.newValue !== 'false');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const value = useMemo(
    () => ({
      useBusinessTerms,
      setUseBusinessTerms,
      autoRefresh,
      setAutoRefresh,
      selectedPreprodMilestones,
      setSelectedPreprodMilestones,
      selectedProdMilestones,
      setSelectedProdMilestones,
      showProductionSection,
      setShowProductionSection,
    }),
    [useBusinessTerms, autoRefresh, selectedPreprodMilestones, selectedProdMilestones, showProductionSection]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}
