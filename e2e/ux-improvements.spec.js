const { test, expect } = require('@playwright/test');

// Helpers to build tRPC batched responses (tRPC v11 format: { result: { data: <value> } })
function makeProjectsListResponse() {
  return {
    result: {
      data: {
        success: true,
        data: { result: [{ id: 1, name: 'Test Project' }] },
        timestamp: new Date().toISOString(),
      },
    },
  };
}

function makeDashboardMetricsResponse() {
  return {
    result: {
      data: {
        success: true,
        data: {
          completionRate: 85,
          passRate: 90,
          failureRate: 5,
          testEfficiency: 88,
          raw: { completed: 85, total: 100, passed: 80, failed: 5, blocked: 0, skipped: 10 },
          slaStatus: { ok: true, alerts: [] },
        },
        timestamp: new Date().toISOString(),
      },
    },
  };
}

function makeDashboardQualityRatesResponse() {
  return {
    result: {
      data: {
        success: true,
        data: { escapeRate: 2, detectionRate: 98 },
        timestamp: new Date().toISOString(),
      },
    },
  };
}

function makeAnomaliesListResponse() {
  return {
    result: {
      data: {
        success: true,
        data: [],
        timestamp: new Date().toISOString(),
      },
    },
  };
}

function makeCircuitBreakersResponse() {
  return {
    result: {
      data: {
        success: true,
        data: [],
        timestamp: new Date().toISOString(),
      },
    },
  };
}

function makeGenericResponse() {
  return {
    result: {
      data: {
        success: true,
        data: {},
        timestamp: new Date().toISOString(),
      },
    },
  };
}

function buildTrpcBatchResponse(url) {
  // URL format: /trpc/proc1,proc2,proc3?batch=1&input=...
  const pathMatch = url.pathname.match(/^\/trpc\/(.+)$/);
  if (!pathMatch) return [makeGenericResponse()];

  const procedures = pathMatch[1].split(',').map((p) => p.trim().split('?')[0]);
  return procedures.map((proc) => {
    if (proc === 'projects.list') return makeProjectsListResponse();
    if (proc === 'dashboard.metrics') return makeDashboardMetricsResponse();
    if (proc === 'dashboard.qualityRates') return makeDashboardQualityRatesResponse();
    if (proc === 'anomalies.list') return makeAnomaliesListResponse();
    if (proc === 'anomalies.circuitBreakers') return makeCircuitBreakersResponse();
    return makeGenericResponse();
  });
}

test.beforeEach(async ({ page }) => {
  // Mock REST API endpoints
  await page.route('**/api/projects', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ id: 1, name: 'Test Project' }] }),
    })
  );
  await page.route('**/api/dashboard/*', (route) =>
    route.fulfill({
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
          slaStatus: { ok: true, alerts: [] },
        },
      }),
    })
  );
  await page.route('**/api/feature-flags', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    })
  );

  // Mock tRPC GET batch endpoint
  await page.route('**/trpc/**', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      const url = new URL(request.url());
      const responses = buildTrpcBatchResponse(url);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responses),
      });
    }
    route.continue();
  });
});

test.describe('UX Improvements', () => {
  test('compact mode toggle persists after reload', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-header');

    // Toggle compact mode (button with data-testid)
    const compactBtn = page.locator('[data-testid="compact-mode-toggle"]');
    await compactBtn.evaluate((el) => el.click());

    // Verify compact class is on body
    await expect(page.locator('body')).toHaveClass(/compact-mode/);

    // Reload
    await page.reload();
    await page.waitForSelector('.app-header');

    // Verify still compact
    await expect(page.locator('body')).toHaveClass(/compact-mode/);
  });

  test('keyboard help overlay opens and closes', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-header');

    // Press ? to open help
    await page.keyboard.press('?');
    await expect(page.locator('role=dialog')).toBeVisible();
    await expect(page.locator('text=Raccourcis clavier')).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(page.locator('role=dialog')).not.toBeVisible();
  });
});
