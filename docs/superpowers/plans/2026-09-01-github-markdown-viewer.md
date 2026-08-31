# GitHub-style Markdown Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a secure Electron Markdown reader with GitHub-style README rendering, syntax highlighting, alerts, safe relative images, and a responsive right-side H1-H3 table of contents.

**Architecture:** Keep privileged filesystem, navigation, and shell operations in Electron's main process behind a typed preload bridge. Parse Markdown through shared deterministic heading/alert utilities, render sanitized React components, and derive the sidebar from the same slug rules. Split the React shell, document renderer, and table of contents into focused components covered by unit, integration, and Electron E2E tests.

**Tech Stack:** Electron 44, React 18, TypeScript, Vite, Tailwind CSS, react-markdown, remark-gfm, rehype-raw, rehype-sanitize, rehype-highlight, github-markdown-css, github-slugger, Vitest, React Testing Library, ESLint, Prettier, and Playwright Electron.

## Global Constraints

- The desktop layout uses the approved option A: centered content with a sticky right-side table of contents.
- The table of contents includes only H1-H3 and becomes a right-side drawer in narrow windows.
- External `http`, `https`, and `mailto` links open only in the system browser; fragment links stay inside the document.
- Renderer code must never receive an unrestricted filesystem read primitive.
- Raw HTML is permitted only after explicit schema-based sanitization.
- Keep `nodeIntegration: false`, `contextIsolation: true`, and renderer sandboxing enabled.
- Support `.md`, `.markdown`, `.mdown`, and `.mkd` consistently.
- Preserve Persian/mixed-direction rendering and persistent light/dark themes.
- Editing, saving, multi-document tabs, live filesystem watching, and repository APIs remain out of scope.

---

## Planned File Structure

```text
electron/
  contracts.ts          Shared IPC/document data types.
  document-service.ts   Extension checks, async document reads, asset containment.
  security.ts           Sender and external-URL validation.
  main.ts               Window lifecycle, single instance, protocol, IPC wiring.
  preload.ts            Narrow typed renderer bridge.
src/
  app/App.tsx           Document request state and application composition.
  components/Toolbar.tsx
  components/TableOfContents.tsx
  components/SidebarDrawer.tsx
  markdown/MarkdownView.tsx
  markdown/Code.tsx
  markdown/Image.tsx
  markdown/Alert.tsx
  markdown/headings.ts   GitHub slugs and H1-H3 model.
  markdown/links.ts      Fragment/external/relative classification.
  markdown/remarkAlerts.ts
  markdown/schema.ts     Sanitization allowlist.
  styles/github.css
  test/setup.ts
  vite-env.d.ts
tests/
  fixtures/readme.md
  electron/document-service.test.ts
  electron/security.test.ts
  e2e/app.spec.ts
eslint.config.js
prettier.config.js
vitest.config.ts
playwright.config.ts
```

---

### Task 1: Toolchain and Heading Model

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `eslint.config.js`
- Create: `prettier.config.js`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/markdown/headings.ts`
- Create: `src/markdown/headings.test.ts`

**Interfaces:**

- Produces: `HeadingItem { id: string; depth: 1 | 2 | 3; text: string; children: HeadingItem[] }`.
- Produces: `extractHeadings(markdown: string): HeadingItem[]`.
- Produces: `createHeadingIdPlugin(): (tree: Root) => void` for renderer IDs.

- [ ] **Step 1: Install supported runtime, rendering, and test dependencies**

Run:

```powershell
npm install electron@^44.0.0 react-markdown@^10.1.0 github-markdown-css@^5.8.1 github-slugger@^2.0.0 rehype-highlight@^7.0.2 rehype-sanitize@^6.0.0 unified@^11.0.5 remark-parse@^11.0.0 unist-util-visit@^5.0.0 mdast-util-to-string@^4.0.0
npm install --save-dev electron-builder@^26.0.0 vitest@^3.2.4 jsdom@^26.1.0 @testing-library/react@^16.3.0 @testing-library/user-event@^14.6.1 @testing-library/jest-dom@^6.8.0 eslint@^9.34.0 @eslint/js@^9.34.0 typescript-eslint@^8.41.0 eslint-plugin-react-hooks@^5.2.0 eslint-plugin-react-refresh@^0.4.20 prettier@^3.6.2 @playwright/test@^1.55.0
```

Expected: `package-lock.json` resolves Electron 44 and all packages install without peer-dependency errors.

- [ ] **Step 2: Add explicit quality scripts**

Set the `package.json` scripts to include:

```json
{
  "typecheck:renderer": "tsc --noEmit -p tsconfig.json",
  "typecheck:electron": "tsc --noEmit -p tsconfig.electron.json",
  "lint": "eslint .",
  "format:check": "prettier --check .",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "check": "npm run typecheck:renderer && npm run typecheck:electron && npm run lint && npm run format:check && npm test && npm run build"
}
```

Also change `electron:build` to run both type-check scripts before Vite and electron-builder.

- [ ] **Step 3: Configure Vitest, ESLint, and Prettier**

Use this Vitest configuration:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
  },
});
```

