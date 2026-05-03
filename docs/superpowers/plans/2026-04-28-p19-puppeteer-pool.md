# P19 — Pool Puppeteer optimisé Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer le PdfService singleton en un service à pool de pages réutilisables avec contrôle de concurrence (3 slots) et exposition du temps de génération via header HTTP.

**Architecture:** Le PdfService gère un pool interne de 3 pages Puppeteer pré-ouvertes. Chaque appel `generateFromHTML` acquiert une page idle, la réutilise, puis la relâche. Une file d'attente FIFO gère les excès de demandes (max 5 en queue). Le temps de génération est mesuré et retourné dans un objet `{ buffer, durationMs }` consommé par la route pour le header `X-PDF-Generation-Time`.

**Tech Stack:** TypeScript (backend), Puppeteer, Jest (tests CJS `.js`), Supertest (tests d'intégration).

---

## File Structure

| File                                           | Action | Responsibility                                                            |
| ---------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| `backend/services/pdf.service.ts`              | Modify | Pool interne (3 pages), semaphore, timing, rotation page                  |
| `backend/routes/pdf.routes.ts`                 | Modify | Consomme `{ buffer, durationMs }`, injecte header `X-PDF-Generation-Time` |
| `backend/tests/services/pdf.service.test.js`   | Modify | Tests du pool, du timing, de la concurrence, du recyclage                 |
| `backend/tests/integration/pdf.routes.test.js` | Modify | Test du header HTTP                                                       |

---

### Task 1: Ajouter le pool de pages dans PdfService

**Files:**

- Modify: `backend/services/pdf.service.ts`

**Contexte:** Le PdfService actuel crée une nouvelle page à chaque appel (`browser.newPage()` puis `page.close()`). On remplace ce pattern par un pool de 3 pages réutilisables.

- [ ] **Step 1: Ajouter les propriétés du pool et initialisation**

Dans la classe `PdfService`, ajouter après les propriétés existantes :

```ts
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
    this.poolSize = parseInt(process.env.PDF_POOL_SIZE || '', 10) || 3;
    this.maxPageGenerations = parseInt(process.env.PDF_MAX_PAGE_GENERATIONS || '', 10) || 20;
    this.maxConcurrency = parseInt(process.env.PDF_MAX_CONCURRENCY || '', 10) || 3;
    this.maxQueueSize = parseInt(process.env.PDF_MAX_QUEUE_SIZE || '', 10) || 5;
    this._pool = [];
    this._queue = [];
    this._activeCount = 0;
  }
```

- [ ] **Step 2: Implémenter `_initPool(browser)`**

Ajouter cette méthode dans `PdfService` :

```ts
  async _initPool(browser: any) {
    if (this._pool.length > 0) return;
    for (let i = 0; i < this.poolSize; i++) {
      const page = await browser.newPage();
      this._pool.push({ page, busy: false, generationCount: 0 });
    }
    logger.info(`[PdfService] Pool initialisé avec ${this.poolSize} pages`);
  }
```

- [ ] **Step 3: Implémenter `_acquirePage()` avec file d'attente**

Ajouter cette méthode dans `PdfService` :

```ts
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

    // Si la queue est pleine, on rejette
    if (this._queue.length >= this.maxQueueSize) {
      throw new Error('PDF generation queue full (too many concurrent requests)');
    }

    // Sinon on attend qu'une page se libère
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const idx = this._queue.indexOf(handler);
        if (idx !== -1) this._queue.splice(idx, 1);
        reject(new Error('PDF generation queue timeout'));
      }, 30000);

      const handler = (page: any) => {
        clearTimeout(timeout);
        resolve(page);
      };

      this._queue.push(handler);
    });
  }
```

- [ ] **Step 4: Implémenter `_releasePage(page)` et `_rotatePageIfNeeded(pageEntry)`**

Ajouter ces méthodes dans `PdfService` :

```ts
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
```

- [ ] **Step 5: Modifier `generateFromHTML` pour utiliser le pool + timing**

Remplacer la méthode `generateFromHTML` existante par :

```ts
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
```

- [ ] **Step 6: Modifier `generateDashboardPDF` pour propager le nouveau retour**

Remplacer la méthode `generateDashboardPDF` par :

```ts
  async generateDashboardPDF(metrics: any, options = {}) {
    const html = this._buildDashboardHTML(metrics, options);
    return this.generateFromHTML(html, options);
  }
```

- [ ] **Step 7: Modifier `close()` pour fermer proprement le pool**

Remplacer `close()` par :

```ts
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
```

---

### Task 2: Route PDF avec header X-PDF-Generation-Time

**Files:**

- Modify: `backend/routes/pdf.routes.ts`

- [ ] **Step 1: Modifier la route pour consommer `{ buffer, durationMs }` et injecter le header**

Remplacer le bloc `res.setHeader('Content-Type'...)` dans `backend/routes/pdf.routes.ts` par :

```ts
const { buffer, durationMs } = await pdfService.generateDashboardPDF(metrics, { format, darkMode });

res.setHeader('Content-Type', 'application/pdf');
res.setHeader('Content-Disposition', `attachment; filename="qa-dashboard-${projectId}-${Date.now()}.pdf"`);
res.setHeader('X-PDF-Generation-Time', durationMs.toString());
exportRunsTotal.inc({ format: 'pdf' });
res.send(buffer);
```

---

### Task 3: Mettre à jour les tests unitaires PdfService

**Files:**

- Modify: `backend/tests/services/pdf.service.test.js`

**Contexte:** Les tests existants mockent `puppeteer.launch` et `browser.newPage`. Avec le pool, `browser.newPage` est appelé 3 fois au démarrage + lors des rotations. Il faut adapter le mock pour supporter `page.goto('about:blank')`.

- [ ] **Step 1: Adapter les mocks pour supporter le pool**

Remplacer le bloc `mockPage` existant dans `backend/tests/services/pdf.service.test.js` par :

```js
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
```

- [ ] **Step 2: Ajouter le test "retourne buffer et durationMs"**

Ajouter dans le `describe('PdfService')` :

```js
it('retourne un buffer et le temps de génération', async () => {
  const result = await pdfService.generateFromHTML('<h1>Test</h1>');
  expect(result).toHaveProperty('buffer');
  expect(result).toHaveProperty('durationMs');
  expect(Buffer.isBuffer(result.buffer)).toBe(true);
  expect(typeof result.durationMs).toBe('number');
  expect(result.durationMs).toBeGreaterThanOrEqual(0);
});
```

- [ ] **Step 3: Ajouter le test "initialise le pool avec 3 pages"**

```js
it('initialise le pool avec 3 pages au premier appel', async () => {
  await pdfService.generateFromHTML('<h1>Test</h1>');
  expect(mockBrowser.newPage).toHaveBeenCalledTimes(3);
});
```

- [ ] **Step 4: Adapter le test "recycle le browser après MAX_GENERATIONS"**

Le test existant vérifie `puppeteer.launch` × 2. Gardons-le tel quel car le recyclage browser global (50 générations) est conservé. Il reste valide.

- [ ] **Step 5: Adapter le test "ferme la page même en cas d erreur"**

Avec le pool, la page n'est plus fermée mais relâchée. Modifier le test existant pour vérifier que `_releasePage` est appelé (via `_activeCount`) :

Remplacer le bloc existant :

```js
it('ferme la page même en cas d erreur', async () => {
  mockPage.setContent.mockRejectedValueOnce(new Error('Timeout'));
  await expect(pdfService.generateFromHTML('<h1>Fail</h1>')).rejects.toThrow('Timeout');
  expect(mockPage.close).toHaveBeenCalledTimes(1);
});
```

Par :

```js
it('relâche la page même en cas d erreur', async () => {
  mockPage.setContent.mockRejectedValueOnce(new Error('Timeout'));
  await expect(pdfService.generateFromHTML('<h1>Fail</h1>')).rejects.toThrow('Timeout');
  expect(pdfService._activeCount).toBe(0);
});
```

- [ ] **Step 6: Adapter le test "generateDashboardPDF appelle generateFromHTML"**

Remplacer le test existant par :

```js
it('generateDashboardPDF retourne buffer et durationMs', async () => {
  const result = await pdfService.generateDashboardPDF({ passRate: 50 }, { darkMode: true });
  expect(result).toHaveProperty('buffer');
  expect(result).toHaveProperty('durationMs');
});
```

- [ ] **Step 7: Exécuter les tests unitaires**

Run:

```bash
cd backend && npx jest tests/services/pdf.service.test.js --no-coverage
```

Expected: PASS (8 tests)

---

### Task 4: Mettre à jour les tests d'intégration route PDF

**Files:**

- Modify: `backend/tests/integration/pdf.routes.test.js`

- [ ] **Step 1: Adapter le mock de pdfService pour retourner `{ buffer, durationMs }`**

Dans le bloc `jest.mock('../../services/pdf.service'...)` du fichier, remplacer par :

```js
jest.mock('../../services/pdf.service', () => ({
  generateDashboardPDF: jest.fn().mockResolvedValue({ buffer: Buffer.from('%PDF-1.4 test'), durationMs: 1245 }),
}));
```

- [ ] **Step 2: Ajouter le test du header X-PDF-Generation-Time**

Ajouter dans le `describe('PDF Routes')` :

```js
it('POST /api/pdf/generate retourne le header X-PDF-Generation-Time', async () => {
  const res = await request(app)
    .post('/api/pdf/generate')
    .set('Authorization', token)
    .send({ projectId: 1, format: 'A4' });

  expect(res.status).toBe(200);
  expect(res.headers['x-pdf-generation-time']).toBe('1245');
});
```

- [ ] **Step 3: Exécuter les tests d'intégration**

Run:

```bash
cd backend && npx jest tests/integration/pdf.routes.test.js --no-coverage
```

Expected: PASS (4 tests)

---

### Task 5: Validation globale

- [ ] **Step 1: Lancer tous les tests du backend**

```bash
cd backend && npm test
```

Expected: tous les tests passent (489/491 ou équivalent).

- [ ] **Step 2: Vérifier le lint**

```bash
cd backend && npx eslint services/pdf.service.ts routes/pdf.routes.ts
```

Expected: 0 erreur.

- [ ] **Step 3: Vérifier TypeScript**

```bash
cd backend && npm run typecheck
```

Expected: 0 erreur.

---

## Self-Review Checklist

1. **Spec coverage:**
   - Pool de 3 pages réutilisables → Task 1 (Step 1-5) ✅
   - Sémaphore à 3 + queue max 5 → Task 1 (Step 3 `_acquirePage`) ✅
   - Rotation page toutes les 20 générations → Task 1 (Step 4 `_rotatePageEntry`) ✅
   - Header `X-PDF-Generation-Time` → Task 2 ✅
   - Log WARN si > 10s → Task 1 (Step 5) ✅
   - Tests unitaires + intégration → Task 3 + 4 ✅

2. **Placeholder scan:** Aucun TBD/TODO/similar trouvé ✅

3. **Type consistency:** `generateFromHTML` retourne `{ buffer, durationMs }` dans Task 1, consommé par `generateDashboardPDF` dans Task 1, et par la route dans Task 2. Coherent ✅
