# CI Test Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `npm run check` reliable in GitHub Actions while retaining the existing per-test timeout and test behavior.

**Architecture:** Vitest currently permits test files to contend for build and JSDOM resources. Disable file-level parallelism in the existing Vitest configuration so each file retains the current five-second timeout but starts only after the previous file has completed. No application source, workflow, or test assertion changes are required.

**Tech Stack:** Vitest 3, Vite, TypeScript, GitHub Actions.

## Global Constraints

- Keep the existing five-second timeout; do not hide individual slow tests by increasing it.
- Keep the current `npm test` and `npm run check` command interfaces.
- Do not change product source, dependencies, release version, workflow permissions, or test assertions.
- Retain the existing `v1.2.1` version and repoint its tag only after every check passes.

---

### Task 1: Serialize Vitest Test Files

**Files:**

- Modify: `vitest.config.mts:7-12`
- Verify: `tests/web/offline-build.test.ts`
- Verify: `src/app/App.test.tsx`

**Interfaces:**

- Consumes: Vitest's `test` configuration object in `vitest.config.mts`.
- Produces: A test runner configuration that executes test files one at a time while retaining default test timeouts.

- [ ] **Step 1: Reproduce the contention diagnosis with focused tests**

Run:

```powershell
node node_modules/vitest/vitest.mjs run tests/web/offline-build.test.ts --reporter=verbose
node node_modules/vitest/vitest.mjs run src/app/App.test.tsx --reporter=verbose
```

Expected: Both files pass alone within the default five-second timeout, confirming the problem is file-level contention rather than an invalid assertion.

- [ ] **Step 2: Add the minimal configuration setting**

In the existing `test` object in `vitest.config.mts`, add:

```ts
fileParallelism: false,
```

Do not add a custom timeout, workers count, retry policy, or additional test configuration.

- [ ] **Step 3: Verify the full suite is stable**

Run:

```powershell
node node_modules/vitest/vitest.mjs run --reporter=verbose
```

Expected: All 24 test files and 200 tests pass with no timeout failures.

- [ ] **Step 4: Verify the release quality gate**

Run renderer and Electron type checks, ESLint, `prettier --check .`, and `vite build` using the installed local executables.

Expected: Each command exits successfully. Record the existing Vite chunk-size warning as non-blocking if it appears.

- [ ] **Step 5: Commit the focused fix**

```powershell
git add vitest.config.mts docs/superpowers/plans/2026-09-10-readme-refresh.md
git commit -m "test: serialize resource-intensive Vitest files"
```

### Task 2: Re-run the v1.2.1 Release

**Files:**

- Modify: Git history and tag reference only.
- Verify: `.github/workflows/release.yml`

**Interfaces:**

- Consumes: The pushed `main` commit and annotated `v1.2.1` tag.
- Produces: A tag-triggered GitHub Actions run and GitHub Release with Windows installer artifacts.

- [ ] **Step 1: Confirm the release workflow trigger and current tag target**

Run:

```powershell
git show v1.2.1:.github/workflows/release.yml
git rev-list -n 1 v1.2.1
```

Expected: The workflow triggers on `v*` tags and the existing tag points to the failed release commit.

- [ ] **Step 2: Push the verified main branch**

Run:

```powershell
git push origin main
```

Expected: GitHub receives the quality-gate fix before the tag is moved.

- [ ] **Step 3: Move the existing annotated release tag to the verified commit**

Run:

```powershell
git tag -fa v1.2.1 -m "MD Viewer v1.2.1"
git push --force origin v1.2.1
```

Expected: GitHub starts a new Release workflow for the corrected `v1.2.1` tag.

- [ ] **Step 4: Verify workflow and release completion**

Run:

```powershell
gh run list --repo lessmore92/md-viewer --workflow Release --limit 2
gh release view v1.2.1 --repo lessmore92/md-viewer
```

Expected: The newest Release workflow completes successfully and the release contains `.exe` and `.blockmap` assets.
