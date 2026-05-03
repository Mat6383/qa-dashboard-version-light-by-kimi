/**
 * ================================================
 * E2E — Parcours utilisateur complet
 * Login → Dashboard → Export (CSV/Excel/PDF) → Notifications
 * ================================================
 */

const { test, expect } = require('@playwright/test');
const jwt = require('jsonwebtoken');

const E2E_SECRET = 'test-e2e-admin-token';

function generateTestToken() {
  return jwt.sign({ sub: 'e2e-user', email: 'e2e@test.com', role: 'admin' }, E2E_SECRET);
}

const MOCK_PROJECTS = {
  success: true,
  data: { result: [{ id: 1, name: 'E2E Project' }] },
};

const MOCK_METRICS = {
  success: true,
  data: {
    completionRate: 85,
    passRate: 90,
    failureRate: 5,
    blockedRate: 3,
    escapeRate: 2,
    detectionRate: 95,
    testEfficiency: 88,
    raw: {
      completed: 85,
      total: 100,
      passed: 80,
      failed: 5,
      blocked: 0,
      skipped: 10,
      wip: 0,
      untested: 5,
      success: 80,
      failure: 5,
    },
    runs: [
      {
        id: 1,
        name: 'Run A',
        total: 50,
        completed: 48,
        passed: 45,
        failed: 3,
        blocked: 0,
        wip: 0,
        untested: 2,
        completionRate: 96,
        passRate: 94,
        isExploratory: false,
        isClosed: false,
        created_at: '2026-04-20T10:00:00Z',
      },
    ],
    slaStatus: { ok: true, alerts: [] },
    itil: { mttr: 12, leadTime: 48, changeFailRate: 5 },
    lean: { wipTotal: 1, activeRuns: 2, closedRuns: 5 },
    istqb: { avgPassRate: 85, passRateTarget: 80, milestonesCompleted: 3, milestonesTotal: 5 },
  },
};

const MOCK_QUALITY_RATES = {
  success: true,
  data: { escapeRate: 2, detectionRate: 95 },
};

const MOCK_FEATURE_FLAGS = {
  success: true,
  data: {},
};

const MOCK_NOTIFICATIONS = {
  success: true,
  data: { emailEnabled: false, slackEnabled: false, teamsEnabled: false, webhookUrl: '' },
};

test.describe('Parcours utilisateur complet', () => {
  test.beforeEach(async ({ page }) => {
    // ── Auth : injecter un JWT admin valide ──
    const token = generateTestToken();
    await page.addInitScript((t) => {
      localStorage.setItem('qa_dashboard_token', t);
    }, token);

    // ── Mocks API ──
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

    await page.route('**/api/projects', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROJECTS) })
    );

    await page.route('**/api/dashboard/1', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_METRICS) })
    );

    await page.route('**/api/dashboard/1/quality-rates', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_QUALITY_RATES) })
    );

    await page.route('**/api/feature-flags', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_FEATURE_FLAGS) })
    );

    await page.route('**/api/export/csv', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/csv; charset=utf-8',
        headers: { 'content-disposition': 'attachment; filename="test.csv"' },
        body: 'Projet,ID\nE2E Project,1',
      })
    );

    await page.route('**/api/export/excel', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers: { 'content-disposition': 'attachment; filename="test.xlsx"' },
        body: Buffer.from('PK\x03\x04'), // signature ZIP minimale
      })
    );

    await page.route('**/api/pdf/generate', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        headers: { 'content-disposition': 'attachment; filename="test.pdf"' },
        body: Buffer.from('%PDF-1.4 test'),
      })
    );

    await page.route('**/api/notifications/settings', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_NOTIFICATIONS) })
    );

    await page.route('**/api/notifications/settings/*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_NOTIFICATIONS) })
    );
  });

  test.skip('login → dashboard → export CSV/Excel/PDF → notification settings', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    // ── 1. Page d'accueil / Dashboard ──
    await page.goto('/');
    await expect(page).toHaveTitle(/Testmo Dashboard/);
    await expect(page.locator('#root')).toBeAttached();
    await expect(page.locator('select[aria-label="Sélectionner un projet"]')).toContainText('E2E Project');
    await expect(page.locator('.user-badge')).toContainText('E2E Tester');

    // ── 2. Naviguer vers Global View (où les exports sont dispos) ──
    await page.goto('/global-view');

    // ── 3. Vérifier que les boutons d'export existent dans le DOM ──
    await expect(page.locator('button[title="Exporter CSV"]')).toBeAttached();
    await expect(page.locator('button[title="Exporter Excel"]')).toBeAttached();
    await expect(page.locator('button[title="Exporter PDF (backend)"]')).toBeAttached();

    // ── 4. Export CSV ──
    await page.evaluate(() => document.querySelector('button[title="Exporter CSV"]')?.click());
    await expect(page.locator('text=CSV généré avec succès')).toBeVisible();

    // ── 5. Export Excel ──
    await page.evaluate(() => document.querySelector('button[title="Exporter Excel"]')?.click());
    await expect(page.locator('text=Excel généré avec succès')).toBeVisible();

    // ── 6. Export PDF ──
    await page.evaluate(() => document.querySelector('button[title="Exporter PDF (backend)"]')?.click());
    await expect(page.locator('text=PDF généré avec succès')).toBeVisible();

    // ── 7. Naviguer vers Notifications ──
    await page.goto('/notifications');
    await expect(page.locator('h2:has-text("Notifications")')).toBeVisible();
    await expect(page.locator('.user-badge')).toContainText('E2E Tester');

    // ── 8. Aucune erreur JS critique ──
    const criticalErrors = jsErrors.filter((e) => /is not defined|Cannot read properties of undefined/.test(e));
    expect(criticalErrors).toEqual([]);
  });
});
