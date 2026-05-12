import React, { useRef, useEffect } from 'react';
import {
  Download,
  ChevronDown,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';

export default function ExportMenu({
  currentPath,
  exportHandler,
  onExportPdfBackend,
  onExportCSV,
  onExportExcel,
  t,
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  if (currentPath !== '/global-view') return null;
  if (!exportHandler && !onExportPdfBackend && !onExportCSV && !onExportExcel) return null;

  return (
    <div className="export-dropdown" ref={menuRef}>
      <button
        className="btn-icon"
        onClick={() => setMenuOpen((prev) => !prev)}
        title={t('layout.export')}
        type="button"
        aria-haspopup="true"
        aria-expanded={menuOpen}
      >
        <Download size={16} />
        <ChevronDown size={14} />
      </button>
      {menuOpen && (
        <div className="export-dropdown-menu" role="menu">
          {exportHandler && (
            <button className="export-dropdown-item" onClick={() => { exportHandler(); setMenuOpen(false); }} role="menuitem" type="button">
              <Download size={14} /> {t('layout.exportPdf')}
            </button>
          )}
          {onExportPdfBackend && (
            <button className="export-dropdown-item" onClick={() => { onExportPdfBackend(); setMenuOpen(false); }} role="menuitem" type="button">
              <Download size={14} /> {t('layout.exportPdfBackend')}
            </button>
          )}
          {onExportCSV && (
            <button className="export-dropdown-item" onClick={() => { onExportCSV(); setMenuOpen(false); }} role="menuitem" type="button">
              <FileText size={14} /> {t('layout.exportCsv')}
            </button>
          )}
          {onExportExcel && (
            <button className="export-dropdown-item" onClick={() => { onExportExcel(); setMenuOpen(false); }} role="menuitem" type="button">
              <FileSpreadsheet size={14} /> {t('layout.exportExcel')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
