import { describe, expect, it } from 'vitest';

import { DocumentCapabilities, MyDocumentListQuery, documentEndpoints } from '../documents.js';

describe('documents contract extensions (COM-07)', () => {
  it('explains why a document cannot be downloaded', () => {
    expect(
      DocumentCapabilities.parse({ canDownload: false, canUploadVersion: false, canCreateRedactedCopy: false, downloadBlockedReason: 'sealed' }),
    ).toMatchObject({ downloadBlockedReason: 'sealed' });
    expect(DocumentCapabilities.safeParse({ canDownload: true, canUploadVersion: true, canCreateRedactedCopy: true }).success).toBe(true);
  });

  it('parses the personal document list filters', () => {
    expect(MyDocumentListQuery.parse({ classification: 'public', redactedCopy: 'true', tenantId: '2', sort: 'title' })).toMatchObject({
      classification: ['public'],
      redactedCopy: true,
      tenantId: 2,
      sort: 'title',
    });
  });

  it('keeps the personal list tenant-exempt (DD-21)', () => {
    expect(documentEndpoints.listMyDocuments).toMatchObject({ audience: 'me', method: 'GET' });
    expect(documentEndpoints.listMyDocuments.permission).toBeUndefined();
  });
});
