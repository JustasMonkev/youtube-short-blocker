import { Page, Locator, expect } from '@playwright/test';

export class PopupPage {
  readonly page: Page;
  readonly header: Locator;
  readonly masterSwitch: Locator;
  readonly addSiteInput: Locator;
  readonly addSiteButton: Locator;
  readonly customSitesList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = page.locator('text=YouTube Shorts Blocker');
    // Locate the label wrapping the checkbox, as the checkbox is hidden
    this.masterSwitch = page.locator('label:has(input[type="checkbox"])').first();
    this.addSiteInput = page.locator('input#custom-site');
    this.addSiteButton = page.locator('button:has-text("Add to blocklist")');
    this.customSitesList = page.locator('ul');
  }

  async goto() {
    // Navigate to the popup.html
    // In extension testing, we usually get the extension ID and navigate to chrome-extension://[ID]/popup.html
    // But getting ID requires browser context.
    // We will handle navigation in the spec file setup or pass the full URL here if known.
    // For now, assume spec handles `goto`.
  }

  async toggleMasterSwitch() {
    // Click the label or input container because input might be hidden/opacity 0
    await this.masterSwitch.click({ force: true });
  }

  async addSite(url: string) {
    await this.addSiteInput.fill(url);
    await this.addSiteButton.click();
  }

  async getSiteItem(host: string) {
    return this.customSitesList.locator(`li:has-text("${host}")`);
  }

  async removeSite(host: string) {
    const item = await this.getSiteItem(host);
    await item.locator('button[aria-label^="Remove"]').click();
  }
}
