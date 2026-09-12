# Header Toolbar Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate document tabs, Split controls, and icon-only actions in the main header while removing desktop/web version labels.

**Architecture:** `Toolbar` becomes the header layout owner and receives the existing `TabBar` as its flexible workspace region. `TabBar` keeps current tab and Split behavior, but renders its two-pane action as an icon-only titled control. `useOffline` returns no label for platform-identification states, so the header only shows meaningful offline-status text.

**Tech Stack:** React 18, TypeScript, CSS, Vitest, React Testing Library, Vite.

## Global Constraints

- Preserve workspace persistence, tab activation, close-button focus transfer, Split selection, and the single-pane behavior at 960px and below.
- Keep the tab strip horizontally scrollable rather than wrapping or increasing header height.
- Keep all icon-only controls keyboard-accessible, with an accessible name and native `title` tooltip.
- Do not remove meaningful offline-progress/error statuses. Hide only `نسخهٔ دسکتاپ` and `نسخهٔ وب` platform-identification labels.
- Keep the existing RTL layout, Vazirmatn typography, theme behavior, and reduced-motion rules.

## File Structure

- `src/app/useOffline.ts`: represent platform-identification states with a null label.
- `src/components/Icon.tsx`: add the two-panel Split glyph.
- `src/components/Toolbar.tsx`: accept the workspace region, remove the standalone document name, and render header actions as icon buttons.
- `src/components/TabBar.tsx`: make the Split toggle icon-only, titled, and disabled when fewer than two tabs exist.
- `src/app/App.tsx`: mount `TabBar` inside `Toolbar`; remove the old `workspace-tabs` row.
- `src/index.css`: style the single header row and its overflow-safe tab region.
- `src/app/App.test.tsx` and `src/components/TabBar.test.tsx`: add regressions for composition, labels, and Split action behavior.

---

### Task 1: Define the header behavior in regression tests

**Files:**

- Modify: `src/app/App.test.tsx`
- Modify: `src/components/TabBar.test.tsx`

**Interfaces:**

- Consumes: existing `App`, `Toolbar`, `TabBar`, and `installApi()` test helper.
- Produces: failing regression coverage for a tablist inside the header, absent platform labels, icon-only tooltip-bearing actions, and Split semantics.

- [ ] **Step 1: Write the failing App-level tests**

Add tests that open two documents with `installApi()`, then verify that the tablist is inside the `banner` header and no `.workspace-tabs` wrapper remains. In the Electron test environment, verify `نسخهٔ دسکتاپ` is not rendered. Verify the open, e-ink, and theme controls have their accessible names and a matching `title`, while their old visible action copy is absent.

```tsx
it('places tabs in the header and hides platform-only labels', () => {
  const api = installApi();
  const { container } = render(<App />);
  api.opened(payload('First'));
  api.opened(payload('Second'));

  const header = screen.getByRole('banner');
  expect(within(header).getByRole('tablist', { name: 'سندهای باز' })).toBeInTheDocument();
  expect(container.querySelector('.workspace-tabs')).not.toBeInTheDocument();
  expect(screen.queryByText('نسخهٔ دسکتاپ')).not.toBeInTheDocument();
});

it('renders header actions as titled icon buttons', () => {
  installApi();
  render(<App />);

  expect(screen.getByRole('button', { name: 'باز کردن فایل' })).toHaveAttribute(
    'title',
    'باز کردن فایل',
  );
  expect(screen.getByRole('button', { name: 'حالت کتابخوان' })).toHaveAttribute(
    'title',
    'حالت کتابخوان (E-Ink)',
  );
  expect(screen.queryByText('باز کردن فایل')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused App test to verify it fails**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL because the tablist is still outside the header, the desktop label remains rendered, and action text is visible.

- [ ] **Step 3: Update TabBar tests for the new Split affordance**

Replace assertions for visible `فعال کردن split` and `بستن split` copy with Persian accessible names and tooltips. Add a one-tab desktop render that expects a visible, disabled Split action.

```tsx
const enableSplit = screen.getByRole('button', { name: 'فعال کردن نمای دوپنل' });
expect(enableSplit).toHaveAttribute('title', 'فعال کردن نمای دوپنل');
expect(enableSplit).toHaveAttribute('aria-pressed', 'false');

