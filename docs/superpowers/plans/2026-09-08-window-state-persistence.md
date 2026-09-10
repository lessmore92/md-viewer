# Window State Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the Electron window's last usable size, position, and maximized state across application launches without restoring fullscreen.

**Architecture:** Add a dependency-free Electron-side module that synchronously loads and saves a small JSON state file, validates its values, and rejects bounds that do not intersect any current display work area. Keep Electron lifecycle wiring in `electron/main.ts`: create the window from the loaded normal bounds, maximize it after creation when requested, and save `getNormalBounds()` plus `isMaximized()` on close.

**Tech Stack:** TypeScript, Electron 44, Node.js filesystem APIs, Vitest 3.

## Global Constraints

- Fullscreen state must never be persisted or restored.
- Minimized state must never be persisted or restored.
- Default window size remains exactly 1200 by 800 pixels.
- Minimum accepted and configured window size remains exactly 600 by 400 pixels.
- State remains local in Electron's per-user application-data directory.
- No runtime dependency is added.
- Missing, unreadable, malformed, incomplete, non-finite, undersized, or off-screen state falls back safely.
- A state-write failure must not prevent the application from closing.

---

### Task 1: Window-state persistence module

**Files:**

- Create: `electron/window-state.ts`
- Create: `tests/electron/window-state.test.ts`

**Interfaces:**

- Consumes: a state-file path string and current display work areas supplied by `electron/main.ts`.
- Produces: `WindowBounds`, `WindowState`, `DEFAULT_WINDOW_STATE`, `loadWindowState(filePath, displays)`, and `saveWindowState(filePath, state)`.

- [ ] **Step 1: Write failing tests for valid loading and maximized-state preservation**

Create `tests/electron/window-state.test.ts` with temporary-directory cleanup and these initial cases:

```ts
// @vitest-environment node

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_WINDOW_STATE,
  loadWindowState,
  type WindowBounds,
} from '../../electron/window-state';

const displays: WindowBounds[] = [{ x: 0, y: 0, width: 1920, height: 1080 }];
let temporaryDirectory: string | undefined;

async function stateFile(contents: unknown): Promise<string> {
  temporaryDirectory ??= await mkdtemp(path.join(tmpdir(), 'md-viewer-window-state-'));
  const filePath = path.join(temporaryDirectory, 'window-state.json');
  await writeFile(filePath, JSON.stringify(contents), 'utf8');
  return filePath;
}

afterEach(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  temporaryDirectory = undefined;
});

describe('loadWindowState', () => {
  it('loads valid normal bounds', async () => {
    const filePath = await stateFile({
      x: 80,
      y: 60,
      width: 1280,
      height: 720,
      isMaximized: false,
    });

    expect(loadWindowState(filePath, displays)).toEqual({
      x: 80,
      y: 60,
      width: 1280,
      height: 720,
      isMaximized: false,
    });
  });

  it('preserves maximized state independently from normal bounds', async () => {
    const filePath = await stateFile({
      x: 40,
      y: 30,
      width: 1400,
      height: 900,
      isMaximized: true,
    });

    expect(loadWindowState(filePath, displays).isMaximized).toBe(true);
  });

  it('uses the default when the state file does not exist', () => {
    expect(loadWindowState('missing-window-state.json', displays)).toEqual(DEFAULT_WINDOW_STATE);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/electron/window-state.test.ts`

Expected: FAIL because `electron/window-state.ts` does not exist.

- [ ] **Step 3: Add the minimal state types, defaults, parsing, and loading implementation**

Create `electron/window-state.ts`:

