// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { createWindowStateTracker } from '../../electron/window-state';

describe('Electron window state lifecycle integration', () => {
  it('keeps a normal window normal', () => {
    const tracker = createWindowStateTracker(false);

    expect(tracker.isMaximized()).toBe(false);
  });

  it('tracks maximize events outside fullscreen', () => {
    const tracker = createWindowStateTracker(false);

    tracker.record('maximize', false);

    expect(tracker.isMaximized()).toBe(true);
  });

  it('tracks unmaximize events outside fullscreen', () => {
    const tracker = createWindowStateTracker(true);

    tracker.record('unmaximize', false);

    expect(tracker.isMaximized()).toBe(false);
  });

  it('does not let minimize erase the maximized state', () => {
    const tracker = createWindowStateTracker(false);
    tracker.record('maximize', false);

    tracker.record('minimize', false);

    expect(tracker.isMaximized()).toBe(true);
  });

  it('keeps a fullscreen window entered from normal normal', () => {
    const tracker = createWindowStateTracker(false);

    tracker.record('maximize', true);

    expect(tracker.isMaximized()).toBe(false);
  });

  it('keeps a fullscreen window entered from maximized maximized', () => {
    const tracker = createWindowStateTracker(true);

    tracker.record('unmaximize', true);

    expect(tracker.isMaximized()).toBe(true);
  });
});
