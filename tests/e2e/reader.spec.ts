import { expect, test } from '@playwright/test';
import { preview } from 'vite';

test('reads a local document after offline reload and persists typography', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'فایل Markdown خود را باز کنید' })).toBeVisible();
  await expect(page.locator('.offline-badge')).toHaveText('آمادهٔ آفلاین');
  await page.screenshot({ path: '.superpowers/screenshots/welcome.png' });
  await page.getByLabel('انتخاب فایل متنی').setInputFiles({
    name: 'یادداشت.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# یادداشت آفلاین\n\nA private local document.\n\n## بخش دوم\n\nمتن فارسی'),
  });
  await expect(page.getByRole('heading', { name: 'یادداشت آفلاین' })).toBeVisible();
  await page.getByRole('button', { name: 'بزرگ کردن متن' }).click();
  await page.getByLabel('فاصلهٔ خطوط').selectOption('2.2');
  await expect(page.getByRole('article')).toHaveCSS('font-size', '19px');
  await expect(page.getByRole('article')).toHaveCSS('line-height', '41.8px');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'یادداشت آفلاین' })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCSS('font-size', '19px');
  // Chrome's emulated navigator.onLine may reset on an SW-served reload;
  // prove the network is actually blocked and the cached reader is ready.
  expect(
    await page.evaluate(() =>
      fetch('./uncached-network-probe')
        .then(() => true)
        .catch(() => false),
    ),
  ).toBe(false);
  await expect(page.locator('.offline-badge.is-ready')).toContainText('آفلاین');
  await page.getByLabel('انتخاب فایل متنی').setInputFiles({
    name: 'second.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Opened while offline'),
  });
  await expect(page.getByRole('heading', { name: 'Opened while offline' })).toBeVisible();
  await page.getByRole('button', { name: 'بستن و پاک کردن سند ذخیره‌شده' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'فایل Markdown خود را باز کنید' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('sample reader remains usable across themes, focus and mobile widths', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'مشاهدهٔ نمونه' }).click();
  await expect(page.getByRole('article')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: '.superpowers/screenshots/reader-desktop.png' });
  await page.getByRole('button', { name: 'فعال کردن حالت تیره' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: '.superpowers/screenshots/reader-dark.png' });
  await page.getByRole('button', { name: 'حالت تمرکز', exact: true }).click();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'حالت تمرکز', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'فعال کردن حالت روشن' }).click();
  for (const width of [390, 320, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole('article')).toBeVisible();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth > innerWidth ||
        document.querySelector('main')!.scrollWidth > document.querySelector('main')!.clientWidth,
    );
    expect(overflow, `overflow at ${width}px`).toBe(false);
    await page.getByRole('button', { name: 'نمایش فهرست مطالب' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    if (width === 390)
      await page.screenshot({ path: '.superpowers/screenshots/reader-mobile.png' });
  }
});

test('ebook appearance stays readable on mobile and survives an offline reload', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.locator('.offline-badge')).toHaveText('آمادهٔ آفلاین');
  await page.getByRole('button', { name: 'مشاهدهٔ نمونه' }).click();
  await page.getByRole('button', { name: 'فعال کردن حالت تیره' }).click();
  await page.getByRole('button', { name: 'بزرگ کردن متن' }).click();
  const ebook = page.getByRole('button', { name: 'حالت کتابخوان', exact: true });
  await ebook.click();
  await expect(ebook).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'ebook-reader');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: '.superpowers/screenshots/reader-ebook.png' });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('article')).toBeVisible();
  await expect(page.getByRole('article')).toHaveCSS('font-size', '19px');
  await expect(ebook).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'ebook-reader');
  await page.getByRole('button', { name: 'حالت تمرکز', exact: true }).click();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'ebook-reader');
  await page.keyboard.press('Escape');
  for (const width of [390, 320, 768]) {
    await page.setViewportSize({ width, height: 844 });
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth > innerWidth ||
        document.querySelector('main')!.scrollWidth > document.querySelector('main')!.clientWidth,
    );
    expect(overflow, `ebook overflow at ${width}px`).toBe(false);
    await expect(ebook).toBeInViewport();
    if (width === 390)
      await page.screenshot({ path: '.superpowers/screenshots/reader-ebook-mobile.png' });
  }
  await ebook.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('article')).toHaveCSS('font-size', '19px');
});

test('loads fonts, icons and the complete offline shell from a subdirectory', async ({
  page,
  context,
}) => {
  const server = await preview({
    base: '/reader/',
    preview: { host: 'localhost', port: 4174, strictPort: true },
  });
  try {
    await page.goto('http://localhost:4174/reader/');
    await expect(page.locator('.offline-badge')).toHaveText('آمادهٔ آفلاین');
    await page.getByRole('button', { name: 'مشاهدهٔ نمونه' }).click();
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('article')).toBeVisible();
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      const logo = document.querySelector<HTMLImageElement>('.toolbar-logo');
      const font = await document.fonts.load('18px Vazirmatn');
      const response = await fetch('./manifest.webmanifest');
      return {
        logo: !!logo?.naturalWidth,
        fonts: font.length,
        manifest: response.ok,
        scope: (await navigator.serviceWorker.ready).scope,
      };
    });
    expect(loaded).toMatchObject({
      logo: true,
      fonts: 1,
      manifest: true,
      scope: 'http://localhost:4174/reader/',
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.httpServer.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
