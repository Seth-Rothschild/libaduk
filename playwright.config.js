import { defineConfig } from '@playwright/test';

export default defineConfig({
  globalSetup: './tests/e2e/global-setup.js',
  testDir: 'tests/e2e',
  timeout: 10000,
  expect: {
    timeout: 5000
  },
  use: {
    baseURL: 'http://localhost:5173',
    actionTimeout: 2000,
    navigationTimeout: 5000
  }
});
