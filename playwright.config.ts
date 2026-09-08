import { defineConfig, devices } from '@playwright/test'

// Each FE worktree runs its own dev server on its own port (never the shared
// 5173) — pass it via ENTIX_DEV_PORT so specs never accidentally hit another
// agent's server. Falls back to 5173 for the main checkout / CI.
const DEV_PORT = process.env.ENTIX_DEV_PORT ?? '5173'

export default defineConfig({
  testDir: './tests',
  testIgnore: process.env.CI && process.env.VISUAL_REGRESSION !== '1' ? '**/visual-regression.spec.ts' : undefined,
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: `http://localhost:${DEV_PORT}`,
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
        port: Number(DEV_PORT),
        reuseExistingServer: false,
        timeout: 120000,
      }
    : {
        command: 'VITE_TURNSTILE_SITEKEY=1x00000000000000000000AA npm run dev',
        port: Number(DEV_PORT),
        reuseExistingServer: true,
      },
})