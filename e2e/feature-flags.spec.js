const { test, expect } = require('@playwright/test');
const jwt = require('jsonwebtoken');

const E2E_SECRET = 'test-e2e-admin-token';

function generateTestToken() {
  return jwt.sign({ sub: 'e2e-user', email: 'e2e@test.com', role: 'admin' }, E2E_SECRET);
}

test.describe('Feature Flags — API', () => {
  test('GET /api/feature-flags retourne un objet', async ({ request }) => {
    const res = await request.get('http://localhost:3001/api/feature-flags', {
      headers: { 'X-Admin-Token': 'test-e2e-admin-token' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.data).toBe('object');
  });

  test('GET /api/feature-flags/:key avec userId applique rollout sticky', async ({ request }) => {
    const headers = { 'X-Admin-Token': 'test-e2e-admin-token' };

    // Créer un flag à 50% rollout
    await request.post('http://localhost:3001/api/feature-flags/admin', {
      headers,
      data: { key: 'e2e-rollout-flag', enabled: true, description: 'E2E rollout', rolloutPercentage: 50 },
    });

    // Appeler plusieurs fois avec le même userId → résultat stable
    const res1 = await request.get('http://localhost:3001/api/feature-flags/e2e-rollout-flag?userId=e2e-user-42', {
      headers,
    });
    const body1 = await res1.json();
    expect(body1.data.rolloutPercentage).toBe(50);

    const values = new Set();
    for (let i = 0; i < 5; i++) {
      const r = await request.get('http://localhost:3001/api/feature-flags/e2e-rollout-flag?userId=e2e-user-42', {
        headers,
      });
      values.add((await r.json()).data.enabled);
    }
    // Même userId → même résultat déterministe
    expect(values.size).toBe(1);

    // Deux userIds différents → résultats potentiellement différents (probabiliste, on vérifie juste la structure)
    const resA = await request.get('http://localhost:3001/api/feature-flags/e2e-rollout-flag?userId=user-a', {
      headers,
    });
    const resB = await request.get('http://localhost:3001/api/feature-flags/e2e-rollout-flag?userId=user-b', {
      headers,
    });
    expect((await resA.json()).data.enabled).toBeDefined();
    expect((await resB.json()).data.enabled).toBeDefined();

    // Cleanup
    await request.delete('http://localhost:3001/api/feature-flags/admin/e2e-rollout-flag', { headers });
  });

  test('PUT /api/feature-flags/:key met à jour un flag', async ({ request }) => {
    const headers = { 'X-Admin-Token': 'test-e2e-admin-token' };
    const res = await request.put('http://localhost:3001/api/feature-flags/admin/test-flag', {
      headers,
      data: { enabled: true },
    });
    const body = await res.json();
    expect(res.ok()).toBeTruthy();
    expect(body.data.enabled).toBe(true);

    // Vérifier que le flag persiste
    const getRes = await request.get('http://localhost:3001/api/feature-flags/test-flag', { headers });
    expect((await getRes.json()).data.enabled).toBe(true);
  });
});

test.describe('Feature Flags Admin — UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((t) => {
      localStorage.setItem('qa_dashboard_token', t);
    }, 'test-e2e-admin-token');
  });

  test.skip('parcours CRUD complet', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    // Mocker les endpoints admin feature flags
    let flags = [];

    await page.route('**/api/feature-flags/admin', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: flags }),
        });
      } else if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        flags.push({
          key: body.key,
          enabled: body.enabled,
          description: body.description,
          rolloutPercentage: body.rolloutPercentage ?? 100,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: flags[flags.length - 1] }),
        });
      }
    });

    await page.route('**/api/feature-flags/admin/**', (route) => {
      const url = route.request().url();
      const key = url.split('/').pop();
      const method = route.request().method();

      if (method === 'PUT') {
        const body = route.request().postDataJSON();
        const idx = flags.findIndex((f) => f.key === key);
        if (idx >= 0) {
          flags[idx] = { ...flags[idx], ...body, updatedAt: new Date().toISOString() };
        }
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: flags[idx] }),
        });
      } else if (method === 'DELETE') {
        flags = flags.filter((f) => f.key !== key);
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, deleted: true }),
        });
      }
    });

    // 1. Naviguer vers l'admin feature flags
    await page.goto('/admin/feature-flags');
    await expect(page.locator('h1:has-text("Feature Flags")')).toBeVisible();

    // 2. Créer un flag
    await page.click('button:has-text("Nouveau flag")');
    await page.fill('input[placeholder="ex: annualTrendsV2"]', 'e2e-test-flag');
    await page.fill('input[placeholder="Description du flag"]', 'Flag de test E2E');
    await page.click('button[type="submit"]:has-text("Créer")');
    await expect(page.locator('text=Flag créé')).toBeVisible();

    // 3. Modifier le rollout à 50%
    await page.click('button[title="Modifier"]', { timeout: 5000 });
    await page.evaluate(() => {
      const slider = document.querySelector('input[type="range"]');
      if (slider) slider.value = 50;
      slider?.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.click('button[type="submit"]:has-text("Mettre à jour")');
    await expect(page.locator('text=Flag mis à jour')).toBeVisible();

    // 4. Toggle le flag
    await page.click('button[title="Désactiver"]');
    await expect(page.locator('text=Flag e2e-test-flag désactivé')).toBeVisible();

    // 5. Supprimer le flag
    page.once('dialog', (dialog) => dialog.accept());
    await page.click('button[title="Supprimer"]');
    await expect(page.locator('text=Flag supprimé')).toBeVisible();

    // 6. Pas d'erreur JS critique
    const criticalErrors = jsErrors.filter((e) => /is not defined|Cannot read properties of undefined/.test(e));
    expect(criticalErrors).toEqual([]);
  });
});
