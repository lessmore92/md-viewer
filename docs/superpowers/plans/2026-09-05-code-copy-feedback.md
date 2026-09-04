# Reliable Code Copy Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make fenced-code copying reliable in Electron and browsers, with accessible local success and failure feedback.

**Architecture:** Electron clipboard access is exposed as one intent-specific preload method backed by a trusted IPC handler. The renderer selects Electron or browser transport through a small copy helper, while `Pre` owns only transient visual state and timers.

**Tech Stack:** Electron 44, React 18, TypeScript, Vitest, Testing Library, CSS.

## Global Constraints

- Preserve context isolation, renderer sandboxing, and trusted-sender validation.
- Do not expose Electron's clipboard module or generic IPC to the renderer.
- Use the existing theme variables and control styling.
- Display success for approximately 1.5 seconds and restart the timer on repeated copies.
- Respect `prefers-reduced-motion` and announce state through `aria-live`.
- Do not add a global toast system or a new dependency.

---

### Task 1: Secure Electron clipboard bridge

**Files:**
- Modify: `electron/contracts.ts`
- Modify: `electron/preload.ts`
- Modify: `electron/main.ts`
- Modify: `src/vite-env.d.ts`
- Modify: `tests/electron/preload.test.ts`
- Create: `electron/clipboard.ts`
- Create: `tests/electron/clipboard.test.ts`

**Interfaces:**
- Produces: `IPC.copyText = 'clipboard:copy-text'`.
- Produces: `window.electronAPI.copyText(text: string): Promise<boolean>`.
- Produces: `writeClipboardText(value: unknown, writeText: (text: string) => void): boolean`.

- [ ] **Step 1: Write failing preload and clipboard-domain tests**

Add a preload assertion that `api.copyText('const x = 1')` invokes `[IPC.copyText, 'const x = 1']`. Add `tests/electron/clipboard.test.ts` cases asserting that strings call the injected writer and return `true`, while non-strings do not call it and return `false`.

- [ ] **Step 2: Run the focused tests and verify red**

Run: `npx vitest run tests/electron/preload.test.ts tests/electron/clipboard.test.ts`

Expected: FAIL because `IPC.copyText`, `api.copyText`, and `writeClipboardText` do not exist.

- [ ] **Step 3: Implement the bridge and constrained writer**

Add the IPC constant and preload method. Implement:

```ts
export function writeClipboardText(
  value: unknown,
  writeText: (text: string) => void,
): boolean {
  if (typeof value !== 'string') return false;
  writeText(value);
  return true;
}
```

Import Electron's `clipboard` in `main.ts`, register `IPC.copyText`, call `requireTrustedSender(event)`, and delegate to `writeClipboardText(value, clipboard.writeText)`. Add `copyText(text: string): Promise<boolean>` to `ElectronAPI` in `src/vite-env.d.ts`.

- [ ] **Step 4: Run focused tests and type checks**

Run: `npx vitest run tests/electron/preload.test.ts tests/electron/clipboard.test.ts`

Run: `npm run typecheck:renderer`

Run: `npm run typecheck:electron`

Expected: all commands PASS.

- [ ] **Step 5: Commit the secure desktop path**

```bash
git add electron/contracts.ts electron/preload.ts electron/main.ts electron/clipboard.ts src/vite-env.d.ts tests/electron/preload.test.ts tests/electron/clipboard.test.ts
git commit -m "fix: copy code through Electron clipboard"
```

### Task 2: Renderer transport and accessible local feedback

**Files:**
- Modify: `src/markdown/Code.tsx`
- Modify: `src/markdown/MarkdownView.test.tsx`
- Modify: `src/styles/github.css`

**Interfaces:**
- Consumes: `window.electronAPI.copyText(text: string): Promise<boolean>` from Task 1.
- Produces: `copyText(text: string): Promise<boolean>` inside `Code.tsx`.
- Produces: copy states `'idle' | 'success' | 'error'` local to each `Pre`.

- [ ] **Step 1: Write failing renderer tests**

Update the shared Electron API test fixture with `copyText`. Add tests proving Electron is preferred over a mocked browser clipboard, browser clipboard is used when Electron is absent, missing/rejected clipboard operations show `کپی نشد`, success shows `کپی شد`, and success disappears after about 1.5 seconds.

- [ ] **Step 2: Run the Markdown tests and verify red**

Run: `npx vitest run src/markdown/MarkdownView.test.tsx`

Expected: FAIL because desktop transport and the Persian feedback states are not implemented.

- [ ] **Step 3: Implement transport selection and state**

Implement the helper with this behavior:

```ts
async function copyText(text: string): Promise<boolean> {
  if (window.electronAPI) return window.electronAPI.copyText(text);
  if (!navigator.clipboard) return false;
  await navigator.clipboard.writeText(text);
  return true;
}
```

In `Pre`, catch rejected operations, show success only for a `true` result, show error otherwise, clear the previous timer before each attempt, and return to idle after 1500 ms. Keep the button's accessible name stable. Render the feedback as a sibling near the button with a check or error icon and a polite `aria-live` label.

- [ ] **Step 4: Add restrained feedback styling**

Position the feedback beside the copy button, use existing background, foreground, border, and semantic color variables, and animate only opacity and transform for 150–200 ms. Under `@media (prefers-reduced-motion: reduce)`, remove positional movement and shorten or disable the transition.

- [ ] **Step 5: Run renderer tests and checks**

Run: `npx vitest run src/markdown/MarkdownView.test.tsx`

Run: `npm run typecheck:renderer`

Run: `npm run lint`

Expected: all commands PASS.

- [ ] **Step 6: Commit renderer feedback**

```bash
git add src/markdown/Code.tsx src/markdown/MarkdownView.test.tsx src/styles/github.css
git commit -m "feat: show code copy feedback"
```

### Task 3: End-to-end verification

**Files:**
- Modify only if verification exposes a defect in files already listed above.

**Interfaces:**
- Consumes: the Electron bridge and renderer copy control delivered by Tasks 1 and 2.
- Produces: verified web and packaged-renderer builds with no regression.

- [ ] **Step 1: Run the complete quality gate**

Run: `npm run check`

Expected: type checks, lint, formatting, unit tests, and production build PASS.

- [ ] **Step 2: Run focused browser interaction coverage**

Run: `npx playwright test tests/e2e/reader.spec.ts`

Expected: reader interactions PASS without console errors.

- [ ] **Step 3: Inspect the copy feedback visually**

Open a document containing a fenced code block in the local app, activate the copy control, confirm the system clipboard contains the exact code, and confirm the local `کپی شد` feedback is legible in light, dark, and ebook-reader themes without covering code.

- [ ] **Step 4: Commit any verification-only correction**

If verification required a correction, stage only the files changed for this feature and commit with a narrowly scoped message. If no correction was needed, do not create an empty commit.
