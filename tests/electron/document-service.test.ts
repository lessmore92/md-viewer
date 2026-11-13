// @vitest-environment node

import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  isMarkdownPath,
  readMarkdownDocument,
  resolveDocumentAsset,
  writeMarkdownDocument,
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

describe('writeMarkdownDocument', () => {
  it('writes UTF-8 content to an existing markdown file and keeps the document id', async () => {
    const directory = await createTemporaryDirectory();
    const filePath = path.join(directory, 'notes.md');
    await writeFile(filePath, '# Old', 'utf8');
    const opened = await readMarkdownDocument(filePath);

    const saved = await writeMarkdownDocument(filePath, '# تازه 👋', opened.documentId);

    expect(saved).toMatchObject({
      filePath: path.resolve(filePath),
      fileName: 'notes.md',
      content: '# تازه 👋',
      documentId: opened.documentId,
    });
    expect(await readFile(filePath, 'utf8')).toBe('# تازه 👋');
    // The saved document still resolves assets from its own directory.
    await writeFile(path.join(directory, 'image.png'), 'image', 'utf8');
    await expect(resolveDocumentAsset(saved.documentId, 'image.png')).resolves.toBe(
      await realpath(path.join(directory, 'image.png')),
    );
  });

  it('rejects saving to a non-Markdown path', async () => {
    const filePath = path.join(tmpdir(), 'md-viewer-save.txt');
    await expect(writeMarkdownDocument(filePath, 'x', 'id')).rejects.toThrow(/markdown/i);
  });

  it('rejects saving to a file that does not exist', async () => {
    const filePath = path.join(tmpdir(), 'md-viewer-missing-save.md');
    await expect(writeMarkdownDocument(filePath, 'x', 'id')).rejects.toThrow();
  });

  it('rejects a valid Markdown path that was not opened for the supplied document id', async () => {
    const directory = await createTemporaryDirectory();
    const openedPath = path.join(directory, 'opened.md');
    const otherPath = path.join(directory, 'other.md');
    await writeFile(openedPath, '# Opened', 'utf8');
    await writeFile(otherPath, '# Do not overwrite', 'utf8');
    const opened = await readMarkdownDocument(openedPath);

    await expect(writeMarkdownDocument(otherPath, '# Replaced', opened.documentId)).rejects.toThrow(
      /does not authorize/i,
    );
    await expect(readFile(otherPath, 'utf8')).resolves.toBe('# Do not overwrite');
  });

  it('keeps save capabilities for documents that remain open in other tabs', async () => {
    const directory = await createTemporaryDirectory();
    const firstPath = path.join(directory, 'first.md');
    const secondPath = path.join(directory, 'second.md');
    await writeFile(firstPath, '# First', 'utf8');
    await writeFile(secondPath, '# Second', 'utf8');
    const first = await readMarkdownDocument(firstPath);
    await readMarkdownDocument(secondPath);

    await expect(writeMarkdownDocument(firstPath, '# Saved first', first.documentId)).resolves.toMatchObject({
      documentId: first.documentId,
      content: '# Saved first',
    });
  });
});

describe('resolveDocumentAsset', () => {
  it('revokes the previous document capability when a new document becomes active', async () => {
    const firstDirectory = await createTemporaryDirectory();
    const secondDirectory = await createTemporaryDirectory();
    const firstDocumentPath = path.join(firstDirectory, 'README.md');
    const firstAssetPath = path.join(firstDirectory, 'image.png');
    const secondDocumentPath = path.join(secondDirectory, 'README.md');
    await writeFile(firstDocumentPath, '# First', 'utf8');
    await writeFile(firstAssetPath, 'image', 'utf8');
    await writeFile(secondDocumentPath, '# Second', 'utf8');

    const firstDocument = await readMarkdownDocument(firstDocumentPath);
    await readMarkdownDocument(secondDocumentPath);

    await expect(resolveDocumentAsset(firstDocument.documentId, 'image.png')).rejects.toThrow(
      /unknown/i,
    );
  });

  it('resolves decoded relative assets against the stored document root', async () => {
    const directory = await createTemporaryDirectory();
    const filePath = path.join(directory, 'README.md');
    const assetPath = path.join(directory, 'images', 'diagram.png');
    await mkdir(path.dirname(assetPath));
    await writeFile(filePath, '# Assets', 'utf8');
    await writeFile(assetPath, 'image', 'utf8');
    const document = await readMarkdownDocument(filePath);

    await expect(resolveDocumentAsset(document.documentId, 'images%2Fdiagram.png')).resolves.toBe(
      await realpath(assetPath),
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
