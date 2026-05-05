import { useState, useEffect, useRef } from 'react';
import { useExportPDF } from './useExportPDF';
import { useGlobalShortcuts } from './useGlobalShortcuts';

export function useTestClosure({ isOpen, metrics, project, onClose, showToast, t }: any) {
  const [version, setVersion] = useState('');
  const [environment, setEnvironment] = useState(t('testClosure.defaultEnvironment'));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [decision, setDecision] = useState('GO_PRODUCTION');
  const [residualRisks, setResidualRisks] = useState('');
  const [signOffs, setSignOffs] = useState('');
  const [bugs, setBugs] = useState([{ id: 1, desc: '', severity: 'Majeur' }]);

  const { exportPDF, isExporting } = useExportPDF({
    orientation: 'portrait',
    backgroundColor: '#FFFFFF',
    preCapture: true,
    multiPage: true,
  });
  const pdfRefExec = useRef<HTMLDivElement>(null);
  const pdfRefDetails = useRef<HTMLDivElement>(null);

  // === Default Values Calculation (Version & Dates) ===
  useEffect(() => {
    if (isOpen && metrics && metrics.runs) {
      // 1. Version Logic
      const standardRuns = metrics.runs.filter((r: any) => !r.isExploratory);
      if (standardRuns.length > 0) {
        const versionRegex = /R\d+[a-zA-Z]?/gi;
        let versionsFound: string[] = [];

        standardRuns.forEach((r: any) => {
          const matches = r.name.match(versionRegex);
          if (matches) {
            versionsFound.push(...matches);
          } else {
            versionsFound.push(r.name);
          }
        });

        versionsFound.sort((a, b) => {
          return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });

        const highestVersion = versionsFound.length > 0 ? versionsFound[versionsFound.length - 1] : '';
        setVersion(highestVersion);
      } else {
        setVersion('');
      }

      // 2. Dates Logic
      if (metrics.runs.length > 0) {
        const allDates = metrics.runs
          .map((r: any) => new Date(r.created_at))
          .filter((d: any) => !isNaN(d.getTime()))
          .sort((a: any, b: any) => a - b);

        if (allDates.length > 0) {
          setStartDate(allDates[0].toISOString().split('T')[0]);
        }

        const runsMajorityPassed = metrics.runs
          .filter((r: any) => r.passRate > 50)
          .map((r: any) => new Date(r.created_at))
          .filter((d: any) => !isNaN(d.getTime()))
          .sort((a: any, b: any) => b - a);

        if (runsMajorityPassed.length > 0) {
          setEndDate(runsMajorityPassed[0].toISOString().split('T')[0]);
        } else if (allDates.length > 0) {
          setEndDate(allDates[allDates.length - 1].toISOString().split('T')[0]);
        }
      }
    }
  }, [isOpen, metrics]);

  // === Bug List Handlers ===
  const addBug = () => setBugs([...bugs, { id: Date.now(), desc: '', severity: 'Majeur' }]);
  const removeBug = (id: number) => setBugs(bugs.filter((b) => b.id !== id));
  const updateBug = (id: number, field: string, value: string) => {
    setBugs(bugs.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  // === Export Logic ===
  const handleExport = async () => {
    try {
      await exportPDF(pdfRefExec.current, `1_Executive_Summary_${project?.name}_${version}.pdf`);
      await exportPDF(pdfRefDetails.current, `2_Rapport_Detaille_${project?.name}_${version}.pdf`);
      onClose();
    } catch (error) {
      console.error("Erreur lors de l'export PDF:", error);
      showToast(t('testClosure.exportError'), 'error');
    }
  };

  const m = metrics || { completionRate: 0, passRate: 0, failureRate: 0, testEfficiency: 0 };

  const isGo = decision === 'GO_PRODUCTION';
  const isGoReserve = decision === 'GO_RESERVE';
  const decisionColor = isGo ? 'var(--text-success)' : isGoReserve ? 'var(--text-warning)' : 'var(--text-danger)';

  const commonPDFStyle = {
    position: 'absolute' as const,
    left: '-9999px',
    top: 0,
    width: '210mm',
    minHeight: '297mm',
    backgroundColor: '#FFFFFF',
    color: '#111827',
    padding: '20mm',
    fontFamily: 'Arial, sans-serif',
    boxSizing: 'border-box' as const,
  };

  useGlobalShortcuts({
    onClose: isOpen ? onClose : undefined,
    onSave: isOpen ? handleExport : undefined,
  });

  return {
    version,
    setVersion,
    environment,
    setEnvironment,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    decision,
    setDecision,
    residualRisks,
    setResidualRisks,
    signOffs,
    setSignOffs,
    bugs,
    addBug,
    removeBug,
    updateBug,
    handleExport,
    isExporting,
    m,
    isGo,
    isGoReserve,
    decisionColor,
    pdfRefExec,
    pdfRefDetails,
    commonPDFStyle,
  };
}
