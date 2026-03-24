import { defineConfig } from '@playwright/test';

const TEST_PORT = 5174;
const TEST_DB = 'libaduk_test';

process.env.MONGO_DB = TEST_DB;

export default defineConfig({
  globalSetup: './tests/e2e/global-setup.js',
  testDir: 'tests/e2e',
  timeout: 10000,
  expect: {
    timeout: 5000
  },
  use: {
    baseURL: `http://localhost:${TEST_PORT}`,
    actionTimeout: 2000,
    navigationTimeout: 5000
  },
  webServer: {
    command: `npm run dev -- --port ${TEST_PORT}`,
    port: TEST_PORT,
    reuseExistingServer: !process.env.CI,
    env: {
      MONGO_DB: TEST_DB
    }
  }
});
