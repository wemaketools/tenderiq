import { beforeAll, describe, expect, it } from 'vitest';

import { DocumentDetail, documentEndpoints } from '../../../contracts/documents.js';
import { createHash } from 'node:crypto';

import { RECORDS } from '../../fixtures/approvals/world.js';
import { allPersonas } from '../../persona.js';
import { TEST_NOW, createTestMockApp } from '../../testing/index.js';
import type { TestMockApp } from '../../testing/index.js';
import { register } from './index.js';
import { PROTOTYPE_COPY_NOTICE, issueToken } from './prototype-storage.js';

/** The mock app's clock (link expiry is judged on it). */
const appNowMs = (): number => TEST_NOW.getTime();

const EMAIL = (login: string): string => `${login}@tenderiq.local`;
const HASH = 'c'.repeat(64);

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp({ auth: 'fixture', modules: [{ name: 'documents', register }] });
});

async function open(login: string, documentId: number) {
  return api.callAs(EMAIL(login), documentEndpoints.getMyDocument, { params: { documentId } });
}

describe('documents module', () => {
  it('loads without skipped modules', () => {
    expect(api.failed).toEqual([]);
    expect(api.loaded).toContain('documents');
  });

  it.each(allPersonas().filter((persona) => persona.status === 'active').map((persona) => [persona.email] as const))(
    'serves a contract-valid document list, viewer and history for %s',
    async (email) => {
      const list = await api.callAs(email, documentEndpoints.listMyDocuments, { query: { pageSize: 100 } });
      expect(list.status).toBe(200);
      for (const row of documentEndpoints.listMyDocuments.response.parse(list.body).items) {
        expect((await api.callAs(email, documentEndpoints.getMyDocument, { params: { documentId: row.id } })).status).toBe(200);
        expect((await api.callAs(email, documentEndpoints.listMyDocumentVersions, { params: { documentId: row.id } })).status).toBe(200);
      }
    },
  );
});

describe('COM-07 document viewer', () => {
  it('shows a public document to any signed-in person with its version history, newest first', async () => {
    const detail = DocumentDetail.parse((await open('gaborone-meter.contributor', 201)).body);
    expect(detail.capabilities.canDownload).toBe(true);
    const versions = await api.callAs(EMAIL('gaborone-meter.contributor'), documentEndpoints.listMyDocumentVersions, { params: { documentId: 201 } });
    expect(documentEndpoints.listMyDocumentVersions.response.parse(versions.body).items.map((version) => version.versionNo)).toEqual([2, 1]);
  });

  it('never lets anyone download sealed content, not even its own supplier', async () => {
    const own = DocumentDetail.parse((await open('tsodilo.bidmanager', 206)).body);
    expect(own.capabilities).toMatchObject({ canDownload: false, downloadBlockedReason: 'sealed' });
    const download = await api.callAs(EMAIL('tsodilo.bidmanager'), documentEndpoints.getDocumentDownloadLink, {
      params: { documentId: 206, versionId: 2061 },
    });
    expect(download.status).toBe(403);
    expect(download.body).toMatchObject({ code: 'DOWNLOAD_NOT_PERMITTED' });
  });

  it('gives the organization administrator no access to sealed or restricted documents (AC-15)', async () => {
    expect((await open('admin.kwu', 206)).status).toBe(404);
    expect((await open('admin.kwu', 207)).status).toBe(404);
  });

  it('keeps a competitor away from another supplier’s documents', async () => {
    expect((await open('chobe-pipe.bidmanager', 206)).status).toBe(404);
    expect((await open('chobe-pipe.admin', 223)).status).toBe(404);
    expect((await open('tsodilo.admin', 213)).status).toBe(404);
  });

  it('never shows a supplier draft to the buyer (BR-17)', async () => {
    expect((await open('tebogo.officer', 222)).status).toBe(404);
    expect((await open('serowe-ict.bidmanager', 222)).status).toBe(200);
  });

  it('distinguishes the redacted copy from the controlled original', async () => {
    const copy = DocumentDetail.parse((await open('limpopo-env.admin', 208)).body);
    expect(copy.isRedactedCopy).toBe(true);
    expect(copy.redactedFrom).toBeNull();
    expect((await open('limpopo-env.admin', 207)).status).toBe(404);
    const original = DocumentDetail.parse((await open('boitumelo.chair', 207)).body);
    expect(original.redactedCopies.map((ref) => ref.documentId)).toEqual([208]);
    const copyForBuyer = DocumentDetail.parse((await open('boitumelo.chair', 208)).body);
    expect(copyForBuyer.redactedFrom?.documentId).toBe(207);
  });

  it('shows restricted material to the auditor as metadata without the file', async () => {
    const detail = DocumentDetail.parse((await open('pule.auditor', 207)).body);
    expect(detail.capabilities).toMatchObject({ canDownload: false, downloadBlockedReason: 'classification_restricted' });
  });

  it('issues a download link for a permitted version and refuses an unconfirmed one', async () => {
    const link = await api.callAs(EMAIL('tebogo.officer'), documentEndpoints.getDocumentDownloadLink, { params: { documentId: 201, versionId: 2012 } });
    expect(documentEndpoints.getDocumentDownloadLink.response.parse(link.body)).toMatchObject({
      fileName: 'T-2026-0002-tender-package-v2.prototype-copy.json',
      contentType: 'application/json',
    });
    const pending = await api.callAs(EMAIL('tebogo.officer'), documentEndpoints.getDocumentDownloadLink, { params: { documentId: 220, versionId: 2201 } });
    expect(pending.body).toMatchObject({ code: 'VERSION_NOT_CONFIRMED' });
    const unknown = await api.callAs(EMAIL('tebogo.officer'), documentEndpoints.getDocumentDownloadLink, { params: { documentId: 201, versionId: 9999 } });
    expect(unknown.body).toMatchObject({ code: 'VERSION_NOT_FOUND' });
  });

  it('shows evidence facts: issuer, period, expiry and verification', async () => {
    const detail = DocumentDetail.parse((await open('mpho.manager', 213)).body);
    expect(detail.evidence).toMatchObject({ issuer: 'Botswana Insurance Company Ltd', expiresAt: '2026-10-08', verificationStatus: 'independently_verified' });
    expect(detail.organization.tenantName).toBe('Kalahari Water Utilities (Pilot)');
    expect(detail.ownerTenant.tenantName).toBe('Chobe Pipe & Valve Supplies');
  });

  it('restricts financial evidence to the financial reviewer on the buyer side', async () => {
    expect((await open('lesego.finance', 214)).status).toBe(200);
    expect((await open('neo.assessor', 214)).status).toBe(404);
  });
});

