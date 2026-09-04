# Task 5 report — responsive multi-tab and Split styling

Status: DONE_WITH_CONCERNS

Worktree: `D:/md-viewer/.worktrees/multi-tab-split-view`

Branch: `codex/multi-tab-split-view`

Starting commit: `fa45b86490212ef94e16e87a74222cb4895f63e1`

Commit subject: `feat: style responsive split document panes`

This report is included in the task commit. Its commit hash is available in the handoff and in `git log -1 --format=%H -- .superpowers/sdd/2026-09-04-multi-tab-split/task-5-report.md`.

## Scope and implementation

Read the task brief, full approved plan/spec, current App, TabBar, DocumentPane, reading controls/status, theme styles, browser tests, and tooling configuration before editing. Reused the existing isolated worktree. The starting tracked worktree was clean.

Only these three files are changed:

- `src/index.css`
- `tests/e2e/reader.spec.ts`
- `.superpowers/sdd/2026-09-04-multi-tab-split/task-5-report.md`

No React/TypeScript application files, dependencies, lockfiles, configuration, plan/spec, or unrelated work were modified. Build outputs and screenshots remain ignored. The report is explicitly staged despite the existing `.superpowers/` ignore rule.

The stylesheet adds a horizontally scrollable RTL tab strip with truncated filenames, selected-tab underline/surface, visible keyboard focus, close-button spacing, disabled and pressed Split states, and a bounded second-document selector. Existing theme tokens supply every color, including dark and ebook appearances.

Split panes retain equal grid columns and independent scroll regions with a logical one-pixel divider. Reading-status footers remain outside the scrollers. Compact document headings and bounded outlines above each document leave the reading columns usable even just above 960px; each outline remains navigable and independently scrollable. Split-only layout and spacing rules preserve the existing single-pane sheet, sidebar, typography, and mobile styles.

At `max-width: 960px`, CSS enforces a single column and hides Split controls/the secondary pane while the existing media listener clears Split state. Tabs remain scrollable at 390px and 320px. Long names and long code lines do not create page or pane horizontal overflow; code blocks keep their existing local scrolling. Focus mode presents only the primary pane at full width, with the existing focus padding and restored Split presentation on exit. New transitions precede and obey the unchanged global reduced-motion override.

## Browser coverage

Added three tests using the existing browser file-input / `setInputFiles` pattern, factored into a local helper for the new cases. Tests open actual Markdown payloads, with no injected workspace or synthetic DOM classes.

1. Wide Split: disabled single-tab Split control, two opened tabs, active/secondary document identity, RTL pane placement and mixed document directions, equal non-overlapping columns, visible divider, disabled primary-document option, bounded scroll regions, mouse-wheel scrolling isolated to one pane, pane-scoped outline navigation with duplicate heading IDs, visible progress footers, third-document selection, secondary close, and keyboard focus recovery.
2. Themes/focus/reduced motion: light, dark, and ebook tab chrome/divider match the current theme; two visible panes; no horizontal overflow; zero-duration tab transitions and automatic scroll behavior under reduced motion; one full-width active pane in focus; Escape restores focus and Split.
3. Responsive fallback: Split works at 961px, closes at exactly 960px, and stays unavailable at 768/390/320px; tabs remain available and scrollable; keyboard activation reveals either end of the mobile tab strip; widening does not reopen Split; a new narrow page restores a previously saved wide Split as a single pane.

The existing offline test now closes both documents explicitly. Task 4 changed the toolbar close action to close only the active tab, so the old assumption that one close clears all opened documents was obsolete. All original offline, typography, theme, focus, mobile, and subdirectory assertions are retained.

## Verification and exact results

All commands ran in the worktree using the installed bundled Node runtime. `npm` is unavailable on PATH, so the existing package tools were invoked directly. No tooling was installed.

### Test-first evidence

Built the pre-style source into `dist`, then ran the three new cases against that unchanged build before rebuilding with the stylesheet changes:

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
$env:NO_PROXY='localhost,127.0.0.1,::1'
node node_modules/@playwright/test/cli.js test tests/e2e/reader.spec.ts --grep 'multi-tab Split'
```

Exit 1: **3 failed**. Expected styling gaps were observed: divider width `0px` instead of `1px`, transparent tab-bar background instead of theme chrome, and tab-strip horizontal overflow `visible` instead of `auto`.

The first post-style full run reported six passing cases and one assertion failure: this installed Playwright build's `toBeDisabled()` treated an `<option disabled>` as enabled. The DOM snapshot confirmed the native disabled property. Updated that assertion to `toHaveJSProperty('disabled', true)`; the focused wide case then passed with exit 0, **1 passed (3.9s)**. No application change was needed.

### Final passing checks

```powershell
node node_modules/prettier/bin/prettier.cjs --check src/index.css tests/e2e/reader.spec.ts
```

Exit 0: `All matched files use Prettier code style!`

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
node node_modules/eslint/bin/eslint.js tests/e2e/reader.spec.ts
```

