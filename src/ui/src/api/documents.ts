/**
 * Documents client (the `documents` contract, COM-07 and the document panels). Personal reads span every active
 * membership; panels and uploads use the active tenant.
 */
import {
  confirmBuyerUpload,
  confirmSupplierUpload,
  createBuyerUpload,
  createRedactedCopy,
  createSupplierUpload,
  getDocumentDownloadLink,
  getMyDocument,
  listBuyerDocuments,
  listMyDocumentVersions,
  listMyDocuments,
  listSupplierDocuments,
} from '@contracts/documents';
import type {
  ConfirmUploadBody,
  ConfirmedUpload,
  CreateRedactedCopyBody,
  CreateUploadBody,
  DocumentDetail,
  DocumentPage,
  DocumentVersionList,
  DownloadLink,
  MyDocumentPage,
  RelatedDocumentsQuery,
  UploadEnvelope,
} from '@contracts/documents';
import type { EndpointQuery } from '@contracts/endpoint';

import { call } from './client';

/** Which side of the platform a panel or upload belongs to. */
export type DocumentAudience = 'buyer' | 'supplier';

/** GET /api/v1/me/documents: documents the caller may read. */
export function fetchMyDocuments(
  query: EndpointQuery<typeof listMyDocuments> = {},
): Promise<MyDocumentPage> {
  return call(listMyDocuments, { query });
}

/** GET /api/v1/me/documents/:documentId (COM-07). */
export function fetchMyDocument(documentId: number): Promise<DocumentDetail> {
  return call(getMyDocument, { params: { documentId } });
}

/** GET /api/v1/me/documents/:documentId/versions: the change history, newest first. */
export function fetchDocumentVersions(documentId: number): Promise<DocumentVersionList> {
  return call(listMyDocumentVersions, { params: { documentId } });
}

/** GET /api/v1/me/documents/:documentId/versions/:versionId/download: a short-lived signed URL. */
export function fetchDownloadLink(documentId: number, versionId: number): Promise<DownloadLink> {
  return call(getDocumentDownloadLink, { params: { documentId, versionId } });
}

/** GET /api/v1/{buyer,supplier}/documents: the document panel of one record. */
export function fetchRelatedDocuments(
  audience: DocumentAudience,
  query: RelatedDocumentsQuery,
): Promise<DocumentPage> {
  return audience === 'buyer'
    ? call(listBuyerDocuments, { query })
    : call(listSupplierDocuments, { query });
}

/** POST /api/v1/{buyer,supplier}/documents/uploads (idempotent): a pending version and its upload target. */
export function createUpload(
  audience: DocumentAudience,
  body: CreateUploadBody,
): Promise<UploadEnvelope> {
  return audience === 'buyer'
    ? call(createBuyerUpload, { body })
    : call(createSupplierUpload, { body });
}

/** POST /api/v1/{buyer,supplier}/documents/uploads/:versionId/confirm. */
export function confirmUpload(
  audience: DocumentAudience,
  versionId: number,
  body: ConfirmUploadBody,
): Promise<ConfirmedUpload> {
  const request = { params: { versionId }, body };
  return audience === 'buyer'
    ? call(confirmBuyerUpload, request)
    : call(confirmSupplierUpload, request);
}

/** POST /api/v1/buyer/documents/:documentId/redacted-copies (idempotent): a wider-audience disclosure copy. */
export function registerRedactedCopy(
  documentId: number,
  body: CreateRedactedCopyBody,
): Promise<UploadEnvelope> {
  return call(createRedactedCopy, { params: { documentId }, body });
}
