/**
 * ================================================
 * USE EXPORT PDF — Hook réutilisable d'export PDF/PNG
 * ================================================
 * Centralise la logique html2canvas + jsPDF utilisée par
 * Dashboard4 (vue globale), TestClosureModal (rapport de clôture),
 * et l'Option C "Pro Suite" (export par carte).
 *
 * Les librairies lourdes sont chargées dynamiquement pour éviter
 * d'impact le bundle initial (lazy-load au niveau feature).
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 1.2.0
 */

import { useState, useCallback } from 'react';
import { useToast } from './useToast';

export interface ExportPDFOptions {
  orientation?: 'portrait' | 'landscape';
  backgroundColor?: string;
  scale?: number;
  logging?: boolean;
  preCapture?: boolean;
  multiPage?: boolean;
  format?: 'pdf' | 'png';
}

export function useExportPDF(defaultOptions: ExportPDFOptions = {}) {
  const [isExporting, setIsExporting] = useState(false);
  const { showToast } = useToast();

  const exportPDF = useCallback(
    async (element: HTMLElement | null, filename: string, callOptions: ExportPDFOptions = {}) => {
      if (!element) return;

      const opts = { ...defaultOptions, ...callOptions };
      setIsExporting(true);

      try {
        // Lazy-load des librairies d'export lourdes
        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
          import('html2canvas'),
          import('jspdf'),
        ]);

        const originalDisplay = opts.preCapture ? element.style.display : undefined;
        if (opts.preCapture) {
          element.style.display = 'block';
        }

        let scale = opts.scale ?? 2;
        const pixelCount = element.offsetWidth * element.offsetHeight * scale * scale;
        const MAX_PIXELS = 32_000_000; // ~32 MP to avoid memory blow-up
        if (pixelCount > MAX_PIXELS) {
          scale = Math.max(1, Math.floor(Math.sqrt(MAX_PIXELS / (element.offsetWidth * element.offsetHeight))));
        }

        const canvas = await html2canvas(element, {
          scale,
          useCORS: true,
          backgroundColor: opts.backgroundColor ?? '#FFFFFF',
          logging: opts.logging ?? false,
        });

        if (opts.preCapture) {
          element.style.display = originalDisplay || '';
        }

        const imgData = canvas.toDataURL('image/png');

        // Option PNG : téléchargement direct
        if (opts.format === 'png') {
          const link = document.createElement('a');
          link.download = filename.replace(/\.pdf$/i, '.png');
          link.href = imgData;
          link.click();
          setIsExporting(false);
          return;
        }

        const pdf = new jsPDF({
          orientation: opts.orientation || 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        if (opts.multiPage) {
          let heightLeft = pdfHeight;
          let position = 0;
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= pdf.internal.pageSize.getHeight();
          while (heightLeft >= 0) {
            position = heightLeft - pdfHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
            heightLeft -= pdf.internal.pageSize.getHeight();
          }
        } else {
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        }

        pdf.save(filename);
      } catch (error) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error("Erreur lors de l'export:", error);
        }
        showToast("Erreur lors de la génération de l'export", 'error');
        throw error;
      } finally {
        setIsExporting(false);
      }
    },
    [defaultOptions, showToast]
  );

  /**
   * Exporte un élément HTML isolé en PNG ou PDF.
   * Par défaut : PNG (rapide pour Slack/Teams).
   */
  const exportElement = useCallback(
    async (element: HTMLElement | null, filename: string, options?: ExportPDFOptions) => {
      if (!element) return;
      const opts = { format: 'png' as const, scale: 2, ...options };
      await exportPDF(element, filename, opts);
    },
    [exportPDF]
  );

  return { exportPDF, exportElement, isExporting };
}
