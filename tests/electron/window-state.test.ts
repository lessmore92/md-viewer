// @vitest-environment node

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_WINDOW_STATE,
  loadWindowState,
  saveWindowState,
  type WindowBounds,
} from '../../electron/window-state';

describe('window state persistence', () => {
  let directory: string;
  let filePath: string;
  const displays: readonly WindowBounds[] = [{ x: 0, y: 0, width: 1920, height: 1080 }];

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), 'md-viewer-window-state-'));
    filePath = path.join(directory, 'window-state.json');
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('loads valid normal window bounds', () => {
    writeFileSync(
      filePath,
      JSON.stringify({ x: 100, y: 120, width: 1200, height: 800, isMaximized: false }),
    );

    expect(loadWindowState(filePath, displays)).toEqual({
      x: 100,
      y: 120,
      width: 1200,
      height: 800,
      isMaximized: false,
    });
  });

  it('preserves the maximized flag independently of valid bounds', () => {
    writeFileSync(
      filePath,
      JSON.stringify({ x: 200, y: 150, width: 1000, height: 700, isMaximized: true }),
    );

    expect(loadWindowState(filePath, displays)).toEqual({
      x: 200,
      y: 150,
      width: 1000,
      height: 700,
      isMaximized: true,
    });
  });

  it('returns the default state for a missing file', () => {
    expect(loadWindowState(filePath, displays)).toBe(DEFAULT_WINDOW_STATE);
  });

  it('returns the default state for malformed JSON', () => {
    writeFileSync(filePath, '{not json');
    expect(loadWindowState(filePath, displays)).toBe(DEFAULT_WINDOW_STATE);
  });

  it('returns the default state for an incomplete state', () => {
    writeFileSync(filePath, JSON.stringify({ x: 0, y: 0, width: 1200, height: 800 }));
    expect(loadWindowState(filePath, displays)).toBe(DEFAULT_WINDOW_STATE);
  });

  it.each([
    ['x', { x: '0', y: 0, width: 1200, height: 800, isMaximized: false }],
    ['y', { x: 0, y: null, width: 1200, height: 800, isMaximized: false }],
    ['width', { x: 0, y: 0, width: '1200', height: 800, isMaximized: false }],
    ['height', { x: 0, y: 0, width: 1200, height: [], isMaximized: false }],
    ['isMaximized', { x: 0, y: 0, width: 1200, height: 800, isMaximized: 1 }],
  ])('returns the default state when %s has the wrong type', (_field, state) => {
    writeFileSync(filePath, JSON.stringify(state));
    expect(loadWindowState(filePath, displays)).toBe(DEFAULT_WINDOW_STATE);
  });

  it.each([
    ['width', { x: 0, y: 0, width: 599, height: 800, isMaximized: false }],
    ['height', { x: 0, y: 0, width: 1200, height: 399, isMaximized: false }],
  ])('returns the default state for undersized %s', (_dimension, state) => {
    writeFileSync(filePath, JSON.stringify(state));
    expect(loadWindowState(filePath, displays)).toBe(DEFAULT_WINDOW_STATE);
  });

  it.each(['x', 'y', 'width', 'height'])('returns the default state for non-finite %s', (field) => {
    const values = { x: '0', y: '0', width: '1200', height: '800' };
    values[field as keyof typeof values] = '1e400';
    writeFileSync(
      filePath,
      `{"x":${values.x},"y":${values.y},"width":${values.width},"height":${values.height},"isMaximized":false}`,
    );
    expect(loadWindowState(filePath, displays)).toBe(DEFAULT_WINDOW_STATE);
  });

  it('returns the default state when no displays are supplied', () => {
    writeFileSync(
      filePath,
      JSON.stringify({ x: 0, y: 0, width: 1200, height: 800, isMaximized: false }),
    );
    expect(loadWindowState(filePath, [])).toBe(DEFAULT_WINDOW_STATE);
  });

  it('returns the default state for fully off-screen bounds', () => {
    writeFileSync(
      filePath,
      JSON.stringify({ x: 2000, y: 0, width: 600, height: 400, isMaximized: false }),
    );
    expect(loadWindowState(filePath, displays)).toBe(DEFAULT_WINDOW_STATE);
  });

  it('loads bounds that partially intersect a display', () => {
    writeFileSync(
      filePath,
      JSON.stringify({ x: 1800, y: 900, width: 600, height: 400, isMaximized: false }),
    );
    expect(loadWindowState(filePath, displays)).toEqual({
      x: 1800,
      y: 900,
      width: 600,
      height: 400,
      isMaximized: false,
    });
  });

  it('writes the complete supplied state as JSON', () => {
    const state = { x: 30, y: 40, width: 900, height: 650, isMaximized: true };
    expect(saveWindowState(filePath, state)).toBe(true);
    expect(JSON.parse(readFileSync(filePath, 'utf8'))).toEqual(state);
  });

  it('returns false instead of throwing when writing fails', () => {
    expect(() => saveWindowState(directory, DEFAULT_WINDOW_STATE)).not.toThrow();
    expect(saveWindowState(directory, DEFAULT_WINDOW_STATE)).toBe(false);
  });
});
