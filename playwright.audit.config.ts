import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: './tests', timeout: 30000, workers: 1, reporter: 'list', use: { baseURL: 'http://127.0.0.1:5279', headless: true, serviceWorkers: 'block' }, webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5279 --strictPort', url: 'http://127.0.0.1:5279', reuseExistingServer: false } })
