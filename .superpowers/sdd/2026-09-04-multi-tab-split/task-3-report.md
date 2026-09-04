# Task 3 report

Status: DONE_WITH_CONCERNS

Implementation commit: `5de6f88f1d0fd0b1f3fc4618c3cb4e41d3902c02` — `refactor: extract independent document pane`.

Worktree: `D:/md-viewer/.worktrees/multi-tab-split-view`
Branch: `codex/multi-tab-split-view`
Baseline: `ba65bc8030a097763ab98898a1f2b789850bcf83`.

## Files changed

- `src/components/DocumentPane.tsx` — new independent document rendering component.
- `src/components/DocumentPane.test.tsx` — four pane integration tests.
- `src/app/App.tsx` — single-document adapter and required extraction changes.
- `.superpowers/sdd/2026-09-04-multi-tab-split/task-3-report.md` — this report, committed separately after the implementation so it can record the exact implementation hash.

No plan, ledger, dependencies, styles, workspace implementation, shared Markdown components, or existing tests were changed.

## Summary

Moved heading extraction, word counting, direction detection, Markdown rendering, active-heading tracking, scoped navigation, scroll element ownership, reading status, loading/error/empty states, drag/drop target behavior, desktop outline, and mobile drawer rendering into DocumentPane. Both outline clicks and Markdown fragment links call scrollToHeading with the pane's own element, then notify onNavigate with the heading ID and pane ID.

The pane reports scrolling through onScrollTop and restores the tab's in-memory position in requestAnimationFrame when the tab, document, or saved position changes. Effect cleanup cancels pending restoration. Workspace persistence remains untouched; its existing restoration tests confirm stored tabs reopen at scrollTop 0.

App still owns one DocumentPayload and its existing file-opening, browser storage, theme, reading preferences, focus, offline, and toolbar behavior. A memoized WorkspaceTab-shaped adapter passes that document and its current scroll position to the pane; no workspace reducer, tab bar, or split layout was integrated.

The exact requested DocumentPaneProps and PaneId types are exported. To move the welcome state and drawer without changing the existing App behavior, the implementation additionally accepts a null-tab branch and optional App adapter properties for opening files/sample, accepting drops, reporting whether headings exist, outline IDs, drawer controls, storage notices, and offline text. These are additive; the brief's minimal render call works unchanged. The onClose contract is retained for later integration; the existing close action remains in App's toolbar, with no new pane-close UI introduced.

## Test-first evidence

Created DocumentPane.test.tsx before creating the production component or editing App. Tests cover rendering/direction, duplicate heading IDs across simultaneous panes, outline and Markdown fragment navigation, scroll restoration across tab switches, scroll notifications, loading/error preservation, and empty content.

npm was unavailable on PATH. The worktree has no node_modules of its own, so the initial attempt to use its local Vitest entry point failed with MODULE_NOT_FOUND. Used the bundled Node executable and the already-installed dependencies at D:/md-viewer/node_modules; no installation was performed.

All commands below were run in the worktree directory.

Exact RED command:

```powershell
& 'C:/Users/HAMAHANG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' D:/md-viewer/node_modules/vitest/vitest.mjs run src/components/DocumentPane.test.tsx
```

Exit code: 1. Relevant output:

```text
 RUN  v3.2.7 D:/md-viewer/.worktrees/multi-tab-split-view

 FAIL  src/components/DocumentPane.test.tsx [ src/components/DocumentPane.test.tsx ]
Error: Failed to resolve import "./DocumentPane" from "src/components/DocumentPane.test.tsx". Does the file exist?
  Plugin: vite:import-analysis
  File: D:/md-viewer/.worktrees/multi-tab-split-view/src/components/DocumentPane.test.tsx:6:29

 Test Files  1 failed (1)
      Tests  no tests
   Start at  14:06:16
   Duration  1.14s (transform 24ms, setup 93ms, collect 0ms, tests 0ms, environment 439ms, prepare 86ms)
```

This is the expected missing-component failure specified by the brief.

## Final test command and complete output

Includes all three suites required by the brief, plus unchanged App and workspace regression suites.

```powershell
& 'C:/Users/HAMAHANG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' D:/md-viewer/node_modules/vitest/vitest.mjs run src/components/DocumentPane.test.tsx src/markdown/MarkdownView.test.tsx src/components/TableOfContents.test.tsx src/app/App.test.tsx src/app/workspace.test.ts
```

Exit code: 0.

```text
RUN  v3.2.7 D:/md-viewer/.worktrees/multi-tab-split-view

 ✓ src/app/workspace.test.ts (15 tests) 14ms
 ✓ src/components/TableOfContents.test.tsx (3 tests) 152ms
 ✓ src/components/DocumentPane.test.tsx (4 tests) 607ms
 ✓ src/markdown/MarkdownView.test.tsx (16 tests) 2504ms
   ✓ MarkdownView > resets visible code-copy confirmation after two seconds  2051ms
 ✓ src/app/App.test.tsx (22 tests) 5258ms
   ✓ persists reading size, enforces bounds and resets preferences  1910ms
   ✓ preserves the document and reading settings while switching into ebook mode and back  529ms

 Test Files  5 passed (5)
      Tests  60 passed (60)
   Start at  14:10:06
   Duration  7.53s (transform 485ms, setup 524ms, collect 2.71s, tests 8.53s, environment 3.37s, prepare 1.31s)
```

## Other verification

Exact lint command:

```powershell
& 'C:/Users/HAMAHANG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' D:/md-viewer/node_modules/eslint/bin/eslint.js src/components/DocumentPane.tsx src/components/DocumentPane.test.tsx src/app/App.tsx
```

Exit code: 0; no output.

Exact formatting command:

