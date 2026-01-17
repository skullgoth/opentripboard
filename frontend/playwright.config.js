// T052: Playwright configuration for E2E tests
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: '**/future-features/**', // Ignore tests for unimplemented features
  fullyParallel: false, // Run tests sequentially for E2E reliability
  forbidOnly: !!process.env.CI,
  retries: 0, // No retry
  workers: 1, // Single worker for E2E tests
  timeout: 60000, // 60 second default timeout
  expect: {
    timeout: 10000, // 10 second expect timeout
  },
  reporter: [
    ['html', { open: 'on-failure', outputFolder: 'playwright-report' }],
    ['list'],
    ...(process.env.CI ? [['github']] : []),
  ],

  use: {
    // Default to local dev environment on 5173
    baseURL: process.env.BASE_URL || 'http://localhost',
    trace: 'on',  // Always capture trace for review
    screenshot: 'on',  // Always capture screenshots
    video: 'on',  // Always record video for all tests
    actionTimeout: 15000, // 15 second action timeout
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Only start webServer when not in container (BASE_URL not set)
  ...(!process.env.BASE_URL && {
    webServer: {
      command: 'docker-compose up -d',
      url: 'http://localhost',
      reuseExistingServer: true,
      timeout: 120000,
    },
  }),
});
