// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('electron/main.ts', 'utf8');

describe('Electron window state lifecycle integration', () => {
  it('restores and persists normal window bounds and maximized state', () => {
    expect(source).toMatch(/\bscreen\b[\s\S]*?from ['"]electron['"]/);
    expect(source).toMatch(
      /import \{[^}]*\bloadWindowState\b[^}]*\bsaveWindowState\b[^}]*\} from ['"]\.\/window-state['"]/,
    );
    expect(source).toContain("path.join(app.getPath('userData'), 'window-state.json')");
    expect(source).toMatch(
      /loadWindowState\([\s\S]*?screen\.getAllDisplays\(\)\.map\(\(\{ workArea \}\) => workArea\)[\s\S]*?\)/,
    );
    expect(source).toMatch(/const \{ isMaximized, \.\.\.bounds \} = windowState;/);
    expect(source).toMatch(
      /new BrowserWindow\(\{[\s\S]*?\.\.\.bounds,[\s\S]*?minWidth: 600,[\s\S]*?minHeight: 400,/,
    );
    expect(source).toMatch(/if \(isMaximized\) window\.maximize\(\);/);
    expect(source).toMatch(/window\.on\(['"]close['"], \(\) => \{[\s\S]*?saveWindowState\(/);
    expect(source).toMatch(/\.\.\.window\.getNormalBounds\(\)/);
    expect(source).toMatch(/isMaximized: window\.isMaximized\(\)/);
    expect(source).not.toMatch(/\.(?:isFullScreen|setFullScreen)\(/);
  });
});
