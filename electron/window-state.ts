import { readFileSync, writeFileSync } from 'node:fs';

export interface WindowBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface WindowState {
  readonly x?: number;
  readonly y?: number;
  readonly width: number;
  readonly height: number;
  readonly isMaximized: boolean;
}

export type WindowStateEvent = 'maximize' | 'unmaximize' | 'minimize';

export interface WindowStateTracker {
  record(event: WindowStateEvent, isFullScreen: boolean): void;
  isMaximized(): boolean;
}

export const DEFAULT_WINDOW_STATE: WindowState = {
  width: 1200,
  height: 800,
  isMaximized: false,
};

export function createWindowStateTracker(initialIsMaximized: boolean): WindowStateTracker {
  let maximized = initialIsMaximized;

  return {
    record(event, isFullScreen) {
      if (isFullScreen) return;
      if (event === 'maximize') maximized = true;
      if (event === 'unmaximize') maximized = false;
    },
    isMaximized() {
      return maximized;
    },
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function intersectsDisplay(state: WindowBounds, display: WindowBounds): boolean {
  return (
    state.x < display.x + display.width &&
    state.x + state.width > display.x &&
    state.y < display.y + display.height &&
    state.y + state.height > display.y
  );
}

export function loadWindowState(filePath: string, displays: readonly WindowBounds[]): WindowState {
  try {
    const value: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
    if (typeof value !== 'object' || value === null) {
      return DEFAULT_WINDOW_STATE;
    }

    const state = value as Record<string, unknown>;
    if (
      !isFiniteNumber(state.x) ||
      !isFiniteNumber(state.y) ||
      !isFiniteNumber(state.width) ||
      !isFiniteNumber(state.height) ||
      typeof state.isMaximized !== 'boolean' ||
      state.width < 600 ||
      state.height < 400
    ) {
      return DEFAULT_WINDOW_STATE;
    }

    const validState: WindowState & WindowBounds = {
      x: state.x,
      y: state.y,
      width: state.width,
      height: state.height,
      isMaximized: state.isMaximized,
    };

    return displays.some((display) => intersectsDisplay(validState, display))
      ? validState
      : DEFAULT_WINDOW_STATE;
  } catch {
    return DEFAULT_WINDOW_STATE;
  }
}

export function saveWindowState(filePath: string, state: WindowState): boolean {
  try {
    writeFileSync(filePath, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
