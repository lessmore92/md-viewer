import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
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
  const content = await readFile(resolvedFilePath, 'utf8');
  const documentId = randomUUID();

  documentRoots.set(documentId, path.dirname(resolvedFilePath));

  return {
    filePath: resolvedFilePath,
    fileName: path.basename(resolvedFilePath),
    content,
    documentId,
  };
}

export function resolveDocumentAsset(documentId: string, relativePath: string): string {
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
  const relativeToRoot = path.relative(documentRoot, resolvedPath);

  if (path.isAbsolute(relativeToRoot) || relativeToRoot.startsWith('..')) {
    throw new Error('Asset path is outside the active document root.');
  }

  return resolvedPath;
}
