export interface DocumentPayload {
  filePath: string;
  fileName: string;
  content: string;
  documentId: string;
}

export const IPC = {
  selectDocument: 'document:select',
  openedDocument: 'document:opened',
  rendererReady: 'renderer:ready',
  openExternal: 'navigation:open-external',
  copyText: 'clipboard:copy-text',
} as const;
