import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#out')).toBeVisible();
  await expect.poll(() => errors).toEqual([]);
});

test('loads the demo and exposes the complete editing workflow', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Export' })).toBeVisible();
  await expect(page.locator('#out')).toHaveJSProperty('width', 960);
  await page.getByLabel('Render style').selectOption('tiles');
  await expect(page.getByRole('button', { name: /Undo/ })).toBeEnabled();
  await page.getByRole('button', { name: /Undo/ }).click();
  await page.getByRole('button', { name: /Redo/ }).click();
  await page.getByRole('button', { name: 'Original' }).click();
  await expect(page.locator('#original')).toBeVisible();
  await page.getByRole('button', { name: 'Effect' }).click();
  await expect(page.locator('#out')).toBeVisible();
});

test('supports keyboard playback and help dialog', async ({ page }) => {
  await page.locator('#stage').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#pl')).toHaveText('▶');
  await page.getByRole('button', { name: 'Open help' }).click();
  await expect(page.getByRole('heading', { name: 'Glyphmix help' })).toBeVisible();
  await page.getByRole('button', { name: 'Close help' }).click();
  await expect(page.locator('#helpDialog')).not.toBeVisible();
});

test('exports a PNG and a self-contained HTML player', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Export is covered once on desktop.');
  const pngEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNG frame' }).click();
  const png = await pngEvent;
  expect(png.suggestedFilename()).toBe('glyphmix.png');

  await page.getByLabel('Frames to process').evaluate(input => { input.value = '8'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  const htmlEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export standalone HTML' }).click();
  const htmlDownload = await htmlEvent;
  const html = await readFile(await htmlDownload.path(), 'utf8');
  expect(html).toContain('<canvas id="c"></canvas>');
  expect(html).not.toContain('export {');
  expect(html.length).toBeGreaterThan(10000);
});

test('has named controls, live status, and no horizontal page overflow', async ({ page }) => {
  await expect(page.locator('#stt')).toHaveAttribute('role', 'status');
  await expect(page.locator('#bar')).toHaveAttribute('role', 'progressbar');
  const unnamed = await page.locator('button:not([aria-label])').evaluateAll(buttons => buttons.filter(b => !b.textContent.trim()).length);
  expect(unnamed).toBe(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