render(
  <TabBar tabs={[tabs[0]]} activeTabId="first" splitTabId={null} narrow={false} {...handlers} />,
);
expect(screen.getByRole('button', { name: 'فعال کردن نمای دوپنل' })).toBeDisabled();
```

- [ ] **Step 4: Run the focused TabBar test to verify it fails**

Run: `npm test -- src/components/TabBar.test.tsx`

Expected: FAIL because the existing text-bearing Split button is still used and the one-tab action is hidden.

- [ ] **Step 5: Commit the red tests**

```bash
git add src/app/App.test.tsx src/components/TabBar.test.tsx
git commit -m "test: define compact header workspace behavior"
```

### Task 2: Consolidate workspace controls and header actions

**Files:**

- Modify: `src/app/useOffline.ts`
- Modify: `src/components/Icon.tsx`
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/TabBar.tsx`
- Modify: `src/app/App.tsx`

**Interfaces:**

- Consumes: existing `Toolbar` and `TabBarProps` callbacks.
- Produces: `Toolbar.children?: ReactNode` as the workspace slot, `useOffline().label: string | null`, and an icon-only Split action owned by `TabBar`.

- [ ] **Step 1: Add the two-panel Split icon and titled control**

Add a `split` path to `Icon.tsx`, drawn as two side-by-side outlined panels. In `TabBar`, replace the current `focus` icon and visible Split text with `<Icon name="split" />`. Use the following accessible state names and retain the pressed state. Disable the action whenever there are fewer than two tabs.

```tsx
<button
  type="button"
  className="icon-button split-toggle"
  aria-label={splitEnabled ? 'بستن نمای دوپنل' : 'فعال کردن نمای دوپنل'}
  title={splitEnabled ? 'بستن نمای دوپنل' : 'فعال کردن نمای دوپنل'}
  aria-pressed={splitEnabled}
  disabled={tabs.length < 2}
  onClick={onToggleSplit}
>
  <Icon name="split" />
</button>
```

- [ ] **Step 2: Add the Toolbar workspace slot and convert actions**

Import `ReactNode`, add `children?: ReactNode` to `ToolbarProps`, and render `children` in a `.toolbar-workspace` wrapper between the brand and `.toolbar-actions`. Delete the `.document-name` filename and close-button markup. Change install, open, and e-ink controls to `.icon-button` controls, preserving callbacks and pressed states and adding both `aria-label` and `title`. Render the offline badge only when `offlineLabel !== null`.

```tsx
{
  children ? <div className="toolbar-workspace">{children}</div> : null;
}

<button
  className="icon-button"
  type="button"
  aria-label="باز کردن فایل"
  title="باز کردن فایل"
  onClick={onOpen}
>
  <Icon name="open" />
</button>;
```

- [ ] **Step 3: Suppress only the web/desktop labels**

Change `useOffline` so Electron and unsupported web environments yield `label: null`. Keep the four meaningful status strings unchanged: `آمادهٔ آفلاین`, `در حال مطالعهٔ آفلاین`, `ذخیرهٔ آفلاین در دسترس نیست`, and `آماده‌سازی آفلاین…`. Change `ToolbarProps.offlineLabel` to `string | null`.

```ts
const label = window.electronAPI
  ? null
  : ready
    ? online
      ? 'آمادهٔ آفلاین'
      : 'در حال مطالعهٔ آفلاین'
    : failed
      ? 'ذخیرهٔ آفلاین در دسترس نیست'
      : supported
        ? 'آماده‌سازی آفلاین…'
        : null;
```

- [ ] **Step 4: Compose TabBar in Toolbar**

Pass the existing `TabBar` as `Toolbar` children only when at least one workspace tab exists. Pass the actual viewport `narrow` value, keep all current tab/Split callbacks, and remove the separate `.workspace-tabs` container plus its duplicate disabled Split control.

```tsx
<Toolbar {...toolbarProps}>
  {workspace.tabs.length > 0 ? (
    <TabBar
      tabs={workspace.tabs}
      activeTabId={workspace.activeTabId}
      splitTabId={workspace.splitTabId}
      narrow={narrow}
      onActivate={activateWorkspaceTab}
      onClose={closeWorkspaceTab}
      onToggleSplit={toggleSplit}
      onSelectSplit={(tabId) => setWorkspace((current) => setSplitTab(current, tabId))}
    />
  ) : null}
</Toolbar>
```

- [ ] **Step 5: Run focused tests to verify green behavior**

Run: `npm test -- src/app/App.test.tsx src/components/TabBar.test.tsx`

