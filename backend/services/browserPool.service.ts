import puppeteer, { Browser, Page } from 'puppeteer';
import logger from './logger.service';

export interface BrowserPoolOptions {
  headless?: boolean;
  idleTimeoutMs?: number;
  maxGenerations?: number;
  launchArgs?: string[];
  defaultViewport?: { width: number; height: number };
  name?: string;
}

/**
 * BrowserPool — Gestion centralisée d'un browser Puppeteer réutilisable.
 *
 * Features :
 * - Lancement lazy (créé à la première demande)
 * - Idle timeout (fermeture auto après inactivité)
 * - Recyclage après N générations/pages pour éviter les fuites mémoire Chromium
 * - Fermeture propre (pages + browser)
 */
export class BrowserPool {
  private _browser: Browser | null = null;
  private _generationCount = 0;
  private _idleTimer: NodeJS.Timeout | null = null;
  private _lastActivity = 0;
  private readonly _options: Required<BrowserPoolOptions>;

  constructor(options: BrowserPoolOptions = {}) {
    this._options = {
      headless: options.headless ?? true,
      idleTimeoutMs: options.idleTimeoutMs ?? 10 * 60 * 1000,
      maxGenerations: options.maxGenerations ?? 50,
      launchArgs: options.launchArgs ?? [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
      ],
      defaultViewport: options.defaultViewport ?? { width: 1920, height: 1080 },
      name: options.name ?? 'BrowserPool',
    };
  }

  async getBrowser(): Promise<Browser> {
    if (this._browser && this._generationCount >= this._options.maxGenerations) {
      logger.info(`[${this._options.name}] Recycle du browser après ${this._generationCount} générations`);
      await this.close();
    }

    if (!this._browser) {
      this._browser = await puppeteer.launch({
        headless: this._options.headless,
        args: this._options.launchArgs,
        defaultViewport: this._options.defaultViewport,
      });
      this._generationCount = 0;
      logger.info(`[${this._options.name}] Browser lancé`);
    }

    this._resetIdleTimer();
    return this._browser;
  }

  async newPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    this._generationCount++;
    this._resetIdleTimer();
    return page;
  }

  private _resetIdleTimer() {
    this._lastActivity = Date.now();
    if (this._idleTimer) clearTimeout(this._idleTimer);
    this._idleTimer = setTimeout(() => {
      logger.info(`[${this._options.name}] Fermeture idle après ${this._options.idleTimeoutMs}ms`);
      this.close().catch((err) =>
        logger.error(`[${this._options.name}] Erreur fermeture idle:`, err)
      );
    }, this._options.idleTimeoutMs);
  }

  async close(): Promise<void> {
    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
    if (this._browser) {
      try {
        await this._browser.close();
        logger.info(`[${this._options.name}] Browser fermé`);
      } catch (err) {
        logger.warn(`[${this._options.name}] Erreur fermeture browser:`, err);
      }
      this._browser = null;
    }
    this._generationCount = 0;
  }

  get isOpen(): boolean {
    return this._browser !== null;
  }

  get generationCount(): number {
    return this._generationCount;
  }

  get lastActivity(): number {
    return this._lastActivity;
  }
}