```ts
import { readFileSync } from 'node:fs';

export interface WindowBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface WindowState {
  readonly x?: number;
  readonly y?: number;
  readonly width: number;
  readonly height: number;
  readonly isMaximized: boolean;
}

export const DEFAULT_WINDOW_STATE: WindowState = {
  width: 1200,
  height: 800,
  isMaximized: false,
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function intersects(left: WindowBounds, right: WindowBounds): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function parseWindowState(value: unknown, displays: readonly WindowBounds[]): WindowState | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (
    !isFiniteNumber(candidate.x) ||
    !isFiniteNumber(candidate.y) ||
    !isFiniteNumber(candidate.width) ||
    !isFiniteNumber(candidate.height) ||
    typeof candidate.isMaximized !== 'boolean'
  )
    return null;

  const state: WindowBounds & WindowState = {
    x: candidate.x,
    y: candidate.y,
    width: candidate.width,
    height: candidate.height,
    isMaximized: candidate.isMaximized,
  };
  if (state.width < 600 || state.height < 400) return null;
  return state;
}

export function loadWindowState(filePath: string, displays: readonly WindowBounds[]): WindowState {
  try {
    return (
      parseWindowState(JSON.parse(readFileSync(filePath, 'utf8')), displays) ?? DEFAULT_WINDOW_STATE
    );
  } catch {
    return DEFAULT_WINDOW_STATE;
  }
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- tests/electron/window-state.test.ts`

Expected: all three tests PASS.

- [ ] **Step 5: Add failing validation and display-safety tests**

Append table-driven tests under `describe('loadWindowState')`:

```ts
it.each([
  null,
  {},
  { x: 0, y: 0, width: 599, height: 800, isMaximized: false },
  { x: 0, y: 0, width: 1200, height: 399, isMaximized: false },
  { x: 'left', y: 0, width: 1200, height: 800, isMaximized: false },
  { x: 0, y: 0, width: 'wide', height: 800, isMaximized: false },
  { x: 0, y: 0, width: 1200, height: 800, isMaximized: 'yes' },
])('rejects invalid state %#', async (state) => {
  expect(loadWindowState(await stateFile(state), displays)).toEqual(DEFAULT_WINDOW_STATE);
});

it('rejects bounds fully outside all displays', async () => {
  const filePath = await stateFile({
    x: 3000,
    y: 100,
    width: 1200,
    height: 800,
    isMaximized: false,
  });
  expect(loadWindowState(filePath, displays)).toEqual(DEFAULT_WINDOW_STATE);
});

it('accepts bounds that intersect an available display', async () => {
  const filePath = await stateFile({
    x: 1800,
    y: 900,
    width: 1200,
    height: 800,
    isMaximized: false,
  });
  expect(loadWindowState(filePath, displays)).toMatchObject({ x: 1800, y: 900 });
});

it('falls back when JSON cannot be parsed', async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'md-viewer-window-state-'));
  const filePath = path.join(temporaryDirectory, 'window-state.json');
  await writeFile(filePath, '{invalid', 'utf8');
  expect(loadWindowState(filePath, displays)).toEqual(DEFAULT_WINDOW_STATE);
});

it('rejects non-finite numeric values', async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'md-viewer-window-state-'));
  const filePath = path.join(temporaryDirectory, 'window-state.json');
  await writeFile(
    filePath,
    '{"x":1e400,"y":0,"width":1200,"height":800,"isMaximized":false}',
    'utf8',
  );
  expect(loadWindowState(filePath, displays)).toEqual(DEFAULT_WINDOW_STATE);
});
```

- [ ] **Step 6: Run the focused test and verify the new RED case**

Run: `npm test -- tests/electron/window-state.test.ts`

Expected: FAIL only for the off-screen test because the initial parser deliberately returns every otherwise-valid state without checking current displays.

- [ ] **Step 7: Complete display validation and verify GREEN**

Replace `return state` in `parseWindowState` with:

```ts
return displays.some((display) => intersects(state, display)) ? state : null;
```

Run: `npm test -- tests/electron/window-state.test.ts`

Expected: all loading and validation tests PASS.

- [ ] **Step 8: Write the failing save-state test**

Add `saveWindowState` to the import list, import `readFile` from `node:fs/promises`, and append:

