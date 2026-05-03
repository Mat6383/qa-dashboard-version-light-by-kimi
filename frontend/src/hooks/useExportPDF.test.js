import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import html2canvas from 'html2canvas';
import * as jspdfModule from 'jspdf';
import { useExportPDF } from './useExportPDF';

const mockShowToast = vi.fn();

vi.mock('./useToast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock('html2canvas', () => ({
  __esModule: true,
  default: vi.fn(() =>
    Promise.resolve({
      toDataURL: () => 'data:image/png;base64,xxx',
      height: 1000,
      width: 2000,
    })
  ),
}));

function createMockPdf() {
  return {
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    addImage: vi.fn(),
    save: vi.fn(),
    addPage: vi.fn(),
  };
}

vi.mock('jspdf', () => ({
  __esModule: true,
  jsPDF: function JsPDFMock() {
    return createMockPdf();
  },
}));

describe('useExportPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exporte un PDF en mode portrait par défaut', async () => {
    const jsPDFSpy = vi.spyOn(jspdfModule, 'jsPDF').mockImplementation(function () {
      return createMockPdf();
    });

    const { result } = renderHook(() => useExportPDF());
    const element = document.createElement('div');

    await act(async () => {
      await result.current.exportPDF(element, 'test.pdf');
    });

    expect(html2canvas).toHaveBeenCalledWith(
      element,
      expect.objectContaining({
        scale: 2,
        useCORS: true,
        backgroundColor: '#FFFFFF',
        logging: false,
      })
    );

    expect(jsPDFSpy).toHaveBeenCalledWith(
      expect.objectContaining({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    );
  });

  it('passe isExporting à true pendant le traitement', async () => {
    const { result } = renderHook(() => useExportPDF());
    const element = document.createElement('div');

    expect(result.current.isExporting).toBe(false);

    let promise;
    act(() => {
      promise = result.current.exportPDF(element, 'test.pdf');
    });

    expect(result.current.isExporting).toBe(true);

    await act(async () => {
      await promise;
    });

    expect(result.current.isExporting).toBe(false);
  });

  it('supporte le mode landscape via les options par défaut', async () => {
    const jsPDFSpy = vi.spyOn(jspdfModule, 'jsPDF').mockImplementation(function () {
      return createMockPdf();
    });

    const { result } = renderHook(() => useExportPDF({ orientation: 'landscape' }));
    const element = document.createElement('div');

    await act(async () => {
      await result.current.exportPDF(element, 'landscape.pdf');
    });

    expect(jsPDFSpy).toHaveBeenCalledWith(expect.objectContaining({ orientation: 'landscape' }));
  });

  it('supporte le backgroundColor custom', async () => {
    const { result } = renderHook(() => useExportPDF({ backgroundColor: '#111827' }));
    const element = document.createElement('div');

    await act(async () => {
      await result.current.exportPDF(element, 'dark.pdf');
    });

    expect(html2canvas).toHaveBeenCalledWith(element, expect.objectContaining({ backgroundColor: '#111827' }));
  });

  it('gère preCapture (display temporaire)', async () => {
    const { result } = renderHook(() => useExportPDF({ preCapture: true }));
    const element = document.createElement('div');
    element.style.display = 'none';

    await act(async () => {
      await result.current.exportPDF(element, 'hidden.pdf');
    });

    expect(element.style.display).toBe('none'); // restauré
  });

  it('affiche un toast en cas d’erreur html2canvas', async () => {
    vi.mocked(html2canvas).mockRejectedValueOnce(new Error('canvas failed'));

    const { result } = renderHook(() => useExportPDF());
    const element = document.createElement('div');

    await act(async () => {
      await expect(result.current.exportPDF(element, 'fail.pdf')).rejects.toThrow('canvas failed');
    });

    expect(mockShowToast).toHaveBeenCalledWith('Erreur lors de la génération du PDF', 'error');
  });

  it('ignore les appels si element est null', async () => {
    const { result } = renderHook(() => useExportPDF());
    await act(async () => {
      await result.current.exportPDF(null, 'null.pdf');
    });
    expect(html2canvas).not.toHaveBeenCalled();
  });
});