Exit 0, no diagnostics.

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
node --input-type=module -e 'import { build } from "vite"; await build({resolve:{preserveSymlinks:true}});'
```

Exit 0: Vite 6.4.3, **557 modules transformed**, built in **3.40s**. CSS: **59.36 kB** / **11.62 kB gzip**. JavaScript: **708.41 kB** / **220.48 kB gzip**. The existing large-chunk warning remains. This verifies bundling, not TypeScript correctness.

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
$env:NO_PROXY='localhost,127.0.0.1,::1'
node node_modules/@playwright/test/cli.js test tests/e2e/reader.spec.ts
```

Exit 0: **7 passed (11.9s)** using the repository's browser selection and one worker. This is the complete reader E2E file: all three new cases and all four existing cases. Includes real offline reloads and the `/reader/` deployment test. No tests were skipped or marked as expected failures.

`git diff --check` also passed. Scoped report formatting and staged diff checks are run before commit.

Visually inspected the generated Split screenshots in light/dark/ebook and the 390px tab screenshot. Confirmed readable pane columns, compact headings/outlines, divider visibility, theme consistency, filename truncation, focus ring visibility, and a mobile page without horizontal expansion. Screenshots are under `.superpowers/screenshots/task-5-*`; existing single-pane screenshot tests also pass.

### Environment and build limitations

- The ordinary Vite invocation failed loading PostCSS because the installed dependency junctions resolve into `D:/md-viewer/node_modules/.ignored`. Process-local `NODE_OPTIONS` and an in-memory Vite `resolve.preserveSymlinks` override made the build runnable. No persistent configuration was changed.
- Playwright with only `--preserve-symlinks` loaded duplicate test-runner instances and failed discovery. Adding `--preserve-symlinks-main` resolved it; all seven cases subsequently ran normally.
- The environment HTTP proxy intercepted Playwright's localhost readiness check and returned `EACCES`. The process-local `NO_PROXY` value above fixed localhost routing. An early full run completed its cases but stalled during owned-preview teardown; it was interrupted. The final full run reused that worktree's preview server and exited normally with the seven-pass result above. The earlier stalled runner was stopped after verification.
- Both the initial and final renderer typechecks reproduced the same **11 pre-existing errors in `src/app/workspace.ts`**, also documented by Task 4. Final command `node node_modules/typescript/bin/tsc --preserveSymlinks` exited **1**, so the `build:web` script's TypeScript gate cannot pass. Diagnostics: TS2339 at 36:18, 38:18, 40:18, 42:18, 76:18, 78:30, 84:18, 85:21, 86:36 (properties on `object`); TS2550 at 106:59 (`replaceAll` against the ES2020 library); TS7006 at 206:54 (implicit-any `tab`). Those files are outside Task 5's scope and were not edited.
- Full repository `npm run check` was not claimed or run; Task 5 used scoped formatting/lint, the renderer build gate, Vite bundling, and the complete reader E2E file. Repository-wide formatting and unrelated unit tests are reserved for Task 6.
- Git requires `-c safe.directory=D:/md-viewer/.worktrees/multi-tab-split-view` under this sandbox user. Global Git configuration was not modified. Git also emits LF/CRLF conversion notices and a warning about the user's inaccessible global ignore file.

## Remaining concerns / scope boundaries

1. **Markup mismatch:** the approved brief names `.split-layout`, but current App renders `.workspace-panes.is-split`. CSS supports both names; browser tests explicitly exercise the real current class. A literal `.split-layout` element cannot be supplied without editing the prohibited App file. No test injects or disguises this missing class.
2. **Pane close controls:** current DocumentPane does not render a dedicated pane-header close button (its `onClose` prop is not consumed). This task styles its existing filename heading and existing tab close controls. Adding pane-header controls requires a separate component change.
3. **Build gate:** the 11 existing workspace type errors remain the release-quality limitation despite successful bundling and browser checks.

Reviewed the final CSS and tests against the brief locally. No callable reviewer-subagent tool was available. The design guidance influenced the theme-token reuse, restrained active-tab treatment, compact outlined navigation, and spacing scoped to Split. The requested commit leaves the existing branch/worktree in place; no merge or push is performed.