`src/test/setup.ts` imports `@testing-library/jest-dom/vitest`. Configure flat ESLint for TypeScript, React hooks, and React refresh, ignoring `dist`, `dist-electron`, `release`, and `.superpowers`. Configure Prettier with single quotes, semicolons, and a 100-character print width.

- [ ] **Step 4: Write failing heading-model tests**

```ts
import { describe, expect, it } from 'vitest';
import { extractHeadings } from './headings';

describe('extractHeadings', () => {
  it('builds an H1-H3 tree and ignores deeper headings', () => {
    expect(extractHeadings('# Intro\n## Install\n### Windows\n#### Detail\n## API')).toEqual([
      {
        id: 'intro',
        depth: 1,
        text: 'Intro',
        children: [
          {
            id: 'install',
            depth: 2,
            text: 'Install',
            children: [{ id: 'windows', depth: 3, text: 'Windows', children: [] }],
          },
          { id: 'api', depth: 2, text: 'API', children: [] },
        ],
      },
    ]);
  });

  it('uses deterministic GitHub slugs for duplicates and Persian headings', () => {
    expect(extractHeadings('# نصب\n## نصب\n## Hello, World!').map(flattenIds)).toEqual([
      ['نصب', 'نصب-1', 'hello-world'],
    ]);
  });
});
```

Define `flattenIds` in the test as a recursive helper returning IDs in document order.

- [ ] **Step 5: Run the test and verify RED**

Run: `npm test -- src/markdown/headings.test.ts`

Expected: FAIL because `./headings` does not exist.

- [ ] **Step 6: Implement deterministic extraction and ID plugin**

Use `remark-parse`, `remark-gfm`, `github-slugger`, `mdast-util-to-string`, and `unist-util-visit`. `extractHeadings` must reset a new slugger per document, omit H4-H6 from the sidebar, and attach a lower-depth heading to the nearest prior ancestor. `createHeadingIdPlugin` must set `node.data.hProperties.id` using the same fresh-slugger algorithm for every transform.

Core signatures:

```ts
export interface HeadingItem {
  id: string;
  depth: 1 | 2 | 3;
  text: string;
  children: HeadingItem[];
}

export function extractHeadings(markdown: string): HeadingItem[];
export function createHeadingIdPlugin(): (tree: Root) => void;
```

- [ ] **Step 7: Run heading tests and quality checks**

Run: `npm test -- src/markdown/headings.test.ts && npm run typecheck:renderer && npm run lint`

Expected: all commands PASS.

- [ ] **Step 8: Commit**

```powershell
git add package.json package-lock.json eslint.config.js prettier.config.js vitest.config.ts src/test/setup.ts src/markdown/headings.ts src/markdown/headings.test.ts
git commit -m "build: add quality tooling and heading model"
```

---

### Task 2: Secure Document and URL Services

**Files:**

- Create: `electron/contracts.ts`
- Create: `electron/document-service.ts`
- Create: `electron/security.ts`
- Create: `tests/electron/document-service.test.ts`
- Create: `tests/electron/security.test.ts`
- Modify: `tsconfig.electron.json`
- Modify: `vitest.config.ts`

**Interfaces:**

