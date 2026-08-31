# GitHub-style Markdown Viewer Design

## Goal

Rebuild MD Viewer into a secure Electron Markdown reader whose document rendering closely matches GitHub README pages. The application must support Persian and mixed-direction documents, a right-side table of contents, local relative assets, syntax-highlighted code, GitHub Alerts, light and dark themes, and safe external-link handling.

This work also resolves the security, rendering, lifecycle, packaging, typing, and test gaps found during the project review.

## Success Criteria

- Markdown output visually follows GitHub README conventions in both light and dark themes.
- GFM tables, task lists, autolinks, strikethrough, fenced code, inline code, raw HTML after sanitization, and GitHub Alerts render correctly.
- Relative images resolve from the Markdown file's directory without exposing arbitrary filesystem reads to renderer code.
- A sticky right sidebar lists nested H1-H3 headings, tracks the active section, and scrolls to headings.
- The sidebar becomes an accessible right-side drawer in narrow windows.
- External links open only in the system browser; internal fragment links remain inside the document.
- Electron navigation, window creation, and privileged IPC are restricted to trusted local application content.
- File opening works through the dialog, command-line/file association, and a second launch while the app is already running.
- Renderer and Electron type-checks, lint, formatting checks, automated tests, production build, and installer packaging pass.

## Architecture

### Electron Main Process

The main process owns all privileged operations:

- Create the application window with `nodeIntegration: false`, `contextIsolation: true`, sandboxing enabled, and a restrictive preload.
- Reject main-frame navigation away from the trusted application URL and deny new Electron windows.
- Validate the sender frame for every IPC handler.
- Open validated `http`, `https`, and `mailto` URLs with the operating system browser. Other protocols are rejected.
- Show the Markdown file picker and read selected documents asynchronously.
- Track an allowlisted document root for the active document. Relative asset requests are resolved against that root, normalized, and rejected if they escape it.
- Use a single-instance lock. A second launch forwards its Markdown path to the existing window and focuses it.
- Support `.md`, `.markdown`, `.mdown`, and `.mkd` consistently in dialogs and packaging associations where supported.

The renderer never supplies an unrestricted filesystem path to a general-purpose read API.

### Preload Boundary

The preload exposes a small, fully typed API:

- select and load a Markdown document;
- receive a document opened by the operating system or another application instance;
- obtain a safe URL for an allowlisted relative asset;
- request that a validated external URL open in the system browser.

Event subscriptions return unsubscribe functions. Raw `ipcRenderer` methods and arbitrary channel names are never exposed.

### Markdown Pipeline

The pipeline has separate, testable responsibilities:

1. Parse Markdown with GFM support.
2. Normalize headings and create stable, de-duplicated GitHub-style slugs.
3. Derive the nested H1-H3 table-of-contents model from the same syntax tree used for rendering.
4. Recognize GitHub Alert blockquotes (`NOTE`, `TIP`, `IMPORTANT`, `WARNING`, and `CAUTION`).
5. Apply syntax highlighting to fenced code while preserving correct inline-code semantics.
6. Resolve safe relative image URLs through the preload boundary.
7. Sanitize raw HTML with an explicit schema that removes scripts, event handlers, iframes, unsafe protocols, and other active content.
8. Render typed React components for headings, links, images, code, tables, alerts, and bidirectional text.

Heading IDs and sidebar entries come from one source of truth, so duplicate headings and mixed Persian/English titles stay synchronized.

### React UI

The renderer is organized into focused units:

- `AppShell`: document state, theme, open-document flow, and top-level error handling.
- `Toolbar`: filename, open button, theme toggle, and sidebar toggle.
- `DocumentView`: GitHub-style Markdown surface and document-relative context.
- `TableOfContents`: nested H1-H3 navigation and active-section state.
- `SidebarDrawer`: responsive narrow-window presentation with focus management.
- shared Markdown utilities: slug generation, TOC construction, direction detection, and safe link classification.

Late async results are ignored when a newer file-open request has already started.

## User Interface

### Desktop Layout

The selected layout is option A from the visual design review:

