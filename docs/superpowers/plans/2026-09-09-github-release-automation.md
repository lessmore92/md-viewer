# GitHub Release Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Publish the repository from main with credential-safe ignore rules and an automated Windows GitHub Release for v\* tags.

**Architecture:** One release workflow first scans full Git history for secrets, then builds and publishes the Windows installer. Repository hygiene is constrained to ignore rules and the release documentation.

**Tech Stack:** GitHub Actions, GitHub CLI, Node.js 22, npm, Electron Builder, Vitest 3, Gitleaks Action v3.

## Global Constraints

- The canonical branch is main and the remote is https://github.com/lessmore92/md-viewer.git.
- Only tags matching v\* trigger a release; do not create a release tag in this work.
- Use actions/checkout@v6, actions/setup-node@v6, and gitleaks/gitleaks-action@v3.
- Use Node.js 22, npm ci, npm run check, and npm run electron:build.
- The release job receives only contents: write; no persistent token or signing secret is committed.
- Upload only release/_.exe and release/_.blockmap.
- Stop before push if an actual secret is found. Do not rewrite history without a separate approval.
- The repository owner approved a configuration-only exception to the text-based Vitest contract test. Validate the YAML with Prettier, validate the project through its existing quality gate, and let GitHub parse the workflow after the main-branch push.

---

### Task 1: Add a failing release-workflow contract test

**Files:**

- Create: tests/release-workflow.test.ts
- Create later: .github/workflows/release.yml

**Interfaces:**

- Consumes: the release-workflow file as UTF-8 text.
- Produces: an automated regression check for the tag-only trigger, secret scan, build steps, and ephemeral release token.

- [ ] **Step 1: Create the focused test**

```ts
// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('GitHub release workflow', () => {
  it('releases only version tags after scanning secrets and building the installer', async () => {
    const workflow = await readFile('.github/workflows/release.yml', 'utf8');

    expect(workflow).toMatch(/on:\s*\n\s*push:\s*\n\s*tags:\s*\n\s*- ['"]v\*['"]/);
    expect(workflow).toContain('uses: actions/checkout@v6');
    expect(workflow).toContain('fetch-depth: 0');
    expect(workflow).toContain('uses: gitleaks/gitleaks-action@v3');
    expect(workflow).toContain('uses: actions/setup-node@v6');
    expect(workflow).toContain("node-version: '22'");
    expect(workflow).toContain('cache: npm');
    expect(workflow).toContain('npm ci');
    expect(workflow).toContain('npm run check');
    expect(workflow).toContain('npm run electron:build');
    expect(workflow).toContain('contents: write');
    expect(workflow).toContain('GH_TOKEN: ${{ github.token }}');
    expect(workflow).toContain('gh release create');
    expect(workflow).toContain('release/*.exe');
    expect(workflow).toContain('release/*.blockmap');
    expect(workflow).not.toMatch(/(secrets\.(?!GITHUB_TOKEN)|BEGIN [A-Z ]*PRIVATE KEY)/i);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

```powershell
& 'C:\Users\HAMAHANG\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' exec vitest run tests/release-workflow.test.ts
```

Expected: FAIL with ENOENT because the workflow does not exist.

### Task 2: Implement the secure tag-driven workflow

**Files:**

- Create: .github/workflows/release.yml
- Test: tests/release-workflow.test.ts

**Interfaces:**

- Consumes: a pushed version tag, package-lock.json, and the existing package scripts.
- Produces: a GitHub Release with the NSIS installer and optional blockmap, only after secret scanning and quality checks.

- [ ] **Step 1: Create the workflow**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: read

jobs:
  secret-scan:
    name: Scan for secrets
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v3
        env:
          GITHUB_TOKEN: ${{ github.token }}

  release:
    name: Build and publish Windows release
    needs: secret-scan
    runs-on: windows-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: '22'
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Run quality checks
        run: npm run check
      - name: Build Windows installer
        run: npm run electron:build
      - name: Create or update GitHub Release
        shell: pwsh
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          if (gh release view $env:GITHUB_REF_NAME 2>$null) {
            gh release upload $env:GITHUB_REF_NAME release/*.exe release/*.blockmap --clobber
          } else {
            gh release create $env:GITHUB_REF_NAME release/*.exe release/*.blockmap --verify-tag --generate-notes
          }
```

- [ ] **Step 2: Run the test and verify GREEN**

