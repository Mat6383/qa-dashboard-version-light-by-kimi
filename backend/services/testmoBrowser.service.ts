/**
 * ================================================
 * TESTMO BROWSER SERVICE — UI Automation (Puppeteer)
 * ================================================
 * Crée et met à jour des **runs manuels** Testmo via l'UI web.
 *
 * L'API REST Testmo ne permet pas d'écrire sur les runs manuels
 * (lecture seule). Ce service contourne la limitation en pilotant
 * un navigateur headless Puppeteer exactement comme un utilisateur.
 *
 * Sélecteurs CSS configurables via variables d'environnement
 * pour s'adapter aux évolutions de l'UI Testmo.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import logger from './logger.service';
import path from 'path';
import fs from 'fs';

// ─── Configuration sélecteurs (tunable via .env) ────────────────────────────

const SELECTORS = {
  // Auth
  loginEmail: process.env.TESTMO_SEL_LOGIN_EMAIL || 'input[type="email"],input[name="email"],#email',
  loginPassword: process.env.TESTMO_SEL_LOGIN_PASSWORD || 'input[type="password"],input[name="password"],#password',
  loginSubmit: process.env.TESTMO_SEL_LOGIN_SUBMIT || 'button[type="submit"],button:has-text("Sign in"),button:has-text("Log in")',

  // Runs list
  addRunButton: process.env.TESTMO_SEL_ADD_RUN || 'a:has-text("Add Run"),button:has-text("Add Run"),[data-testid="run-add"],.run-add',
  addRunModal: process.env.TESTMO_SEL_ADD_RUN_MODAL || '.modal,.dialog,[role="dialog"],.run-add-dialog',

  // Run form
  runNameInput: process.env.TESTMO_SEL_RUN_NAME || 'input[name="name"],input[placeholder*="name" i],#run-name',
  runMilestoneSelect: process.env.TESTMO_SEL_RUN_MILESTONE || 'select[name="milestone_id"],[data-testid="milestone-select"]',
  runConfigSelect: process.env.TESTMO_SEL_RUN_CONFIG || 'select[name="config_id"],[data-testid="config-select"]',
  runSubmitButton: process.env.TESTMO_SEL_RUN_SUBMIT || 'button:has-text("Add Run"):not([disabled]),button[type="submit"],.btn-primary:has-text("Add")',

  // Case selection (inside modal)
  selectCasesButton: process.env.TESTMO_SEL_SELECT_CASES || 'button:has-text("Select Cases"),a:has-text("Select Cases"),[data-testid="select-cases"]',
  caseCheckbox: process.env.TESTMO_SEL_CASE_CHECKBOX || 'input[type="checkbox"],.case-checkbox,.select-row-checkbox',
  caseSelectConfirm: process.env.TESTMO_SEL_CASE_CONFIRM || 'button:has-text("Select"),button:has-text("Confirm"),button:has-text("Add Selected")',

  // Run detail (results)
  testRow: process.env.TESTMO_SEL_TEST_ROW || '.test-row,.run-test,.case-row',
  statusButton: (status: string) => `button:has-text("${status}"),[data-status="${status.toLowerCase()}"],.status-${status.toLowerCase()}`,
  resultNoteInput: process.env.TESTMO_SEL_RESULT_NOTE || 'textarea[name="note"],.result-note,[data-testid="result-note"]',
  resultSubmit: process.env.TESTMO_SEL_RESULT_SUBMIT || 'button:has-text("Save Result"),button:has-text("Submit"),button:has-text("Add Result")',

  // Misc
  toastSuccess: process.env.TESTMO_SEL_TOAST_SUCCESS || '.toast-success,.alert-success,[data-testid="toast-success"]',
  loadingSpinner: process.env.TESTMO_SEL_LOADING || '.loading,.spinner,.busy,[data-testid="loading"]',
};

const TIMEOUT = parseInt(process.env.TESTMO_BROWSER_TIMEOUT || '', 10) || 30000;
const HEADLESS = process.env.TESTMO_BROWSER_HEADLESS !== 'false';
const SCREENSHOT_DIR = process.env.TESTMO_BROWSER_SCREENSHOTS || path.join(process.cwd(), 'logs', 'testmo-browser');

// ─── Helpers ────────────────────────────────────────────────────────────────

function _ensureScreenshotDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

function _screenshotPath(name: string) {
  _ensureScreenshotDir();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(SCREENSHOT_DIR, `${name}-${ts}.png`);
}

async function _screenshot(page: Page, name: string) {
  try {
    const p = _screenshotPath(name);
    await page.screenshot({ path: p, fullPage: true });
    logger.info(`[TestmoBrowser] Screenshot: ${p}`);
  } catch (e: any) {
    logger.warn(`[TestmoBrowser] Screenshot failed: ${e.message}`);
  }
}

async function _safeClick(page: Page, selector: string, opts: { timeout?: number; visible?: boolean } = {}) {
  const sel = selector.split(',')[0].trim(); // prend le premier sélecteur
  const el = await page.waitForSelector(sel, { timeout: opts.timeout || TIMEOUT, visible: opts.visible !== false });
  if (!el) throw new Error(`Element not found: ${sel}`);
  await page.evaluate((e: any) => e.scrollIntoView({ block: 'center' }), el);
  await el.click();
  return el;
}

async function _safeType(page: Page, selector: string, text: string) {
  const sel = selector.split(',')[0].trim();
  const el = await page.waitForSelector(sel, { timeout: TIMEOUT, visible: true });
  if (!el) throw new Error(`Input not found: ${sel}`);
  await el.click({ clickCount: 3 }); // select all
  await el.type(text);
}

async function _safeSelect(page: Page, selector: string, value: string | number) {
  const sel = selector.split(',')[0].trim();
  const el = await page.waitForSelector(sel, { timeout: TIMEOUT, visible: true });
  if (!el) throw new Error(`Select not found: ${sel}`);
  await el.select(String(value));
}

async function _waitForNetworkIdle(page: Page, timeout = TIMEOUT) {
  try {
    await (page as any).waitForNetworkIdle({ idleTime: 500, timeout });
  } catch {
    // ignore — on continue
  }
}

async function _dismissModals(page: Page) {
  // Echap pour fermer d'éventuelles modales overlay
  try {
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 300));
  } catch {
    // ignore
  }
}

// ─── Service ────────────────────────────────────────────────────────────────

class TestmoBrowserService {
  private browser: Browser | null = null;
  private lastActivity = 0;
  private idleTimer: NodeJS.Timeout | null = null;
  private readonly idleTimeoutMs = parseInt(process.env.TESTMO_BROWSER_IDLE_TIMEOUT_MS || '', 10) || 5 * 60 * 1000; // 5 min

  // ── Lifecycle ────────────────────────────────────────────────────────────

  private async _getBrowser(): Promise<Browser> {
    if (this.browser) {
      this._resetIdleTimer();
      return this.browser;
    }

    this.browser = await puppeteer.launch({
      headless: HEADLESS,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--window-size=1920,1080',
      ],
      defaultViewport: { width: 1920, height: 1080 },
    });

    logger.info('[TestmoBrowser] Browser launched');
    this._resetIdleTimer();
    return this.browser;
  }

  private _resetIdleTimer() {
    this.lastActivity = Date.now();
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      logger.info(`[TestmoBrowser] Idle timeout — closing browser`);
      this.close().catch((err) => logger.error('[TestmoBrowser] Idle close error:', err));
    }, this.idleTimeoutMs);
  }

  async close() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.browser) {
      try {
        await this.browser.close();
        logger.info('[TestmoBrowser] Browser closed');
      } catch (err: any) {
        logger.warn('[TestmoBrowser] Close error:', err.message);
      }
      this.browser = null;
    }
  }

  private async _newPage(): Promise<Page> {
    const browser = await this._getBrowser();
    const page = await browser.newPage();
    page.setDefaultTimeout(TIMEOUT);
    return page;
  }

  // ── Auth ─────────────────────────────────────────────────────────────────

  /**
   * Authentifie la page sur l'UI Testmo.
   * Supporte deux mécanismes :
   * 1. Cookie de session pré-existant (si `TESTMO_BROWSER_COOKIE` est renseigné)
   * 2. Login email/password (variables TESTMO_UI_USER / TESTMO_UI_PASSWORD)
   */
  async authenticate(page: Page): Promise<Page> {
    const baseUrl = process.env.TESTMO_URL;
    if (!baseUrl) throw new Error('TESTMO_URL manquant');

    const cookieValue = process.env.TESTMO_BROWSER_COOKIE;
    if (cookieValue) {
      logger.info('[TestmoBrowser] Using provided session cookie');
      await page.setCookie({
        name: 'testmo_session',
        value: cookieValue,
        domain: new URL(baseUrl).hostname,
        path: '/',
      });
    }

    await page.goto(`${baseUrl}/projects`, { waitUntil: 'networkidle2', timeout: TIMEOUT });
    await _waitForNetworkIdle(page);
    await _screenshot(page, '01-projects-page');

    // Détection : sommes-nous déjà logués ?
    const currentUrl = page.url();
    const isLoggedIn = !currentUrl.includes('/auth') && !currentUrl.includes('/login') && !currentUrl.includes('/signin');

    if (isLoggedIn) {
      logger.info('[TestmoBrowser] Already authenticated');
      return page;
    }

    // Fallback login form
    const email = process.env.TESTMO_UI_USER || process.env.TESTMO_EMAIL;
    const password = process.env.TESTMO_UI_PASSWORD || process.env.TESTMO_PASSWORD;

    if (!email || !password) {
      throw new Error(
        'Testmo UI authentication failed. Provide TESTMO_BROWSER_COOKIE ' +
          'or TESTMO_UI_USER + TESTMO_UI_PASSWORD'
      );
    }

    logger.info('[TestmoBrowser] Logging in via form');
    await _safeType(page, SELECTORS.loginEmail, email);
    await _safeType(page, SELECTORS.loginPassword, password);
    await _screenshot(page, '02-login-filled');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: TIMEOUT }).catch(() => {}),
      _safeClick(page, SELECTORS.loginSubmit),
    ]);

    await _waitForNetworkIdle(page);
    await _screenshot(page, '03-post-login');

    const postUrl = page.url();
    if (postUrl.includes('/auth') || postUrl.includes('/login')) {
      throw new Error('Testmo login failed — still on auth page');
    }

    logger.info('[TestmoBrowser] Authenticated successfully');
    return page;
  }

  // ── Create Manual Run ────────────────────────────────────────────────────

  /**
   * Crée un run manuel dans Testmo via l'UI.
   *
   * @param projectId — ID du projet Testmo
   * @param options — { name, milestoneId?, configId?, caseIds? }
   * @returns { runId, url }
   */
  async createManualRun(
    projectId: number,
    options: {
      name: string;
      milestoneId?: number;
      configId?: number;
      caseIds?: number[];
    }
  ): Promise<{ runId: number; url: string }> {
    const page = await this._newPage();
    const baseUrl = process.env.TESTMO_URL;

    try {
      await this.authenticate(page);

      // 1. Naviguer vers la page des runs du projet
      const runsUrl = `${baseUrl}/projects/${projectId}/runs`;
      logger.info(`[TestmoBrowser] Navigating to ${runsUrl}`);
      await page.goto(runsUrl, { waitUntil: 'networkidle2', timeout: TIMEOUT });
      await _waitForNetworkIdle(page);
      await _screenshot(page, '04-runs-list');

      // 2. Cliquer sur "Add Run"
      logger.info('[TestmoBrowser] Clicking Add Run');
      await _safeClick(page, SELECTORS.addRunButton);
      await new Promise((r) => setTimeout(r, 800)); // laisser la modale s'ouvrir
      await _screenshot(page, '05-add-run-modal');

      // 3. Attendre et remplir le formulaire
      const modal = await page.waitForSelector(SELECTORS.addRunModal, { timeout: TIMEOUT, visible: true });
      if (!modal) throw new Error('Add Run modal did not open');

      logger.info(`[TestmoBrowser] Filling run name: "${options.name}"`);
      await _safeType(page, SELECTORS.runNameInput, options.name);

      if (options.milestoneId) {
        logger.info(`[TestmoBrowser] Selecting milestone: ${options.milestoneId}`);
        try {
          await _safeSelect(page, SELECTORS.runMilestoneSelect, options.milestoneId);
        } catch (e: any) {
          logger.warn(`[TestmoBrowser] Could not select milestone: ${e.message}`);
        }
      }

      if (options.configId) {
        logger.info(`[TestmoBrowser] Selecting config: ${options.configId}`);
        try {
          await _safeSelect(page, SELECTORS.runConfigSelect, options.configId);
        } catch (e: any) {
          logger.warn(`[TestmoBrowser] Could not select config: ${e.message}`);
        }
      }

      await _screenshot(page, '06-form-filled');

      // 4. Sélection des cases (si fournies)
      if (options.caseIds && options.caseIds.length > 0) {
        logger.info(`[TestmoBrowser] Selecting ${options.caseIds.length} cases`);
        try {
          await _safeClick(page, SELECTORS.selectCasesButton);
          await new Promise((r) => setTimeout(r, 1000));
          await _screenshot(page, '07-case-selection');

          // Cocher les cases par ID (on itère sur la liste affichée)
          for (const caseId of options.caseIds) {
            try {
              // Recherche par texte contenant l'ID ou data-attribute
              const rowSelector = `[data-case-id="${caseId}"],tr:has-text("C${caseId}"),tr:has-text("${caseId}")`;
              const row = await page.waitForSelector(rowSelector, { timeout: 5000, visible: true });
              if (row) {
                const cb = await row.$('input[type="checkbox"],.case-checkbox');
                if (cb) {
                  await cb.click();
                  await new Promise((r) => setTimeout(r, 200));
                }
              }
            } catch (e: any) {
              logger.warn(`[TestmoBrowser] Could not select case ${caseId}: ${e.message}`);
            }
          }

          await _screenshot(page, '08-cases-selected');
          await _safeClick(page, SELECTORS.caseSelectConfirm);
          await new Promise((r) => setTimeout(r, 800));
        } catch (e: any) {
          logger.warn(`[TestmoBrowser] Case selection failed: ${e.message}`);
        }
      }

      // 5. Soumettre le formulaire
      logger.info('[TestmoBrowser] Submitting run');
      await _screenshot(page, '09-pre-submit');
      await _safeClick(page, SELECTORS.runSubmitButton);

      // Attendre la navigation ou le toast de succès
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: TIMEOUT }).catch(() => {}),
        page.waitForSelector(SELECTORS.toastSuccess, { timeout: TIMEOUT }).catch(() => {}),
      ]);

      await _waitForNetworkIdle(page);
      await _screenshot(page, '10-post-submit');

      // 6. Extraire l'ID du run depuis l'URL
      const finalUrl = page.url();
      const runIdMatch = finalUrl.match(/\/runs\/(\d+)/);
      const runId = runIdMatch ? parseInt(runIdMatch[1], 10) : 0;

      if (!runId) {
        // Fallback : chercher un lien vers le run fraîchement créé
        const links = await page.$$eval('a[href*="/runs/"]', (els: any[]) => els.map((e: any) => e.href));
        const freshLink = links.find((h) => h.includes('/runs/'));
        if (freshLink) {
          const m = freshLink.match(/\/runs\/(\d+)/);
          if (m) {
            return { runId: parseInt(m[1], 10), url: freshLink };
          }
        }
        throw new Error(`Could not extract runId from URL: ${finalUrl}`);
      }

      const url = `${baseUrl}/projects/${projectId}/runs/${runId}`;
      logger.info(`[TestmoBrowser] Manual run created: ${url}`);
      return { runId, url };
    } finally {
      await page.close();
    }
  }

  // ── Add Results to Manual Run ────────────────────────────────────────────

  /**
   * Ajoute des résultats à un run manuel existant.
   * Stratégie : bulk-edit si disponible, sinon ligne par ligne.
   *
   * @param projectId — ID projet Testmo
   * @param runId — ID du run
   * @param results — tableau de { caseId, status, note?, elapsed? }
   */
  async addRunResults(
    projectId: number,
    runId: number,
    results: Array<{
      caseId?: number;
      testId?: number;
      status: 'passed' | 'failed' | 'blocked' | 'skipped' | 'retest' | string;
      note?: string;
      elapsed?: number;
    }>
  ): Promise<{ updated: number; errors: number }> {
    const page = await this._newPage();
    const baseUrl = process.env.TESTMO_URL;
    let updated = 0;
    let errors = 0;

    try {
      await this.authenticate(page);

      const runUrl = `${baseUrl}/projects/${projectId}/runs/${runId}`;
      logger.info(`[TestmoBrowser] Opening run ${runUrl}`);
      await page.goto(runUrl, { waitUntil: 'networkidle2', timeout: TIMEOUT });
      await _waitForNetworkIdle(page);
      await _screenshot(page, '11-run-detail');

      // Détection du mode bulk (sélection multiple + menu bulk)
      const bulkEl = await page.$('.bulk-edit,.bulk-actions,[data-testid="bulk-edit"],.select-all');
      const hasBulk = !!bulkEl;

      if (hasBulk && results.length > 3) {
        logger.info('[TestmoBrowser] Using bulk-edit strategy');
        // Group by status
        const byStatus: Record<string, typeof results> = {};
        for (const r of results) {
          byStatus[r.status] = byStatus[r.status] || [];
          byStatus[r.status].push(r);
        }

        for (const [status, items] of Object.entries(byStatus)) {
          try {
            await this._bulkSetStatus(page, items, status);
            updated += items.length;
          } catch (e: any) {
            logger.error(`[TestmoBrowser] Bulk status ${status} failed: ${e.message}`);
            errors += items.length;
          }
        }
      } else {
        logger.info('[TestmoBrowser] Using per-row strategy');
        for (const r of results) {
          try {
            await this._setSingleResult(page, r);
            updated++;
          } catch (e: any) {
            logger.warn(`[TestmoBrowser] Result update failed for case ${r.caseId}: ${e.message}`);
            errors++;
          }
        }
      }

      await _screenshot(page, '12-results-done');
      return { updated, errors };
    } finally {
      await page.close();
    }
  }

  private async _bulkSetStatus(page: Page, items: any[], status: string) {
    // Sélectionner les lignes correspondantes (par caseId ou nom)
    for (const item of items.slice(0, 20)) {
      // limiter pour éviter la surcharge UI
      try {
        const identifier = item.caseId || item.testId;
        const rowSel = `tr:has-text("C${identifier}"),tr:has-text("${identifier}"),[data-test-id="${identifier}"]`;
        const row = await page.waitForSelector(rowSel, { timeout: 5000, visible: true });
        if (row) {
          const cb = await row.$('input[type="checkbox"],.row-checkbox');
          if (cb) await cb.click();
        }
      } catch {
        // ignore missing row
      }
    }

    // Ouvrir le bulk menu et choisir le statut
    const bulkBtn = await page.$('.bulk-edit button,.bulk-actions button,[data-testid="bulk-status"]');
    if (!bulkBtn) throw new Error('Bulk edit button not found');
    await bulkBtn.click();
    await new Promise((r) => setTimeout(r, 400));

    const statusBtn = await page.$(SELECTORS.statusButton(status));
    if (statusBtn) {
      await statusBtn.click();
      await new Promise((r) => setTimeout(r, 600));
      await _waitForNetworkIdle(page);
    } else {
      throw new Error(`Status button for "${status}" not found`);
    }
  }

  private async _setSingleResult(page: Page, item: any) {
    const identifier = item.caseId || item.testId;
    const rowSel = `tr:has-text("C${identifier}"),tr:has-text("${identifier}"),[data-test-id="${identifier}"]`;
    const row = await page.waitForSelector(rowSel, { timeout: 8000, visible: true });
    if (!row) throw new Error(`Row not found for ${identifier}`);

    // Cliquer sur la cellule de statut ou le bouton "Untested"
    const statusCell = await row.$('td:last-child,td.status,.status-cell,button:has-text("Untested")');
    if (statusCell) await statusCell.click();
    await new Promise((r) => setTimeout(r, 400));

    // Cliquer le statut cible
    const targetBtn = await page.$(SELECTORS.statusButton(item.status));
    if (targetBtn) {
      await targetBtn.click();
    } else {
      // fallback — chercher par texte exact dans les boutons visibles
      const btns = await page.$$('button, .status-btn, [role="button"]');
      for (const btn of btns) {
        const text = await page.evaluate((el) => el.textContent, btn);
        if (text && text.toLowerCase().includes(item.status.toLowerCase())) {
          await btn.click();
          break;
        }
      }
    }

    await new Promise((r) => setTimeout(r, 300));

    // Note optionnelle
    if (item.note) {
      try {
        const noteInput = await page.waitForSelector(SELECTORS.resultNoteInput, { timeout: 3000, visible: true });
        if (noteInput) {
          await noteInput.type(item.note);
          await new Promise((r) => setTimeout(r, 200));
        }
      } catch {
        // ignore
      }
    }

    // Sauvegarder
    try {
      const saveBtn = await page.waitForSelector(SELECTORS.resultSubmit, { timeout: 5000, visible: true });
      if (saveBtn) await saveBtn.click();
    } catch {
      // Peut-être que le clic sur le statut a déjà sauvegardé
    }

    await new Promise((r) => setTimeout(r, 400));
    await _waitForNetworkIdle(page);
  }

  // ── Health check ─────────────────────────────────────────────────────────

  async healthCheck(): Promise<{ ok: boolean; message: string }> {
    const page = await this._newPage();
    try {
      await this.authenticate(page);
      return { ok: true, message: 'Authenticated successfully' };
    } catch (e: any) {
      return { ok: false, message: e.message };
    } finally {
      await page.close();
    }
  }
}

export default new TestmoBrowserService();
