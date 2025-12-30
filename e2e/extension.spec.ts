import { test, expect, chromium, BrowserContext } from '@playwright/test';
import path from 'path';
import { PopupPage } from './pages/PopupPage';
import fs from 'fs';
import os from 'os';

test.describe('Extension Popup', () => {
  let context: BrowserContext;
  let extensionId: string;
  let userDataDir: string;

  // Use test.beforeAll/AfterAll if we want one context, but for isolation per test is better?
  // Persistent context is heavy. Let's do per test.

  test.beforeEach(async () => {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-user-data-'));
    const pathToExtension = path.resolve(__dirname, '../dist');

    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false, // Allow args to control headless mode
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--headless=new' // Force new headless mode
      ],
    });

    // Wait for service worker
    let [background] = context.serviceWorkers();
    if (!background)
      background = await context.waitForEvent('serviceworker', { timeout: 10000 });

    extensionId = background.url().split('/')[2];
  });

  test.afterEach(async () => {
    await context.close();
    // Cleanup userDataDir? Playwright might not delete it.
    // fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  test('should render title', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    const popup = new PopupPage(page);
    await expect(popup.header).toBeVisible();
  });

  test('should add and remove a custom site', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    const popup = new PopupPage(page);
    await popup.addSite('example.com');
    const item = await popup.getSiteItem('example.com');
    await expect(item).toBeVisible();

    await popup.removeSite('example.com');
    await expect(item).toBeHidden();
  });

  test('should toggle master switch', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    const popup = new PopupPage(page);

    // Check internal checkbox state
    const checkbox = popup.masterSwitch.locator('input');
    await expect(checkbox).toBeChecked();

    await popup.toggleMasterSwitch();
    await expect(checkbox).not.toBeChecked();

    await popup.toggleMasterSwitch();
    await expect(checkbox).toBeChecked();
  });
});
