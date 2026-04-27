import { defineConfig, devices } from '@playwright/test';

const POS_BASE_URL = process.env.POS_BASE_URL ?? 'http://localhost:5173';
const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL ?? 'http://localhost:3001';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html']] : 'list',
  use: {
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'pos',
      use: { ...devices['Desktop Chrome'], baseURL: POS_BASE_URL, viewport: { width: 1280, height: 800 } },
      testMatch: /pos\/.*\.spec\.ts/,
    },
    {
      name: 'admin',
      use: { ...devices['Desktop Chrome'], baseURL: ADMIN_BASE_URL },
      testMatch: /admin\/.*\.spec\.ts/,
    },
  ],
});
