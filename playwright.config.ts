import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    headless: true, // Use new headless mode by default or explicitly 'new' if supported
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
            args: [
                `--disable-extensions-except=${path.resolve(__dirname, 'dist')}`,
                `--load-extension=${path.resolve(__dirname, 'dist')}`,
                '--headless=new', // Enforce new headless mode for extension support
                '--no-sandbox',
                '--disable-setuid-sandbox',
            ],
        },
      },
    },
  ],
});
