# GitHub Release Automation Design

## Goal

Publish the MD Viewer repository on GitHub from the `main` branch without committing local caches, build output, environment files, or credentials. Create a Windows installer and GitHub Release automatically when a version tag beginning with `v` is pushed.

## Repository Hygiene

The repository will continue to track only source code, tests, documentation, and the versioned application icon. The ignore rules will explicitly exclude the local pnpm store, dependency folders, build directories, release artifacts, environment files, private-key files, and common local credential files. An optional `.env.example` remains trackable as a safe template.

The implementation will scan the currently tracked files and reachable commit history for credential-shaped content without printing potential values. No history rewrite is part of this change. If the scan finds a plausible secret in history, the release setup stops and requires an explicit decision before destructive history rewriting or credential rotation.

## Branch and Remote

The existing `master` branch will be renamed to `main`. The GitHub repository `https://github.com/lessmore92/md-viewer.git` will become the `origin` remote. The final commit and initial push target `main`; the release workflow uses only tags and does not publish on ordinary commits.

## Release Workflow

Create `.github/workflows/release.yml` with these characteristics:

- Trigger only when a pushed tag matches `v*`.
- Run on `windows-latest`, matching the Windows NSIS installer target.
- Use Node.js 22 and the committed npm lockfile through `npm ci`.
- Run `npm run check` before packaging.
- Run `npm run electron:build` to produce the installer.
- Create or update the GitHub Release for the tag and upload only `release/*.exe` and `release/*.blockmap`.
- Use GitHub's automatically supplied `GITHUB_TOKEN` with `contents: write`; no token, certificate, or other credential is stored in the repository.

## Documentation

Update the release instructions in `README.md` to use `main`, explain the `v*` tag trigger, and state that the GitHub Actions workflow attaches the installer automatically. The manual browser-upload flow will be removed.

## Validation

Before publishing, validate the release-workflow contract with a focused automated test, inspect the ignored and tracked file sets, run the project quality gate, and inspect the generated workflow text. The actual GitHub Release is created only after a `v*` tag is pushed, so its final execution is verified by GitHub Actions on the repository.

## Non-goals

- Changing the application version or creating a release tag now.
- Rewriting repository history unless a credential scan identifies an actual issue and the repository owner explicitly approves that separate operation.
- Code-signing the Windows installer.
- Publishing the web build to a hosting provider.
