import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/edge-function-rls.spec.ts'], // Exclude API-only tests
    },
    {
      name: 'edge-rls',
      testMatch: '**/edge-function-rls.spec.ts',
      use: {
        // API-only tests don't need a browser, but Playwright requires a project
        ...devices['Desktop Chrome'],
      },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    // Don't start webserver for edge-rls tests (they use Supabase)
    ignoreHTTPSErrors: true,
  },
});
