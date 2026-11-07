import { test, expect } from '@playwright/test';

async function ready(page) {
  await page.goto('/');
  await expect(page.locator('#home')).toHaveAttribute('aria-busy', 'false');
}
async function size(page, label, count) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel(label, { exact: false }).check();
  await expect(page.locator('#grid .cell')).toHaveCount(count);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('#settings-dialog')).not.toBeVisible();
}
async function edit(page, index) {
  if (await page.locator('#edit-toggle').getAttribute('aria-pressed') !== 'true') await page.locator('#edit-toggle').click();
  await page.locator(`#grid [data-index="${index}"]`).click();
}

test('clean page, all brand assets load, and no runtime or network errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await ready(page);
  await expect(page.locator('#grid .cell')).toHaveCount(9);
  await expect(page.locator('input[name="q"], .history-panel')).toHaveCount(0);
  await size(page, 'Medium', 16);
  await page.getByRole('button', { name: 'Add shortcut to cell 10', exact: true }).click();
  await expect(page.locator('#catalog .catalog-item')).toHaveCount(20);
  await expect.poll(() => page.locator('#catalog img').evaluateAll((images) => images.every((img) => img.complete && img.naturalWidth > 0))).toBe(true);
  await page.screenshot({ path: 'test-results/catalog.png', fullPage: true });
  await expect(page.locator('#catalog')).toMatchAriaSnapshot(`
    - button "WhatsApp"
    - button "Telegram"
    - button "Facebook"
    - button "ChatGPT"
    - button "YouTube"
    - button "Gmail"
    - button "Google"
    - button "Google Drive"
    - button "Instagram"
    - button "X (Twitter)"
    - button "GitHub"
    - button "LinkedIn"
    - button "Reddit"
    - button "Discord"
    - button "TikTok"
    - button "Spotify"
    - button "Netflix"
    - button "Notion"
    - button "Claude"
    - button "Gemini"
  `);
  expect(errors).toEqual([]);
});

test('all grid sizes persist and hidden shortcuts return after shrinking', async ({ page }) => {
  await ready(page);
  await size(page, 'Large', 25);
  await page.getByRole('button', { name: 'Add shortcut to cell 25', exact: true }).click();
  await page.getByRole('button', { name: 'Telegram', exact: true }).click();
  await expect(page.locator('#shortcut-dialog')).not.toBeVisible();
  await expect(page.locator('[data-index="24"]')).toHaveAttribute('href', 'https://web.telegram.org/');
  await expect(page.locator('[data-index="24"]')).toBeFocused();
  await size(page, 'Small', 9);
  await page.reload();
  await expect(page.locator('#grid .cell')).toHaveCount(9);
  await size(page, 'Medium', 16);
  await size(page, 'Large', 25);
  await expect(page.locator('[data-index="24"]')).toContainText('Telegram');
  await page.reload();
  await expect(page.locator('#grid .cell')).toHaveCount(25);
  await expect(page.locator('[data-index="24"]')).toContainText('Telegram');
});

test('custom upload, edit, replacement and removal persist with literal markup', async ({ page }) => {
  await ready(page);
  await size(page, 'Medium', 16);
  await page.getByRole('button', { name: 'Add shortcut to cell 10', exact: true }).click();
  await page.getByRole('tab', { name: 'Custom shortcut' }).click();
  await page.getByLabel('Shortcut name', { exact: true }).fill('<img src=x onerror=alert(1)>');
  await page.getByLabel('Website URL', { exact: true }).fill('https://example.com/my-page');
  await page.locator('#custom-icon').setInputFiles({
    name: 'icon.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1cAAAAASUVORK5CYII=', 'base64'),
  });
  await expect(page.locator('#icon-preview img')).toHaveAttribute('src', /^data:image\/png;base64,/);
  await page.getByRole('button', { name: 'Save shortcut', exact: true }).click();
  await expect(page.locator('#shortcut-dialog')).not.toBeVisible();
  await expect(page.locator('[data-index="9"]')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('[data-index="9"] img')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('[data-index="9"] img')).toHaveAttribute('src', /^data:image\/png;base64,/);
  await edit(page, 9);
  await page.getByLabel('Shortcut name', { exact: true }).fill('Edited shortcut');
  await page.getByRole('button', { name: 'Save shortcut', exact: true }).click();
  await expect(page.locator('#shortcut-dialog')).not.toBeVisible();
  await expect(page.locator('[data-index="9"]')).toContainText('Edited shortcut');
  await page.locator('[data-index="9"]').click();
  await page.getByRole('tab', { name: 'Popular websites' }).click();
  await page.getByRole('button', { name: 'Gmail', exact: true }).click();
  await expect(page.locator('#shortcut-dialog')).not.toBeVisible();
  await expect(page.locator('[data-index="9"]')).toContainText('Gmail');
  await page.locator('[data-index="9"]').click();
  await page.getByRole('button', { name: 'Remove shortcut', exact: true }).click();
  await expect(page.locator('#shortcut-dialog')).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Add shortcut to cell 10', exact: true })).toBeVisible();
});