```ts
describe('saveWindowState', () => {
  it('writes the complete state as JSON', async () => {
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'md-viewer-window-state-'));
    const filePath = path.join(temporaryDirectory, 'window-state.json');
    const state = { x: 25, y: 50, width: 1200, height: 800, isMaximized: true };

    expect(saveWindowState(filePath, state)).toBe(true);
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual(state);
  });

  it('reports a write failure without throwing', () => {
    expect(saveWindowState(temporaryDirectory ?? '', DEFAULT_WINDOW_STATE)).toBe(false);
  });
});
```

- [ ] **Step 9: Run the focused test and verify RED**

Run: `npm test -- tests/electron/window-state.test.ts`

Expected: FAIL because `saveWindowState` is not exported.

- [ ] **Step 10: Implement synchronous, failure-safe saving**

Update the filesystem import and add:

```ts
import { readFileSync, writeFileSync } from 'node:fs';

export function saveWindowState(filePath: string, state: WindowState): boolean {
  try {
    writeFileSync(filePath, JSON.stringify(state), 'utf8');
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 11: Run tests and typechecking, then commit**

Run: `npm test -- tests/electron/window-state.test.ts`

Expected: all focused tests PASS.

Run: `npm run typecheck:electron`

Expected: PASS with no TypeScript errors.

Commit:

```bash
git add electron/window-state.ts tests/electron/window-state.test.ts
git commit -m "feat: persist validated window state"
```

---

### Task 2: Electron window lifecycle integration

**Files:**

- Modify: `electron/main.ts`
- Create: `tests/electron/window-state-integration.test.ts`

**Interfaces:**

- Consumes: `loadWindowState(filePath, displays): WindowState` and `saveWindowState(filePath, state): boolean` from Task 1.
- Produces: startup restoration and close-time persistence in the main Electron window lifecycle.

- [ ] **Step 1: Write a failing source-level integration test for lifecycle wiring**

Create `tests/electron/window-state-integration.test.ts`:

```ts
// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('Electron window-state integration', () => {
  it('loads normal bounds, restores maximize, and saves normal bounds on close', async () => {
    const source = await readFile('electron/main.ts', 'utf8');

    expect(source).toContain("import { loadWindowState, saveWindowState } from './window-state';");
    expect(source).toContain("path.join(app.getPath('userData'), 'window-state.json')");
    expect(source).toContain('screen.getAllDisplays().map(({ workArea }) => workArea)');
    expect(source).toContain('...windowBounds');
    expect(source).toContain('if (windowState.isMaximized) window.maximize();');
    expect(source).toContain("window.on('close', () => {");
    expect(source).toContain('...window.getNormalBounds()');
    expect(source).toContain('isMaximized: window.isMaximized()');
    expect(source).not.toContain('isFullScreen()');
  });
});
```

- [ ] **Step 2: Run the integration test and verify RED**

Run: `npm test -- tests/electron/window-state-integration.test.ts`

Expected: FAIL because `electron/main.ts` has no window-state integration.

- [ ] **Step 3: Load state before creating the BrowserWindow**

In `electron/main.ts`, add `screen` to the Electron imports and import the module:

```ts
import { loadWindowState, saveWindowState } from './window-state';
```

At the start of `createWindow()`, load state and separate the Electron constructor bounds from `isMaximized`:

```ts
const windowStatePath = path.join(app.getPath('userData'), 'window-state.json');
const windowState = loadWindowState(
  windowStatePath,
  screen.getAllDisplays().map(({ workArea }) => workArea),
);
const { isMaximized: _isMaximized, ...windowBounds } = windowState;
```

Spread `windowBounds` into the constructor options instead of the fixed `width` and `height`:

```ts
const window = new BrowserWindow({
  ...windowBounds,
  minWidth: 600,
  minHeight: 400,
  // existing options remain unchanged
});
```

- [ ] **Step 4: Restore maximize without restoring fullscreen**

Immediately after assigning `mainWindow`, add:

```ts
if (windowState.isMaximized) window.maximize();
```

Do not add any `setFullScreen`, `isFullScreen`, minimized-state, or fullscreen persistence logic.

- [ ] **Step 5: Save normal bounds and maximized state during close**

Before the existing `closed` listener, add:

```ts
window.on('close', () => {
  saveWindowState(windowStatePath, {
    ...window.getNormalBounds(),
    isMaximized: window.isMaximized(),
  });
});
```

Using `getNormalBounds()` is required: when the current window is maximized or fullscreen, it retains the last non-maximized geometry rather than persisting full-screen dimensions.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `npm test -- tests/electron/window-state.test.ts tests/electron/window-state-integration.test.ts`

Expected: both suites PASS.

- [ ] **Step 7: Run complete verification**

Run: `npm run typecheck:electron`

Expected: PASS.

Run: `npm test`

Expected: all unit suites PASS.

Run: `npm run build`

Expected: renderer typecheck and production Vite build PASS.

- [ ] **Step 8: Commit the lifecycle integration**

```bash
git add electron/main.ts tests/electron/window-state-integration.test.ts
git commit -m "feat: restore Electron window state"
```

---

### Task 3: Final behavior verification

**Files:**

- Modify only if verification reveals a defect: `electron/window-state.ts`, `electron/main.ts`, or their corresponding tests.

**Interfaces:**

- Consumes: the completed persistence module and Electron lifecycle integration.
- Produces: verified launch/close behavior for normal and maximized windows.

- [ ] **Step 1: Run the full project quality gate**

Run: `npm run check`

Expected: typechecking, lint, formatting check, tests, and production build all PASS without errors.

- [ ] **Step 2: Manually verify the normal-window path**

Run: `npm run electron:dev`.

Move and resize the window to a distinctive non-maximized rectangle, close it, start the app again, and verify that the same normal size and position are restored.

- [ ] **Step 3: Manually verify the maximized path**

Restore the window to normal, note its bounds, maximize it, close it, and start the app again. Verify that it starts maximized; then restore it and verify that the earlier normal bounds return.

- [ ] **Step 4: Manually verify fullscreen is not restored**

Enter fullscreen, close the application, and start it again. Verify that it does not start fullscreen.

- [ ] **Step 5: Record any verification-only corrections**

If Steps 1-4 required a code correction, first add or adjust a failing regression test, verify RED, make the smallest fix, rerun `npm run check`, and commit only the correction:

```bash
git add electron/window-state.ts electron/main.ts tests/electron/window-state.test.ts tests/electron/window-state-integration.test.ts
git commit -m "fix: harden Electron window restoration"
```

If no correction was required, do not create an empty commit.

---

### Task 4: Semantic version and Windows installer

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Generated artifact: `release/MD Viewer Setup 1.2.0.exe`

**Interfaces:**

- Consumes: the completed and verified window-state feature.
- Produces: application version `1.2.0` and an installable Windows NSIS package.

- [ ] **Step 1: Update package metadata using Semantic Versioning**

Change the root package version from `1.1.0` to `1.2.0` in both `package.json` and `package-lock.json`. This is a minor release because it adds backward-compatible window-state behavior.

- [ ] **Step 2: Verify metadata consistency**

Run a Node assertion that reads both JSON files and verifies that their root versions are exactly `1.2.0` and that `package-lock.json` also records `packages[""]?.version` as exactly `1.2.0`.

Expected: the assertion exits successfully.

- [ ] **Step 3: Run the complete quality gate**

Run: `npm run check`

Expected: typechecking, lint, formatting check, tests, and production build all PASS without errors.

- [ ] **Step 4: Build the Windows installer**

Run: `npm run electron:build`

Expected: Electron Builder produces `release/MD Viewer Setup 1.2.0.exe` successfully.

- [ ] **Step 5: Inspect the release artifact**

Verify that `release/MD Viewer Setup 1.2.0.exe` exists, has non-zero size, and has a fresh modification timestamp. Compute its SHA-256 checksum for delivery.

- [ ] **Step 6: Commit version metadata**

```bash
git add package.json package-lock.json
git commit -m "chore: release version 1.2.0"
```

Do not commit generated files from `release/`.
