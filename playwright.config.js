// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'npm run start -w backend',
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'development',
        PORT: '3001',
        TESTMO_URL: 'http://localhost',
        TESTMO_TOKEN: 'test',
        GITLAB_URL: 'http://localhost',
        GITLAB_TOKEN: 'test',
        ADMIN_API_TOKEN: 'test-e2e-admin-token',
      },
    },
    {
      command: 'npm run preview -w frontend -- --port 3000',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
