import type { DocumentPayload } from '../../electron/contracts';
import { createWorkspace, openInWorkspace, readWorkspace, saveWorkspace } from './workspace';
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

export function restoreBrowserDocument(): DocumentPayload | null {
  const workspace = readWorkspace();
  return workspace.tabs.find((tab) => tab.tabId === workspace.activeTabId)?.document ?? null;
}

export function saveBrowserDocument(doc: DocumentPayload | null): boolean {
  const restoreTabs = readWorkspace().restoreTabs;
  const workspace = doc ? openInWorkspace(createWorkspace(restoreTabs), doc) : createWorkspace(restoreTabs);
  return saveWorkspace(workspace);
}
