# Task 4 report

Status: DONE_WITH_CONCERNS

Implementation commit: `8c6c4ee0596ff2bb5bd47b04c873e51f46d06a53`

Commit subject: `feat: integrate multi-tab reading workspace`

Worktree: `D:/md-viewer/.worktrees/multi-tab-split-view`

Branch: `codex/multi-tab-split-view`

Starting commit: `c410fba0537f5885bf563f4df1d93d6a6134bdd1`

## Scope

Read the exact `task-4-brief.md` before inspecting or changing implementation files. Reused the existing isolated worktree and its installed dependency junctions. The implementation commit contains exactly:

- `src/app/App.tsx`
- `src/app/App.test.tsx`
- `src/components/ReadingToolbar.tsx`

No plan, ledger, dependency manifest, lockfile, test configuration, stylesheet, workspace helper, TabBar, DocumentPane, or Markdown component was edited. This report was written after the implementation commit so it can record the exact hash. It is a local deliverable in the already-ignored `.superpowers/` directory and is not part of the implementation commit.

## Implemented behavior

### Workspace ownership and opening documents

App now owns `WorkspaceState`, deriving the primary and secondary tabs from `activeTabId` and `splitTabId`. Initialization checks local storage availability, calls `readWorkspace()` in browser and Electron contexts, respects `restoreTabs`, and clears restored Split when starting at a narrow viewport. If storage is unavailable, initialization returns an empty workspace without throwing.

All successful Electron dialog results, OS-open events, browser uploads, drops, and sample opens pass through `openInWorkspace`. The existing helper supplies document identity, duplicate reuse, payload refresh, activation, and Split normalization. There is no second duplicate-detection implementation in App.

Opening another dialog no longer discards a successful earlier operation. Pending operations have individual IDs in a set; successful results are accepted while their IDs remain pending. The last success becomes active, including when requests resolve out of order, while both documents remain available as tabs. Request ordering still suppresses obsolete errors. Cancellation keeps the current workspace intact, loading reflects the remaining pending operations, and unmount clears pending IDs and unsubscribes from OS-open events. Closing the active tab also invalidates pending operations, preserving the explicit-close cancellation behavior. Closing an inactive tab does not discard pending successful operations.

### Activation and closing

TabBar activation and close callbacks use the existing immutable `activateTab` and `closeTab` helpers. Active close selects the helper's nearest remaining tab; inactive close preserves the active selection. Closing a Split document, or activating it as the primary document, clears Split through the helper's normalization. Closing the final tab returns to the Persian welcome state and persists an empty tab list.

The existing browser toolbar close action now closes only the active tab. Its existing accessible label is retained. Drawer and focus state are reset on close as before.

### Split, panes, and reader behavior

App renders the existing DocumentPane twice for a valid wide-screen Split, in equal grid columns. Each pane has a flex-column container with a bounded scroll region and its own reading-status footer. A single pane retains the same reader content and behavior. There remains exactly one main landmark.

Split chooses the first non-active tab initially, supports changing the secondary tab through the existing selector, and can be toggled off without closing documents. The existing media listener clears Split and closes the drawer on narrow resize. Widening again does not reactivate Split. Narrow startup also normalizes a persisted Split to one pane while retaining all tabs.

TabBar has no disabled-Split prop and is outside Task 4's edit list. App therefore uses its existing action-hiding behavior when there is only one tab, and renders a native disabled Split button next to it. Close and activation buttons remain enabled. At narrow widths, Split controls are hidden. At zero tabs, there is no tab bar or Split control.

Each pane reports its scroll position into the matching workspace tab. Positions survive tab switches and closing/reopening the second pane within the session. Existing DocumentPane restoration avoids scroll feedback churn. Stable navigation/drawer callbacks preserve MarkdownView's heading-node and observer behavior. Outline navigation in the second pane stays scoped to that pane even when both documents have the same heading IDs.

Existing reading preferences, theme and ebook switching, focus/Escape behavior, outline visibility, narrow drawer behavior, reduced-motion navigation, empty documents, error recovery, sample content, file-input keyboard shortcut, browser-local file reading, and offline status/install wiring are retained.

### Restore preference and persistence

ReadingToolbar exports `ReadingToolbarProps` with `restoreTabs` and `onRestoreTabsChange`. It renders the native labeled checkbox `بازگردانی تب‌ها هنگام شروع`. The control supports keyboard toggling, uses existing toolbar/select theme classes, and permits wrapping alongside the other reading controls. Like the existing reading controls, it is hidden in focus mode and restored on exit.

Disabling restoration updates the saved preference without closing the current workspace. The next mount starts empty. Re-enabling restoration allows the then-current workspace to reopen on the next mount. App explicitly applies this policy because `readWorkspace()` returns stored data plus the preference rather than enforcing the startup policy itself.

An effect saves workspace and restore preference after initial normalization, open/duplicate refresh, activation, close, Split changes, and restore-setting changes. Both boolean save results contribute to `storageError`. No state rollback or in-memory data clearing occurs when a write fails. A later meaningful change retries both writes, allowing the notice to clear after recovery.

