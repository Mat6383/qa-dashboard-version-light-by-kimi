/**
 * ================================================
 * USE EXPORT PDF — Hook réutilisable d'export PDF
 * ================================================
 * Centralise la logique html2canvas + jsPDF utilisée par
 * Dashboard4 (vue globale) et TestClosureModal (rapport de clôture).
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useToast } from './useToast';

/**
 * Hook d'export PDF.
 *
 * @param {object} defaultOptions - Options par défaut pour tous les exports
 * @param {string} [defaultOptions.orientation='portrait'] - 'portrait' | 'landscape'
 * @param {string} [defaultOptions.backgroundColor='#FFFFFF'] - Couleur de fond canvas
 * @param {number} [defaultOptions.scale=2] - Échelle html2canvas
 * @param {boolean} [defaultOptions.logging=false] - Logs html2canvas
 * @param {boolean} [defaultOptions.preCapture=false] - Force display:block temporairement
 * @param {boolean} [defaultOptions.multiPage=false] - Pagination auto si contenu trop long
 */
export interface ExportPDFOptions {
  orientation?: 'portrait' | 'landscape';
  backgroundColor?: string;
  scale?: number;
  logging?: boolean;
  preCapture?: boolean;
  multiPage?: boolean;
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
        // Certains éléments sont cachés (position:absolute; left:-9999px)
        // il faut les rendre visibles le temps de la capture
        const originalDisplay = opts.preCapture ? element.style.display : undefined;
        if (opts.preCapture) {
          element.style.display = 'block';
        }

        const canvas = await html2canvas(element, {
          scale: opts.scale ?? 2,
          useCORS: true,
          backgroundColor: opts.backgroundColor ?? '#FFFFFF',
          logging: opts.logging ?? false,
        });

        if (opts.preCapture) {
          element.style.display = originalDisplay;
        }

        const imgData = canvas.toDataURL('image/png');
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
        console.error("Erreur lors de l'export PDF:", error);
        showToast('Erreur lors de la génération du PDF', 'error');
        throw error;
      } finally {
        setIsExporting(false);
      }
    },
    [defaultOptions, showToast]
  );

  return { exportPDF, isExporting };
}
