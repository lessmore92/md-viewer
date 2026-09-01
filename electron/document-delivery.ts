import type { DocumentPayload } from './contracts';

interface DocumentDelivery {
  publish(document: DocumentPayload): void;
  markRendererLoading(): void;
  markRendererReady(): void;
}

export function createDocumentDelivery(
  sendDocument: (document: DocumentPayload) => boolean,
): DocumentDelivery {
  let rendererReady = false;
  let pendingDocument: DocumentPayload | null = null;

  return {
    publish(document) {
      if (rendererReady && sendDocument(document)) return;
      pendingDocument = document;
    },
    markRendererLoading() {
      rendererReady = false;
    },
    markRendererReady() {
      rendererReady = true;
      if (pendingDocument && sendDocument(pendingDocument)) pendingDocument = null;
    },
  };
}