describe('me.documents.list', () => {
  it('filters by classification and redacted copies', async () => {
    const list = await api.callAs(EMAIL('tebogo.officer'), documentEndpoints.listMyDocuments, { query: { redactedCopy: 'true' } });
    expect(documentEndpoints.listMyDocuments.response.parse(list.body).items.map((row) => row.id)).toEqual([208]);
  });

  it('counts only documents the caller may read', async () => {
    const list = await api.callAs(EMAIL('limpopo-env.admin'), documentEndpoints.listMyDocuments, { query: { pageSize: 100 } });
    const page = documentEndpoints.listMyDocuments.response.parse(list.body);
    expect(page.total).toBe(page.items.length);
    expect(page.items.every((row) => row.classification === 'public' || row.classification === 'participating_suppliers')).toBe(true);
  });
});

describe('document panels', () => {
  it('lists a record’s documents for the buyer in precedence order', async () => {
    const list = await api.callAs(EMAIL('tebogo.officer'), documentEndpoints.listBuyerDocuments, {
      tenant: 'kwu',
      query: { relatedType: 'tender', relatedId: '2' },
    });
    expect(documentEndpoints.listBuyerDocuments.response.parse(list.body).items.map((row) => row.id)).toEqual([201, 221, 220]);
  });

  it('lists only documents released to the supplier audience', async () => {
    const invited = await api.callAs(EMAIL('chobe-pipe.bidmanager'), documentEndpoints.listSupplierDocuments, {
      tenant: 'chobe-pipe',
      query: { relatedType: 'tender', relatedId: '6' },
    });
    expect(documentEndpoints.listSupplierDocuments.response.parse(invited.body).items.map((row) => row.id)).toEqual([219]);
    const notInvited = await api.callAs(EMAIL('serowe-ict.bidmanager'), documentEndpoints.listSupplierDocuments, {
      tenant: 'serowe-ict',
      query: { relatedType: 'tender', relatedId: '6' },
    });
    expect(documentEndpoints.listSupplierDocuments.response.parse(notInvited.body).total).toBe(0);
  });

  it('refuses buyer-only record types on the supplier side', async () => {
    const response = await api.callAs(EMAIL('tsodilo.bidmanager'), documentEndpoints.listSupplierDocuments, {
      tenant: 'tsodilo',
      query: { relatedType: 'procurement_request', relatedId: '3' },
    });
    expect(response.body).toMatchObject({ code: 'RELATED_TYPE_NOT_SUPPORTED' });
  });

  it('answers the one identical 403 for another tenant and FORBIDDEN to an operator support grant', async () => {
    const wrongTenant = await api.callAs(EMAIL('tebogo.officer'), documentEndpoints.listBuyerDocuments, {
      tenant: 'odc',
      query: { relatedType: 'tender', relatedId: '11' },
    });
    expect(wrongTenant.body).toMatchObject({ code: 'TENANT_ACCESS_DENIED' });
    const supportGrant = await api.callAs(EMAIL('support.agent'), documentEndpoints.listBuyerDocuments, {
      tenant: 'kwu',
      query: { relatedType: 'tender', relatedId: '2' },
    });
    expect(supportGrant.status).toBe(403);
    expect(supportGrant.body).toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('uploads and redacted copies', () => {
  const upload = {
    relatedType: 'tender',
    relatedId: 2,
    title: 'Clarification annex',
    classification: 'participating_suppliers',
    fileName: 'annex.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1024,
    sha256: HASH,
  } as const;

  it('issues an envelope and confirms the version it issued', async () => {
    const envelope = await api.callAs(EMAIL('tebogo.officer'), documentEndpoints.createBuyerUpload, { tenant: 'kwu', body: upload });
    expect(envelope.status).toBe(201);
    const issued = documentEndpoints.createBuyerUpload.response.parse(envelope.body);
    expect(issued.version.uploadStatus).toBe('pending');
    const confirmed = await api.callAs(EMAIL('tebogo.officer'), documentEndpoints.confirmBuyerUpload, {
      tenant: 'kwu',
      params: { versionId: issued.version.id },
      body: { sha256: HASH, sizeBytes: 1024 },
    });
    expect(documentEndpoints.confirmBuyerUpload.response.parse(confirmed.body)).toMatchObject({
      document: { title: 'Clarification annex' },
      version: { uploadStatus: 'confirmed' },
    });
  });

  it('refuses a confirm whose digest differs from the announced one', async () => {
    const envelope = documentEndpoints.createBuyerUpload.response.parse(
      (await api.callAs(EMAIL('tebogo.officer'), documentEndpoints.createBuyerUpload, { tenant: 'kwu', body: upload })).body,
    );
    const confirmed = await api.callAs(EMAIL('tebogo.officer'), documentEndpoints.confirmBuyerUpload, {
      tenant: 'kwu',
      params: { versionId: envelope.version.id },
      body: { sha256: 'd'.repeat(64), sizeBytes: 1024 },
    });
    expect(confirmed.body).toMatchObject({ code: 'UPLOAD_HASH_MISMATCH' });
  });

  it.each([
    ['UPLOAD_EXPIRED', 2201],
    ['UPLOAD_ALREADY_CONFIRMED', 2011],
    ['UPLOAD_NOT_FOUND', 9_999_999],
  ] as const)('answers %s on confirm', async (code, versionId) => {
    const response = await api.callAs(EMAIL('tebogo.officer'), documentEndpoints.confirmBuyerUpload, {
      tenant: 'kwu',
      params: { versionId },
      body: { sha256: HASH, sizeBytes: 1024 },
    });
    expect(response.body).toMatchObject({ code });
  });

  it('refuses classifications the side may not choose, held records and received revisions', async () => {
    const sealed = await api.callAs(EMAIL('tebogo.officer'), documentEndpoints.createBuyerUpload, {
      tenant: 'kwu',
      body: { ...upload, classification: 'sealed' },
    });
    expect(sealed.body).toMatchObject({ code: 'CLASSIFICATION_NOT_PERMITTED' });
    const held = await api.callAs(EMAIL('masego.contracts'), documentEndpoints.createBuyerUpload, {
      tenant: 'kwu',
      body: { ...upload, relatedType: 'contract', relatedId: RECORDS.c7.id, classification: 'buyer_internal' },
    });
    expect(held.body).toMatchObject({ code: 'HOLD_BLOCKS_ACTION' });
    const received = await api.callAs(EMAIL('tsodilo.bidmanager'), documentEndpoints.createSupplierUpload, {
      tenant: 'tsodilo',
      body: { ...upload, relatedType: 'bid_revision', relatedId: 801, classification: 'supplier_private' },
    });
    expect(received.body).toMatchObject({ code: 'SUBMISSION_ALREADY_RECEIVED' });
  });

  it('refuses a new version of a signed document', async () => {
    const response = await api.callAs(EMAIL('masego.contracts'), documentEndpoints.createBuyerUpload, {
      tenant: 'kwu',
      body: { ...upload, documentId: 209, relatedType: 'contract', relatedId: 1, classification: 'commercially_confidential' },
    });
    expect(response.body).toMatchObject({ code: 'DOCUMENT_NOT_EDITABLE' });
  });

  it('registers a wider-audience redacted copy and refuses sealed or narrower ones', async () => {
    const body = {
      title: 'Evaluation report (public summary)',
      classification: 'public',
      reason: 'Complaint response disclosure',
      fileName: 'summary.pdf',
      contentType: 'application/pdf',
      sizeBytes: 2048,
      sha256: HASH,
    } as const;
    const ok = await api.callAs(EMAIL('tebogo.officer'), documentEndpoints.createRedactedCopy, { tenant: 'kwu', params: { documentId: 207 }, body });
    expect(documentEndpoints.createRedactedCopy.response.parse(ok.body).document).toMatchObject({ isRedactedCopy: true, status: 'redacted' });
    const narrower = await api.callAs(EMAIL('tebogo.officer'), documentEndpoints.createRedactedCopy, {
      tenant: 'kwu',
      params: { documentId: 207 },
      body: { ...body, classification: 'restricted_assessment' },
    });
    expect(narrower.body).toMatchObject({ code: 'CLASSIFICATION_NOT_WIDER' });
    const ofCopy = await api.callAs(EMAIL('tebogo.officer'), documentEndpoints.createRedactedCopy, { tenant: 'kwu', params: { documentId: 208 }, body });
    expect(ofCopy.body).toMatchObject({ code: 'DOCUMENT_IS_REDACTED_COPY' });
  });
});

describe('prototype storage downloads (COM-07: download only when permitted)', () => {
  async function linkFor(login: string, documentId: number, versionId: number) {
    const response = await api.callAs(EMAIL(login), documentEndpoints.getDocumentDownloadLink, { params: { documentId, versionId } });
    return documentEndpoints.getDocumentDownloadLink.response.parse(response.body);
  }

  it('serves the exact version behind the link as an honestly labelled prototype copy, without a bearer token', async () => {
    // Arrange
    const link = await linkFor('kagiso.requester', 204, 2041);

    // Act
    const file = await api.request('GET', link.url);

    // Assert
    expect(link.url).toMatch(/^\/api\/v1\/public\/prototype-storage\/documents\//);
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toContain('application/json');
    expect(file.body).toMatchObject({
      notice: PROTOTYPE_COPY_NOTICE,
      document: { id: 204, classification: 'buyer_internal', relatedReference: 'PR-2026-0003' },
      version: { id: 2041, versionNo: 1, fileName: 'PR-2026-0003-business-case.pdf' },
    });
    expect(link.sizeBytes).toBe(Buffer.byteLength(file.text, 'utf8'));
    expect(link.sha256).toBe(createHash('sha256').update(file.text).digest('hex'));
  });

  it('refuses the file of a sealed or restricted version with the same 403 as the link request', async () => {
    // Arrange: links forged for readers whose access excludes the file (sealed content; auditor on restricted material)
    const expires = appNowMs() + 60_000;
    const sealed = issueToken(206, 2061, 5, expires);
    const restricted = issueToken(207, 2071, 20, expires);

    // Act
    const sealedFile = await api.request('GET', `/api/v1/public/prototype-storage/documents/${sealed}`);
    const restrictedFile = await api.request('GET', `/api/v1/public/prototype-storage/documents/${restricted}`);
    const sealedLink = await api.callAs(EMAIL('tebogo.officer'), documentEndpoints.getDocumentDownloadLink, { params: { documentId: 206, versionId: 2061 } });

    // Assert
    expect(sealedFile.status).toBe(403);
    expect(sealedFile.body).toMatchObject({ code: 'DOWNLOAD_NOT_PERMITTED' });
    expect(restrictedFile.body).toMatchObject({ code: 'DOWNLOAD_NOT_PERMITTED' });
    expect(sealedLink.status).toBe(403);
    expect(sealedLink.body).toMatchObject({ code: 'DOWNLOAD_NOT_PERMITTED', detail: (sealedFile.body as { detail?: string }).detail });
  });

  it('refuses expired and tampered links', async () => {
    const expired = issueToken(201, 2012, 5, appNowMs() - 1_000);
    const valid = issueToken(201, 2012, 5, appNowMs() + 60_000);
    // Change the last digest character to a different hex digit, so the token never stays valid by chance.
    const tampered = `${valid.slice(0, -1)}${valid.endsWith('0') ? '1' : '0'}`;

    const late = await api.request('GET', `/api/v1/public/prototype-storage/documents/${expired}`);
    const forged = await api.request('GET', `/api/v1/public/prototype-storage/documents/${tampered}`);

    expect(late.status).toBe(410);
    expect(late.body).toMatchObject({ code: 'DOWNLOAD_LINK_EXPIRED' });
    expect(forged.body).toMatchObject({ code: expect.stringMatching(/DOWNLOAD_LINK_INVALID|VALIDATION_FAILED/) });
  });
});