Scroll-only changes do not rewrite all document contents to storage. The effect compares tab identity/document references and persisted workspace fields before writing. Scroll positions remain session-only, consistent with the existing workspace storage helper.

App displays one Persian workspace-level storage notice referring to tabs and restore settings. It replaces the single-document storage notice at the App integration level without modifying DocumentPane. The existing offline labels are retained.

## Test-first evidence and baseline investigation

Used the test-driven-development and React testing workflows: changed App tests before editing either production file, ran them to failure, then implemented the integration. Tests exercise real App, TabBar, DocumentPane, workspace helpers, storage, and Markdown rendering. Electron dialogs/events and missing browser APIs use the existing test doubles.

The ordinary bundled Node/Vitest command initially failed before executing tests:

```text
Error: Cannot find package 'vitest' imported from D:\md-viewer\node_modules\.ignored\@testing-library\jest-dom\dist\vitest.mjs
Test Files  2 failed (2)
Tests       no tests
```

npm was unavailable on PATH. Inspection showed the worktree's dependency folders are junctions into `D:/md-viewer/node_modules/.ignored`. Node's `--preserve-symlinks` alone did not fix Vite's resolution. Using the installed Vitest API with an in-memory `resolve.preserveSymlinks` override, plus Node's preserve-symlinks option, ran the tests successfully. No files, dependencies, or persistent environment settings were changed for this workaround.

The runnable pre-change baseline had 25 passing and 3 failing tests across App and DocumentPane. All three failures came from old App tests targeting the main landmark for drop/scroll behavior after Task 3 moved that behavior into the named DocumentPane section. Updated those targets to `region` named `محتوای سند`, retaining the original behavioral assertions. Updated the pending-frame test to target the same real scroll region as well.

The deliberate RED run then reported:

```text
Test Files  1 failed (1)
Tests       11 failed | 20 passed (31)
Start at    18:21:29
Duration    8.17s
```

The failures were for absent tabs/Split/restore controls, absent Electron workspace restoration, discarded earlier successful opens, and missing workspace storage feedback. The test changes also update the old single-document race expectation to require both successful results, and update the reading-preference remount test to expect the sample document to be restored.

The brief's sample uses `user.selectOptions(select, { label: 'Second.md' })`, which is not supported by the installed Testing Library user-event API. After the first implementation run reached that step, corrected the two tests to pass the accessible option element instead. This was a test API correction; application behavior was not changed to accommodate it.

## Final focused verification

Run from the isolated worktree after all implementation edits:

```powershell
$env:NODE_OPTIONS='--preserve-symlinks'
& 'C:/Users/HAMAHANG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' --input-type=module -e 'import { startVitest } from "vitest/node"; const ctx = await startVitest("test", ["src/app/App.test.tsx", "src/components/DocumentPane.test.tsx"], { watch: false, reporters: ["default"] }, { resolve: { preserveSymlinks: true } }); if (!ctx) process.exitCode = 1; else await ctx.close();'
```

Exit code: 0.

```text
RUN  v3.2.7 D:/md-viewer/.worktrees/multi-tab-split-view

✓ src/components/DocumentPane.test.tsx (6 tests) 667ms
✓ src/app/App.test.tsx (31 tests) 8272ms

Test Files  2 passed (2)
Tests       37 passed (37)
Start at    18:27:01
Duration    10.70s (transform 290ms, setup 183ms, collect 2.23s, tests 8.94s, environment 1.12s, prepare 212ms)
```

App's nine added integration tests cover duplicate payload refresh, single-tab Split disabling, close/fallback/empty state, changing and clearing Split, persistence and narrow transitions, keyboard restore toggling and remount policy, upload/drop deduplication and browser tab close, OS/dialog concurrency and late results after unmount, independent scroll/navigation, and storage failure/recovery. The modified existing race test adds out-of-order success coverage. All 22 pre-existing App tests remain present, with the explicitly described behavior/target adaptations; all six existing DocumentPane tests pass unchanged.

The RED command used the same runtime options and Vitest API invocation, with only `src/app/App.test.tsx` as its filter and the `dot` reporter.

## Other verification and review

With the same Node executable and `NODE_OPTIONS`, ran:

```powershell
node_modules/eslint/bin/eslint.js src/app/App.tsx src/app/App.test.tsx src/components/ReadingToolbar.tsx
node_modules/prettier/bin/prettier.cjs --check src/app/App.tsx src/app/App.test.tsx src/components/ReadingToolbar.tsx
```

Both were invoked through the bundled Node executable. ESLint completed without errors or warnings on the final tree. Prettier exited 0 with `All matched files use Prettier code style!`. A redundant request-counter increment in effect cleanup was removed during review; pending-set cleanup already provides the unmount guard and the final focused run verifies it.

Both working and staged `git diff --check` passed. Reviewed the complete App integration and staged file list before committing. Verified the resulting commit lists exactly the three permitted files and that tracked working-tree status is clean. Git emitted benign LF-to-CRLF notices and a sandbox warning reading the user's global ignore file; staging and commit succeeded under the authorized Git escalation.

