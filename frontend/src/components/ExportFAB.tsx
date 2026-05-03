import React, { useState, useRef, useEffect } from 'react';
import { Download, FileText, FileSpreadsheet, X } from 'lucide-react';

interface ExportFABProps {
  onExportPdf?: (() => void) | null;
  onExportPdfBackend?: (() => void) | null;
  onExportCSV?: (() => void) | null;
  onExportExcel?: (() => void) | null;
}

export default function ExportFAB({ onExportPdf, onExportPdfBackend, onExportCSV, onExportExcel }: ExportFABProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const items = [
    { label: 'PDF', icon: <Download size={16} />, onClick: onExportPdf, color: 'var(--action-primary-bg)' },
    { label: 'PDF (backend)', icon: <Download size={16} />, onClick: onExportPdfBackend, color: 'var(--action-secondary-bg)' },
    { label: 'CSV', icon: <FileText size={16} />, onClick: onExportCSV, color: 'var(--action-success-bg)' },
    { label: 'Excel', icon: <FileSpreadsheet size={16} />, onClick: onExportExcel, color: 'var(--action-primary-bg)' },
  ].filter((i) => i.onClick);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="export-fab">
      {open && (
        <div className="export-fab-menu" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              className="export-fab-item"
              style={{ backgroundColor: item.color }}
              onClick={() => { item.onClick?.(); setOpen(false); }}
              role="menuitem"
              type="button"
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
      <button
        className="export-fab-trigger"
        onClick={() => setOpen((p) => !p)}
        aria-label="Exporter"
        aria-expanded={open}
        type="button"
      >
        {open ? <X size={24} /> : <Download size={24} />}
      </button>
    </div>
  );
}
