# Task 7 report — Renderer type-check cleanup

## Status

Complete. The renderer workspace module now type-checks under the existing ES2020 target without changing workspace runtime behavior.

## Changes

- Changed the existing `hasOwn` helper to return a `Record<string, unknown>` type predicate while retaining its existing runtime check.
- Typed the result of `JSON.parse` as `unknown`, so persisted workspace fields are accessed only after the existing guards narrow them.
- Replaced `String.prototype.replaceAll` with the ES2020-compatible global regular-expression replacement for backslash normalization.
- Added no test: the existing malformed-workspace and Windows-path tests already cover the affected runtime behavior, while the renderer compiler is the regression gate for the type-only defect.

Only `src/app/workspace.ts` and this report were changed. No dependencies, generated output, configuration, plan, or unrelated files were modified.

## Test-first evidence

Before the source edit, the renderer typecheck exited 1 with the 11 expected diagnostics in `src/app/workspace.ts`: nine TS2339 unsafe-property-access errors, one TS2550 `replaceAll`/ES2020 error, and the resulting TS7006 implicit-`any` error. The focused runtime baseline passed all 69 tests.

After the minimal source edit, the same renderer typecheck exited 0 with no diagnostics, and the same focused suite passed all 69 tests.

## Verification

All commands ran from `D:/md-viewer/.worktrees/multi-tab-split-view` with the bundled Node executable at `C:/Users/HAMAHANG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe` (Node 24.19.0). No package manager or junction-creation command was run. The worktree's pre-existing dependency junctions require preserve-symlink options for reliable package/type resolution; no filesystem links were added or changed by Task 7.

### Renderer TypeScript

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json --preserveSymlinks
```

Exit 0; no diagnostics.

### Focused workspace/browser/App/TabBar/DocumentPane tests

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
node --input-type=module -e 'import { startVitest } from "vitest/node"; const files = ["src/app/workspace.test.ts", "src/app/browserDocument.test.ts", "src/app/App.test.tsx", "src/components/TabBar.test.tsx", "src/components/DocumentPane.test.tsx"]; const ctx = await startVitest("test", files, { watch: false, reporters: ["default"] }, { resolve: { preserveSymlinks: true } }); if (!ctx) process.exitCode = 1; else await ctx.close();'
```

Exit 0: 5 test files passed, 69 tests passed, 0 failed.

### Changed-file lint and format

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
node node_modules/eslint/bin/eslint.js src/app/workspace.ts
```

Exit 0; no errors or warnings.

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
node node_modules/prettier/bin/prettier.cjs --check src/app/workspace.ts .superpowers/sdd/2026-09-04-multi-tab-split/task-7-report.md
```

Exit 0: `All matched files use Prettier code style!`

```powershell
git diff --check
```

Exit 0; no whitespace errors.

## Concerns

- A plain compiler invocation without TypeScript's `--preserveSymlinks` also reports unrelated dependency/type-resolution fallout caused by the worktree's pre-existing junction-based installation. The preserved-symlink renderer invocation is the established clean project check and now passes with no source diagnostics.
- No runtime semantics were intentionally changed. The helper still uses the same object/null/`in` checks, and `/\\/g` replaces exactly the same backslash characters as the former `replaceAll('\\', '/')` call.
