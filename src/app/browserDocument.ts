import type { DocumentPayload } from '../../electron/contracts';

export const browserDocumentStorageKey = 'md-viewer-document-v1';
const maxBytes = 5 * 1024 * 1024;
export const acceptedFiles = '.md,.markdown,.mdown,.mkd,.txt';

export function readBrowserFile(file: File): Promise<DocumentPayload> {
  if (!/\.(md|markdown|mdown|mkd|txt)$/i.test(file.name)) {
    return Promise.reject(new Error('یک فایل متنی با پسوند Markdown یا TXT انتخاب کنید.'));
  }
  if (file.size > maxBytes) {
    return Promise.reject(new Error('حجم فایل باید کمتر از ۵ مگابایت باشد.'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve({
          fileName: file.name,
          filePath: '',
          // This is a render identity, not a security token. HTTP previews may
          // lack randomUUID even though reading local files is supported.
          documentId:
            globalThis.crypto?.randomUUID?.() ??
            `web-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          content: String(reader.result ?? ''),
        });
      } catch {
        reject(new Error('خواندن فایل ممکن نشد. دوباره انتخابش کنید.'));
      }
    };
    reader.onerror = () => reject(new Error('خواندن فایل ممکن نشد. دوباره انتخابش کنید.'));
    reader.onabort = () => reject(new Error('خواندن فایل متوقف شد. دوباره تلاش کنید.'));
    reader.readAsText(file);
  });
}

export function downloadDocument(fileName: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Defer revocation so the click-triggered download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function restoreBrowserDocument(): DocumentPayload | null {
  try {
    const value = JSON.parse(localStorage.getItem(browserDocumentStorageKey) ?? 'null');
    if (
      value &&
      typeof value.fileName === 'string' &&
      typeof value.content === 'string' &&
      value.content.length <= maxBytes &&
      typeof value.documentId === 'string'
    ) {
      return {
        fileName: value.fileName,
        content: value.content,
        documentId: value.documentId,
        filePath: '',
      };
    }
  } catch {
    /* A saved document is optional. */
  }
  return null;
}

export function saveBrowserDocument(doc: DocumentPayload | null): boolean {
  try {
    if (doc) localStorage.setItem(browserDocumentStorageKey, JSON.stringify(doc));
    else localStorage.removeItem(browserDocumentStorageKey);
    return true;
  } catch {
    return false;
  }
}
