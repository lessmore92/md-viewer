# CI Test Stability Design

## Goal

Make the existing `npm run check` command reliable in GitHub Actions without changing product behavior, test assertions, or the five-second timeout that identifies genuinely slow tests.

## Evidence

The `v1.2.1` release workflow reached `npm run check` and passed renderer type checking, Electron type checking, and linting. It first failed on an unformatted documentation file; that formatting issue has been corrected locally.

When the full Vitest suite was run locally, two otherwise-valid tests exceeded the default five-second timeout while other resource-intensive files were running concurrently:

- `tests/web/offline-build.test.ts` builds production fixtures repeatedly.
- `src/app/App.test.tsx` performs many user-level interactions.

Each file passes independently within the existing timeout. The failure is therefore contention between parallel test files, not a product regression or a timeout that is too short for either test.

## Design

Set Vitest's `fileParallelism` option to `false` in `vitest.config.mts`.

This keeps the existing test environment, test timeout, assertions, and `npm test` command intact while running test files one at a time. It removes resource contention in local and GitHub Actions runs, preserving the five-second timeout as a meaningful guard for individual tests.

## Verification

1. Run the full Vitest suite and confirm every test passes.
2. Run renderer and Electron type checks, linting, Prettier, and a production web build.
3. Commit the focused configuration change and documentation-format correction.
4. Push `main`, move the existing `v1.2.1` tag to that commit, and verify the new Release workflow run succeeds.

## Scope

No production source, dependencies, workflow permissions, release version, test assertions, or timeouts will change.
