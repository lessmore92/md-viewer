# Window State Persistence Design

## Goal

Restore the Electron application's last usable window size, position, and maximized state when the application starts again. Fullscreen state is intentionally not restored.

## Behavior

- When the window closes in its normal state, save its current bounds.
- When the window closes while maximized, save the normal bounds that Electron retains for restoring the window, plus a separate `isMaximized` flag.
- On the next launch, create the window with the saved normal bounds and maximize it after creation when `isMaximized` is true.
- Never persist or restore fullscreen state. Closing while fullscreen saves the underlying normal bounds and a non-maximized state unless the underlying window is maximized.
- If no saved state exists, use the current defaults of 1200 by 800 pixels.

## Storage

Store a small JSON file in Electron's per-user application-data directory. The persisted shape contains `x`, `y`, `width`, `height`, and `isMaximized` only. Window state remains local to the device.

Writes occur when the main window is closing so the final state is captured. A failed write must not delay or prevent shutdown. Missing, unreadable, malformed, or incomplete data falls back safely to the defaults.

## Display Safety

Before applying saved bounds, verify that the saved rectangle intersects an available display work area. This prevents the application from reopening off-screen after monitor removal or display-layout changes. Bounds that are invalid, smaller than the application's minimum size, or completely outside all displays are discarded in favor of the default size and Electron's normal placement.

## Structure

Place parsing, validation, display checks, loading, and saving in a focused Electron-side module. `electron/main.ts` remains responsible for integrating that module with `BrowserWindow` creation and close events.

The module accepts narrow dependencies for the state-file path and available display work areas, keeping its behavior testable without launching Electron.

## Testing

Unit tests cover:

- loading valid normal bounds;
- preserving the maximized flag independently from normal bounds;
- rejecting malformed, incomplete, undersized, and non-finite values;
- rejecting bounds that are fully outside all available displays;
- accepting bounds that intersect an available display;
- falling back when the state file does not exist or cannot be parsed;
- writing the expected JSON state.

Electron integration is checked through typechecking, the complete unit suite, and the production build.

## Non-goals

- Restoring fullscreen mode.
- Persisting minimized state.
- Synchronizing window state between devices.
- Adding a user-facing preference or reset control.
