import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type DocumentPayload } from './contracts';

contextBridge.exposeInMainWorld('electronAPI', {
  selectDocument: () => ipcRenderer.invoke(IPC.selectDocument),
  openExternal: (url: string) => ipcRenderer.invoke(IPC.openExternal, url),
  copyText: (text: string) => ipcRenderer.invoke(IPC.copyText, text),
  assetUrl: (documentId: string, relativePath: string) => {
    const encodedPath = relativePath.split(/[\\/]/).map(encodeURIComponent).join('/');
    return `md-asset://document/${encodeURIComponent(documentId)}/${encodedPath}`;
  },
  onDocumentOpened: (callback: (document: DocumentPayload) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, document: DocumentPayload) =>
      callback(document);
    ipcRenderer.on(IPC.openedDocument, listener);
    ipcRenderer.send(IPC.rendererReady);
    return () => ipcRenderer.removeListener(IPC.openedDocument, listener);
  },
});