test('legacy data, list view, drag and keyboard reorder survive upgrade', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('home_cards')) return;
    localStorage.setItem('home_cards', JSON.stringify([
      { label: 'Legacy favorite', icon: 'fab fa-github', url: 'https://github.com/user', color: '#123456' },
      { label: 'Second', icon: 'fas fa-star', url: 'https://example.com', color: '#abcdef' },
    ]));
    localStorage.setItem('home_view', 'list');
  });
  await ready(page);
  await expect(page.locator('#grid')).toHaveClass(/list-view/);
  await expect(page.locator('[data-index="0"] .legacy-icon')).toHaveCSS('background-color', 'rgb(18, 52, 86)');
  await page.locator('#edit-toggle').click();
  await page.locator('[data-index="0"]').dragTo(page.locator('[data-index="1"]'));
  await expect(page.locator('[data-index="1"]')).toContainText('Legacy favorite');
  await page.locator('[data-index="1"]').focus();
  await page.keyboard.press('Alt+ArrowDown');
  await expect(page.locator('[data-index="2"]')).toContainText('Legacy favorite');
  await page.reload();
  await expect(page.locator('[data-index="2"]')).toContainText('Legacy favorite');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('home_cards'))[0].label)).toBe('Legacy favorite');
});

test('unsafe legacy URLs are inert, custom unsafe URLs fail validation and dialogs block hotkeys', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('home_cards', JSON.stringify([{ label: 'Unsafe', icon: '', url: 'javascript:window.injected=true' }])));
  await ready(page);
  await expect(page.locator('[data-index="0"]')).not.toHaveAttribute('href');
  await page.locator('[data-index="0"]').click();
  await page.getByLabel('Website URL', { exact: true }).fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Save shortcut', exact: true }).click();
  await expect(page.locator('#shortcut-dialog')).toBeVisible();
  expect(await page.locator('#shortcut-url').evaluate((input) => input.validationMessage)).toContain('http://');
  await page.getByLabel('Shortcut name', { exact: true }).fill('123');
  await page.keyboard.press('1');
  await expect(page.locator('#shortcut-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#shortcut-dialog')).not.toBeVisible();
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
});

test('all layouts fit narrow windows and reduced motion is respected', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 568 });
  await ready(page);
  for (const [label, count] of [['Small', 9], ['Medium', 16], ['Large', 25]]) {
    await size(page, label, count);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const boxes = await page.locator('#grid .cell').evaluateAll((cells) => cells.map((c) => ({ w: c.offsetWidth, h: c.offsetHeight })));
    expect(new Set(boxes.map((box) => box.w)).size).toBeLessThanOrEqual(2);
    expect(new Set(boxes.map((box) => box.h)).size).toBe(1);
    expect(boxes.every((box) => Math.abs(box.w - box.h) <= 1)).toBe(true);
  }
  await page.getByRole('button', { name: 'Add shortcut to cell 25', exact: true }).click();
  expect(await page.locator('#shortcut-dialog').evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile-dialog.png', fullPage: true });
  expect(await page.locator('#shortcut-dialog').evaluate((dialog) => getComputedStyle(dialog).animationName)).toBe('none');
});

test('failed writes leave the original tile and show a save error', async ({ page }) => {
  await ready(page);
  await edit(page, 0);
  await page.getByLabel('Shortcut name', { exact: true }).fill('Unsaved name');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: 'Save shortcut', exact: true }).click();
  await expect(page.locator('#shortcut-error')).toContainText('Could not save');
  await expect(page.locator('[data-index="0"]')).toContainText('Discord');
});

test('numeric navigation works outside dialogs', async ({ page }) => {
  await ready(page);
  await page.route('https://discord.com/**', (route) => route.fulfill({ body: 'Destination reached' }));
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('1');
  await expect(page).toHaveURL('https://discord.com/app');
});

test('Shift plus a digit opens a new tab and keeps the homepage open', async ({ page, context }) => {
  await context.route('https://discord.com/**', (route) => route.fulfill({ body: 'Destination reached' }));
  await ready(page);
  const homepageUrl = page.url();
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  const newTab = context.waitForEvent('page');
  await page.keyboard.press('Shift+Digit1');
  const destination = await newTab;
  await expect(destination).toHaveURL('https://discord.com/app');
  await expect(destination.locator('body')).toContainText('Destination reached');
  expect(await destination.evaluate(() => window.opener === null)).toBe(true);
  await expect(page).toHaveURL(homepageUrl);
});

test('edit mode remains available and pauses numeric navigation', async ({ page }) => {
  await ready(page);
  const homepageUrl = page.url();
  const opened = [];
  await page.exposeFunction('recordOpenedTab', (url) => opened.push(url));
  await page.evaluate(() => { window.open = (url) => { window.recordOpenedTab(url); return null; }; });
  await page.getByRole('button', { name: 'Edit mode', exact: true }).click();
  await expect(page.locator('#grid')).toHaveClass(/editing/);
  await expect(page.locator('#edit-help')).toBeVisible();
  await page.keyboard.press('Digit1');
  await page.keyboard.press('Shift+Digit1');
  await expect(page).toHaveURL(homepageUrl);
  expect(opened).toEqual([]);
  await page.getByRole('button', { name: 'Edit Discord, cell 1', exact: true }).click();
  await expect(page.locator('#shortcut-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#shortcut-dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Done editing', exact: true }).click();
  await expect(page.locator('#grid')).not.toHaveClass(/editing/);
  await page.keyboard.press('Shift+Digit1');
  await expect.poll(() => opened).toEqual(['https://discord.com/app']);
});
