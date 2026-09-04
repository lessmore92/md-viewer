/// <reference types="vite/client" />

import type { DocumentPayload } from '../electron/contracts';

interface ElectronAPI {
  selectDocument(): Promise<DocumentPayload | null>;
  openExternal(url: string): Promise<boolean>;
  assetUrl(documentId: string, relativePath: string): string;
  onDocumentOpened(callback: (document: DocumentPayload) => void): () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