- compact toolbar across the top;
- centered GitHub-style document surface;
- sticky table of contents on the right, matching the Persian RTL application shell;
- readable content width and GitHub-like typography, spacing, borders, tables, task lists, blockquotes, links, and code presentation;
- active sidebar heading marked with GitHub blue and a visible indicator;
- sidebar hidden when no H1-H3 headings exist;
- explicit control to collapse and restore the sidebar.

Code blocks include language-aware highlighting and a copy button. Images scale within the document surface. Missing relative images show a compact non-disruptive placeholder containing the failed relative path.

### Responsive Layout

Below the desktop breakpoint, the document uses the available width and the table of contents becomes a drawer entering from the right. The drawer:

- closes after selecting a heading;
- closes on Escape or an outside click;
- traps focus while open and restores focus to its trigger when closed;
- has accessible labels and visible keyboard focus.

Motion is reduced or removed when `prefers-reduced-motion` is enabled.

### Themes

The existing manual light/dark toggle remains. Both palettes follow GitHub's content colors rather than generic gray Tailwind defaults. The preference persists locally and is applied before the first meaningful paint where practical to avoid a theme flash.

## Links and Assets

- Fragment links scroll to the matching sanitized heading ID in the current document.
- Relative images are resolved against the active Markdown file directory through a constrained main-process handler.
- Absolute `http` and `https` images may render according to the Content Security Policy; failures use the same image fallback.
- External `http`, `https`, and `mailto` links open through the operating system.
- `javascript:`, `file:`, `data:` for links, custom protocols, malformed URLs, and navigation attempts inside the Electron window are rejected.

## Security Controls

- Keep Electron on a currently supported major version.
- Define a restrictive Content Security Policy and avoid inline executable scripts.
- Enable context isolation and renderer sandboxing; keep Node integration disabled.
- Deny unexpected navigation and new-window creation.
- Validate IPC senders against the packaged local application origin or development origin.
- Replace unrestricted `read-file(path)` IPC with intent-specific document and asset operations.
- Normalize paths and enforce containment before loading relative assets.
- Sanitize raw HTML with an allowlist schema.
- Do not expose raw Electron primitives through the context bridge.
- Validate protocols before calling `shell.openExternal`.

## Error Handling

- Unreadable, deleted, or invalid documents display a Persian error state with an action to select another file.
- Failed relative images display a small placeholder instead of breaking layout.
- Rejected URLs and paths fail safely and do not navigate the window.
- File reads are asynchronous so large documents do not block the main process.
- Stale document requests cannot overwrite a more recently opened file.
- Empty documents and documents without headings remain valid states.
- Duplicate headings receive deterministic unique IDs.

## Testing and Quality Gates

### Unit Tests

- bidirectional text detection;
- GitHub-style slug generation, including duplicates and Persian/English input;
- nested H1-H3 TOC construction;
- safe URL classification;
- path containment and relative-asset validation;
- HTML sanitization and unsafe-protocol rejection.

### React Integration Tests

- correct H1-H6 elements and IDs;
- inline code versus fenced code;
- semantic `th` and `td` output;
- GFM tables and task lists;
- GitHub Alerts;
- relative image resolution and fallback;
- sidebar hierarchy, active state, navigation, drawer behavior, and listener cleanup;
- light/dark persistence and accessible controls.

### Electron Tests

- trusted versus untrusted IPC sender validation;
- document selection and constrained asset loading;
- external URL validation;
- navigation and new-window denial;
- single-instance path forwarding and file-association parsing.

### End-to-End Flow

At least one automated desktop flow opens a representative Markdown fixture, checks GitHub-style content, navigates through the sidebar, toggles the theme, and verifies external-link delegation.

### Commands

The project gains explicit scripts for renderer type-checking, Electron type-checking, linting, formatting verification, tests, production build, packaging, and an aggregate `check` command. The final delivery requires all relevant checks and installer packaging to succeed.

## Packaging and Documentation

- File associations and README claims use the same supported extension set.
- Build resources and application icons are validated during packaging.
- Development and production build instructions are updated.
- Security-relevant behavior for links, raw HTML, and relative assets is documented.

## Out of Scope

- Editing or saving Markdown files.
- A full file browser or workspace tree.
- Tabs for multiple simultaneously open documents.
- Live filesystem watching and automatic reload.
- GitHub repository APIs, authentication, comments, or remote repository browsing.
- Exact emulation of GitHub features that require server-side processing.