- Produces: `DocumentPayload { filePath; fileName; content; documentId }`.
- Produces: `readMarkdownDocument(filePath): Promise<DocumentPayload>`.
- Produces: `resolveDocumentAsset(documentId, relativePath): Promise<string>`; document roots remain private and canonical containment is enforced.
- Produces: `isTrustedSender(url, trustedRendererUrl): boolean`.
- Produces: `parseExternalUrl(value): URL | null`.

- [ ] **Step 1: Write failing service tests in Node environment**

Add `// @vitest-environment node` to both test files. Cover:

```ts
it('accepts all configured markdown extensions case-insensitively', async () => {
  for (const name of ['a.md', 'a.markdown', 'a.mdown', 'a.MKD']) {
    expect(isMarkdownPath(name)).toBe(true);
  }
});

it('rejects asset traversal outside the active document root', async () => {
  const { documentId } = await readMarkdownDocument(markdownFixturePath);
  await expect(resolveDocumentAsset(documentId, '..\\secret.txt')).rejects.toThrow(/outside/i);
});

it.each(['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,x'])(
  'rejects unsafe external URL %s',
  (value) => {
    expect(parseExternalUrl(value)).toBeNull();
  },
);

it.each(['https://example.com', 'http://localhost:3000', 'mailto:test@example.com'])(
  'accepts supported external URL %s',
  (value) => {
    expect(parseExternalUrl(value)?.href).toBeTruthy();
  },
);
```

Add temp-directory coverage proving `readMarkdownDocument` reads UTF-8 asynchronously and returns a stable opaque `documentId`, not the root directory.

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test -- tests/electron/document-service.test.ts tests/electron/security.test.ts`

Expected: FAIL because the service modules do not exist.

- [ ] **Step 3: Implement contracts and pure security helpers**

```ts
export interface DocumentPayload {
  filePath: string;
  fileName: string;
  content: string;
  documentId: string;
}

export const IPC = {
  selectDocument: 'document:select',
  openedDocument: 'document:opened',
  openExternal: 'navigation:open-external',
} as const;
```

`isTrustedSender` compares a parsed sender URL with an explicit trusted renderer URL. In production, the trusted URL is the canonical packaged `dist/index.html` URL; reject non-empty `file:` hosts and any other local file path, while ignoring only fragment changes. In development, accept only the exact `http://localhost:5173` origin and application path. `parseExternalUrl` uses `new URL` and an exact protocol set of `http:`, `https:`, and `mailto:`.

- [ ] **Step 4: Implement async document and asset services**

Use `node:fs/promises`, `node:path`, and `node:crypto`. Reject non-Markdown extensions before reading. Track canonical document roots in a `Map<string, string>` keyed by a random UUID. `resolveDocumentAsset` decodes and normalizes the relative path, rejects absolute and parent-traversal paths, canonicalizes the existing target with asynchronous `realpath`, and verifies canonical containment using `path.relative`. A symlink or junction that resolves outside the registered root is rejected.

- [ ] **Step 5: Run service tests and Electron type-check**

Run: `npm test -- tests/electron && npm run typecheck:electron`

Expected: PASS with no synchronous filesystem calls.

- [ ] **Step 6: Commit**

```powershell
git add electron/contracts.ts electron/document-service.ts electron/security.ts tests/electron tsconfig.electron.json vitest.config.ts
git commit -m "feat: add secure document services"
```

---

### Task 3: Harden Electron Main and Preload

**Files:**

- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Modify: `src/vite-env.d.ts`
- Create: `tests/electron/file-arguments.test.ts`

**Interfaces:**

- Consumes: `DocumentPayload`, `IPC`, `readMarkdownDocument`, `isTrustedSender`, and `parseExternalUrl` from Task 2.
- Produces renderer API:

```ts
interface ElectronAPI {
  selectDocument(): Promise<DocumentPayload | null>;
  openExternal(url: string): Promise<boolean>;
  assetUrl(documentId: string, relativePath: string): string;
  onDocumentOpened(callback: (document: DocumentPayload) => void): () => void;
}
```

- [ ] **Step 1: Write failing argument parsing tests**

Extract and test `findMarkdownArgument(argv: string[]): string | null`:

