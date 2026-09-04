# MD Viewer

## Register

product

## Users

Desktop and mobile browser users, alongside Windows users, reading local Markdown including Persian and mixed Persian/English technical documents.

## Product Purpose

یک یا چند سند محلی را ایمن و با قواعد آشنای README گیت‌هاب باز کند و پیمایش ساختار H1–H3 هر سند را مستقل نگه دارد.

نسخهٔ وب پس از بارگذاری اولیه، مطالعهٔ آفلاین، نگه‌داری محلی سندها و تنظیم تایپوگرافی را نیز پشتیبانی می‌کند. همهٔ داده‌های سندهای انتخاب‌شده باید روی همان دستگاه بمانند.

## رفتار تب‌ها و Split

- هر سند تازه در یک تب جدا باز می‌شود؛ انتخاب دوبارهٔ همان فایل، تب موجود را فعال می‌کند و تب تکراری نمی‌سازد.
- در عرض بیشتر از ۹۶۰ پیکسل، Split دو تب را در دو پنل مستقل نمایش می‌دهد. در عرض ۹۶۰ پیکسل و کمتر، Split بسته و رابط تک‌پنلی می‌شود.
- گزینهٔ «بازگردانی تب‌ها هنگام شروع» به‌طور پیش‌فرض روشن است. خاموش‌کردن آن تب‌های نشست جاری را نمی‌بندد و از شروع بعدی اثر می‌گذارد.
- وضعیت تب‌ها، تب فعال و Split فقط روی همان دستگاه ذخیره می‌شود و هیچ محتوای سندی به سرور فرستاده نمی‌شود.
- سندهای بازگردانی‌شده از ابتدای صفحه باز می‌شوند؛ موقعیت پیمایش فقط در نشست جاری حفظ می‌شود.

## Brand Personality

Familiar, restrained, readable. GitHub README rendering is the explicit visual reference approved by the user.

## Anti-references

Avoid marketing-page decoration, oversized cards, gratuitous animation, and editor controls outside a reading-focused document workspace.

## Design Principles

- Preserve GitHub document semantics and visual familiarity.
- Keep local documents as data, never privileged application pages.
- Use the approved centered document with a right-side table of contents.
- Support Persian and English without sacrificing code readability.
- Prefer visible error recovery and predictable keyboard behavior.

## Accessibility & Inclusion

Visible keyboard focus, accessible control names, drawer focus management and Escape dismissal, reduced-motion behavior, readable contrast, and persistent light/dark/ebook-reader themes.

## Approved Design

The authoritative detailed specification is `docs/superpowers/specs/2026-09-01-github-markdown-viewer-design.md`. Existing GitHub colors and Vazirmatn typography take precedence over generic design-skill defaults.

The September 4 extension is documented in `docs/superpowers/specs/2026-09-04-offline-reader-design.md`: book/M identity, responsive reading toolbar, focus mode and offline browser support.

The user also approved a distinct E-Ink-inspired appearance, documented in `docs/superpowers/specs/2026-09-04-ebook-reader-design.md`: warm gray paper, monochrome content, book-like headings and a reversible appearance toggle. Existing reading preferences remain available in every theme.

رفتار مصوب چندتب و Split در `docs/superpowers/specs/2026-09-04-multi-tab-split-design.md` ثبت شده است.
