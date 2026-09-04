# Multi-tab and Split View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent multi-tab document reading and an accessible two-pane Split View to the existing React/Electron/website reader.

**Architecture:** Replace the single `doc` state in `App` with a versioned workspace containing tabs, active-tab state, optional split-tab state, and a restore preference. Extract document rendering into an independent `DocumentPane` so each pane owns its scroll and outline state, and add a focused `TabBar` for tab selection, closing, Split, and second-pane selection.

**Tech Stack:** React 18, TypeScript, Vitest + Testing Library, Playwright, CSS media queries, Electron preload contract unchanged, browser `localStorage` for same-device persistence.

## Global Constraints

- Open every newly selected document in a new tab unless the same document is already open; duplicate documents activate the existing tab.
- Split is available only above the existing `960px` narrow breakpoint and closes automatically below it.
- Keep RTL Persian/English rendering, GitHub Markdown semantics, themes, focus mode, local-only file handling, and existing accessibility behavior.
- Do not add a runtime dependency.
- Persist workspace data only on the same device; never send document contents to a server.
- A cancelled or failed open must not remove or replace existing tabs.
- Keep existing single-document localStorage data readable through a migration path.
- Verify the finished work with `npm run check` and the relevant Playwright E2E tests.

## File Map

- Create `src/app/workspace.ts`: workspace/tab types, stable document keys, add/activate/close/split transitions, and versioned serialization.
- Create `src/app/workspace.test.ts`: pure workspace transition and persistence tests.
- Modify `src/app/browserDocument.ts` and `src/app/browserDocument.test.ts`: expose the legacy document key for migration and verify browser document identity inputs.
- Create `src/components/TabBar.tsx` and `src/components/TabBar.test.tsx`: accessible tab strip and Split controls.
- Create `src/components/DocumentPane.tsx` and `src/components/DocumentPane.test.tsx`: one document’s scroll container, Markdown, outline, error/loading content, and reading status.
- Modify `src/app/App.tsx` and `src/app/App.test.tsx`: integrate workspace state, document opening, pane selection, persistence, focus mode, and responsive Split behavior.
- Modify `src/components/ReadingToolbar.tsx` and its call sites: expose the restore-tabs setting.
- Modify `src/index.css`: tab strip, pane grid, pane headers, and narrow-screen rules.
- Modify `tests/e2e/reader.spec.ts`: cover multi-tab and Split behavior at wide and narrow viewports.
- Modify `README.md` and `PRODUCT.md`: document the shipped reader capability and restore setting.

---

### Task 1: Build the workspace state and persistence boundary

**Files:**
- Create: `src/app/workspace.ts`
- Create: `src/app/workspace.test.ts`
- Modify: `src/app/browserDocument.ts`
- Modify: `src/app/browserDocument.test.ts`

**Interfaces:**
- `WorkspaceTab = { tabId: string; document: DocumentPayload; documentKey: string; scrollTop: number }`
- `WorkspaceState = { tabs: WorkspaceTab[]; activeTabId: string | null; splitTabId: string | null; restoreTabs: boolean }`
- `createWorkspace(restoreTabs?: boolean): WorkspaceState`
- `documentKey(document: DocumentPayload): string`
- `openInWorkspace(workspace: WorkspaceState, document: DocumentPayload): WorkspaceState`
- `activateTab(workspace: WorkspaceState, tabId: string): WorkspaceState`
- `closeTab(workspace: WorkspaceState, tabId: string): WorkspaceState`
- `setSplitTab(workspace: WorkspaceState, tabId: string | null): WorkspaceState`
- `readWorkspace(): WorkspaceState`
- `saveWorkspace(workspace: WorkspaceState): boolean`
- `saveRestoreTabs(value: boolean): boolean`

- [ ] **Step 1: Add failing pure transition tests**

