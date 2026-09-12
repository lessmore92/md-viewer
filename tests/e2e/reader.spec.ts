import { expect, test, type Page } from '@playwright/test';
import { preview } from 'vite';

async function openLocalDocument(page: Page, name: string, content: string) {
  await page.getByLabel('انتخاب فایل متنی').setInputFiles({
    name,
    mimeType: 'text/markdown',
    buffer: Buffer.from(content),
  });
  await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('article', { name, exact: true })).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() =>
        [
          document.documentElement,
          document.body,
          ...document.querySelectorAll('main, .document-pane, .reader-scroll'),
        ].every((element) => element.scrollWidth <= element.clientWidth),
      ),
    )
    .toBe(true);
}

const firstFile = 'راهنمای مطالعه و یادداشت‌های پروژه با نام طولانی.md';
const secondFile = 'second-document-with-a-long-descriptive-file-name.md';
const thirdFile = 'third.md';
const longDocument = (title: string) =>
  `# ${title}\n\n` +
  Array.from(
    { length: 30 },
    (_, index) =>
      `## Section ${index + 1}\n\nمتن فارسی برای مطالعه. English text for independent scrolling.\n\n` +
      `\`\`\`text\n${'long-code-line-'.repeat(30)}\n\`\`\`\n\n`,
  ).join('');

// App currently calls the approved split-layout container workspace-panes.is-split.
// Exercise that real markup without adding classes or replacing application state in tests.
const splitLayout = '.workspace-panes.is-split';

test('multi-tab Split has two bounded RTL panes with independent scrolling and selection', async ({
  page,
}) => {
  await page.goto('/');
  await openLocalDocument(page, firstFile, longDocument('راهنمای مطالعه'));
  await expect(page.getByRole('button', { name: 'فعال کردن نمای دوپنل' })).toBeDisabled();
  await openLocalDocument(page, secondFile, longDocument('Second document'));
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.locator('.tab-bar')).toBeVisible();
  await page.getByRole('button', { name: 'فعال کردن نمای دوپنل' }).click();
  await expect(page.getByRole('button', { name: 'بستن نمای دوپنل' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator(splitLayout)).toBeVisible();
  await expect(page.locator(splitLayout)).toHaveCSS('display', 'grid');
  const panes = page.locator('.document-pane');
  await expect(panes).toHaveCount(2);
  await expect(panes.nth(0).getByRole('article')).toHaveAttribute('aria-label', secondFile);
  await expect(panes.nth(1).getByRole('article')).toHaveAttribute('aria-label', firstFile);
  await expect(panes.nth(0).getByRole('article')).toHaveAttribute('dir', 'ltr');
  await expect(panes.nth(1).getByRole('article')).toHaveAttribute('dir', 'rtl');
  await expect(panes.nth(1)).toHaveCSS('border-inline-start-width', '1px');
  await expect(
    page.getByLabel('سند پنل دوم').getByRole('option', { name: secondFile, exact: true }),
  ).toHaveJSProperty('disabled', true);
  const primaryBox = (await panes.nth(0).boundingBox())!;
  const secondaryBox = (await panes.nth(1).boundingBox())!;
  expect(primaryBox.x).toBeGreaterThan(secondaryBox.x);
  expect(secondaryBox.x + secondaryBox.width).toBeLessThanOrEqual(primaryBox.x + 1);
  expect(Math.abs(primaryBox.width - secondaryBox.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(primaryBox.y - secondaryBox.y)).toBeLessThanOrEqual(1);
  await expectNoHorizontalOverflow(page);

  const primaryScroll = panes.nth(0).getByRole('region', { name: 'محتوای سند' });
  const secondaryScroll = panes.nth(1).getByRole('region', { name: 'محتوای سند' });
  for (const scroll of [primaryScroll, secondaryScroll]) {
    await expect(scroll).toHaveCSS('overflow-y', 'auto');
    expect(await scroll.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
      true,
    );
  }
  await primaryScroll.hover();
  await page.mouse.wheel(0, 500);
  await expect
    .poll(() => primaryScroll.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(100);
  expect(await secondaryScroll.evaluate((element) => element.scrollTop)).toBe(0);
  // Navigation must target only the second pane even with duplicate heading IDs.
  await secondaryScroll
    .getByRole('navigation')
    .getByRole('link', { name: 'Section 20', exact: true })
    .click();
  await expect
    .poll(() => secondaryScroll.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(100);
  expect(await primaryScroll.evaluate((element) => element.scrollTop)).toBeLessThan(1000);
  for (const pane of [panes.nth(0), panes.nth(1)]) {
    await expect(pane.getByRole('progressbar')).toBeInViewport();
  }

  await page.getByRole('button', { name: 'بستن نمای دوپنل' }).click();
  await openLocalDocument(page, thirdFile, '# Third document');
  await page.getByRole('tab', { name: secondFile, exact: true }).click();
  await page.getByRole('button', { name: 'فعال کردن نمای دوپنل' }).click();
  await page.getByLabel('سند پنل دوم').selectOption({ label: thirdFile });
  await expect(panes.nth(1).getByRole('article')).toHaveAttribute('aria-label', thirdFile);
  await page.getByRole('button', { name: `بستن ${thirdFile}`, exact: true }).click();
  await expect(panes).toHaveCount(1);
  await expect(page.getByRole('tab', { name: secondFile, exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'فعال کردن نمای دوپنل' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByRole('tab')).toHaveCount(2);
});

test('multi-tab Split follows themes, focus mode and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await openLocalDocument(page, firstFile, longDocument('راهنمای مطالعه'));
  await openLocalDocument(page, secondFile, longDocument('Second document'));
  await page.getByRole('button', { name: 'فعال کردن نمای دوپنل' }).click();
  for (const theme of ['light', 'dark', 'ebook-reader']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'فعال کردن حالت تیره' }).click();
    if (theme === 'ebook-reader')
      await page.getByRole('button', { name: 'حالت کتابخوان', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('.document-pane:visible')).toHaveCount(2);
    await expectNoHorizontalOverflow(page);
    const colors = await page.evaluate(() => {
      const toolbar = getComputedStyle(document.querySelector('.toolbar')!);
      const tabbar = getComputedStyle(document.querySelector('.tab-bar')!);
      const pane = getComputedStyle(document.querySelectorAll('.document-pane')[1]);
      return {
        chrome: toolbar.backgroundColor,
        tabs: tabbar.backgroundColor,
        border: toolbar.borderBottomColor,
        divider: pane.borderInlineStartColor,
      };
    });
    expect(colors.tabs).toBe(colors.chrome);
    expect(colors.divider).toBe(colors.border);
    await page.screenshot({ path: `.superpowers/screenshots/task-5-split-${theme}.png` });
    await expect(page.locator('.tab-button').first()).toHaveCSS('transition-duration', '0s');
    await expect(page.locator('.reader-scroll').first()).toHaveCSS('scroll-behavior', 'auto');
    await page.getByRole('button', { name: 'حالت تمرکز', exact: true }).click();
    await expect(page.locator('.tab-bar')).toBeHidden();
    await expect(page.locator('.document-pane:visible')).toHaveCount(1);
    await expect(page.getByRole('article', { name: secondFile, exact: true })).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0);
    const focusedPane = (await page.locator('.document-pane:visible').boundingBox())!;
    expect(focusedPane.width).toBe(page.viewportSize()!.width);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'حالت تمرکز', exact: true })).toBeFocused();
    await expect(page.locator('.document-pane:visible')).toHaveCount(2);
  }
});

