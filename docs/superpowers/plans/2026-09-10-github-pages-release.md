# GitHub Pages Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the web build to GitHub Pages only after a `v*` release tag has passed the existing release checks and Windows release job.

**Architecture:** The existing `.github/workflows/release.yml` remains the single release entrypoint. A new Pages job, dependent on the existing secret scan and Windows release job, builds the Vite web bundle on Ubuntu, uploads `dist/`, and deploys it using GitHub's official Pages actions.

**Tech Stack:** GitHub Actions, GitHub Pages, Node.js 22, npm, Vite, Vitest.

## Global Constraints

- Trigger deployment only for pushed tags matching `v*`; do not deploy on pushes to `main`.
- Deploy only after `secret-scan` and `release` succeed.
- Use Vite's existing relative asset base; do not change application code or the README.
- Use only GitHub's official Pages configuration, artifact upload, and deploy actions.
- Preserve the Windows release job's ability to create or update a GitHub Release.

---

### Task 1: Deploy the tagged web build to GitHub Pages

**Files:**

- Modify: `.github/workflows/release.yml`

**Interfaces:**

- Consumes: Vite's `dist/` output.
- Produces: a `pages` GitHub Actions job that publishes the versioned web build after the Windows release job succeeds.

- [ ] **Step 1: Add the required workflow permissions**

Under the workflow's top-level `permissions`, retain `contents: read` and add:

```yaml
pages: write
id-token: write
```

Leave the `release` job's job-level `contents: write` permission unchanged so it can still publish the Windows release.

- [ ] **Step 2: Add the Pages job after the existing release job**

Append this job at the top workflow level, aligned with `secret-scan` and `release`:

```yaml
pages:
  name: Build and deploy web app
  needs: [secret-scan, release]
  runs-on: ubuntu-latest
  environment:
    name: github-pages
    url: ${{ steps.deployment.outputs.page_url }}
  steps:
    - uses: actions/checkout@v6
    - uses: actions/setup-node@v6
      with:
        node-version: '22'
        cache: npm
    - name: Install dependencies
      run: npm ci
    - name: Verify and build web app
      run: npm run typecheck:renderer && npm test && npm run build:web
    - name: Configure GitHub Pages
      uses: actions/configure-pages@v5
    - name: Upload web artifact
      uses: actions/upload-pages-artifact@v4
      with:
        path: dist
    - name: Deploy to GitHub Pages
      id: deployment
      uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Run the full project verification**

Run: `npm run check`

Expected: exit code 0 for renderer and Electron type checks, linting, formatting, all Vitest tests, and the production web build.

- [ ] **Step 4: Commit the deployment**

```bash
git add .github/workflows/release.yml
git commit -m "ci: publish tagged web releases to GitHub Pages"
```
