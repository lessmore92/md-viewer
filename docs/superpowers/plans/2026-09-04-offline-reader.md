# Offline Reader Implementation Plan

> Execute the app changes inline; the independent vector icon task is delegated under the executing-plans workflow. Review both outputs before completion.

**Goal:** Ship a polished shared desktop/web Markdown reader with an installable offline web build and reading controls.

**Architecture:** Keep App as the document coordinator. Add browser-document storage/input helpers, reading preference helpers, a reading toolbar and status component, and a production service-worker build plugin. Preserve Electron contracts and Markdown sanitization.

**Tech stack:** React 18, TypeScript, Vite, native File API, localStorage, Cache Storage and service workers; existing Vitest/Testing Library and Playwright.

## Constraints

- Preserve GitHub semantics, Persian RTL and English/code LTR, blue accent, existing font assets and both themes.
- No uploaded documents, backend, analytics, runtime CDN or new runtime dependency.
- Browser files limited to 5 MiB; persistent storage is optional and failures are visible.
- 14–28px font size, line heights 1.6/1.9/2.2, widths 38/48/60rem.
- Service worker only in production HTTP(S), never Electron or dev; support nested paths.

## Tasks

- [x] Browser support: add `src/app/browserDocument.ts`, make Electron API optional, adapt external links/images, provide file input and drop flow in App. Test browser opening and stale-request protection through the rendered App before implementation.
- [x] Reading tools: add `src/app/readingPreferences.ts`, `src/components/ReadingToolbar.tsx`, `src/components/ReadingStatus.tsx`; test bounds, persistence and focus exit. Apply inherited CSS variables to article typography and reading layout.
- [x] Visual refresh: update Toolbar, empty state, outline metadata and workspace CSS; integrate vector icon and exported platform sizes. Inspect desktop and narrow viewport renders.
- [x] Offline web: add `scripts/offline-plugin.ts`, manifest, bundled sample and `src/app/useOffline.ts`. Generate precache URLs from build output/public files; hash their contents for the version. Verify real offline reload after precache, also under a nested path.
- [x] Delivery: update README/PRODUCT, run typechecks, lint, formatting, unit tests, builds, Windows icon generation and focused Playwright scenarios; inspect screenshots and review diff.

## Acceptance scenarios

1. Select a browser File containing Persian/English Markdown, change font size and reload offline: document and preference remain visible.
2. Cancel or fail a second open: the existing document remains intact and an accessible error offers recovery.
3. Enable focus then press Escape: full toolbar/outline return without replacing the document.
4. Open under `/reader/`: scripts, fonts, manifest, icons and service worker load within that path and reload offline.
5. Existing Electron API tests, Markdown sanitization tests and production CSP tests pass unchanged except optional API typing.
