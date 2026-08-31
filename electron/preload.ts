import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  getFileName: (filePath: string) => ipcRenderer.invoke('get-file-name', filePath),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  onOpenFile: (callback: (filePath: string) => void) => {
    ipcRenderer.on('open-file', (event, filePath) => callback(filePath));
  },
});