test('multi-tab Split closes at 960px and narrow tabs scroll without page overflow', async ({
  page,
}) => {
  await page.goto('/');
  await openLocalDocument(page, firstFile, longDocument('راهنمای مطالعه'));
  await openLocalDocument(page, secondFile, longDocument('Second document'));
  await openLocalDocument(page, thirdFile, '# Third document');
  await page.setViewportSize({ width: 961, height: 844 });
  await page.getByRole('button', { name: 'فعال کردن نمای دوپنل' }).click();
  await expect(page.locator('.document-pane:visible')).toHaveCount(2);
  await expectNoHorizontalOverflow(page);
  for (const width of [960, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator('.document-pane')).toHaveCount(1);
    await expect(page.getByRole('button', { name: /split/ })).toBeHidden();
    await expect(page.getByLabel('سند پنل دوم')).toBeHidden();
    await expect(page.getByRole('tab')).toHaveCount(3);
    await expect(page.locator('.tab-strip')).toHaveCSS('overflow-x', 'auto');
    await expectNoHorizontalOverflow(page);
    if (width <= 390) {
      const strip = page.getByRole('tablist');
      expect(await strip.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
        true,
      );
      // Keyboard focus must reveal either end of the overflowing RTL tab strip.
      for (const name of [firstFile, thirdFile]) {
        const tab = page.getByRole('tab', { name, exact: true });
        await tab.focus();
        await expect(tab).toBeInViewport();
        await page.keyboard.press('Enter');
        await expect(tab).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByRole('article', { name, exact: true })).toBeVisible();
      }
      await expectNoHorizontalOverflow(page);
      if (width === 390)
        await page.screenshot({ path: '.superpowers/screenshots/task-5-tabs-mobile.png' });
    }
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  await expect(page.locator('.document-pane')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'فعال کردن نمای دوپنل' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.getByRole('button', { name: 'فعال کردن نمای دوپنل' }).click();
  // Restore a saved Split directly into a narrow viewport, not just a resize event.
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('md-viewer-workspace-v1')!).splitTabId),
    )
    .toBeTruthy();
  const narrowPage = await page.context().newPage();
  try {
    await narrowPage.setViewportSize({ width: 390, height: 844 });
    await narrowPage.goto('/');
    await expect(narrowPage.getByRole('tab')).toHaveCount(3);
    await expect(narrowPage.locator('.document-pane')).toHaveCount(1);
    await expect(narrowPage.getByRole('button', { name: /split/ })).toBeHidden();
    await expectNoHorizontalOverflow(narrowPage);
  } finally {
    await narrowPage.close();
  }
});

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
  await page.getByRole('button', { name: 'بستن second.md' }).click();
  await expect(page.getByRole('heading', { name: 'یادداشت آفلاین' })).toBeVisible();
  await page.getByRole('button', { name: 'بستن یادداشت.md' }).click();
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
