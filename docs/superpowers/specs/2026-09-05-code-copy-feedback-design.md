# Code Copy Reliability and Feedback Design

## Goal

Make fenced-code copy controls reliable in both the packaged Electron application and the browser build, then provide clear, restrained confirmation near the control.

## Root Cause

The current control only calls `navigator.clipboard.writeText`. The packaged application loads its renderer from a `file:` URL, where the browser Clipboard API is not consistently available. When it is missing, the handler returns without copying or showing an error. Existing tests mock the browser API and therefore do not cover the packaged Electron path.

## Architecture

The Electron main process will own desktop clipboard access. A narrowly scoped `copyText(text)` method will be exposed through the existing context-isolated preload bridge and sent over a dedicated IPC channel. The main-process handler will accept only trusted renderer requests and string input before calling Electron's system clipboard API.

The renderer will use the Electron bridge when present. In the browser build it will use `navigator.clipboard.writeText`. No legacy DOM-copy fallback will be added because it is deprecated and less predictable.

## Interaction Design

The copy control remains attached to the top-right corner of each fenced code block. After a successful copy, a compact confirmation appears beside the control with a check icon and the Persian label `کپی شد`. It fades and moves into place quickly, remains visible long enough to register, then fades out after approximately 1.5 seconds.

The feedback is local to the code block that initiated the action. Repeated clicks restart its dismissal timer. It will use the existing theme variables and component shape language, without introducing a new global toast dependency.

For users who prefer reduced motion, confirmation changes state without positional movement. An `aria-live` region announces success without moving keyboard focus.

## Failure Handling

The success confirmation appears only after the selected clipboard operation resolves successfully. On failure, the control shows a short failure state instead of silently doing nothing or falsely reporting success. The user can retry immediately. Errors remain local and do not interrupt reading with a modal.

## Security

The IPC handler reuses the existing trusted-sender validation. The preload bridge exposes only the intent-specific `copyText` operation; it does not expose Electron's clipboard module or generic IPC primitives to the renderer.

## Testing

- Renderer test: the Electron bridge is preferred when available.
- Renderer test: the browser Clipboard API is used when no Electron bridge exists.
- Renderer test: success feedback appears, is announced, and dismisses after the timeout.
- Renderer test: failure feedback appears when copying rejects or no browser Clipboard API is available.
- Preload test: `copyText` invokes only the dedicated IPC channel with the supplied string.
- Main-process or isolated handler test: untrusted senders and non-string values cannot write to the clipboard.
- Existing type checks, unit tests, linting, formatting, and builds remain green.

## Scope

This change covers fenced-code copy behavior and its local feedback only. It does not add a global notification system or change inline-code rendering.
