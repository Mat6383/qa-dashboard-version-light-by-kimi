/**
 * Tests unitaires — BrowserPool
 */

jest.mock('../../services/logger.service', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('puppeteer', () => ({
  launch: jest.fn(),
}));

import puppeteer from 'puppeteer';
import { BrowserPool } from '../../services/browserPool.service';

describe('BrowserPool', () => {
  let mockPage: any;
  let mockBrowser: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockPage = {
      goto: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      setDefaultTimeout: jest.fn(),
    };

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
    };

    (puppeteer.launch as jest.Mock).mockResolvedValue(mockBrowser);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('lance un browser à la première demande', async () => {
    const pool = new BrowserPool({ name: 'Test' });
    await pool.getBrowser();
    expect(puppeteer.launch).toHaveBeenCalledTimes(1);
    expect(pool.isOpen).toBe(true);
  });

  it('réutilise le browser existant', async () => {
    const pool = new BrowserPool({ name: 'Test' });
    await pool.getBrowser();
    await pool.getBrowser();
    expect(puppeteer.launch).toHaveBeenCalledTimes(1);
  });

  it('crée une nouvelle page et incrémente generationCount', async () => {
    const pool = new BrowserPool({ name: 'Test' });
    const page = await pool.newPage();
    expect(page).toBe(mockPage);
    expect(pool.generationCount).toBe(1);
    expect(mockBrowser.newPage).toHaveBeenCalledTimes(1);
  });

  it('recycle le browser après maxGenerations', async () => {
    const pool = new BrowserPool({ name: 'Test', maxGenerations: 3 });
    await pool.newPage();
    await pool.newPage();
    await pool.newPage();
    expect(puppeteer.launch).toHaveBeenCalledTimes(1);

    // 4ème page dépasse le quota → recycle
    await pool.newPage();
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    expect(puppeteer.launch).toHaveBeenCalledTimes(2);
    expect(pool.generationCount).toBe(1);
  });

  it('ferme proprement le browser et le timer', async () => {
    const pool = new BrowserPool({ name: 'Test' });
    await pool.getBrowser();
    await pool.close();
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    expect(pool.isOpen).toBe(false);
    expect(pool.generationCount).toBe(0);
  });

  it('ferme automatiquement après idleTimeout', async () => {
    const pool = new BrowserPool({ name: 'Test', idleTimeoutMs: 5000 });
    await pool.getBrowser();
    expect(pool.isOpen).toBe(true);

    jest.advanceTimersByTime(5001);
    // La fermeture est async dans setTimeout, on laisse les promesses se résoudre
    await Promise.resolve();
    jest.advanceTimersByTime(1);
    await Promise.resolve();

    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    expect(pool.isOpen).toBe(false);
  });

  it('passe les options de launch correctement', async () => {
    const pool = new BrowserPool({
      headless: false,
      launchArgs: ['--custom-arg'],
      defaultViewport: { width: 800, height: 600 },
    });
    await pool.getBrowser();
    expect(puppeteer.launch).toHaveBeenCalledWith(
      expect.objectContaining({
        headless: false,
        args: ['--custom-arg'],
        defaultViewport: { width: 800, height: 600 },
      })
    );
  });
});
