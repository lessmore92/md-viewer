import { randomUUID } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import type { DocumentPayload } from './contracts';

const markdownExtensions = new Set(['.md', '.markdown', '.mdown', '.mkd']);
const documentRoots = new Map<string, string>();

export function isMarkdownPath(filePath: string): boolean {
  return markdownExtensions.has(path.extname(filePath).toLowerCase());
}

export async function readMarkdownDocument(filePath: string): Promise<DocumentPayload> {
  if (!isMarkdownPath(filePath)) {
    throw new Error('Only Markdown documents are supported.');
  }

  const resolvedFilePath = path.resolve(filePath);
  const canonicalFilePath = await realpath(resolvedFilePath);
  const content = await readFile(canonicalFilePath, 'utf8');
  const documentId = randomUUID();

  documentRoots.set(documentId, path.dirname(canonicalFilePath));

  return {
    filePath: resolvedFilePath,
    fileName: path.basename(resolvedFilePath),
    content,
    documentId,
  };
}

export async function resolveDocumentAsset(
  documentId: string,
  relativePath: string,
): Promise<string> {
  let decodedPath: string;

  try {
    decodedPath = decodeURIComponent(relativePath);
  } catch {
    throw new Error('Asset path is invalid.');
  }

  if (
    path.isAbsolute(decodedPath) ||
    path.posix.isAbsolute(decodedPath) ||
    path.win32.isAbsolute(decodedPath)
  ) {
    throw new Error('Asset path is outside the active document root.');
  }

  const normalizedPath = path.normalize(decodedPath.replace(/[\\/]+/g, path.sep));
  if (normalizedPath.startsWith('..')) {
    throw new Error('Asset path is outside the active document root.');
  }

  const documentRoot = documentRoots.get(documentId);
  if (!documentRoot) {
    throw new Error('Unknown document identifier.');
  }

  const resolvedPath = path.resolve(documentRoot, normalizedPath);
  const lexicalRelativeToRoot = path.relative(documentRoot, resolvedPath);

  if (path.isAbsolute(lexicalRelativeToRoot) || lexicalRelativeToRoot.startsWith('..')) {
    throw new Error('Asset path is outside the active document root.');
  }

  const canonicalPath = await realpath(resolvedPath);
  const canonicalRelativeToRoot = path.relative(documentRoot, canonicalPath);

  if (path.isAbsolute(canonicalRelativeToRoot) || canonicalRelativeToRoot.startsWith('..')) {
    throw new Error('Asset path is outside the active document root.');
  }

  return canonicalPath;
}