```ts
it('adds a new document and makes it active', () => {
  const first = payload('First');
  const next = openInWorkspace(createWorkspace(), first);
  expect(next.tabs).toHaveLength(1);
  expect(next.activeTabId).toBe(next.tabs[0].tabId);
});

it('activates an already-open document instead of duplicating it', () => {
  const first = payload('First');
  const opened = openInWorkspace(openInWorkspace(createWorkspace(), first), payload('Second'));
  const next = openInWorkspace(opened, { ...first, documentId: 'different-render-id' });
  expect(next.tabs).toHaveLength(2);
  expect(next.activeTabId).toBe(next.tabs[0].tabId);
});

it('closes the split tab and selects a safe active tab', () => {
  let workspace = openInWorkspace(createWorkspace(), payload('First'));
  workspace = openInWorkspace(workspace, payload('Second'));
  workspace = setSplitTab(workspace, workspace.tabs[1].tabId);
  const next = closeTab(workspace, workspace.tabs[1].tabId);
  expect(next.tabs).toHaveLength(1);
  expect(next.splitTabId).toBeNull();
  expect(next.activeTabId).toBe(next.tabs[0].tabId);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- src/app/workspace.test.ts`

Expected: FAIL because the workspace module and transitions do not exist.

- [ ] **Step 3: Implement immutable workspace transitions**

Use a stable key that does not require Node APIs in the renderer:

```ts
export function documentKey(document: DocumentPayload): string {
  if (document.filePath) return `path:${document.filePath.replaceAll('\\', '/').toLowerCase()}`;
  return `content:${document.fileName}\u0000${document.content}`;
}
```

Generate `tabId` with `crypto.randomUUID()` and a timestamp/random fallback, preserve tab order, and make `closeTab` choose the previous tab or the first remaining tab. `setSplitTab` must reject an unknown tab and the active tab by returning an unchanged workspace with `splitTabId: null`.

- [ ] **Step 4: Add versioned localStorage read/write tests**

Cover valid data, malformed data, an empty workspace, the old `md-viewer-document-v1` browser document, and storage exceptions. Assert that `readWorkspace()` never throws and that `saveWorkspace()` returns `false` when `Storage.prototype.setItem` throws.

- [ ] **Step 5: Implement migration and persistence**

Use `md-viewer-workspace-v1` for the new serialized format. `readWorkspace()` should migrate the old document into one tab, use `restoreTabs: true` when no preference exists, and discard invalid tab entries rather than throwing. Store the restore preference under `md-viewer-restore-tabs-v1`. Do not persist `scrollTop`; initialize it to `0` after restoration.

- [ ] **Step 6: Make browser document identity testable**

Export `documentKey` from the workspace module and update browser tests to prove that two files with the same name and content map to the same key while changed content maps to a different key. Keep the existing random `documentId` as the Markdown render identity.

- [ ] **Step 7: Run the focused tests and commit**

Run: `npm test -- src/app/workspace.test.ts src/app/browserDocument.test.ts`

Expected: PASS.

```bash
git add src/app/workspace.ts src/app/workspace.test.ts src/app/browserDocument.ts src/app/browserDocument.test.ts
git commit -m "feat: add persistent tab workspace state"
```

### Task 2: Add the accessible tab strip and Split controls

**Files:**
- Create: `src/components/TabBar.tsx`
- Create: `src/components/TabBar.test.tsx`

**Interfaces:**
- `TabBarProps = { tabs: WorkspaceTab[]; activeTabId: string | null; splitTabId: string | null; narrow: boolean; onActivate(tabId: string): void; onClose(tabId: string): void; onToggleSplit(): void; onSelectSplit(tabId: string): void }`

- [ ] **Step 1: Write failing interaction tests**

```tsx
it('marks the active tab and exposes a close button by file name', async () => {
  const user = userEvent.setup();
  render(<TabBar tabs={tabs} activeTabId="first" splitTabId={null} narrow={false} {...handlers} />);
  expect(screen.getByRole('tab', { name: 'First.md' })).toHaveAttribute('aria-selected', 'true');
  await user.click(screen.getByRole('button', { name: 'بستن First.md' }));
  expect(handlers.onClose).toHaveBeenCalledWith('first');
});

it('offers only non-active tabs to the split selector', () => {
  render(<TabBar tabs={tabs} activeTabId="first" splitTabId="second" narrow={false} {...handlers} />);
  expect(screen.getByLabelText('سند پنل دوم')).toHaveValue('second');
  expect(screen.getByRole('option', { name: 'First.md' })).toBeDisabled();
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- src/components/TabBar.test.tsx`

Expected: FAIL because `TabBar` does not exist.

