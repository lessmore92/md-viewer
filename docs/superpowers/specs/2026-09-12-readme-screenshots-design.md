# README Screenshot Gallery Design

## Goal

Show MD Viewer's visual reading experience directly in the English README without making the repository documentation repetitive or heavy.

## Refresh: Current Interface

Regenerate the gallery after the workspace-header update so each asset represents the current reading interface. Keep the existing three-image gallery and filenames: light theme, dark theme, and focus mode with E-Ink mode enabled. Review the English captions against the refreshed interface and change only copy that is no longer accurate.

## Scope

- Capture three representative desktop-app screenshots using the bundled sample document:
  - Light theme in the standard reading workspace.
  - Dark theme in the standard reading workspace.
  - Focus mode with E-Ink mode enabled, including reading status information.
- Store lossless PNG assets in `docs/screenshots/` with descriptive, stable filenames.
- Add a `Screenshots` section after `Highlights` in `README.md`.
- Use concise English captions and HTML image tags with a consistent presentation width so the three states are easy to compare on GitHub.

## Exclusions

- No screenshots of personal documents or file paths.
- No functional, UI, or behavioral changes to the app.
- No exhaustive gallery of every preference combination.

## Capture and Verification

- Open the desktop development app using its existing local sample Markdown document.
- Set each requested appearance state through the visible reading controls and capture only the application window.
- Confirm that all committed image files render through the relative README paths and that the README retains its existing English style.

## Acceptance Criteria

- README contains a visible `Screenshots` section immediately after `Highlights`.
- The section has three accurately labelled images for light, dark, and focus/E-Ink modes.
- Image files are present at the referenced paths and contain no personal content.
- Existing README sections and instructions remain intact.