```ts
expect(findMarkdownArgument(['electron.exe', 'app', 'C:\\docs\\README.markdown'])).toBe(
  'C:\\docs\\README.markdown',
);
expect(findMarkdownArgument(['electron.exe', 'app', '--inspect=9229'])).toBeNull();
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- tests/electron/file-arguments.test.ts`

Expected: FAIL because the exported parser does not exist.

- [ ] **Step 3: Replace unrestricted IPC with intent-specific handlers**

In each `ipcMain.handle`, reject requests unless `isTrustedSender(event.senderFrame.url, trustedRendererUrl)` returns true. Production derives `trustedRendererUrl` from the canonical packaged `dist/index.html`; development uses `http://localhost:5173/`. `document:select` owns the dialog selection and immediately returns `readMarkdownDocument(selectedPath)`. `navigation:open-external` parses the URL and calls `shell.openExternal(parsed.href)` only when accepted.

Register `md-asset` as a standard, secure custom scheme before `app.whenReady()`. Handle `md-asset://document/<documentId>/<relativePath>` by resolving the active document root and returning `net.fetch(pathToFileURL(resolvedPath).href)`. Reject missing IDs, traversal, and directories with a 404 response.

- [ ] **Step 4: Add navigation and permission denial**

For every app window:

```ts
mainWindow.webContents.on('will-navigate', (event, url) => {
  if (!isTrustedSender(url, trustedRendererUrl)) event.preventDefault();
});
mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
mainWindow.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) =>
  callback(false),
);
```

Keep dev tools available only in development.

- [ ] **Step 5: Implement single-instance and operating-system open flows**

Acquire `app.requestSingleInstanceLock()` before `whenReady`. If acquisition fails, quit immediately. On `second-instance`, parse the incoming argv, asynchronously read a valid document, send `document:opened`, restore/minimize state, and focus the existing window. Reuse the same `openDocumentPath` function for initial argv and macOS `open-file` events.

- [ ] **Step 6: Implement a cleanup-safe preload bridge**

```ts
onDocumentOpened: (callback) => {
  const listener = (_event: Electron.IpcRendererEvent, document: DocumentPayload) =>
    callback(document);
  ipcRenderer.on(IPC.openedDocument, listener);
  return () => ipcRenderer.removeListener(IPC.openedDocument, listener);
};
```

`assetUrl` only URL-encodes `documentId` and path components into the `md-asset` scheme; it exposes no Node or IPC primitive.

- [ ] **Step 7: Replace all `any` window access with the global API type**

Update `src/vite-env.d.ts` to import `DocumentPayload` as a type and declare the exact API above. Application code must use `window.electronAPI` directly.

- [ ] **Step 8: Verify focused tests and type-checks**

Run: `npm test -- tests/electron && npm run typecheck:electron && npm run typecheck:renderer`

Expected: PASS; `rg "readFileSync|read-file|get-file-name|window as any" electron src` returns no matches.

- [ ] **Step 9: Commit**

```powershell
git add electron/main.ts electron/preload.ts src/vite-env.d.ts tests/electron/file-arguments.test.ts
git commit -m "fix: harden Electron navigation and IPC"
```

---

### Task 4: GitHub-compatible Markdown Pipeline

**Files:**

- Create: `src/markdown/links.ts`
- Create: `src/markdown/links.test.ts`
- Create: `src/markdown/remarkAlerts.ts`
- Create: `src/markdown/schema.ts`
- Create: `src/markdown/Code.tsx`
- Create: `src/markdown/Image.tsx`
- Create: `src/markdown/Alert.tsx`
- Create: `src/markdown/MarkdownView.tsx`
- Create: `src/markdown/MarkdownView.test.tsx`
- Delete: `src/components/Markdown.tsx`

**Interfaces:**

- Consumes: `createHeadingIdPlugin`, `extractHeadings`, and `window.electronAPI`.
- Produces: `MarkdownView({ content, documentId, onHeadingsChange })`.
- Produces: `classifyLink(href): 'fragment' | 'external' | 'relative' | 'unsafe'`.

- [ ] **Step 1: Write link and renderer tests before implementation**

Cover exact semantics:

