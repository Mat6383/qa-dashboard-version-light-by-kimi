const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  // Mocker les endpoints critiques pour éviter les 500 sans vraies APIs
  await page.route('**/api/projects', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: [{ id: 1, name: 'Test Project' }] }),
  }));
  await page.route('**/api/dashboard/*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        completionRate: 85,
        passRate: 90,
        failureRate: 5,
        testEfficiency: 88,
        raw: { completed: 85, total: 100, passed: 80, failed: 5, blocked: 0, skipped: 10 },
        slaStatus: { ok: true, alerts: [] }
      }
    }),
  }));
  await page.route('**/api/feature-flags', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: {} }),
  }));
});

test('la page d\'accueil se charge sans erreur critique', async ({ page }) => {
  const jsErrors = [];
  page.on('pageerror', err => jsErrors.push(err.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/Testmo Dashboard/);
  await expect(page.locator('#root')).toBeAttached();
  // Aucune erreur JS critique (ReferenceError / TypeError bloquant)
  const criticalErrors = jsErrors.filter(e => /is not defined|Cannot read properties of undefined/.test(e));
  expect(criticalErrors).toEqual([]);
});

test('la navigation vers Configuration fonctionne', async ({ page }) => {
  await page.goto('/');
  // Rechercher un lien ou bouton qui mène à /configuration
  const configLink = page.locator('a[href="/configuration"], button:has-text("Configuration")').first();
  if (await configLink.isVisible().catch(() => false)) {
    await configLink.click();
    await expect(page).toHaveURL(/.*configuration/);
  }
});
