// @vitest-environment node

import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  isMarkdownPath,
  readMarkdownDocument,
  resolveDocumentAsset,
} from '../../electron/document-service';

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'md-viewer-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('isMarkdownPath', () => {
  it('accepts all configured markdown extensions case-insensitively', () => {
    for (const name of ['a.md', 'a.markdown', 'a.mdown', 'a.MKD']) {
      expect(isMarkdownPath(name)).toBe(true);
    }
  });

  it.each(['README', 'notes.txt', 'archive.md.exe'])('rejects non-Markdown path %s', (name) => {
    expect(isMarkdownPath(name)).toBe(false);
  });
});

describe('readMarkdownDocument', () => {
  it('reads UTF-8 asynchronously and returns an opaque document identifier', async () => {
    const directory = await createTemporaryDirectory();
    const filePath = path.join(directory, 'راهنما.MD');
    await writeFile(filePath, '# سلام 👋', 'utf8');

    const pendingDocument = readMarkdownDocument(filePath);
    expect(pendingDocument).toBeInstanceOf(Promise);

    const document = await pendingDocument;
    expect(document).toMatchObject({
      filePath: path.resolve(filePath),
      fileName: 'راهنما.MD',
      content: '# سلام 👋',
    });
    expect(document.documentId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(document.documentId).not.toBe(directory);
  });

  it('rejects a non-Markdown extension before attempting to read the file', async () => {
    const missingTextFile = path.join(tmpdir(), 'missing-md-viewer-document.txt');

    await expect(readMarkdownDocument(missingTextFile)).rejects.toThrow(/markdown/i);
  });
});

describe('resolveDocumentAsset', () => {
  it('resolves decoded relative assets against the stored document root', async () => {
    const directory = await createTemporaryDirectory();
    const filePath = path.join(directory, 'README.md');
    const assetPath = path.join(directory, 'images', 'diagram.png');
    await mkdir(path.dirname(assetPath));
    await writeFile(filePath, '# Assets', 'utf8');
    await writeFile(assetPath, 'image', 'utf8');
    const document = await readMarkdownDocument(filePath);

    await expect(resolveDocumentAsset(document.documentId, 'images%2Fdiagram.png')).resolves.toBe(
      path.resolve(directory, 'images', 'diagram.png'),
    );
  });

  it('rejects asset traversal outside the active document root', async () => {
    const directory = await createTemporaryDirectory();
    const filePath = path.join(directory, 'README.md');
    await writeFile(filePath, '# Assets', 'utf8');
    const { documentId } = await readMarkdownDocument(filePath);

    await expect(resolveDocumentAsset(documentId, '..\\secret.txt')).rejects.toThrow(/outside/i);
  });

  it.each(['C:\\secret.txt', '/etc/passwd', '%2e%2e%5csecret.txt'])(
    'rejects absolute or encoded traversal asset path %s',
    async (relativePath) => {
      await expect(resolveDocumentAsset('unknown-document', relativePath)).rejects.toThrow(
        /outside/i,
      );
    },
  );

  it('rejects an unknown document identifier', async () => {
    await expect(resolveDocumentAsset('unknown-document', 'image.png')).rejects.toThrow(/unknown/i);
  });

  it('rejects an in-root link whose target is outside the canonical document root', async ({
    skip,
  }) => {
    const directory = await createTemporaryDirectory();
    const outsideDirectory = await createTemporaryDirectory();
    const filePath = path.join(directory, 'README.md');
    const outsideAsset = path.join(outsideDirectory, 'secret.txt');
    const linkedDirectory = path.join(directory, 'linked-assets');
    await writeFile(filePath, '# Assets', 'utf8');
    await writeFile(outsideAsset, 'secret', 'utf8');

    try {
      await symlink(
        outsideDirectory,
        linkedDirectory,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        ['EACCES', 'EPERM', 'ENOTSUP'].includes(String(error.code))
      ) {
        skip();
        return;
      }
      throw error;
    }

    const { documentId } = await readMarkdownDocument(filePath);

    await expect(resolveDocumentAsset(documentId, 'linked-assets/secret.txt')).rejects.toThrow(
      /outside/i,
    );
  });
});