```powershell
& 'C:\Users\HAMAHANG\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' exec vitest run tests/release-workflow.test.ts
```

Expected: PASS with one test and no failures.

- [ ] **Step 3: Inspect the workflow text**

```powershell
Get-Content -Raw .github/workflows/release.yml
```

Expected: the workflow has only the v\* push filter, the release job needs secret-scan, and the only credential expression is github.token.

### Task 3: Add ignore rules and update the release guide

**Files:**

- Modify: .gitignore
- Modify: README.md

**Interfaces:**

- Consumes: the repository's local-file conventions and the workflow behavior.
- Produces: a clean tracked-file set and a tag-based release guide for main.

- [ ] **Step 1: Extend .gitignore**

Append these patterns while preserving the existing !build/icon.png exception:

```gitignore
.pnpm-store/
.env*
!.env.example
*.pem
*.key
*.p12
*.pfx
.npmrc
```

- [ ] **Step 2: Verify ignore behavior**

```powershell
git check-ignore -v .pnpm-store/cache .env .env.local deploy.key certificate.pfx .npmrc
git check-ignore -v .env.example
```

Expected: every local/credential example is ignored and .env.example is not ignored.

- [ ] **Step 3: Replace the final Windows-release section of README.md**

The new section must use the following commands and statement:

```bash
npm version patch --no-git-tag-version
npm test
npm run electron:build
git add package.json package-lock.json
git commit -m "chore: release version 1.2.1"
git tag -a v1.2.1 -m "MD Viewer v1.2.1"
git push origin main --tags
```

Write these Persian requirements directly below the commands: a pushed v\* tag runs a full-history check for unwanted credentials, then quality checks and Windows packaging; the exe and blockmap become assets of the matching GitHub Release; the workflow uses GitHub's temporary token, and no token or certificate belongs in the repository; Windows code signing remains separate and optional.

- [ ] **Step 4: Verify the documentation**

```powershell
rg -n "push origin (master|main)|Draft a new release|v\*|GitHub Actions" README.md
```

Expected: the release guide names main and GitHub Actions, documents v\*, and contains no manual upload instruction.

### Task 4: Verify safety, commit, and publish main

**Files:**

- Modify only if a scan identifies a real credential and remediation does not require history rewriting.

**Interfaces:**

- Consumes: the complete workflow, ignore rules, documentation, local history, and requested remote.
- Produces: a verified main branch pushed without a release tag.

- [ ] **Step 1: Scan reachable history without printing credential values**

```powershell
$pattern = '(?im)\b(?:api[_-]?key|secret|password|token|private[_-]?key|client[_-]?secret)\b\s*[:=]\s*(?!\$\{\{)["'']?[A-Za-z0-9_./+=-]{16,}'
$hits = foreach ($commit in (git rev-list --all)) {
  git grep -I -l -E $pattern $commit -- . 2>$null
}
$uniqueHits = $hits | Sort-Object -Unique
if ($uniqueHits) {
  throw "Credential-like content found in: $($uniqueHits -join ', ')"
}
```

Expected: exit successfully without printing potential credential values. If it reports a path, stop; validate the finding and obtain approval before history rewriting.

- [ ] **Step 2: Run the full local quality gate**

```powershell
& 'C:\Users\HAMAHANG\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' run check
```

Expected: renderer and Electron typechecks, lint, formatting, all tests, and the production build pass.

- [ ] **Step 3: Commit the verified changes**

```powershell
git add .gitignore .github/workflows/release.yml README.md tests/release-workflow.test.ts
git commit -m "ci: add secure GitHub release workflow"
```

- [ ] **Step 4: Rename and fast-forward the primary branch**

From the original checkout, after confirming it still points to the original master commit:

```powershell
git branch -m master main
git merge --ff-only codex/release-automation
```

Expected: local main advances without a merge conflict.

- [ ] **Step 5: Configure and preflight the remote**

```powershell
git remote add origin https://github.com/lessmore92/md-viewer.git
git ls-remote --heads origin main
```

Expected: a new repository has no main ref. If a remote main exists, fetch it and stop unless it is already an ancestor of local main. Never force-push.

- [ ] **Step 6: Push the verified branch without a tag**

```powershell
git push -u origin main
git ls-remote --heads origin main
git ls-tree -r origin/main -- .github/workflows/release.yml
```

Expected: origin/main matches local main and contains the release workflow. Do not push a tag; the first real version tag triggers the first release.
