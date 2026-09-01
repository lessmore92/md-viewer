// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC, type DocumentPayload } from '../../electron/contracts';

const electron = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  send: vi.fn(),
}));

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: electron.exposeInMainWorld },
  ipcRenderer: {
    invoke: electron.invoke,
    on: electron.on,
    removeListener: electron.removeListener,
    send: electron.send,
  },
}));

await import('../../electron/preload');

interface ExposedAPI {
  selectDocument(): Promise<DocumentPayload | null>;
  openExternal(url: string): Promise<boolean>;
  assetUrl(documentId: string, relativePath: string): string;
  onDocumentOpened(callback: (document: DocumentPayload) => void): () => void;
}

const api = electron.exposeInMainWorld.mock.calls[0][1] as ExposedAPI;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('preload bridge', () => {
  it('signals renderer readiness only after installing the document listener', () => {
    api.onDocumentOpened(vi.fn());

    expect(electron.send).toHaveBeenCalledWith('renderer:ready');
    expect(electron.on.mock.invocationCallOrder[0]).toBeLessThan(
      electron.send.mock.invocationCallOrder[0],
    );
  });

  it('subscribes to document payloads and removes the exact listener during cleanup', () => {
    const callback = vi.fn();
    const cleanup = api.onDocumentOpened(callback);
    const listener = electron.on.mock.calls[0][1] as (
      event: Electron.IpcRendererEvent,
      document: DocumentPayload,
    ) => void;
    const document: DocumentPayload = {
      filePath: 'C:\\docs\\README.md',
      fileName: 'README.md',
      content: '# Readme',
      documentId: 'document-id',
    };

    listener({} as Electron.IpcRendererEvent, document);
    cleanup();

    expect(callback).toHaveBeenCalledWith(document);
    expect(electron.on).toHaveBeenCalledWith(IPC.openedDocument, listener);
    expect(electron.removeListener).toHaveBeenCalledWith(IPC.openedDocument, listener);
  });

  it('encodes document and path components into the asset scheme', () => {
    expect(api.assetUrl('document id', 'images\\a b#c.png')).toBe(
      'md-asset://document/document%20id/images/a%20b%23c.png',
    );
  });

  it('exposes only intent-specific IPC invocations', async () => {
    electron.invoke.mockResolvedValueOnce(null).mockResolvedValueOnce(true);

    await expect(api.selectDocument()).resolves.toBeNull();
    await expect(api.openExternal('https://example.com')).resolves.toBe(true);

    expect(electron.invoke.mock.calls).toEqual([
      [IPC.selectDocument],
      [IPC.openExternal, 'https://example.com'],
    ]);
  });
});
