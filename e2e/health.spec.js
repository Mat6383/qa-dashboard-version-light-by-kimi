const { test, expect } = require('@playwright/test');

test('API health retourne OK', async ({ request }) => {
  const res = await request.get('http://localhost:3001/api/health');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe('OK');
});

test('API health/detailed retourne les checks SQLite', async ({ request }) => {
  const res = await request.get('http://localhost:3001/api/health/detailed');
  expect([200, 503]).toContain(res.status());
  const body = await res.json();
  expect(body.checks).toHaveProperty('syncHistoryDB');
  expect(body.checks).toHaveProperty('commentsDB');
});