```powershell
& 'C:/Users/HAMAHANG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' D:/md-viewer/node_modules/prettier/bin/prettier.cjs --check src/components/DocumentPane.tsx src/components/DocumentPane.test.tsx src/app/App.tsx
```

Exit code: 0.

```text
Checking formatting...
All matched files use Prettier code style!
```

`git -c safe.directory=D:/md-viewer/.worktrees/multi-tab-split-view diff --check` exited 0. Git emitted only its LF-to-CRLF normalization warning for App.tsx.

Exact renderer type-check command:

```powershell
& 'C:/Users/HAMAHANG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' D:/md-viewer/node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
```

Exit code: 1.

```text
src/app/workspace.ts(36,18): error TS2339: Property 'fileName' does not exist on type 'object'.
src/app/workspace.ts(38,18): error TS2339: Property 'filePath' does not exist on type 'object'.
src/app/workspace.ts(40,18): error TS2339: Property 'content' does not exist on type 'object'.
src/app/workspace.ts(42,18): error TS2339: Property 'documentId' does not exist on type 'object'.
src/app/workspace.ts(76,18): error TS2339: Property 'tabId' does not exist on type 'object'.
src/app/workspace.ts(78,30): error TS2339: Property 'document' does not exist on type 'object'.
src/app/workspace.ts(84,18): error TS2339: Property 'tabId' does not exist on type 'object'.
src/app/workspace.ts(85,21): error TS2339: Property 'document' does not exist on type 'object'.
src/app/workspace.ts(86,36): error TS2339: Property 'document' does not exist on type 'object'.
src/app/workspace.ts(106,59): error TS2550: Property 'replaceAll' does not exist on type 'string'. Do you need to change your target library? Try changing the 'lib' compiler option to 'es2021' or later.
src/app/workspace.ts(206,54): error TS7006: Parameter 'tab' implicitly has an 'any' type.
```

Confirmed `git diff --exit-code HEAD -- src/app/workspace.ts tsconfig.json` had no diff and exited 0 against the pre-Task-3 baseline. These diagnostics are in existing code outside the permitted extraction scope; no diagnostics named the Task 3 files.

## Self-review

- Compared the extracted markup and handlers with the original App: classes, Persian copy, toolbar-to-outline IDs, file-drop handling, welcome actions, error recovery, focus behavior, and footer placement are preserved.
- Reused MarkdownView, TableOfContents, useActiveHeading, scrollToHeading, detectDirection, ReadingStatus, and SidebarDrawer without modifying their implementations.
- Verified navigation cannot fall back to global document lookup from the pane.
- The unchanged App tests initially found two regressions caused by newly allocated navigation/drawer callbacks. MarkdownView recreates heading component types when its navigation callback changes, leaving observed heading nodes stale. A stable App closeDrawer callback restored the original callback stability; both failing tests and all other App tests then passed.
- Verified pending animation-frame cleanup through the existing App unmount test and per-tab restoration through the new pane test.
- Existing App tests cover browser loading/restoration/close, invalid drops, cancellation and stale requests, preferences/themes/focus, desktop outline toggling, narrow drawer navigation and resize, active heading geometry, and reduced motion.
- Kept the patch within the three implementation/test files specified by the brief. No Task 4 integration.
- Implementation commit was followed by a clean git status before writing this report.

## Concerns and handoff notes

1. Renderer type-check remains blocked by the 11 existing workspace.ts diagnostics listed above. Task 3 focused tests, App regression tests, lint, and formatting pass.
2. Additional optional App adapter properties and the null-tab branch are necessary to preserve and extract the existing single-document welcome, file-drop, and drawer behavior; the exported required pane interface matches the brief.
3. Task 4 should provide stable navigation/drawer callbacks, as App now does, because MarkdownView's memoized heading components depend on navigation callback identity. It must wire onScrollTop into per-tab in-memory state and connect the existing close contract when adding workspace controls.
4. Verification was automated under jsdom; no desktop packaging, full end-to-end browser run, or visual split-layout validation was performed. Split layout belongs to Task 4.

## Task 3 fix finalization — 2026-09-04

Status: DONE_WITH_CONCERNS.

Fix commit: `94bd32f4a885583e7326883ace9b7c48edfe8219` — `fix: keep one main landmark and avoid scroll restoration churn`.

Inspected and committed the existing changes in App.tsx, DocumentPane.tsx, and DocumentPane.test.tsx without implementation edits. App owns the single main landmark; panes use named sections. Scroll feedback matching the same tab, document, and position skips restoration; external positions and document changes retain restoration and frame cleanup. Regression tests cover these behaviors. No plan or ledger was edited.

Focused verification, run from `D:/md-viewer/.worktrees/multi-tab-split-view`:

```powershell
& 'C:/Users/HAMAHANG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' ./node_modules/vitest/vitest.mjs run src/components/DocumentPane.test.tsx src/app/App.test.tsx
```

Exit code: 1. Vitest 3.2.7 reported 2 failed suites and no tests executed (duration 766ms). Both suites failed during setup:

```text
Error: Cannot find package 'vitest' imported from D:\md-viewer\node_modules\.ignored\@testing-library\jest-dom\dist\vitest.mjs
```

An initial attempt with the same arguments and `D:/md-viewer/node_modules/vitest/vitest.mjs` as the runner exited 1 with MODULE_NOT_FOUND because that runner path no longer exists. The worktree-local runner above was available. No dependencies were installed or changed.

`git -c safe.directory=D:/md-viewer/.worktrees/multi-tab-split-view diff --check` exited 0 before committing, with only LF-to-CRLF warnings. The worktree was clean after the fix commit, before this report append.

Concerns: Focused tests remain unverified due to dependency resolution failure, not an executed assertion failure. Broader tests, lint, build, and type-check were not run in this finalization; earlier results above are historical.
