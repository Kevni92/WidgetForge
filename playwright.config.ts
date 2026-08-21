import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './playwright',
  outputDir: './test-results',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173/WidgetForge/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 5_000,
    navigationTimeout: 15_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'npm run dev --prefix playground -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/WidgetForge/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