````tsx
render(
  <MarkdownView
    content={'# Title\n\nUse `npm test`.\n\n```ts\nconst x = 1\n```\n\n| H |\n|---|\n| C |'}
    documentId="doc-1"
  />,
);
expect(screen.getByRole('heading', { level: 1, name: 'Title' })).toHaveAttribute('id', 'title');
expect(screen.getByText('npm test').closest('pre')).toBeNull();
expect(screen.getByText('const x = 1').closest('pre')).not.toBeNull();
expect(screen.getByRole('columnheader', { name: 'H' }).tagName).toBe('TH');
````

Add cases for duplicate heading IDs, a sanitized `<script>`, stripped `onclick`, rejected `javascript:` links, safe raw `<details>`, GitHub NOTE/WARNING alerts, relative image rewriting, external-link delegation, and fragment scrolling.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/markdown/links.test.ts src/markdown/MarkdownView.test.tsx`

Expected: FAIL because the new modules do not exist.

- [ ] **Step 3: Implement link classification and sanitization schema**

`classifyLink` treats `#...` as a fragment, exact allowed external protocols as external, relative paths as relative, and all other explicit schemes as unsafe. Extend `rehype-sanitize`'s `defaultSchema` only with GitHub-safe structural tags/attributes needed by `details`, `summary`, `kbd`, task lists, syntax-highlight class names, heading IDs, and alert class/data attributes. Do not permit `script`, `style`, iframe-like tags, or event attributes.

- [ ] **Step 4: Implement the GitHub Alert remark plugin**

Visit blockquotes and recognize only a first text prefix matching:

```ts
/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\r?\n|\s+|$)/;
```

Remove the marker, set a safe `data-alert` value, and inject a title node with the Persian-neutral GitHub labels `Note`, `Tip`, `Important`, `Warning`, or `Caution`. Ordinary blockquotes remain unchanged.

- [ ] **Step 5: Implement typed renderer components**

- `Code` determines block form from the parent/node structure or language class, never an obsolete `inline` prop; fenced code gets highlighting and an accessible Copy button.
- `Image` maps relative sources through `window.electronAPI.assetUrl(documentId, src)`, preserves safe `http`, `https`, and `data:image` sources, and switches to a compact fallback on error.
- `Alert` maps validated alert types to class names and icons while preserving accessible text.
- Headings remain semantic `h1`-`h6`; table headers remain `th`.
- Bidirectional detection is applied per block without flattening or cloning away nested line breaks.

- [ ] **Step 6: Compose the ReactMarkdown pipeline**

Use this order:

```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkAlerts, createHeadingIdPlugin]}
  rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSchema], rehypeHighlight]}
  components={components}
>
  {content}
</ReactMarkdown>
```

Do not spread the parser's internal `node` prop onto DOM elements.

- [ ] **Step 7: Run Markdown tests and renderer checks**

Run: `npm test -- src/markdown && npm run typecheck:renderer && npm run lint`

Expected: PASS, including semantic heading, inline code, `th`, alert, sanitization, and asset tests.

- [ ] **Step 8: Commit**

```powershell
git add src/markdown src/components/Markdown.tsx
git commit -m "feat: render sanitized GitHub-style Markdown"
```

---

### Task 5: GitHub Surface and Right-side Table of Contents

**Files:**

- Create: `src/components/Toolbar.tsx`
- Create: `src/components/TableOfContents.tsx`
- Create: `src/components/TableOfContents.test.tsx`
- Create: `src/components/SidebarDrawer.tsx`
- Create: `src/components/SidebarDrawer.test.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/App.test.tsx`
- Modify: `src/main.tsx`
- Delete: `src/App.tsx`
- Create: `src/styles/github.css`
- Modify: `src/index.css`

**Interfaces:**

- Consumes: `DocumentPayload`, `HeadingItem`, `extractHeadings`, and `MarkdownView`.
- Produces: `TableOfContents({ headings, activeId, onNavigate })`.
- Produces: `SidebarDrawer({ open, onClose, children })`.

- [ ] **Step 1: Write failing table-of-contents interaction tests**

