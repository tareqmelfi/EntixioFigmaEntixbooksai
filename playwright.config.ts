import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.CI ? 'http://localhost:5173' : 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: process.env.CI
    ? {
        command: 'VITE_TURNSTILE_SITEKEY=1x00000000000000000000AA npm run dev',
        port: 5173,
        reuseExistingServer: false,
        timeout: 120000,
      }
    : {
        command: 'VITE_TURNSTILE_SITEKEY=1x00000000000000000000AA npm run dev',
        port: 5173,
        reuseExistingServer: true,
      },
})