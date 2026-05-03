/**
 * Tests unitaires du PdfService
 */

jest.mock('../../services/logger.service', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mockPage = {
  setContent: jest.fn().mockResolvedValue(),
  pdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4')),
  close: jest.fn().mockResolvedValue(),
  goto: jest.fn().mockResolvedValue(),
};

const mockBrowser = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn().mockResolvedValue(),
};

jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue(mockBrowser),
}));

// On réinitialise le singleton avant chaque test
delete require.cache[require.resolve('../../services/pdf.service')];
const pdfService = require('../../services/pdf.service').default;

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(async () => {
  await pdfService.close();
});

describe('PdfService', () => {
  it('lance un browser à la première génération', async () => {
    const puppeteer = require('puppeteer');
    await pdfService.generateFromHTML('<h1>Test</h1>');
    expect(puppeteer.launch).toHaveBeenCalledTimes(1);
    expect(pdfService.generationCount).toBe(1);
  });

  it('réutilise le browser existant', async () => {
    const puppeteer = require('puppeteer');
    await pdfService.generateFromHTML('<h1>A</h1>');
    await pdfService.generateFromHTML('<h1>B</h1>');
    expect(puppeteer.launch).toHaveBeenCalledTimes(1);
    expect(pdfService.generationCount).toBe(2);
  });

  it('recycle le browser après MAX_GENERATIONS', async () => {
    const puppeteer = require('puppeteer');
    const originalMax = process.env.PDF_MAX_GENERATIONS;
    process.env.PDF_MAX_GENERATIONS = '3';
    try {
      for (let i = 0; i < 4; i++) {
        await pdfService.generateFromHTML(`<h1>${i}</h1>`);
      }
      expect(puppeteer.launch).toHaveBeenCalledTimes(2);
      expect(pdfService.generationCount).toBe(1);
    } finally {
      process.env.PDF_MAX_GENERATIONS = originalMax;
    }
  });

  it('passe les bonnes options à puppeteer.launch', async () => {
    const puppeteer = require('puppeteer');
    await pdfService.generateFromHTML('<h1>Test</h1>');
    expect(puppeteer.launch).toHaveBeenCalledWith(
      expect.objectContaining({
        headless: true,
        args: expect.arrayContaining([
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ]),
      })
    );
  });

  it('ferme proprement le browser et le timer', async () => {
    await pdfService.generateFromHTML('<h1>Test</h1>');
    await pdfService.close();
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    expect(pdfService.browser).toBeNull();
    expect(pdfService.generationCount).toBe(0);
  });

  it('appelle page.pdf avec les bonnes options', async () => {
    await pdfService.generateFromHTML('<h1>Test</h1>', { format: 'A4-Landscape' });
    expect(mockPage.pdf).toHaveBeenCalledWith(
      expect.objectContaining({
        landscape: true,
        printBackground: true,
        displayHeaderFooter: true,
      })
    );
  });

  it('relâche la page même en cas d erreur', async () => {
    mockPage.setContent.mockRejectedValueOnce(new Error('Timeout'));
    await expect(pdfService.generateFromHTML('<h1>Fail</h1>')).rejects.toThrow('Timeout');
    expect(pdfService._activeCount).toBe(0);
  });

  it('retourne un buffer et le temps de génération', async () => {
    const result = await pdfService.generateFromHTML('<h1>Test</h1>');
    expect(result).toHaveProperty('buffer');
    expect(result).toHaveProperty('durationMs');
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('initialise le pool avec 5 pages au premier appel', async () => {
    await pdfService.generateFromHTML('<h1>Test</h1>');
    expect(mockBrowser.newPage).toHaveBeenCalledTimes(5);
  });

  it('generateDashboardPDF retourne buffer et durationMs', async () => {
    const result = await pdfService.generateDashboardPDF({ passRate: 50 }, { darkMode: true });
    expect(result).toHaveProperty('buffer');
    expect(result).toHaveProperty('durationMs');
  });
});
