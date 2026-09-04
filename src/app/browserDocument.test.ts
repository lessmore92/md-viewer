import { afterEach, expect, it, vi } from 'vitest';
import { documentKey } from './workspace';
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

it('uses the same document key for the same file name and content', () => {
  const first = documentKey({
    fileName: 'note.md',
    filePath: '',
    documentId: 'first',
    content: '# Note',
  });
  const second = documentKey({
    fileName: 'note.md',
    filePath: '',
    documentId: 'second',
    content: '# Note',
  });

  expect(first).toBe(second);
});

it('changes the document key when the content changes', () => {
  const first = documentKey({
    fileName: 'note.md',
    filePath: '',
    documentId: 'first',
    content: '# Note',
  });
  const second = documentKey({
    fileName: 'note.md',
    filePath: '',
    documentId: 'second',
    content: '# Updated',
  });

  expect(first).not.toBe(second);
});
