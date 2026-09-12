# README Screenshot Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three accurate desktop-app screenshots to the English README, covering light, dark, and focus/E-Ink reading states.

**Architecture:** Static PNG files live in `docs/screenshots/`; `README.md` references them with descriptive captions. The app itself is unchanged, and the bundled sample document provides non-sensitive capture content.

**Tech Stack:** Electron, React, Markdown, PNG.

## Global Constraints

- Capture only the local bundled sample document; do not expose personal files or paths.
- Use exactly three screenshots: light, dark, and focus mode with E-Ink enabled.
- Preserve the existing English README style and all unrelated content.
- Store lossless images at stable relative paths under `docs/screenshots/`.

---

## Refresh: Current Workspace Header

Regenerate `docs/screenshots/light-theme.png`, `docs/screenshots/dark-theme.png`, and `docs/screenshots/focus-eink-mode.png` from the current local interface after the workspace-header update. Preserve their filenames and the compact three-image README gallery. Compare every existing caption to the refreshed screen and edit only wording that no longer describes a visible state.

### Task 0: Refresh and inspect the current gallery

**Files:**

- Modify: `docs/screenshots/light-theme.png`
- Modify: `docs/screenshots/dark-theme.png`
- Modify: `docs/screenshots/focus-eink-mode.png`
- Modify: `README.md` only when a caption is no longer accurate

**Interfaces:**

- Consumes: the local MD Viewer preview and `src/app/sample.md`.
- Produces: three replacement PNGs that show the current workspace header and the existing README references.

- [ ] **Step 1: Start a local preview on an unused port**

Run the existing Vite entry point with the bundled local Node runtime and a fixed unused port.

- [ ] **Step 2: Capture the three agreed states**

Open the sample document, then replace the existing files with same-size captures of light mode, dark mode, and focus mode with E-Ink enabled.

- [ ] **Step 3: Inspect the images and README captions**

Verify that the current header is visible in standard modes, focus mode removes workspace chrome, and each English caption remains accurate.

- [ ] **Step 4: Verify links and documentation formatting**

Confirm that all three `<img src>` paths in `README.md` point to existing PNGs, then run Prettier against README and this plan.

---

### Task 1: Capture representative desktop states

**Files:**

- Create: `docs/screenshots/light-theme.png`
- Create: `docs/screenshots/dark-theme.png`
- Create: `docs/screenshots/focus-eink-mode.png`

**Interfaces:**

- Consumes: `src/app/sample.md` as the non-sensitive capture document and existing toolbar preferences.
- Produces: three consistently framed PNG assets referenced by the README.

- [ ] **Step 1: Start the existing Electron development app**

Run: `npm run electron:dev`

Expected: a local MD Viewer desktop window opens without modifying app source files.

- [ ] **Step 2: Open the bundled sample document and capture standard light mode**

Set the theme control to light mode with focus and E-Ink disabled. Capture the app window and save it as `docs/screenshots/light-theme.png`.

- [ ] **Step 3: Capture standard dark mode**

Set the same document to dark mode with focus and E-Ink disabled. Capture the app window and save it as `docs/screenshots/dark-theme.png`.

- [ ] **Step 4: Capture focus and E-Ink mode**

Enable focus mode and E-Ink mode together, retaining the same sample document. Ensure the reading-status indicator is visible, then save the capture as `docs/screenshots/focus-eink-mode.png`.

- [ ] **Step 5: Inspect image files**

Confirm all three files exist, open correctly, use the same window framing, and contain no personal document data or local paths.

### Task 2: Add the gallery to the README

**Files:**

- Modify: `README.md` immediately after `## Highlights`
- Consumes: `docs/screenshots/light-theme.png`, `docs/screenshots/dark-theme.png`, and `docs/screenshots/focus-eink-mode.png`.
- Produces: a concise English `## Screenshots` section.

- [ ] **Step 1: Insert the screenshot section**

Add the following directly after the Highlights list:

```markdown
## Screenshots

<p align="center">
  <img src="docs/screenshots/light-theme.png" alt="MD Viewer in light theme" width="720" />
</p>

**Light theme** — a clean, GitHub-inspired workspace for everyday reading.

<p align="center">
  <img src="docs/screenshots/dark-theme.png" alt="MD Viewer in dark theme" width="720" />
</p>

**Dark theme** — a comfortable high-contrast view for low-light environments.

<p align="center">
  <img src="docs/screenshots/focus-eink-mode.png" alt="MD Viewer in focus and E-Ink mode" width="720" />
</p>

**Focus and E-Ink mode** — distraction-free reading with progress, word count, and estimated reading time.
```

- [ ] **Step 2: Verify Markdown references**

Read `README.md` and confirm every image `src` exactly matches a created file and the section remains between `Highlights` and `Privacy and Security`.

- [ ] **Step 3: Run formatting and quality checks**

Run: `npm run check`

Expected: all static checks pass; this documentation-only change does not introduce app regressions.

- [ ] **Step 4: Review the final documentation diff**

Run: `git -c safe.directory=D:/md-viewer diff -- README.md docs/screenshots`

Expected: the diff contains only the intended README gallery and its three image assets.
