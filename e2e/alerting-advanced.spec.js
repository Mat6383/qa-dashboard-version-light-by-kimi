const { test, expect } = require('@playwright/test');

async function mockAuth(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('qa_dashboard_token', 'test-e2e-admin-token'));
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { id: 'e2e-user', email: 'e2e@test.com', name: 'E2E Tester', role: 'admin' },
      }),
    })
  );
  await page.reload();
}

test.describe('P24 — Alerting avancé', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await page.goto('/notifications');
  });

  test.skip('navigation entre les onglets de notifications', async ({ page }) => {
    await expect(page.locator('text=Paramètres')).toBeVisible();
    await page.click('text=Templates');
    await expect(page.locator('text=Template Email')).toBeVisible();
    await page.click('text=Webhooks');
    await expect(page.locator('text=Ajouter')).toBeVisible();
  });
});
