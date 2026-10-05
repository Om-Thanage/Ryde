const { defineConfig, devices } = require('@playwright/test');
const { existsSync } = require('node:fs');
module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' } },
  ],
  webServer: [
    { command: 'node scripts/start-e2e-api.cjs', url: 'http://127.0.0.1:3100/api/health', reuseExistingServer: false, timeout: 60000 },
    { command: 'npm --prefix client run dev -- --host localhost --port 4173 --strictPort', env: { API_PROXY_TARGET: 'http://127.0.0.1:3100' }, url: 'http://localhost:4173', reuseExistingServer: false, timeout: 60000 },
  ],
});
