// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { writeClipboardText } from '../../electron/clipboard';

describe('writeClipboardText', () => {
  it('writes string values to the system clipboard', () => {
    const writeText = vi.fn();

    expect(writeClipboardText('console.log(1)', writeText)).toBe(true);
    expect(writeText).toHaveBeenCalledWith('console.log(1)');
  });

  it.each([undefined, null, 42, { text: 'unsafe' }])(
    'rejects non-string clipboard value %j',
    (value) => {
      const writeText = vi.fn();

      expect(writeClipboardText(value, writeText)).toBe(false);
      expect(writeText).not.toHaveBeenCalled();
    },
  );
});
