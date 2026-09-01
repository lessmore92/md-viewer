// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { findMarkdownArgument } from '../../electron/file-arguments';

describe('findMarkdownArgument', () => {
  it('returns the first Markdown file argument', () => {
    expect(findMarkdownArgument(['electron.exe', 'app', 'C:\\docs\\README.markdown'])).toBe(
      'C:\\docs\\README.markdown',
    );
  });

  it('ignores Electron options when no Markdown file is present', () => {
    expect(findMarkdownArgument(['electron.exe', 'app', '--inspect=9229'])).toBeNull();
  });
});
