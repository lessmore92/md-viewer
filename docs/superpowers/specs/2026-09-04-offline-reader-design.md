# MD Viewer: offline reading and interface design

The reader serves people reading Persian and mixed-language technical documents on a laptop or phone, in daylight and at night. Preserve the GitHub document semantics, blue accent, Vazirmatn, light/dark themes, safe Markdown rendering, and right-hand outline.

## Direction

Use a quiet document workspace: a branded top bar, a compact reading toolbar, a centered white document on a pale neutral workspace, and an unboxed outline. The empty state offers opening a local file, drag and drop, and a bundled sample. A book/M icon identifies the application in the interface, browser and Windows.

Keep one React renderer for browser and Electron. Separate the browser document input and persistence from Electron's privileged file operations. A separate web application would duplicate the renderer; a cosmetic-only refresh would leave the browser unusable. A shared renderer with a small browser adapter is the chosen approach.

## Reading controls

- Adjustable 14–28px document text with visible size, bounded increase/decrease, and reset.
- Standard/relaxed/spacious line height; narrow/comfortable/wide reading measure.
- Focus mode hides secondary chrome and the outline, with a visible exit button and Escape shortcut.
- Word count, estimated reading time, scroll progress and return-to-top action.
- Preferences persist locally, and malformed or inaccessible storage falls back safely.

## Browser and offline behavior

File input and drag/drop accept .md, .markdown, .mdown, .mkd and .txt, with a 5 MiB limit. Documents are read locally and never uploaded. Browser storage remembers the last document, exposes a clear action, and reports when saving fails. Cancellation or failed reads keep the current document. Browser external links open separately with noopener/noreferrer. Browser-relative images show a clear unavailable state because selecting one file grants no access to sibling files; Electron retains its existing safe local-image resolver.

A production-only service worker precaches the generated application files, fonts, icons and sample, with a content-derived cache version and scope-specific cleanup. No remote images are cached. The manifest uses relative paths to support subdirectory hosting. The interface reports preparation, offline readiness or unavailable caching truthfully. Offline use needs one successful online load over HTTPS or localhost; remote image availability is separate. New builds wait for the old application to close before activation, avoiding mixed versions.

## Verification

Behavior tests cover browser opening and failures, storage recovery, preference persistence/bounds, focus exit, Electron selection races and safe links. Production browser checks cover desktop/mobile layout, theme, real file input, reload while offline, subdirectory asset paths and console errors. Existing security tests remain gates. Public hosting is outside this local implementation; deliver a static dist build and deployment instructions.