```tsx
render(<TableOfContents headings={headings} activeId="install" onNavigate={onNavigate} />);
expect(screen.getByRole('link', { name: 'Install' })).toHaveAttribute('aria-current', 'location');
await user.click(screen.getByRole('link', { name: 'Windows' }));
expect(onNavigate).toHaveBeenCalledWith('windows');
```

Add tests for nested H1-H3 lists, no-heading hidden state, drawer Escape/outside-click closure, focus restoration, and toolbar accessible names.

- [ ] **Step 2: Write failing App request-order and subscription tests**

Mock `window.electronAPI`. Resolve a second `selectDocument` request before the first and assert the second remains displayed. Mount under `StrictMode`, unmount, and assert the unsubscribe function runs for each subscription setup.

- [ ] **Step 3: Run UI tests and verify RED**

Run: `npm test -- src/components src/app`

Expected: FAIL because the new UI components do not exist.

- [ ] **Step 4: Implement the application state flow**

Use a monotonically increasing request ID in `App`:

```ts
const requestId = ++latestRequest.current;
const next = await window.electronAPI.selectDocument();
if (next && requestId === latestRequest.current) setDocument(next);
```

Subscribe once through `onDocumentOpened` and return its unsubscribe callback from `useEffect`. Compute `headings` with `useMemo(() => extractHeadings(document.content), [document.content])`.

- [ ] **Step 5: Implement active-heading tracking and navigation**

Use one `IntersectionObserver` over rendered H1-H3 elements, with a top-biased root margin. Store only the active heading ID. `onNavigate` calls `document.getElementById(id)?.scrollIntoView({ behavior })`, where behavior is `auto` under reduced motion and `smooth` otherwise.

- [ ] **Step 6: Implement responsive option-A layout**

Desktop uses a centered two-column grid with document content first and a sticky 16-18rem right sidebar in RTL shell order. Hide the sidebar when collapsed or empty. Below the chosen breakpoint, render the same TOC tree inside `SidebarDrawer`, close after navigation, trap focus, close on Escape/outside click, and restore trigger focus.

- [ ] **Step 7: Apply GitHub visual styling**

Import `github-markdown-css/github-markdown.css` into `src/styles/github.css`, scope it under `.markdown-body`, and add explicit light/dark overrides for background, foreground, muted text, borders, links, inline code, code blocks, tables, task lists, alerts, focus rings, image fallback, and scrollbar. Keep Vazirmatn for Persian body text and a platform monospace stack for code.

Code-copy feedback must use text/icon state for two seconds and not depend on color alone.

- [ ] **Step 8: Run UI tests and checks**

Run: `npm test -- src/components src/app && npm run typecheck:renderer && npm run lint`

Expected: PASS with no React act warnings or leaked listeners.

- [ ] **Step 9: Commit**

```powershell
git add src/app src/components src/styles src/main.tsx src/index.css src/App.tsx
git commit -m "feat: add GitHub layout and heading sidebar"
```

---

### Task 6: CSP, Packaging, Associations, and Documentation

**Files:**

- Modify: `index.html`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `vite.config.ts`
- Modify: `electron/main.ts`
- Modify: `build/icon.png` only if packaging proves it invalid

**Interfaces:**

- Consumes: completed renderer and Electron lifecycle.
- Produces: packaged Windows application with consistent file associations.

- [ ] **Step 1: Add restrictive CSP and verify production asset requirements**

