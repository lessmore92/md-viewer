# GitHub Pages Release Design

## Goal

Publish the production web reader to GitHub Pages only when a version tag
matching `v*` is pushed. The published web version must represent the same
validated release as the Windows installer.

## Approach

Extend the existing tag-triggered release workflow with a Pages deployment
job. It runs after both the secret scan and the Windows release job succeed,
so an unsuccessful release cannot replace the public web site.

The Pages job will:

1. install the locked dependencies on Ubuntu;
2. run the web-relevant production verification (renderer type check, unit
   tests, and the web build);
3. upload the generated `dist/` directory as the Pages artifact; and
4. deploy that artifact through GitHub's Pages deployment action.

The workflow will receive the minimum additional Pages and OpenID Connect
permissions required by GitHub's official deployment actions. The existing
release job retains its `contents: write` permission for creating releases.

## Compatibility

Vite already uses a relative `base` setting, so built assets resolve beneath
both a GitHub Pages project URL and a custom domain without repository-name
configuration. No application code or README content changes are needed.

## One-Time Repository Setup

Before the first deployment, the repository owner must open GitHub repository
Settings, choose Pages, and set the build and deployment source to GitHub
Actions. This setup instruction is intentionally not added to the README.

## Verification

A dedicated workflow-configuration test will assert that the release workflow
is tag-triggered, uses the official Pages configuration/upload/deploy actions,
and deploys the `dist/` build artifact. The test starts red before workflow
changes and is run again after the implementation, along with the complete
project quality suite.
