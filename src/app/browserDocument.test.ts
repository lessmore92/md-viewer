import { afterEach, expect, it, vi } from 'vitest';
import { readBrowserFile, restoreBrowserDocument } from './browserDocument';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

it('can open a file on an HTTP origin without crypto.randomUUID', async () => {
  vi.stubGlobal('crypto', {});
  const result = await readBrowserFile(new File(['# Local'], 'local.md'));
  expect(result.content).toBe('# Local');
  expect(result.documentId).toBeTruthy();
});

it('rejects an oversized file before reading it', async () => {
  const file = new File(['text'], 'large.md');
  Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 + 1 });
  await expect(readBrowserFile(file)).rejects.toThrow('۵ مگابایت');
});

it('ignores malformed saved document data', () => {
  localStorage.setItem('md-viewer-document-v1', '{"content":42,"fileName":"bad.md"}');
  expect(restoreBrowserDocument()).toBeNull();
});
