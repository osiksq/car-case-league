import { defineConfig, devices } from '@playwright/test';

const origin = 'http://127.0.0.1:4173';
const baseURL = `${origin}/car-case-league/`;
const devURL = 'http://127.0.0.1:4174/car-case-league/';
const channel = process.env.PLAYWRIGHT_CHANNEL;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', testIgnore: '**/*.dev.spec.ts', use: { ...devices['Desktop Chrome'], channel } },
    { name: 'mobile', testIgnore: '**/*.dev.spec.ts', use: { ...devices['Pixel 7'], channel } },
    {
      name: 'development',
      testMatch: '**/*.dev.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: devURL, channel },
    },
  ],
  webServer: [{
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
  }, {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174 --strictPort',
    url: devURL,
    reuseExistingServer: false,
    timeout: 30_000,
  }],
});