Use a production-compatible policy equivalent to:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: http: md-asset:; font-src 'self'; connect-src 'self' http://localhost:5173 ws://localhost:5173; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"
/>
```

If Vite development requires a narrower environment-specific adjustment, generate it through Vite's HTML transform; do not broaden production `script-src`.

- [ ] **Step 2: Make extensions and build scripts consistent**

Set file associations for `md`, `markdown`, `mdown`, and `mkd` in electron-builder configuration. Ensure the association icon resolves from `build/icon.png`. Make `electron:build` execute renderer type-check, Electron type-check, Vite build, and electron-builder in that order.

- [ ] **Step 3: Update README with actual behavior**

Document:

- GitHub-style rendering and supported syntax;
- H1-H3 right sidebar and responsive drawer;
- local relative images;
- safe external-link behavior;
- supported extensions;
- `npm run electron:dev`, `npm run check`, and `npm run electron:build`;
- installer output location.

- [ ] **Step 4: Run production build and inspect warnings**

Run: `npm run check`

Expected: all checks PASS; no CJS Vite deprecation or typeless PostCSS warning remains. If necessary, rename PostCSS/Tailwind configs to `.cjs` or convert them consistently with package module type.

- [ ] **Step 5: Build the installer**

Run: `npm run electron:build`

Expected: electron-builder produces the Windows installer under `release/`, resolves `build/icon.png`, and reports all four associations without missing-resource errors.

- [ ] **Step 6: Commit**

```powershell
git add index.html package.json package-lock.json README.md vite.config.ts electron/main.ts build/icon.png postcss.config.* tailwind.config.*
git commit -m "build: secure and document Windows packaging"
```

---

### Task 7: Electron End-to-End Verification

**Files:**

- Create: `tests/fixtures/readme.md`
- Create: `tests/fixtures/local-image.png`
- Create: `tests/e2e/app.spec.ts`
- Create: `playwright.config.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: packaged/development Electron entry point and typed UI controls.
- Produces: automated critical-path proof for document opening, rendering, sidebar, theme, and external navigation delegation.

- [ ] **Step 1: Create a representative fixture**

The fixture must contain Persian and English text, duplicate H2 headings, H1-H4 hierarchy, inline code, TypeScript fenced code, a table, task list, NOTE and WARNING alerts, an allowed `<details>` block, a stripped `<script>`, a relative image, an internal heading link, and an external HTTPS link.

- [ ] **Step 2: Write the failing Electron E2E test**

Launch with Playwright's Electron API and the fixture path in argv. Assert:

```ts
const app = await electron.launch({ args: ['.', fixturePath] });
const page = await app.firstWindow();
await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
await expect(page.getByRole('navigation', { name: 'فهرست مطالب' })).toBeVisible();
await page.getByRole('link', { name: 'نصب' }).click();
await expect(page.locator('#نصب')).toBeInViewport();
await page.getByRole('button', { name: 'تغییر حالت نمایش' }).click();
await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
```

Spy on the main-process external-open helper or mock `shell.openExternal` and assert the HTTPS link delegates without changing `page.url()`.

- [ ] **Step 3: Run E2E and verify RED**

Run: `npm run build && npm run test:e2e`

Expected: FAIL until selectors, startup argv handling, and external-link seam are fully wired for automation.

- [ ] **Step 4: Make only the minimal production adjustments required by E2E**

Use accessible roles/names rather than test IDs. Export or inject the external-open function at the main-process boundary rather than adding an app-only backdoor. Keep production security checks enabled during the test.

- [ ] **Step 5: Run the complete verification matrix**

Run:

```powershell
npm run check
npm run test:e2e
npm run electron:build
```

Expected: every command exits 0, the installer exists under `release/`, and Git shows only intended source/test/documentation changes.

- [ ] **Step 6: Perform targeted static checks**

Run:

```powershell
rg -n "readFileSync|nodeIntegration:\s*true|contextIsolation:\s*false|window as any|ipcRenderer\.(send|invoke)\([^I]" electron src
rg -n "rehypeRaw" src/markdown/MarkdownView.tsx
rg -n "rehypeSanitize" src/markdown/MarkdownView.tsx
```

Expected: the unsafe-pattern search returns no matches; both raw parsing and subsequent sanitization are present in the Markdown pipeline.

- [ ] **Step 7: Commit**

```powershell
git add tests/e2e tests/fixtures playwright.config.ts package.json package-lock.json
git commit -m "test: cover desktop Markdown workflow"
```

---

## Final Review Checklist

- [ ] Compare every success criterion in the design spec with a passing test or verification command above.
- [ ] Review the final diff for unrelated changes and generated `dist`, `dist-electron`, or `release` files.
- [ ] Confirm the working tree is clean after the final commit.
- [ ] Record exact versions and verification output in the delivery summary.
- [ ] Use the `verification-before-completion` skill before claiming completion.
- [ ] Use the `requesting-code-review` skill for a final requirements and quality review.
