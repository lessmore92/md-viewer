import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { format, resolveConfig } from 'prettier';

// Run with `node scripts/generate-app-icons.mjs`. All assets stay local.
// Use the installed Playwright browser, Chrome, Edge, or set CHROMIUM_PATH.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const formatOptions = await resolveConfig(join(root, 'prettier.config.js'));
const formatSvg = (source) => format(source, { ...formatOptions, parser: 'html' });
const blue = '#0969da';
const book =
  '<path d="M22 29c11-2 21 2 26 9v36c-7-6-16-9-26-7V29Zm56 0c-11-2-21 2-26 9v36c7-6 16-9 26-7V29Z" fill="currentColor"/>';

const concepts = [
  {
    id: '01-open-book',
    name: 'کتاب باز',
    english: 'Open book',
    type: 'Geometric monogram',
    fa: 'دو صفحهٔ یکپارچه، با فاصله‌ای روشن در میانه، هم کتاب باز را می‌سازند و هم فرم حرف M را. سطح‌های پُر در اندازه‌های کوچک خوانا می‌مانند.',
    en: 'Two solid pages suggest an open book and the silhouette of an M. A clear central seam keeps the mark legible at small sizes.',
    drawing: book,
  },
  {
    id: '02-modular-m',
    name: 'نقطه‌های متن',
    english: 'Modular M',
    type: 'Dot matrix',
    fa: 'حرف M از واحدهای کوچک متن ساخته شده؛ اشاره‌ای به ساختار ماژولار Markdown. شخصیتی فنی‌تر، مناسب استفاده در ابعاد متوسط.',
    en: 'A modular M built from small text units. The matrix points to Markdown structure and has a technical character at medium sizes.',
    drawing:
      '<g fill="currentColor"><rect x="23" y="25" width="12" height="12" rx="3"/><rect x="23" y="44" width="12" height="12" rx="3"/><rect x="23" y="63" width="12" height="12" rx="3"/><rect x="44" y="43" width="12" height="12" rx="3"/><rect x="65" y="25" width="12" height="12" rx="3"/><rect x="65" y="44" width="12" height="12" rx="3"/><rect x="65" y="63" width="12" height="12" rx="3"/></g>',
  },
  {
    id: '03-reading-rhythm',
    name: 'آهنگ خواندن',
    english: 'Reading rhythm',
    type: 'Line system',
    fa: 'شش سطر پیوسته، قوس صفحه‌های کتاب را دنبال می‌کنند. ریتم خطوط به خواندن آرام اشاره دارد و در اندازه‌های بزرگ غنی‌تر دیده می‌شود.',
    en: 'Six continuous lines trace the curves of book pages. Their repetition expresses the steady rhythm of reading.',
    drawing:
      '<g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><path d="M24 25q14-2 26 8 12-10 26-8"/><path d="M24 34q14-2 26 8 12-10 26-8"/><path d="M24 43q14-2 26 8 12-10 26-8"/><path d="M24 52q14-2 26 8 12-10 26-8"/><path d="M24 61q14-2 26 8 12-10 26-8"/><path d="M24 70q14-2 26 8 12-10 26-8"/></g>',
  },
  {
    id: '04-document-dots',
    name: 'ساختار نوشته',
    english: 'Document structure',
    type: 'Geometry + dots',
    fa: 'یک صفحه با گوشهٔ تاخورده و سه نشانهٔ فهرست؛ تمرکز روی سند و سازمان‌دهی متن. شکل نامتقارن گوشه، جهت بصری ایجاد می‌کند.',
    en: 'A folded document and three list markers express text organization. The folded corner gives the compact shape direction.',
    drawing:
      '<path d="M30 22h28l16 16v34a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6V28a6 6 0 0 1 6-6Zm28 2v12a4 4 0 0 0 4 4h10" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><g fill="currentColor"><circle cx="36" cy="47" r="3"/><circle cx="36" cy="58" r="3"/><circle cx="36" cy="69" r="3"/></g><path d="M46 47h15M46 58h15M46 69h9" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>',
  },
  {
    id: '05-reading-window',
    name: 'پنجرهٔ خواندن',
    english: 'Reading window',
    type: 'Geometry + lines',
    fa: 'دو گوشهٔ باز، قاب خواندن را مشخص می‌کنند و سه سطر میان آن‌ها قرار می‌گیرد. ساده و کاربردی، با تأکید بر تمرکز روی متن.',
    en: 'Open corners frame three lines of text. The mark puts the reading surface and focus on content at its center.',
    drawing:
      '<g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M36 24H24v52h12M64 24h12v52H64"/><path d="M38 39h24M38 50h24M38 61h16"/></g>',
  },
  {
    id: '06-layered-pages',
    name: 'صفحه‌های پیوسته',
    english: 'Connected pages',
    type: 'Layered geometry',
    fa: 'دو صفحهٔ هم‌پوشان، تبدیل متن ساده به سند خوانا را نشان می‌دهند. بریدگی‌های باز، لایه‌ها را بدون سایه از هم جدا می‌کنند.',
    en: 'Two overlapping pages suggest plain text becoming a readable document. Open contours separate the layers without shadows.',
    drawing:
      '<path d="M62 25H29a5 5 0 0 0-5 5v38a5 5 0 0 0 5 5h5" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><rect x="42" y="37" width="34" height="43" rx="5" fill="currentColor"/><path d="M51 50h16M51 59h16M51 68h10" fill="none" stroke="var(--paper,white)" stroke-width="3" stroke-linecap="round"/>',
  },
];

