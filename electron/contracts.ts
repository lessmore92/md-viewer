export interface DocumentPayload {
  filePath: string;
  fileName: string;
  content: string;
  documentId: string;
}

export const IPC = {
  selectDocument: 'document:select',
  openedDocument: 'document:opened',
  openExternal: 'navigation:open-external',
} as const;
