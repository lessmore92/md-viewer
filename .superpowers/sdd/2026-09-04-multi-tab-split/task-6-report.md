# Task 6 report — documentation and final verification

Status: DONE_WITH_CONCERNS

Worktree: `D:/md-viewer/.worktrees/multi-tab-split-view`

Branch: `codex/multi-tab-split-view`

Starting commit: `dec3286ddc42b2a32062d151f8577a717189fc2f`

Commit subject: `docs: document multi-tab split reading`

## Scope and documentation

Changed only:

- `README.md`
- `PRODUCT.md`
- `.superpowers/sdd/2026-09-04-multi-tab-split/task-6-report.md`

The Persian documentation now states that each new document opens in its own tab, reopening the same file activates the existing tab, Split shows two independent panes only above 960px, and 960px or narrower falls back to one pane. It also documents the default-on restore setting, its next-start behavior, same-device-only workspace persistence, and restored documents opening at the top because scroll positions are session-only. The obsolete “last document” and “single-document reader” wording was corrected.

No source, test, dependency, lockfile, configuration, plan, or specification file was edited. No package manager was run, no dependency was installed, and no `node_modules` junction was created.

## Verification commands and results

All commands ran from the worktree. The `node` executable resolved to the repository environment's bundled runtime at `C:/Users/HAMAHANG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe` (Node 24.19.0).

### Project quality-gate entry point

```powershell
npm run check
```

Exit 1 before running the script: `npm` is not recognized in this controller environment. The repository's `.superpowers/bin/npm.cmd` delegates to pnpm, so it was intentionally not used because this task prohibits pnpm. The script's stages were therefore run directly and independently below, allowing later stages to execute even when an earlier known failure occurred.

### Type checks

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json --preserveSymlinks
```

Exit 1 with the same 11 pre-existing renderer diagnostics recorded by Tasks 3–5:

```text
src/app/workspace.ts(36,18): TS2339 Property 'fileName' does not exist on type 'object'.
src/app/workspace.ts(38,18): TS2339 Property 'filePath' does not exist on type 'object'.
src/app/workspace.ts(40,18): TS2339 Property 'content' does not exist on type 'object'.
src/app/workspace.ts(42,18): TS2339 Property 'documentId' does not exist on type 'object'.
src/app/workspace.ts(76,18): TS2339 Property 'tabId' does not exist on type 'object'.
src/app/workspace.ts(78,30): TS2339 Property 'document' does not exist on type 'object'.
src/app/workspace.ts(84,18): TS2339 Property 'tabId' does not exist on type 'object'.
src/app/workspace.ts(85,21): TS2339 Property 'document' does not exist on type 'object'.
src/app/workspace.ts(86,36): TS2339 Property 'document' does not exist on type 'object'.
src/app/workspace.ts(106,59): TS2550 Property 'replaceAll' does not exist on type 'string' with the current library target.
src/app/workspace.ts(206,54): TS7006 Parameter 'tab' implicitly has an 'any' type.
```

`git diff --exit-code HEAD -- src/app/workspace.ts tsconfig.json` exited 0, confirming neither file changed in Task 6.

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.electron.json --preserveSymlinks
```

Exit 0; no diagnostics.

### Lint and formatting

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
node node_modules/eslint/bin/eslint.js .
```

Exit 0; no diagnostics.

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
node node_modules/prettier/bin/prettier.cjs --check .
```

The initial run exited 1 and listed 78 files, including the two edited documents. After formatting only `README.md` and `PRODUCT.md`, the final repository-wide run exited 1 and listed 76 pre-existing files. No file changed by this task appears in the final failure list.

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
node node_modules/prettier/bin/prettier.cjs --check README.md PRODUCT.md
```

Exit 0: `All matched files use Prettier code style!`

### Unit tests

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
node --input-type=module -e 'import { startVitest } from "vitest/node"; const ctx = await startVitest("test", [], { watch: false, reporters: ["default"] }, { resolve: { preserveSymlinks: true } }); if (!ctx) process.exitCode = 1; else await ctx.close();'
```

