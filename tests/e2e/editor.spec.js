import { readFile, stat } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#out')).toBeVisible();
  await expect.poll(() => errors).toEqual([]);
});

test('organizes styles as a selectable list and preserves history', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Export' })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: /ASCII text/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: /Glyph tiles/ }).click();
  await expect(page.getByRole('radio', { name: /Glyph tiles/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: /Undo/ })).toBeEnabled();
  await page.getByRole('button', { name: /Undo/ }).click();
  await expect(page.getByRole('radio', { name: /ASCII text/ })).toHaveAttribute('aria-checked', 'true');
});

test('uses one detail control and has no contradictory cell-size control', async ({ page }) => {
  await expect(page.getByLabel('Detail (columns)')).toHaveCount(1);
  await expect(page.getByLabel(/Cell size/i)).toHaveCount(0);
  await expect(page.getByLabel(/Columns \(resolution\)/i)).toHaveCount(0);
  await page.getByLabel('Detail (columns)').fill('80');
  await expect(page.getByText('80 · 640px')).toBeVisible();
});

test('opens one accessible export window with format-aware options', async ({ page }) => {
  await page.getByRole('button', { name: 'Export…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Choose an output' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('radio', { name: /Animated text HTML/ })).toBeChecked();
  await expect(page.getByText(/Real selectable ASCII text/)).toBeVisible();
  await page.getByRole('radio', { name: /PNG image/ }).check();
  await expect(page.getByRole('spinbutton', { name: /^Frames/ })).toBeHidden();
  await expect(page.getByLabel('Transparent background')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toBeHidden();
});

test('supports keyboard playback and help dialog', async ({ page }) => {
  await page.locator('#stage').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#pl')).toHaveText('▶');
  await page.getByRole('button', { name: 'Open help' }).click();
  await expect(page.getByRole('heading', { name: 'Glyphmix help' })).toBeVisible();
  await page.getByRole('button', { name: 'Close help' }).click();
});

test('exports text HTML, canvas HTML, plain text, frame sequences, PNG, and WebM', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'All download formats are covered once on desktop.');
  const open = async format => {
    await page.getByRole('button', { name: 'Export…' }).click();
    if (format) await page.getByRole('radio', { name: format }).check();
    const frames = page.getByRole('spinbutton', { name: /^Frames/ });
    if (await frames.isVisible()) await frames.fill('8');
    const fps = page.getByLabel('Playback rate');
    if (await fps.isVisible()) await fps.fill('30');
  };
  const download = async buttonName => {
    const event = page.waitForEvent('download');
    await page.getByRole('button', { name: buttonName }).click();
    return event;
  };

  await open();
  let file = await download('Export animated text HTML');
  let content = await readFile(await file.path(), 'utf8');
  expect(content).toContain('<pre id="art"');
  expect(content).not.toContain('<canvas');
  expect(content).not.toContain('MediaRecorder');

  await open(/Canvas HTML/);
  file = await download('Export canvas HTML');
  content = await readFile(await file.path(), 'utf8');
  expect(content).toContain('<canvas id="c"></canvas>');
  expect(content).not.toContain('export {');

  await open(/Text frame/);
  file = await download('Export text frame');
  content = await readFile(await file.path(), 'utf8');
  expect(content.split('\n').length).toBeGreaterThan(10);

  await open(/Animated text frames/);
  file = await download('Export text frames');
  content = await readFile(await file.path(), 'utf8');
  expect(content).toContain('FRAME 1 / 8');
  expect(content).toContain('FRAME 8 / 8');

  await open(/PNG image/);
  file = await download('Export PNG');
  expect((await stat(await file.path())).size).toBeGreaterThan(1000);

  await open(/WebM video/);
  file = await download('Export WebM');
  expect((await stat(await file.path())).size).toBeGreaterThan(1000);
});

test('has named controls, live status, and no page overflow', async ({ page }) => {
  await expect(page.locator('#stt')).toHaveAttribute('role', 'status');
  await expect(page.locator('#bar')).toHaveAttribute('role', 'progressbar');
  const unnamed = await page.locator('button:not([aria-label])').evaluateAll(buttons => buttons.filter(button => !button.textContent.trim()).length);
  expect(unnamed).toBe(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
