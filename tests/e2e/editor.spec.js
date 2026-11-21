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

test('defaults all settings groups to collapsed and preserves style history', async ({ page }) => {
  const groups = page.locator('#ctl > details');
  await expect(groups).toHaveCount(8);
  expect(await groups.evaluateAll(items => items.every(item => !item.open))).toBe(true);
  await page.getByText('Style', { exact: true }).click();
  await expect(page.getByRole('radio', { name: /ASCII text/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: /Glyph tiles/ }).click();
  await expect(page.getByRole('radio', { name: /Glyph tiles/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: /Undo/ }).click();
  await expect(page.getByRole('radio', { name: /ASCII text/ })).toHaveAttribute('aria-checked', 'true');
});

test('places all built-in presets in the first settings section', async ({ page }) => {
  await expect(page.locator('#ctl > details').first().locator('summary')).toHaveText('Presets');
  await page.getByText('Presets', { exact: true }).click();
  for (const name of ['Terminal','Koi tiles','1-bit dither','Halftone print','Pixel mosaic','Cyber blocks','Gameboy','Amber CRT']) {
    await expect(page.getByRole('radio', { name: new RegExp(name) })).toBeVisible();
  }
  await page.getByRole('radio', { name: /Terminal/ }).click();
  await expect(page.getByRole('radio', { name: /Terminal/ })).toHaveAttribute('aria-checked', 'true');
});

test('uses one detail control and has no contradictory cell-size control', async ({ page }) => {
  await page.getByText('Detail', { exact: true }).click();
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

test('auto-fits the preview and serves the favicon', async ({ page, request }) => {
  const favicon = await request.get('/favicon.svg');
  expect(favicon.ok()).toBe(true);
  expect(favicon.headers()['content-type']).toContain('image/svg+xml');
  await page.getByText('Detail', { exact: true }).click();
  await page.getByLabel('Detail (columns)').fill('300');
  await expect.poll(async () => {
    const canvas = await page.locator('#out').boundingBox();
    const stage = await page.locator('#stage').boundingBox();
    return canvas.width <= stage.width && canvas.height <= stage.height;
  }).toBe(true);
  await expect(page.getByLabel('Preview automatically fits the available area')).toBeVisible();
});

test('adapts without cropping at narrow, tablet, short, and wide screens', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Viewport matrix is covered once.');
  for (const viewport of [{ width: 320, height: 568 }, { width: 768, height: 500 }, { width: 1024, height: 600 }, { width: 1440, height: 700 }]) {
    await page.setViewportSize(viewport);
    const result = await page.evaluate(() => {
      const rects = [...document.querySelectorAll('.topbar,.workspace,.preview-shell,.sidebar')].map(element => element.getBoundingClientRect());
      return {
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        outside: rects.some(rect => rect.left < -1 || rect.right > innerWidth + 1 || rect.top < -1 || rect.bottom > innerHeight + 1)
      };
    });
    expect(result).toEqual({ overflow: false, outside: false });
  }
});

test('has named controls, live status, and no page overflow', async ({ page }) => {
  await expect(page.locator('#stt')).toHaveAttribute('role', 'status');
  await expect(page.locator('#bar')).toHaveAttribute('role', 'progressbar');
  const unnamed = await page.locator('button:not([aria-label])').evaluateAll(buttons => buttons.filter(button => !button.textContent.trim()).length);
  expect(unnamed).toBe(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
