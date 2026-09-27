import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base,
  testMatch: /(?:marketing-capabilities|contractor-identity|expense-document-view|inbox-review|sidebar-section-return|quotes-dashboard|project-tasks|simple-purchases)\.spec\.ts/,
  projects: [
    {name: 'safari-desktop', use:{...devices['Desktop Safari']}},
    {name: 'iphone', testMatch:/marketing-capabilities\.spec\.ts/, use:{...devices['iPhone 13']}},
    {name: 'ipad', testMatch:/marketing-capabilities\.spec\.ts/, use:{...devices['iPad Pro 11']}},
  ],
});