const svg = (drawing, title, attributes = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="${title}" ${attributes}>${drawing}</svg>\n`;

const appIcon = svg(
  `<rect x="4" y="4" width="92" height="92" rx="23" fill="currentColor"/><g color="#fff">${book}</g>`,
  'MD Viewer — open book',
  `color="${blue}"`,
);
// All meaningful artwork lies inside the central 80% safe circle, including
// corners of the page shapes. The solid background fills every launcher mask.
const maskable = svg(
  `<path fill="${blue}" d="M0 0h100v100H0z"/><g color="#fff" transform="translate(10 10) scale(.8)">${book}</g>`,
  'MD Viewer — maskable icon',
);

const iconDirectory = join(root, 'docs/design/icons');
await Promise.all([
  mkdir(iconDirectory, { recursive: true }),
  mkdir(join(root, 'public'), { recursive: true }),
  mkdir(join(root, 'build'), { recursive: true }),
]);
await writeFile(join(root, 'public/icon.svg'), await formatSvg(appIcon));
await Promise.all(
  concepts.map(async (concept) =>
    writeFile(
      join(iconDirectory, `${concept.id}.svg`),
      await formatSvg(svg(concept.drawing, concept.english, `color="${blue}"`)),
    ),
  ),
);

// Adapted from logo-generator's grid showcase, with no remote scripts or fonts.
const showcase = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MD Viewer — Icon concepts</title>
  <style>
    @font-face{font-family:Vazirmatn;src:url('../../public/fonts/Vazirmatn-Regular.woff2') format('woff2');font-weight:400;font-display:swap}
    @font-face{font-family:Vazirmatn;src:url('../../public/fonts/Vazirmatn-Bold.woff2') format('woff2');font-weight:700;font-display:swap}
    *{box-sizing:border-box}body{--paper:#fff;--surface:#f4f6f8;--ink:#172536;--muted:#59697a;--line:#d6dfe9;margin:0;background:var(--paper);color:var(--ink);font:16px/1.8 Vazirmatn,Arial,sans-serif}
    body.dark{--paper:#142031;--surface:#1b2a3e;--ink:#eff5fc;--muted:#adbed3;--line:#3b4d65}
    main{max-width:1180px;margin:auto;padding:64px 32px}header{display:flex;gap:40px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:42px}.eyebrow{color:var(--muted);font-size:12px;letter-spacing:.12em}h1{font-size:clamp(30px,5vw,52px);line-height:1.35;margin:10px 0 16px}p{margin:0;color:var(--muted)}header p{max-width:650px}header img{width:144px;height:144px}.controls{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin:28px 0 36px}button,a{font:inherit}button{background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:7px 14px;cursor:pointer}button[aria-pressed=true]{border-color:#0969da;color:#0969da;background:#eaf3ff}button:focus-visible,a:focus-visible{outline:3px solid #0969da;outline-offset:4px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:36px 32px}.concept{border-top:1px solid var(--line);padding-top:18px}.meta{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;color:var(--muted)}.chosen{color:#0969da;background:#eaf3ff;border-radius:4px;padding:2px 8px;font-size:11px}.canvas{height:190px;display:flex;align-items:center;justify-content:center;background:var(--surface);margin:16px 0 22px;border-radius:12px;transition:background .2s}.canvas svg{color:#0969da;width:116px;height:116px;transition:transform .2s}.dark .canvas svg{color:#72b0ff}.concept:hover .canvas svg{transform:translateY(-3px)}.small .canvas svg{width:32px;height:32px}.concept h2{font-size:22px;margin:0}.english{direction:ltr;text-align:right;font-size:13px}.rationale{font-size:14px;margin:12px 0 0;min-height:100px}.rationale-en{font-size:12px;direction:ltr;line-height:1.65;text-align:left;min-height:84px}.download{display:inline-block;color:#0969da;margin-top:14px;font-size:13px}.dark .download{color:#72b0ff}.export{margin-top:60px;border-top:1px solid var(--line);padding-top:28px}.export h2{font-size:22px;margin:0 0 14px}.sizes{display:flex;align-items:center;flex-wrap:wrap;gap:28px;padding:30px;background:var(--surface);border-radius:12px}.sizes figure{margin:0;display:flex;align-items:center;flex-direction:column;gap:12px}.sizes figcaption{font-size:11px;color:var(--muted)}.links{display:flex;flex-wrap:wrap;gap:22px;margin-top:18px}.links a{color:#0969da;font-size:14px}.note{font-size:13px;margin-top:20px}footer{border-top:1px solid var(--line);margin-top:48px;padding-top:20px;font-size:12px;color:var(--muted)}
    @media(max-width:800px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}header{gap:20px}header img{width:100px;height:100px}.rationale{min-height:125px}}
    @media(max-width:520px){main{padding:32px 20px}header{align-items:flex-start;flex-direction:column-reverse}.grid{grid-template-columns:1fr}.rationale,.rationale-en{min-height:0}.canvas{height:170px}.sizes{gap:22px;padding:20px}}
    @media(prefers-reduced-motion:reduce){*{transition:none!important}.concept:hover .canvas svg{transform:none}}
  </style>
</head>
<body>
  <main>
    <header>
      <div><div class="eyebrow" dir="ltr">MD VIEWER · IDENTITY EXPLORATION</div><h1>نشانی برای خواندن آرام</h1><p>شش مسیر برای هویت یک Markdown‌خوان فارسی و انگلیسی. طرح «کتاب باز» با فرم ساده و خوانایی بهتر در ابعاد کوچک، برای آیکون برنامه انتخاب شده است.</p></div>
      <img src="../../public/icon.svg" alt="نشان منتخب MD Viewer" width="144" height="144">
    </header>
    <div class="controls"><button id="theme" type="button" aria-pressed="false">پس‌زمینهٔ تیره</button><button id="size" type="button" aria-pressed="false">مقایسه در اندازهٔ ۳۲ پیکسل</button></div>
    <section class="grid" aria-label="مقایسهٔ شش طرح آیکون">
    ${concepts
      .map(
        (concept, index) => `<article class="concept">
      <div class="meta"><span dir="ltr">0${index + 1} / ${concept.type}</span>${index === 0 ? '<span class="chosen">منتخب</span>' : ''}</div>
      <div class="canvas">${svg(concept.drawing, concept.english)}</div>
      <h2>${concept.name}</h2><p class="english" lang="en">${concept.english}</p><p class="rationale">${concept.fa}</p><p class="rationale-en" lang="en">${concept.en}</p>
      <a class="download" href="icons/${concept.id}.svg" download>دریافت SVG</a>
    </article>`,
      )
      .join('\n')}
    </section>
    <section class="export" aria-label="اندازه‌ها و خروجی‌های نشان منتخب">
      <h2>یک نشان، از زبانهٔ مرورگر تا دسکتاپ</h2>
      <div class="sizes" dir="ltr">${[16, 32, 64, 128].map((size) => `<figure><img src="../../public/icon.svg" alt="MD Viewer at ${size} pixels" width="${size}" height="${size}"><figcaption>${size} px</figcaption></figure>`).join('')}<figure><img src="../../public/icon-maskable.png" alt="Masked app icon" width="128" height="128" style="border-radius:50%"><figcaption>Maskable</figcaption></figure></div>
      <div class="links"><a href="../../public/icon.svg" download>SVG اصلی</a><a href="../../public/icon-512.png" download>PNG · 512</a><a href="../../public/icon-192.png" download>PNG · 192</a><a href="../../public/apple-touch-icon.png" download>Apple touch · 180</a><a href="../../public/icon-maskable.png" download>Maskable · 512</a></div>
      <p class="note">رنگ اصلی: <bdi>#0969da</bdi> · نشان بدون وابستگی به فونت یا تصویر خارجی · حاشیهٔ امن مخصوص آیکون‌های نصب‌شده</p>
    </section>
    <footer>MD Viewer · SVG identity system · 2026</footer>
  </main>
  <script>
    document.querySelector('#theme').addEventListener('click', (event) => {
      const enabled = document.body.classList.toggle('dark');
      event.currentTarget.setAttribute('aria-pressed', String(enabled));
    });
    document.querySelector('#size').addEventListener('click', (event) => {
      const enabled = document.body.classList.toggle('small');
      event.currentTarget.setAttribute('aria-pressed', String(enabled));
    });
  </script>
</body>
</html>
`;
await writeFile(join(root, 'docs/design/icon-concepts.html'), await formatSvg(showcase));

const candidates = [
  process.env.CHROMIUM_PATH,
  chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].filter(Boolean);
let executablePath;
for (const candidate of candidates) {
  try {
    await access(candidate, constants.F_OK);
    executablePath = candidate;
    break;
  } catch {
    // Try another installed browser before requesting a Playwright download.
  }
}
if (!executablePath) {
  throw new Error(
    'No Chromium browser found. Set CHROMIUM_PATH or run npx playwright install chromium.',
  );
}

const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const exports = [
    ['public/icon.png', 256, appIcon],
    ['public/icon-192.png', 192, appIcon],
    ['public/icon-512.png', 512, appIcon],
    ['public/apple-touch-icon.png', 180, appIcon],
    ['public/icon-maskable.png', 512, maskable],
  ];
  for (const [path, size, source] of exports) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;width:100%;height:100%;background:transparent}svg{display:block;width:100%;height:100%}</style>${source}`,
    );
    await page.screenshot({ path: join(root, path), omitBackground: true });
    const png = await readFile(join(root, path));
    if (png.readUInt32BE(16) !== size || png.readUInt32BE(20) !== size) {
      throw new Error(`Unexpected PNG dimensions for ${path}`);
    }
  }
  await copyFile(join(root, 'public/icon.png'), join(root, 'build/icon.png'));
} finally {
  await browser.close();
}
console.log('Generated six SVG concepts, the offline showcase, and all app icon exports.');
