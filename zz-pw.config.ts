import base from './playwright.config'
import { defineConfig } from '@playwright/test'
export default defineConfig({ ...base, testDir: './tests', workers: 3, retries: 0, reporter: 'line', webServer: undefined,
  use: { ...(base as any).use, launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' } } })
