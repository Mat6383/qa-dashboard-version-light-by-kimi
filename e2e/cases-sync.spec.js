/**
 * ================================================
 * E2E — Flow Cases Sync complet
 * Sélection projet → Itération → Preview → Sync → Vérification historique
 * ================================================
 */

const { test, expect } = require('@playwright/test');
const jwt = require('jsonwebtoken');

const E2E_SECRET = 'test-e2e-admin-token';

function generateTestToken() {
  return jwt.sign({ sub: 'e2e-user', email: 'e2e@test.com', role: 'admin' }, E2E_SECRET);
}

const MOCK_SYNC_PROJECTS = [
  { id: 'workshop-web', label: 'Workshop Web', configured: true, gitlabProjectId: 141 },
  { id: 'legacy-mobile', label: 'Legacy Mobile', configured: false },
];

const MOCK_ITERATIONS = [
  { id: 1, title: 'R06 - run 1' },
  { id: 2, title: 'R06 - run 2' },
  { id: 3, title: 'R14 - Pilot' },
];

const MOCK_PREVIEW = {
  iteration: { name: 'R06 - run 1', id: null },
  folder: { parent: 'R06', child: 'R06 - run 1', exists: false },
  issues: [
    { iid: 101, url: 'https://gitlab.example.com/issues/101', title: '[TEST] Connexion utilisateur', status: 'create' },
    { iid: 102, url: 'https://gitlab.example.com/issues/102', title: '[TEST] Déconnexion', status: 'create' },
    { iid: 103, url: 'https://gitlab.example.com/issues/103', title: 'Bug affichage mobile', status: 'update' },
    {
      iid: 104,
      url: 'https://gitlab.example.com/issues/104',
      title: '[PRÉREQUIS] Environnement de test',
      status: 'skip',
    },
  ],
  summary: { toCreate: 2, toUpdate: 1, toSkip: 1, total: 4 },
  target_folder: { id: null, name: 'R06 - run 1' },
};

const MOCK_HISTORY = [
  {
    id: 1,
    project_name: 'Workshop Web',
    iteration_name: 'R06 - run 1',
    mode: 'execute',
    created: 2,
    updated: 1,
    skipped: 1,
    errors: 0,
    total_issues: 4,
    executed_at: '2026-05-05T08:00:00Z',
  },
];

