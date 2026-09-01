// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import type { DocumentPayload } from '../../electron/contracts';
import { createDocumentDelivery } from '../../electron/document-delivery';

const document: DocumentPayload = {
  filePath: 'C:\\docs\\README.md',
  fileName: 'README.md',
  content: '# Readme',
  documentId: 'document-id',
};

describe('createDocumentDelivery', () => {
  it('holds a document until renderer readiness and delivers it exactly once', () => {
    const send = vi.fn(() => true);
    const delivery = createDocumentDelivery(send);

    delivery.publish(document);
    expect(send).not.toHaveBeenCalled();

    delivery.markRendererReady();
    delivery.markRendererReady();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(document);
  });
});