No callable reviewer-subagent tool was available; performed the brief-to-diff review locally. Confirmed state transitions reuse the existing helpers, navigation callbacks remain stable, failed persistence retains tabs, per-pane scrolling stays scoped, and no out-of-scope source files entered the commit.

## Concerns and limits

1. Renderer type-check is still blocked by the same 11 pre-existing diagnostics in `src/app/workspace.ts`. With the dependency-resolution workaround, there are no diagnostics in Task 4 files. The exact command was the bundled Node executable followed by `node_modules/typescript/bin/tsc --noEmit -p tsconfig.json --preserveSymlinks` (exit 1):

   ```text
   workspace.ts(36,18): TS2339 fileName does not exist on type object
   workspace.ts(38,18): TS2339 filePath does not exist on type object
   workspace.ts(40,18): TS2339 content does not exist on type object
   workspace.ts(42,18): TS2339 documentId does not exist on type object
   workspace.ts(76,18): TS2339 tabId does not exist on type object
   workspace.ts(78,30): TS2339 document does not exist on type object
   workspace.ts(84,18): TS2339 tabId does not exist on type object
   workspace.ts(85,21): TS2339 document does not exist on type object
   workspace.ts(86,36): TS2339 document does not exist on type object
   workspace.ts(106,59): TS2550 replaceAll requires an ES2021-or-later library
   workspace.ts(206,54): TS7006 parameter tab implicitly has an any type
   ```

   Verified `workspace.ts` and `tsconfig.json` are unchanged from the starting commit. A plain type-check without preserve-symlinks additionally reports dependency/type-resolution fallout across existing test and Markdown files, so it is not a clean way to assess this junction-based installation.

2. The ordinary npm/Vitest entry point remains affected by the existing dependency junction issue. The reproducible in-memory workaround above was used for every executed assertion run; it does not repair the installation or change project configuration.

3. Verification is automated under jsdom. No real-browser visual review, desktop packaging, production build, or full end-to-end suite was run. The pane grid and toolbar wrapping are implemented in the permitted TSX files; stylesheet-level tab-bar polish and visual behavior across themes remain unverified. No claim of a passing production build is made.

4. The one-tab disabled Split button is composed by App because changing TabBar's interface was outside the exact file scope. A future TabBar interface revision could accept a disabled flag to simplify that composition. Current behavior is covered by the App tests.

5. The report is intentionally left as the requested local file under the ignored coordination directory. The implementation commit is limited to the three files specified by the brief; no plan or ledger was edited.

## Review fix — concurrent open error isolation

The Task 4 review identified a blocking race in `App.tsx`: `acceptDocument()` incremented `latestRequest.current`. If dialog A succeeded before newer dialog B failed, A's success changed the counter and B's error guard incorrectly treated the failure as stale. The consequence was a missing user-visible error while A remained open successfully.

Added the focused regression test `reports a newer dialog failure after an older dialog succeeds`. It starts two deferred Electron dialog operations, resolves the older operation successfully, rejects the newer operation, and requires both the First document and the Persian recovery alert. On the pre-fix implementation the test failed because no `role="alert"` was rendered. This establishes the required red-green evidence.

The fix keeps request IDs advancing when a dialog starts and when an explicit close/unmount invalidates pending work, but successful dialog results no longer advance the newest-request marker. Therefore an older success can still open or activate a deduplicated tab without suppressing a newer pending failure. A newer success still makes older failures stale because the newer request ID remains the current one. An OS-open event continues to cancel all pending dialog operations before accepting its document, preserving the existing test and UI rule that an OS-opened document is not replaced by an older dialog result or error. The `pendingRequests` set remains the per-operation cancellation guard.

The final focused command was rerun after the correction to the OS-open test expectation:

```powershell
$env:NODE_OPTIONS='--preserve-symlinks'
& 'C:/Users/HAMAHANG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' --input-type=module -e 'import { startVitest } from "vitest/node"; const ctx = await startVitest("test", ["src/app/App.test.tsx", "src/components/DocumentPane.test.tsx"], { watch: false, reporters: ["default"] }, { resolve: { preserveSymlinks: true } }); if (!ctx) process.exitCode = 1; else await ctx.close();'
```

Exit code: 0. Final output:

```text
✓ src/components/DocumentPane.test.tsx (6 tests) 738ms
✓ src/app/App.test.tsx (32 tests) 7227ms

Test Files  2 passed (2)
Tests       38 passed (38)
Start at    18:39:20
Duration    9.30s
```

Prettier check passed for `src/app/App.tsx` and `src/app/App.test.tsx`, and `git diff --check` passed. The first post-fix ESLint attempt was not usable because the junction based environment could not resolve the existing `typescript` package from the ESLint parser; this is the same dependency installation limitation documented above, rather than a source lint diagnostic. No unrelated type errors were changed.

The fix commit is the follow-up commit that contains this report append; its exact hash is reported with the handoff.