test.describe('Cases Sync — Flow complet', () => {
  test.beforeEach(async ({ page }) => {
    const token = generateTestToken();
    await page.addInitScript((t) => {
      localStorage.setItem('qa_dashboard_token', t);
    }, token);

    // ── Auth ──
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 'e2e-user', name: 'E2E Tester', email: 'e2e@test.com', role: 'admin' },
        }),
      })
    );

    // ── Mocks Cases Sync ──
    await page.route('**/api/sync/projects', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_SYNC_PROJECTS }),
      })
    );

    await page.route(/\/api\/sync\/[^/]+\/iterations/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_ITERATIONS }),
      })
    );

    await page.route('**/api/sync/cases/preview', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_PREVIEW }),
      })
    );

    await page.route('**/api/sync/history', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_HISTORY }),
      })
    );

    // SSE execute — stream mock avec body texte
    await page.route('**/api/sync/cases/execute', (route) => {
      const sseBody = [
        'data: {"level":"info","message":"Starting case sync for iteration R06 - run 1"}\n\n',
        'data: {"level":"debug","message":"CREATE: [TEST] Connexion utilisateur"}\n\n',
        'data: {"level":"debug","message":"CREATE: [TEST] Déconnexion"}\n\n',
        'data: {"level":"debug","message":"UPDATE: Bug affichage mobile"}\n\n',
        'data: {"level":"debug","message":"SKIP: [PRÉREQUIS] Environnement de test"}\n\n',
        'data: {"level":"done","created":2,"updated":1,"skipped":1,"enriched":0,"errors":0,"total":4,"testmo_run_url":null}\n\n',
      ].join('');

      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: {
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
        body: sseBody,
      });
    });
  });

  test('sélection projet → itération → preview → sync → vérification historique', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    // ── 1. Accéder à la page Global View et ouvrir l'onglet Sync ──
    await page.goto('/global-view');
    await expect(page).toHaveTitle(/Testmo Dashboard/);

    // Cliquer sur l'onglet GitLab Sync
    const syncTab = page.locator('#d4-tab-gitlab-sync');
    await expect(syncTab).toBeVisible();
    await syncTab.click();

    // ── 2. Sélectionner un projet configuré ──
    const projectSelect = page.locator('.d6-select').first();
    await expect(projectSelect).toBeVisible();
    await projectSelect.selectOption('workshop-web');

    // Vérifier le badge "Configuré"
    await expect(page.locator('.d6-badge-configured')).toContainText('Configuré');

    // ── 3. Sélectionner une itération ──
    const iterSelect = page.locator('.d6-select').nth(1);
    await expect(iterSelect).toBeVisible();
    await iterSelect.selectOption('R06 - run 1');

    // ── 4. Lancer l'analyse (preview) ──
    const analyzeBtn = page.locator('button:has-text("Analyser")');
    await expect(analyzeBtn).toBeEnabled();
    await analyzeBtn.click();

    // Attendre l'aperçu
    await expect(page.locator('.d6-section:has-text("Aperçu")')).toBeVisible();

    // Vérifier le résumé des chips
    await expect(page.locator('.d6-chip-create')).toContainText('2 à créer');
    await expect(page.locator('.d6-chip-update')).toContainText('1 à mettre à jour');
    await expect(page.locator('.d6-chip-skip')).toContainText('1 à ignorer');
    await expect(page.locator('.d6-chip-total')).toContainText('4 au total');

    // Vérifier la liste des tickets
    await expect(page.locator('.d6-issue-list')).toBeVisible();
    await expect(page.locator('.d6-issue-item')).toHaveCount(4);

    // ── 5. Lancer la synchronisation ──
    const executeBtn = page.locator('button:has-text("Confirmer et Synchroniser")');
    await expect(executeBtn).toBeEnabled();
    await executeBtn.click();

    // Attendre l'état "done"
    await expect(page.locator('text=Synchronisation terminée')).toBeVisible({ timeout: 10000 });

    // Vérifier les stats finales
    await expect(page.locator('.d6-stat-created')).toContainText('2');
    await expect(page.locator('.d6-stat-updated')).toContainText('1');
    await expect(page.locator('.d6-stat-skipped')).toContainText('1');
    await expect(page.locator('.d6-stat-errors')).toContainText('0');

    // ── 6. Vérifier l'historique ──
    await expect(page.locator('.d6-history-table')).toBeVisible();
    await expect(page.locator('.d6-history-table tbody tr')).toHaveCount(1);
    await expect(page.locator('.d6-history-table tbody tr')).toContainText('R06 - run 1');
    await expect(page.locator('.d6-history-table tbody tr')).toContainText('Exécution');

    // ── 7. Aucune erreur JS critique ──
    const criticalErrors = jsErrors.filter((e) => /is not defined|Cannot read properties of undefined/.test(e));
    expect(criticalErrors).toEqual([]);
  });

  test('projet non configuré affiche un avertissement', async ({ page }) => {
    await page.addInitScript((t) => {
      localStorage.setItem('qa_dashboard_token', t);
    }, generateTestToken());

    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 'e2e-user', name: 'E2E Tester', email: 'e2e@test.com', role: 'admin' },
        }),
      })
    );

    await page.route('**/api/sync/projects', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_SYNC_PROJECTS }),
      })
    );

    await page.goto('/global-view');
    await page.locator('#d4-tab-gitlab-sync').click();

    // Sélectionner le projet non configuré
    const projectSelect = page.locator('.d6-select').first();
    await projectSelect.selectOption('legacy-mobile');

    // Vérifier le badge et l'alerte
    await expect(page.locator('.d6-badge-unconfigured')).toContainText('Non configuré');
    await expect(page.locator('.d6-alert-warn')).toContainText("n'est pas encore configuré");
  });
});
