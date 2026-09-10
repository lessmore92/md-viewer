# README Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Replace the Persian-first README with a professional, accurate English guide for users and contributors.

**Architecture:** Keep one focused README that moves from product value to installation, usage, privacy, development, testing, packaging, and tag-driven releases. Validate its claims against package scripts and current product documentation rather than adding tests for human-facing prose.

**Tech Stack:** Markdown, Electron, React, TypeScript, npm, Playwright, GitHub Actions.

## Global Constraints

- Write the README entirely in English.
- Preserve only product claims supported by the current application and product notes.
- Keep Electron-specific and browser-specific behavior distinct.
- Do not add badges, screenshots, download links, or claims about code signing.
- Retain the existing npm commands and the v\* tag release process on main.

---

### Task 1: Rewrite the README around user outcomes

**Files:**

- Modify: README.md

**Interfaces:**

- Consumes: PRODUCT.md, package.json scripts, and the current README's documented behavior.
- Produces: a concise English guide that a GitHub visitor can scan, install from, and contribute to.

- [ ] **Step 1: Replace the README with this heading structure**

Use these sections in this order:

```markdown
# MD Viewer

> A private, GitHub-style Markdown reader for Windows and the web, with RTL support and offline-ready reading.

## Highlights

## Privacy and security

## Quick start

### Desktop development

### Web build

## Using MD Viewer

### Desktop app

### Web app and offline reading

## Development

## Testing

## Build a Windows installer

## Create a GitHub Release

## Supported files
```

Explain the reader features concisely: multiple documents in tabs, optional split view above 960 px, saved reading preferences, focus mode, E-Ink reading mode, GitHub-flavored Markdown, RTL-aware typography, H1-H3 navigation, and safe local image handling.

- [ ] **Step 2: Keep the commands immediately actionable**

Use these exact command blocks in their matching sections:

```bash
npm ci
npm run electron:dev
```

```bash
npm run build:web
npm run preview
```

```bash
npm run check
npm run test:e2e
```

```bash
npm run electron:build
```

```bash
npm version patch --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: release version 1.2.1"
git tag -a v1.2.1 -m "MD Viewer v1.2.1"
git push origin main --tags
```

- [ ] **Step 3: Add accurate privacy and platform details**

State that selected documents and reading preferences stay on the device; the browser edition accepts .md and .txt files up to 5 MB and cannot access neighboring relative images; the desktop application supports .md, .markdown, .mdown, and .mkd files and safely resolves in-folder relative images. Describe the allowed external link protocols as http, https, and mailto, and state that scripts, frames, forms, file URLs, and javascript URLs are blocked.

### Task 2: Validate the completed document

**Files:**

- Modify only if validation finds an inaccurate command or unsupported claim: README.md

**Interfaces:**

- Consumes: the rewritten README, package.json, PRODUCT.md, and Prettier.
- Produces: an English README with verified commands and supported feature claims.

- [ ] **Step 1: Verify every documented command exists**

Run:

```powershell
rg -n '"(electron:dev|build:web|preview|check|test:e2e|electron:build)"' package.json
rg -n 'npm run (electron:dev|build:web|preview|check|test:e2e|electron:build)|npm version patch|git push origin main --tags' README.md
```

Expected: each command named in the README is present in package.json or is a Git command in the release procedure.

- [ ] **Step 2: Verify the document language and required coverage**

Run:

```powershell
rg -n '^## |^### ' README.md
rg -n 'Privacy|Quick start|Desktop app|Web app|Development|Testing|Windows installer|GitHub Release|Supported files' README.md
```

Expected: the prescribed English sections are present and the README contains no Persian prose.

- [ ] **Step 3: Format and check the README**

Run:

```powershell
npx prettier --write README.md
npx prettier --check README.md
```

Expected: Prettier reports that README.md matches project formatting.

- [ ] **Step 4: Commit the refresh**

```powershell
git add README.md docs/superpowers/plans/2026-09-10-readme-refresh.md
git commit -m "docs: refresh English README"
```