- [ ] **Step 3: Implement the tab strip**

Render a `role="tablist"` with one `role="tab"` button per tab, `aria-selected`, `aria-controls`, filename tooltip, and a nested close button whose click stops propagation. Render a `button` labeled `فعال کردن split` or `بستن split` with `aria-pressed`. Render a labeled `<select>` for the second pane only when Split is enabled; disable the active-tab option and call `onSelectSplit` for valid choices.

- [ ] **Step 4: Implement narrow behavior and keyboard-safe focus**

Do not render the Split control or second-pane selector when `narrow` is true. Keep native button/tab keyboard behavior, preserve focus after closing a tab by relying on the next tab button’s stable order, and use the existing Persian labels and `Icon` component.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- src/components/TabBar.test.tsx`

Expected: PASS.

```bash
git add src/components/TabBar.tsx src/components/TabBar.test.tsx
git commit -m "feat: add accessible document tab bar"
```

### Task 3: Extract an independent document pane

**Files:**
- Create: `src/components/DocumentPane.tsx`
- Create: `src/components/DocumentPane.test.tsx`
- Modify: `src/app/App.tsx`

**Interfaces:**
- `DocumentPaneProps = { tab: WorkspaceTab; paneId: PaneId; showSidebar: boolean; loading: boolean; error: string; onNavigate(id: string, pane: PaneId): void; onClose(): void; onScrollTop(value: number): void }`
- `PaneId = 'primary' | 'secondary'`

- [ ] **Step 1: Add a rendering test for one pane**

```tsx
it('renders its own document, outline, and reading status', () => {
  render(<DocumentPane tab={tab('Guide')} showSidebar loading={false} error="" paneId="primary" {...handlers} />);
  expect(screen.getByRole('article', { name: 'Guide.md' })).toBeInTheDocument();
  expect(screen.getByRole('navigation')).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: 'پیشرفت مطالعه' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- src/components/DocumentPane.test.tsx`

Expected: FAIL until the component is created.

- [ ] **Step 3: Move document-specific rendering into `DocumentPane`**

Move heading extraction, direction detection, `MarkdownView`, `TableOfContents`, `useActiveHeading`, scroll ref, loading/error/empty rendering, drag/drop target behavior, and `ReadingStatus` from `App` into the pane. Scope heading navigation to that pane’s scroll element so identical Markdown IDs in the two panes cannot collide.

- [ ] **Step 4: Preserve scroll per tab**

On pane scroll call `onScrollTop(scrollRef.current?.scrollTop ?? 0)`. On mount/update restore the tab’s in-memory `scrollTop` in `requestAnimationFrame`; when a tab is restored from localStorage its value remains `0`.

- [ ] **Step 5: Run existing and new pane tests**

Run: `npm test -- src/components/DocumentPane.test.tsx src/markdown/MarkdownView.test.tsx src/components/TableOfContents.test.tsx`

Expected: PASS.

### Task 4: Integrate workspace behavior in `App`

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/components/ReadingToolbar.tsx`

**Interfaces:**
- `ReadingToolbarProps` gains `restoreTabs: boolean` and `onRestoreTabsChange(value: boolean): void`.
- `App` owns `WorkspaceState`, derives `primaryTab` from `activeTabId`, and derives `secondaryTab` from `splitTabId`.

- [ ] **Step 1: Add failing App tests for open, duplicate, close, and Split**

```tsx
it('opens multiple documents as tabs and reuses a duplicate', async () => {
  const api = installApi();
  const user = userEvent.setup();
  render(<App />);
  api.opened(payload('First'));
  api.opened(payload('Second'));
  expect(screen.getAllByRole('tab')).toHaveLength(2);
  api.opened(payload('First'));
  expect(screen.getAllByRole('tab')).toHaveLength(2);
  expect(screen.getByRole('tab', { name: 'First.md' })).toHaveAttribute('aria-selected', 'true');
  await user.click(screen.getByRole('button', { name: 'فعال کردن split' }));
  await user.selectOptions(screen.getByLabelText('سند پنل دوم'), { label: 'Second.md' });
  expect(screen.getAllByRole('article')).toHaveLength(2);
});
```

- [ ] **Step 2: Run the focused App tests and confirm the new assertions fail**

Run: `npm test -- src/app/App.test.tsx`

Expected: existing tests may pass, while the new tab assertions fail because `App` still owns one `doc`.

- [ ] **Step 3: Replace single-document state with workspace state**

Initialize from `readWorkspace()` only when the browser or Electron renderer has local storage available. Route every successful `selectDocument`, browser file, drop, sample, and `onDocumentOpened` event through `openInWorkspace`; do not invalidate a successful older request just because a newer dialog was opened. Keep request cancellation/error guards for each pending operation.

- [ ] **Step 4: Add tab activation and close handlers**

Wire `TabBar` callbacks to immutable workspace transitions. When the active tab changes, update the active pane; when a tab closes, clear Split if necessary and select the nearest remaining tab. Keep the existing web close action as a tab close action, and when the final tab closes return to the Persian empty state.

- [ ] **Step 5: Add Split and responsive transitions**

Use the existing media query listener to call `setSplitTab(null)` whenever `narrow` becomes true. Disable Split with fewer than two tabs. Render one `DocumentPane` for the active tab and a second independent pane for `splitTabId` when valid.

- [ ] **Step 6: Add the restore setting to the reading toolbar**

Render a checkbox labeled `بازگردانی تب‌ها هنگام شروع` and persist changes through `saveRestoreTabs`. Turning it off affects the next start and leaves the current workspace intact. Keep the control keyboard accessible and compatible with ebook, light, dark, and focus modes.

- [ ] **Step 7: Persist workspace after every meaningful change**

Save after tab open, activation, close, Split change, and restore-setting change. Set `storageError` from the boolean return value without clearing in-memory state. Keep the existing offline/browser document notice wording understandable for multi-tab storage.

- [ ] **Step 8: Run App tests and commit**

Run: `npm test -- src/app/App.test.tsx src/components/DocumentPane.test.tsx`

Expected: PASS, including all pre-existing reader behavior.

```bash
git add src/app/App.tsx src/app/App.test.tsx src/components/ReadingToolbar.tsx
git commit -m "feat: integrate multi-tab reading workspace"
```

### Task 5: Add Split layout styling and responsive polish

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add layout assertions to the E2E test before styling**

Assert the wide page exposes `.tab-bar`, `.split-layout`, and two `.document-pane` elements after opening two documents and enabling Split. Assert the narrow page has one `.document-pane` and a disabled or absent Split control.

- [ ] **Step 2: Implement styles matching the existing visual system**

Add a bordered, horizontally scrollable tab strip using existing `--chrome`, `--surface`, `--border`, `--accent`, and `--muted` variables. Use a two-column grid for Split with a visible divider, independent pane overflow, compact pane headers, and consistent RTL placement. Keep the single-pane layout visually unchanged.

- [ ] **Step 3: Add the narrow breakpoint rules**

At `@media (max-width: 960px)`, force one column, hide Split controls, keep tabs scrollable, and prevent horizontal page overflow. At `@media (prefers-reduced-motion: reduce)`, reuse the existing global rule so tab/pane transitions are disabled.

- [ ] **Step 4: Run formatting and browser tests**

Run: `npm run format:check; npm run build:web; npm run test:e2e`

Expected: formatting, production build, wide Split flow, narrow fallback, offline reader, and existing E2E behavior all pass.

```bash
git add src/index.css tests/e2e/reader.spec.ts
git commit -m "feat: style responsive split document panes"
```

### Task 6: Update product documentation and perform the full verification

**Files:**
- Modify: `README.md`
- Modify: `PRODUCT.md`

- [ ] **Step 1: Document the user-visible behavior**

Add concise Persian bullets for multiple tabs, duplicate-file activation, wide-screen Split, narrow-screen fallback, and the restore-tabs setting. State that workspace data stays on the device and that restored documents start at the top.

- [ ] **Step 2: Run the full quality gate**

Run: `npm run check`

Expected: renderer and Electron typechecks, lint, formatting, unit tests, and production build pass with exit code `0`.

- [ ] **Step 3: Inspect the final workspace and commit documentation**

Run: `git -c safe.directory=D:/md-viewer status --short`

Expected: only the intended multi-tab implementation and documentation changes remain.

```bash
git add README.md PRODUCT.md
git commit -m "docs: document multi-tab split reading"
```