Expected: PASS, including current workspace and close-focus tests.

- [ ] **Step 6: Commit the behavior**

```bash
git add src/app/useOffline.ts src/components/Icon.tsx src/components/Toolbar.tsx src/components/TabBar.tsx src/app/App.tsx src/app/App.test.tsx src/components/TabBar.test.tsx
git commit -m "feat: consolidate workspace controls in header"
```

### Task 3: Style the compact, scrollable header workspace

**Files:**

- Modify: `src/index.css`
- Modify: `src/app/App.test.tsx`

**Interfaces:**

- Consumes: `.toolbar-workspace`, `.tab-bar`, `.tab-strip`, `.tab-bar-actions`, and `.split-toggle`.
- Produces: one responsive header whose center tab region can shrink and scroll horizontally while controls stay usable.

- [ ] **Step 1: Add a failing hierarchy assertion**

Add the following assertion to the header-composition test, anchoring the markup that owns the overflow rules.

```tsx
expect(header.querySelector('.toolbar-workspace > .tab-bar')).toBeInTheDocument();
```

- [ ] **Step 2: Run the focused assertion before CSS work**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL until Task 2’s markup exists. If Task 2 is already green, add the assertion first and confirm it targets the exact intended hierarchy before changing CSS.

- [ ] **Step 3: Replace the second-row tab styles**

Remove `.workspace-tabs` rules. Make `.toolbar-workspace` flexible with `min-width: 0`; remove the separate `TabBar` row background, border, and padding; retain `overflow-x: auto` and `min-width: 0` on `.tab-strip`. Keep the action group and Split selector non-shrinking, so tabs are the only horizontally scrolling content.

```css
.toolbar-workspace {
  display: flex;
  flex: 1 1 18rem;
  min-width: 0;
}

.toolbar-workspace .tab-bar {
  display: flex;
  flex: 1;
  min-width: 0;
  gap: 8px;
  padding: 0;
}

.toolbar-workspace .tab-strip {
  min-width: 0;
  overflow-x: auto;
}
```

At 960px, hide `.tab-bar-actions` but keep the tab strip scrollable. At 560px, preserve the existing larger tab touch targets and let the workspace take a flexible full row when needed to prevent overlap.

- [ ] **Step 4: Run tests and static checks**

Run: `npm test -- src/app/App.test.tsx src/components/TabBar.test.tsx`

Expected: PASS.

Run: `npm run typecheck:renderer && npm run lint && npm run format:check`

Expected: each command exits with code 0.

- [ ] **Step 5: Commit the layout**

```bash
git add src/index.css src/app/App.test.tsx
git commit -m "style: embed document tabs in header toolbar"
```

### Task 4: Verify browser and production behavior

**Files:**

- Modify: no production files unless verification reveals a regression.
- Test: `tests/e2e/reader.spec.ts`

**Interfaces:**

- Consumes: the complete header implementation.
- Produces: verification that meaningful supported-web offline statuses remain available and the production renderer builds.

- [ ] **Step 1: Run the complete unit suite**

Run: `npm test`

Expected: all Vitest suites pass.

- [ ] **Step 2: Build the renderer**

Run: `npm run build:web`

Expected: TypeScript compilation and Vite build exit with code 0.

- [ ] **Step 3: Run browser end-to-end coverage**

Run: `npm run test:e2e`

Expected: existing offline-status checks pass because supported-web status labels remain visible.

- [ ] **Step 4: Inspect desktop and narrow header states**

Use the local preview to open multiple documents. Confirm tabs are in the header, overflowing tabs scroll horizontally, Split uses the two-panel icon and shows a hover tooltip, every header action is icon-only with a tooltip, and Split controls disappear at the narrow breakpoint.

- [ ] **Step 5: Commit any required verification-only test change**

```bash
git add tests/e2e/reader.spec.ts
git commit -m "test: verify header workspace controls"
```

## Self-Review

- Spec coverage: Tasks 1–2 remove only desktop/web labels, retain meaningful offline labels, relocate tabs/Split controls, and make header buttons icon-only with native tooltip and accessibility metadata. Task 3 preserves horizontal scrolling and responsive behavior. Task 4 verifies browser/offline and production behavior.
- Placeholder scan: no unresolved tasks or undefined interfaces remain.
- Type consistency: `Toolbar.children` is the workspace slot, `useOffline().label` is `string | null`, and `TabBarProps` callback signatures remain unchanged.
