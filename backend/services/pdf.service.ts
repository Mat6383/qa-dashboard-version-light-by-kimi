import puppeteer from 'puppeteer';
import logger from './logger.service';

const _getMaxGenerations = () => parseInt(process.env.PDF_MAX_GENERATIONS || '', 10) || 50;
const IDLE_TIMEOUT_MS = parseInt(process.env.PDF_IDLE_TIMEOUT_MS || '', 10) || 10 * 60 * 1000; // 10 min
const PAGE_TIMEOUT_MS = parseInt(process.env.PDF_PAGE_TIMEOUT_MS || '', 10) || 30_000; // 30s

class PdfService {
  browser: any;
  generationCount: number;
  idleTimer: any;
  lastActivity: number;
  poolSize: number;
  maxPageGenerations: number;
  maxConcurrency: number;
  maxQueueSize: number;
  _pool: { page: any; busy: boolean; generationCount: number }[];
  _queue: ((page: any) => void)[];
  _activeCount: number;

  constructor() {
    this.browser = null;
    this.generationCount = 0;
    this.idleTimer = null;
    this.lastActivity = Date.now();
    this.poolSize = parseInt(process.env.PDF_POOL_SIZE || '', 10) || 5;
    this.maxPageGenerations = parseInt(process.env.PDF_MAX_PAGE_GENERATIONS || '', 10) || 20;
    this.maxConcurrency = parseInt(process.env.PDF_MAX_CONCURRENCY || '', 10) || 5;
    this.maxQueueSize = parseInt(process.env.PDF_MAX_QUEUE_SIZE || '', 10) || 10;
    this._pool = [];
    this._queue = [];
    this._activeCount = 0;
  }