Exit 1: 21 files ran, 19 passed and 2 failed; 165 tests ran, 163 passed and 2 failed.

- `tests/electron/preload-build.test.ts` failed before its assertion because the test internally executes `npm run build:electron`, and npm is unavailable.
- `tests/electron/csp-build.test.ts` failed during its internal ordinary Vite build because `unist-util-visit` could not be resolved from the existing `D:/md-viewer/node_modules/.ignored/rehype-highlight` dependency path.

These are environment/dependency-entry-point failures. No executed assertion in the other 163 tests failed.

Focused multi-tab/Split regression command:

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
node --input-type=module -e 'import { startVitest } from "vitest/node"; const files = ["src/app/workspace.test.ts", "src/app/browserDocument.test.ts", "src/components/TabBar.test.tsx", "src/components/DocumentPane.test.tsx", "src/app/App.test.tsx"]; const ctx = await startVitest("test", files, { watch: false, reporters: ["default"] }, { resolve: { preserveSymlinks: true } }); if (!ctx) process.exitCode = 1; else await ctx.close();'
```

Exit 0: 5 files passed, 69 tests passed, 0 failed. This includes workspace persistence/migration, duplicate activation, tab controls, independent panes and scroll, Split behavior, narrow fallback, and restore-setting behavior.

### Electron and production builds

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
node node_modules/typescript/bin/tsc -p tsconfig.electron.json
```

Exit 0.

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
node node_modules/esbuild/bin/esbuild electron/preload.ts --bundle --platform=node --format=cjs --external:electron --outfile=dist-electron/preload.js
```

Exit 0: `dist-electron/preload.js 1.0kb`, completed in 4ms.

Because the scripted web build stops at the known renderer type-check failure, bundling was also run directly with the documented dependency-resolution workaround:

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
node --input-type=module -e 'import { build } from "vite"; await build({ resolve: { preserveSymlinks: true } });'
```

Exit 0: Vite 6.4.3 transformed 557 modules and built in 3.06s. Output included `59.36 kB` CSS and `708.41 kB` JavaScript. The existing warning that a minified chunk exceeds 500 kB remains; it is non-fatal.

### Browser E2E

First attempt, using Playwright-owned preview:

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
$env:NO_PROXY='localhost,127.0.0.1,::1'
node node_modules/@playwright/test/cli.js test tests/e2e/reader.spec.ts --reporter=list
```

All 7 cases printed `ok`, including the 3 multi-tab/Split cases, but Playwright again hung while tearing down its preview process. It was interrupted after two 30-second no-output polls and therefore exited 1. This reproduces the Task 5 controller teardown limitation, not a test assertion failure.

For a clean final result, the same built output was served by a separately started hidden Vite preview, and the identical Playwright command reused that server. The final Playwright run exited 0: 7 passed in 11.5s. The preview process was then stopped. Covered behavior includes wide two-pane Split, independent scrolling and selection, themes/focus/reduced motion, the exact 960px fallback and narrower widths, local/offline persistence, mobile reading, and subdirectory deployment.

## Concerns and classification

1. The full `npm run check` entry point cannot start because npm is unavailable; the prohibited pnpm fallback was not used.
2. Renderer type-check remains blocked by 11 pre-existing `workspace.ts` diagnostics. The relevant files are unchanged from the starting commit.
3. Repository-wide formatting remains blocked by 76 pre-existing files. Both Task 6 documents pass their scoped format check.
4. The full Vitest run has two environment/dependency-entry-point failures described above; the focused feature suite passes 69/69, direct Electron build passes, direct Vite production bundling passes, and final browser E2E passes 7/7.
5. Production bundling retains the existing non-fatal large-chunk warning.
6. Git in the sandbox requires a command-local `safe.directory` setting and reports that the user's global ignore file is inaccessible. No global Git setting was changed.

No Task 6 regression was found in the checks that could execute normally.
