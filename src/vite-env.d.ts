/// <reference types="vite/client" />

interface ElectronAPI {
  openFileDialog: () => Promise<string | null>;
  readFile: (filePath: string) => Promise<{ content: string | null; error: string | null }>;
  getFileName: (filePath: string) => Promise<string>;
  getAppPath: () => Promise<string>;
  onOpenFile: (callback: (filePath: string) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
