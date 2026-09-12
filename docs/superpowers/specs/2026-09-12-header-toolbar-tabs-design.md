# Header toolbar tabs design

## Goal

Simplify the application header by removing platform-version copy, relocating workspace tabs and their Split controls into the main toolbar, and making header actions icon-only with accessible hover hints.

## Layout

- The header remains a single toolbar. The logo and product name stay at the start of the toolbar.
- The current `workspace-tabs` row is removed. Its tab strip becomes the flexible middle region of the header.
- Open-document tabs preserve their current selection, close action, keyboard focus behavior, and horizontal overflow scrolling. The tab strip is allowed to shrink and scroll horizontally rather than wrap or enlarge the header.
- Split controls move beside the tab strip in the header. The Split toggle uses a two-panel icon. When Split is enabled, the existing second-pane document selector remains visible beside that toggle on wide layouts.
- Narrow layouts keep the current behavior that hides Split controls and shows a single pane, while tabs remain horizontally scrollable in the header.

## Header actions

- Remove the web/desktop version indicator and any platform-specific caption from the header.
- Header buttons, including open, install when available, outline, e-ink, theme, and Split, render as icon-only controls.
- Every icon-only action has an accessible name and a native `title` tooltip, so its guidance appears on hover and remains available to assistive technology.
- Non-button controls, including the second-pane selector, retain visible context so their purpose remains understandable.

## Behavior and accessibility

- Existing tab activation, tab close focus transfer, Split selection, and viewport breakpoint behavior do not change.
- No document state, persisted workspace state, or loading/error flow changes.
- Visual focus indicators continue to be visible for every interactive header control.

## Verification

- Component tests cover icon-only header actions, removal of platform-version text, and the relocated tab/Split controls.
- The browser build and existing test suite pass.