  async _getBrowser() {
    const maxGen = _getMaxGenerations();
    // Si le browser a dépassé le quota de générations, on le recycle
    if (this.browser && this.generationCount >= maxGen) {
      logger.info(`[PdfService] Recycle du browser après ${this.generationCount} générations`);
      await this.close();
    }

    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
        ],
      });
      this.generationCount = 0;
      logger.info('[PdfService] Browser Puppeteer lancé');
    }

    this._resetIdleTimer();
    return this.browser;
  }

  _resetIdleTimer() {
    this.lastActivity = Date.now();
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      logger.info(`[PdfService] Fermeture idle après ${IDLE_TIMEOUT_MS}ms d'inactivité`);
      this.close().catch((err: any) => logger.error('[PdfService] Erreur fermeture idle:', err.message));
    }, IDLE_TIMEOUT_MS);
  }

  _logMemory() {
    if (process.env.NODE_ENV === 'production' || process.env.DEBUG_PDF_MEMORY) {
      const mem = process.memoryUsage();
      logger.debug(
        '[PdfService] Mémoire — rss:',
        Math.round(mem.rss / 1024 / 1024),
        'MB, heapUsed:',
        Math.round(mem.heapUsed / 1024 / 1024),
        'MB'
      );
    }
  }

  async _initPool(browser: any) {
    if (this._pool.length > 0) return;
    for (let i = 0; i < this.poolSize; i++) {
      const page = await browser.newPage();
      this._pool.push({ page, busy: false, generationCount: 0 });
    }
    logger.info(`[PdfService] Pool initialisé avec ${this.poolSize} pages`);
  }

  async _acquirePage(): Promise<any> {
    const browser = await this._getBrowser();
    await this._initPool(browser);

    // Si une page est idle, on la prend
    const idle = this._pool.find((p) => !p.busy);
    if (idle && this._activeCount < this.maxConcurrency) {
      idle.busy = true;
      this._activeCount++;
      await idle.page.goto('about:blank');
      return idle.page;
    }

    // Si la queue est pleine, on rejette (fail-fast)
    if (this._queue.length >= this.maxQueueSize) {
      logger.warn(`[PdfService] Queue pleine — ${this._queue.length}/${this.maxQueueSize} en attente, active=${this._activeCount}`);
      throw new Error('PDF generation queue full (too many concurrent requests)');
    }

    // Sinon on attend qu'une page se libère (timeout court pour fail-fast)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const idx = this._queue.indexOf(handler);
        if (idx !== -1) this._queue.splice(idx, 1);
        reject(new Error('PDF generation queue timeout'));
      }, 10000);

      const handler = (page: any) => {
        clearTimeout(timeout);
        resolve(page);
      };

      this._queue.push(handler);
    });
  }

  async _releasePage(page: any) {
    const entry = this._pool.find((p) => p.page === page);
    if (!entry) return;

    entry.generationCount++;
    this.generationCount++;
    this._activeCount--;

    // Rotation fine : on recycle la page après N générations
    if (entry.generationCount >= this.maxPageGenerations) {
      await this._rotatePageEntry(entry);
    }

    entry.busy = false;

    // Si quelqu'un attend dans la queue, on lui donne la page
    if (this._queue.length > 0) {
      const next = this._queue.shift()!;
      entry.busy = true;
      this._activeCount++;
      next(entry.page);
      return;
    }
  }

  async _rotatePageEntry(entry: any) {
    try {
      await entry.page.close();
    } catch (err: any) {
      logger.warn('[PdfService] Erreur fermeture page:', err.message);
    }
    const browser = await this._getBrowser();
    entry.page = await browser.newPage();
    entry.generationCount = 0;
    logger.info('[PdfService] Page du pool recyclée');
  }

  /**
   * Génère un PDF à partir d'une chaîne HTML
   * @param {string} html — Contenu HTML complet
   * @param {object} options — { format: 'A4'|'A4-Landscape', margin }
   * @returns {Buffer} PDF
   */
  async generateFromHTML(html: any, options: any = {}) {
    const start = Date.now();
    const page = await this._acquirePage();

    try {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: PAGE_TIMEOUT_MS });

      const pdfBuffer = await page.pdf({
        format: options.format === 'A4-Landscape' ? 'A4' : 'A4',
        landscape: options.format === 'A4-Landscape',
        printBackground: true,
        margin: options.margin || { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="font-size:10px;width:100%;padding:10px 20px;display:flex;justify-content:space-between;color:#666;font-family:system-ui,sans-serif;">
            <span>QA Dashboard — Neo-Logix</span>
            <span class="date"></span>
          </div>
        `,
        footerTemplate: `
          <div style="font-size:10px;width:100%;padding:10px 20px;display:flex;justify-content:space-between;color:#666;font-family:system-ui,sans-serif;">
            <span>ISTQB Compliant | LEAN Optimized | ITIL SLA Monitoring</span>
            <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
          </div>
        `,
        timeout: PAGE_TIMEOUT_MS,
      });

      const durationMs = Date.now() - start;
      this._logMemory();
      logger.info(`[PdfService] PDF généré en ${durationMs}ms (#${this.generationCount})`);

      if (durationMs > 10000) {
        logger.warn(`[PdfService] Génération lente : ${durationMs}ms`);
      }

      return { buffer: pdfBuffer, durationMs };
    } finally {
      await this._releasePage(page);
    }
  }

  /**
   * Génère un PDF de dashboard à partir des métriques
   */
  async generateDashboardPDF(metrics: any, options = {}) {
    const html = this._buildDashboardHTML(metrics, options);
    return this.generateFromHTML(html, options);
  }

  _buildDashboardHTML(metrics: any, options: any = {}) {
    const isDark = options.darkMode;
    const bg = isDark ? '#0f172a' : '#ffffff';
    const text = isDark ? '#f1f5f9' : '#1f2937';
    const cardBg = isDark ? '#1e293b' : '#f9fafb';
    const border = isDark ? '#334155' : '#e5e7eb';

    const metricsCards = [
      { label: 'Taux de réussite', value: `${metrics?.passRate ?? '-'}%`, color: '#10B981' },
      { label: 'Taux de complétion', value: `${metrics?.completionRate ?? '-'}%`, color: '#3B82F6' },
      { label: 'Taux de blocage', value: `${metrics?.blockedRate ?? '-'}%`, color: '#F59E0B' },
      { label: 'Escape Rate', value: `${metrics?.escapeRate ?? '-'}%`, color: '#EF4444' },
      { label: 'Detection Rate', value: `${metrics?.detectionRate ?? '-'}%`, color: '#8B5CF6' },
    ]
      .map(
        (m: any) => `
      <div style="background:${cardBg};border:1px solid ${border};border-radius:8px;padding:16px;text-align:center;flex:1;min-width:140px;">
        <div style="font-size:1.75rem;font-weight:700;color:${m.color};">${m.value}</div>
        <div style="font-size:0.875rem;color:${text};margin-top:4px;opacity:0.8;">${m.label}</div>
      </div>`
      )
      .join('');

    const sla = metrics?.slaStatus;
    const slaHtml = sla?.ok
      ? `<div style="background:#10B98115;color:#10B981;padding:12px 16px;border-radius:6px;border:1px solid #10B98140;font-weight:500;">✅ Tous les SLA sont respectés</div>`
      : `<div style="background:#EF444415;color:#EF4444;padding:12px 16px;border-radius:6px;border:1px solid #EF444440;font-weight:500;">
          ⚠️ Alertes SLA : ${(sla?.alerts || []).map((a: any) => `${a.metric} (${a.value}% / seuil ${a.threshold}%)`).join(', ')}
         </div>`;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Rapport QA Dashboard</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: ${bg}; color: ${text}; padding: 24px; }
    h1 { font-size: 1.5rem; margin: 0 0 8px; }
    .subtitle { opacity: 0.7; font-size: 0.875rem; margin-bottom: 24px; }
    .grid { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
  </style>
</head>
<body>
  <h1>📊 Rapport de qualité — ${metrics?.projectName || 'Projet'}</h1>
  <div class="subtitle">Généré le ${new Date().toLocaleString('fr-FR')}</div>
  ${slaHtml}
  <div style="margin-top:24px;">
    <h2 style="font-size:1.125rem;margin-bottom:12px;">Métriques ISTQB</h2>
    <div class="grid">${metricsCards}</div>
  </div>
  ${
    metrics?.runs?.length
      ? `
  <div style="margin-top:24px;">
    <h2 style="font-size:1.125rem;margin-bottom:12px;">Runs actifs (${metrics.runs.length})</h2>
    <table style="width:100%;border-collapse:collapse;font-size:0.875rem;">
      <thead><tr style="background:${cardBg};border-bottom:2px solid ${border};">
        <th style="text-align:left;padding:8px;">Run</th>
        <th style="text-align:left;padding:8px;">Statut</th>
        <th style="text-align:right;padding:8px;">Tests</th>
        <th style="text-align:right;padding:8px;">Passés</th>
        <th style="text-align:right;padding:8px;">Échoués</th>
      </tr></thead>
      <tbody>
        ${metrics.runs
          .map(
            (r: any) => `
        <tr style="border-bottom:1px solid ${border};">
          <td style="padding:8px;">${r.name}</td>
          <td style="padding:8px;">${r.status}</td>
          <td style="padding:8px;text-align:right;">${r.total}</td>
          <td style="padding:8px;text-align:right;color:#10B981;">${r.passed}</td>
          <td style="padding:8px;text-align:right;color:#EF4444;">${r.failed}</td>
        </tr>`
          )
          .join('')}
      </tbody>
    </table>
  </div>`
      : ''
  }
</body>
</html>`;
  }

  async close() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    for (const entry of this._pool) {
      try {
        await entry.page.close();
      } catch (err: any) {
        logger.warn('[PdfService] Erreur fermeture page pool:', err.message);
      }
    }
    this._pool = [];
    if (this.browser) {
      try {
        await this.browser.close();
        logger.info('[PdfService] Browser fermé');
      } catch (err: any) {
        logger.warn('[PdfService] Erreur fermeture browser:', err.message);
      }
      this.browser = null;
    }
    this.generationCount = 0;
    this._activeCount = 0;
    this._queue = [];
  }
}

export default new PdfService();
