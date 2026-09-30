/**
 * Prototype storage (Stage A only): what `me.documents.download` hands to the browser in place of a storage signed
 * URL. The prototype stores no files, so the link returns an honestly labelled "prototype copy": a small JSON file
 * naming the document, the exact version, its SHA-256 digest and classification, and saying that the original file
 * is not held by the prototype. Stage B replaces the link with a Supabase Storage signed URL; this endpoint is not
 * part of the contracts catalog.
 *
 * The link is self-authorizing (the browser opens it without the bearer token, like a signed URL): the token names
 * the document, version, persona and expiry and carries a digest over them. Opening it re-checks the persona's
 * access, so sealed and restricted versions are refused with the same 403 as the link request.
 */
import { z } from 'zod';

import { Id, Instant } from '../../../contracts/common.js';
import { DocumentsClassification } from '../../../contracts/enums.js';
import { defineEndpoint } from '../../../contracts/endpoint.js';
import { digest } from '../../fixtures/approvals/world.js';
import type { FixtureDocument, FixtureDocumentVersion } from '../../fixtures/documents.js';
import { findFixtureDocument } from '../../fixtures/documents.js';
import { findPersonaById, organizationLabel } from '../../persona.js';
import { downloadBlock, personaGrant } from './access.js';

/** How long a prototype download link stays valid (as a storage signed URL would). */
export const PROTOTYPE_LINK_TTL_MS = 5 * 60 * 1000;

/** The content type and file-name suffix of a prototype copy. */
export const PROTOTYPE_COPY_CONTENT_TYPE = 'application/json';
export const PROTOTYPE_COPY_SUFFIX = '.prototype-copy.json';

export const PROTOTYPE_COPY_NOTICE =
  'TenderIQ prototype copy. The prototype does not store document files: this file identifies the exact version you are entitled to download. The original file is served in the production service.';

/** The body of a prototype copy (keys in this order: the file's bytes are computed from it). */
export const PrototypeDocumentCopy = z.object({
  notice: z.string().min(1),
  document: z.object({
    id: Id,
    title: z.string().min(1),
    classification: DocumentsClassification,
    organization: z.string().min(1),
    relatedReference: z.string().nullable(),
  }),
  version: z.object({
    id: Id,
    versionNo: z.number().int().min(1),
    fileName: z.string().min(1),
    contentType: z.string().min(1),
    sizeBytes: z.number().int().min(0),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    createdAt: Instant,
  }),
});
export type PrototypeDocumentCopy = z.infer<typeof PrototypeDocumentCopy>;

export const downloadPrototypeCopy = defineEndpoint({
  id: 'public.prototypeStorage.download',
  method: 'GET',
  path: '/api/v1/public/prototype-storage/documents/:token',
  audience: 'public',
  params: z.object({ token: z.string().regex(/^\d+\.\d+\.\d+\.\d+\.[0-9a-f]{32}$/) }),
  response: PrototypeDocumentCopy,
  errors: ['DOWNLOAD_LINK_INVALID', 'DOWNLOAD_LINK_EXPIRED', 'DOWNLOAD_NOT_PERMITTED'],
  screens: ['COM-07'],
  summary: 'Stage A prototype storage: serves the prototype copy behind a document download link.',
});

/** The prototype copy of one version (deterministic, so the link can announce its size and digest). */
export function prototypeCopy(document: FixtureDocument, version: FixtureDocumentVersion): PrototypeDocumentCopy {
  return {
    notice: PROTOTYPE_COPY_NOTICE,
    document: {
      id: document.id,
      title: document.title,
      classification: document.classification,
      organization: organizationLabel(document.tenantId).tenantName,
      relatedReference: document.relatedReference,
    },
    version: {
      id: version.id,
      versionNo: version.versionNo,
      fileName: version.fileName,
      contentType: version.contentType,
      sizeBytes: version.sizeBytes,
      sha256: version.sha256,
      createdAt: version.createdAt,
    },
  };
}

/** The bytes the browser saves (the JSON the mock API answers with). */
export function prototypeCopyText(copy: PrototypeDocumentCopy): string {
  return JSON.stringify(copy);
}

/** `report.pdf` → `report.prototype-copy.json`. */
export function prototypeCopyFileName(fileName: string): string {
  const stem = fileName.replace(/\.[A-Za-z0-9]+$/, '');
  return `${stem}${PROTOTYPE_COPY_SUFFIX}`;
}

function signature(payload: string): string {
  return digest(`prototype-storage:${payload}`).slice(0, 32);
}

/** A signed token for `userId` to fetch one version until `expiresAtMs`. */
export function issueToken(documentId: number, versionId: number, userId: number, expiresAtMs: number): string {
  const payload = `${documentId}.${versionId}.${userId}.${Math.floor(expiresAtMs / 1000)}`;
  return `${payload}.${signature(payload)}`;
}

export interface TokenClaims {
  readonly documentId: number;
  readonly versionId: number;
  readonly userId: number;
  readonly expiresAtMs: number;
}

/** The claims of a well-signed token, or `null`. */
export function readToken(token: string): TokenClaims | null {
  const parts = token.split('.');
  if (parts.length !== 5) {
    return null;
  }
  const payload = parts.slice(0, 4).join('.');
  if (signature(payload) !== parts[4]) {
    return null;
  }
  const [documentId, versionId, userId, expires] = parts.slice(0, 4).map(Number);
  if (documentId === undefined || versionId === undefined || userId === undefined || expires === undefined) {
    return null;
  }
  return { documentId, versionId, userId, expiresAtMs: expires * 1000 };
}

/** The outcome of opening a link: the copy, or the refusal. */
export type OpenedLink =
  | { readonly ok: true; readonly copy: PrototypeDocumentCopy }
  | { readonly ok: false; readonly status: number; readonly code: string; readonly detail: string };

/** Opens a download link at `nowMs`: verifies the token, the expiry and the holder's access to the file. */
export function openLink(token: string, nowMs: number): OpenedLink {
  const claims = readToken(token);
  const document = claims === null ? undefined : findFixtureDocument(claims.documentId);
  const version = document?.versions.find((candidate) => candidate.id === claims?.versionId);
  const persona = claims === null ? undefined : findPersonaById(claims.userId);
  if (claims === null || document === undefined || version === undefined || persona === undefined) {
    return { ok: false, status: 404, code: 'DOWNLOAD_LINK_INVALID', detail: 'This download link is not valid.' };
  }
  if (claims.expiresAtMs < nowMs) {
    return { ok: false, status: 410, code: 'DOWNLOAD_LINK_EXPIRED', detail: 'This download link has expired; download the document again.' };
  }
  const grant = personaGrant(document, persona);
  const block = grant === null ? 'classification_restricted' : downloadBlock(document, grant);
  if (block !== null || version.uploadStatus !== 'confirmed') {
    return {
      ok: false,
      status: 403,
      code: 'DOWNLOAD_NOT_PERMITTED',
      detail:
        block === 'sealed'
          ? 'Sealed content cannot be downloaded before the authorized opening.'
          : 'Your access to this document does not include the file.',
    };
  }
  return { ok: true, copy: prototypeCopy(document, version) };
}
