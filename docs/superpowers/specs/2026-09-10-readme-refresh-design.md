# README Refresh Design

## Goal

Replace the current Persian-first README with a concise, professional English README that helps a new GitHub visitor understand MD Viewer, install it, run it, develop it, and create a Windows release.

## Audience

The README serves two groups in this order:

- People who want a private desktop or web Markdown reader with RTL support.
- Contributors who need reproducible development, testing, packaging, and release commands.

## Structure

Use this progression:

1. Product name, one-sentence value proposition, and technology line.
2. Feature highlights grouped around reading, documents, and offline use.
3. Privacy and security guarantees, including local-only document handling and safe link/image behavior.
4. Quick start for desktop development and a separate web-build path.
5. Usage notes for the Electron and browser editions.
6. Development commands, test commands, and Windows packaging instructions.
7. Tag-driven GitHub Release instructions for `main`.

## Writing Style

Keep the document entirely in English. Lead sections with outcomes, use short paragraphs and scan-friendly bullets, and retain code blocks only where they are immediately actionable. Preserve concrete limits and compatibility details that affect users, such as the 5 MB browser file limit and supported Markdown extensions.

## Accuracy Constraints

- Do not claim an installer is code-signed.
- Do not imply that selected documents are uploaded to a server.
- Keep Electron and browser behavior distinct where their file access differs.
- Describe the tag-triggered GitHub Actions release flow accurately.
- Do not introduce screenshots, badges, hosted demos, download URLs, or features that do not exist.

## Validation

Review all command names against `package.json`, compare user-facing claims against the existing product notes and source-backed README, then run the repository's formatting check on the refreshed README.

## Non-goals

- Changing the application behavior, dependencies, or visual design.
- Translating the rest of the repository documentation.
- Adding marketing assets or a project website.
