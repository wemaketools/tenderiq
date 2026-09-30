/**
 * Publication fixtures: `publications` rows per tender version and channel, and the `integration_exceptions`
 * raised by external notice failures (BUY-14; FR-08; AC-33; DD-15, DD-17).
 *
 * Ids: publication `tender * 100 + version * 10 + channel` (1 = portal, 2 = external notice).
 * - T-2026-0002 version 2 (addendum 1): the external Gazette notice FAILED and its exception is open, so the
 *   event is visibly "not advertised" for the current version (AC-33).
 * - T-2026-0001 version 1: a late confirmation that was reconciled manually (a closed exception).
 * - T-2026-0011 (ODC) version 2 (addendum 1): the external notice awaits confirmation.
 * Publication dates are the version issue dates of the tender fixtures (the release, then each addendum).
 * - T-2026-0013 (ODC): both channels are scheduled.
 */
import type { IntegrationExceptionsStatus, PublicationsChannel, PublicationsStatus } from '../../../contracts/enums.js';
import { TENANT_IDS } from '../platform.js';
import { TENDERS } from './tenders.js';

export const EXTERNAL_CHANNEL_NAME = 'Botswana Government Gazette e-Notices';

export interface FixturePublication {
  readonly id: number;
  readonly tenantId: number;
  readonly tenderId: number;
  readonly versionNo: number;
  readonly channel: PublicationsChannel;
  readonly status: PublicationsStatus;
  readonly scheduledAt: string | null;
  readonly publishedAt: string | null;
  readonly externalReference: string | null;
  readonly confirmationReceivedAt: string | null;
  readonly failureReason: string | null;
  readonly reconciled: boolean;
  readonly exceptionId: number | null;
  readonly updatedAt: string;
}

export interface FixtureIntegrationException {
  readonly id: number;
  readonly tenantId: number;
  readonly recordId: number;
  readonly description: string;
  readonly status: IntegrationExceptionsStatus;
  readonly ownerUserId: number | null;
  readonly openedAt: string;
  readonly resolvedAt: string | null;
  readonly resolution: string | null;
  readonly taskId: number | null;
}

const KWU = TENANT_IDS.kwu;
const ODC = TENANT_IDS.odc;

/** When a version was issued (the release or its addendum), from the tender fixtures. */
function issuedAt(tenderId: number, versionNo: number): string {
  const version = TENDERS.find((tender) => tender.id === tenderId)?.versions.find((entry) => entry.versionNo === versionNo);
  if (version === undefined) {
    throw new Error(`T-2026-${String(tenderId).padStart(4, '0')} has no version ${versionNo}.`);
  }
  return version.issuedAt;
}

/** The external notice goes out two minutes after the portal publication. */
function sentAt(tenderId: number, versionNo: number): string {
  return new Date(Date.parse(issuedAt(tenderId, versionNo)) + 2 * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function portal(tenantId: number, tenderId: number, versionNo: number): FixturePublication {
  const publishedAt = issuedAt(tenderId, versionNo);
  return {
    id: tenderId * 100 + versionNo * 10 + 1,
    tenantId,
    tenderId,
    versionNo,
    channel: 'portal',
    status: 'published',
    scheduledAt: null,
    publishedAt,
    externalReference: null,
    confirmationReceivedAt: null,
    failureReason: null,
    reconciled: true,
    exceptionId: null,
    updatedAt: publishedAt,
  };
}

function confirmedExternal(
  tenantId: number,
  tenderId: number,
  versionNo: number,
  externalReference: string,
  confirmationReceivedAt: string,
  exceptionId: number | null = null,
): FixturePublication {
  const publishedAt = sentAt(tenderId, versionNo);
  return {
    id: tenderId * 100 + versionNo * 10 + 2,
    tenantId,
    tenderId,
    versionNo,
    channel: 'external_notice',
    status: 'confirmed',
    scheduledAt: null,
    publishedAt,
    externalReference,
    confirmationReceivedAt,
    failureReason: null,
    reconciled: true,
    exceptionId,
    updatedAt: confirmationReceivedAt,
  };
}

export const PUBLICATIONS: readonly FixturePublication[] = Object.freeze([
  portal(KWU, 1, 1),
  confirmedExternal(KWU, 1, 1, 'BGG-2026-06-0021', '2026-06-15T19:40:00Z', 902),
  portal(KWU, 1, 2),
  confirmedExternal(KWU, 1, 2, 'BGG-2026-07-0044', '2026-07-03T13:10:00Z'),
  portal(KWU, 2, 1),
  confirmedExternal(KWU, 2, 1, 'BGG-2026-09-0032', '2026-09-15T09:15:00Z'),
  portal(KWU, 2, 2),
  {
    id: 222,
    tenantId: KWU,
    tenderId: 2,
    versionNo: 2,
    channel: 'external_notice',
    status: 'failed',
    scheduledAt: null,
    publishedAt: null,
    externalReference: null,
    confirmationReceivedAt: null,
    failureReason: 'The Gazette gateway rejected the notice: the attached addendum exceeds the 5 MB limit (HTTP 413).',
    reconciled: false,
    exceptionId: 901,
    updatedAt: '2026-09-24T08:04:00Z',
  },
  portal(KWU, 3, 1),
  confirmedExternal(KWU, 3, 1, 'BGG-2026-07-0388', '2026-07-20T15:20:00Z'),
  portal(KWU, 3, 2),
  confirmedExternal(KWU, 3, 2, 'BGG-2026-08-0102', '2026-08-05T15:00:00Z'),
  portal(KWU, 4, 1),
  portal(KWU, 6, 1),
  portal(KWU, 7, 1),
  confirmedExternal(KWU, 7, 1, 'BGG-2026-05-0502', '2026-05-11T14:45:00Z'),
  portal(KWU, 8, 1),
  confirmedExternal(KWU, 8, 1, 'BGG-2026-08-0671', '2026-08-24T16:05:00Z'),
  portal(KWU, 9, 1),
  portal(KWU, 10, 1),
  confirmedExternal(KWU, 10, 1, 'BGG-2026-01-0197', '2026-01-12T12:30:00Z'),
  portal(ODC, 11, 1),
  confirmedExternal(ODC, 11, 1, 'BGG-2026-09-0415', '2026-09-16T14:20:00Z'),
  portal(ODC, 11, 2),
  {
    id: 1122,
    tenantId: ODC,
    tenderId: 11,
    versionNo: 2,
    channel: 'external_notice',
    status: 'awaiting_confirmation',
    scheduledAt: null,
    publishedAt: '2026-09-20T07:02:00Z',
    externalReference: null,
    confirmationReceivedAt: null,
    failureReason: null,
    reconciled: false,
    exceptionId: null,
    updatedAt: '2026-09-20T07:02:00Z',
  },
  {
    id: 1311,
    tenantId: ODC,
    tenderId: 13,
    versionNo: 1,
    channel: 'portal',
    status: 'scheduled',
    scheduledAt: '2026-10-20T06:00:00Z',
    publishedAt: null,
    externalReference: null,
    confirmationReceivedAt: null,
    failureReason: null,
    reconciled: false,
    exceptionId: null,
    updatedAt: '2026-09-28T09:30:00Z',
  },
  {
    id: 1312,
    tenantId: ODC,
    tenderId: 13,
    versionNo: 1,
    channel: 'external_notice',
    status: 'scheduled',
    scheduledAt: '2026-10-20T06:00:00Z',
    publishedAt: null,
    externalReference: null,
    confirmationReceivedAt: null,
    failureReason: null,
    reconciled: false,
    exceptionId: null,
    updatedAt: '2026-09-28T09:30:00Z',
  },
] satisfies FixturePublication[]);

export const INTEGRATION_EXCEPTIONS: readonly FixtureIntegrationException[] = Object.freeze([
  {
    id: 901,
    tenantId: KWU,
    recordId: 222,
    description:
      'External publication of T-2026-0002 version 2 (addendum 1) failed at the Government Gazette gateway. The event is not advertised externally for its current version until the notice is republished and reconciled.',
    status: 'open',
    ownerUserId: 5,
    openedAt: '2026-09-24T08:04:00Z',
    resolvedAt: null,
    resolution: null,
    // The reconciliation task of tebogo.officer (fixtures/tasks.ts; linked only once the tasks fixtures hold it).
    taskId: 190,
  },
  {
    id: 902,
    tenantId: KWU,
    recordId: 112,
    description: 'The Gazette confirmation for T-2026-0001 version 1 arrived 12 hours late and was not matched automatically.',
    status: 'reconciled',
    ownerUserId: 5,
    openedAt: '2026-06-15T19:00:00Z',
    resolvedAt: '2026-06-16T07:30:00Z',
    resolution: 'Confirmation BGG-2026-06-0021 checked against published version 1 and reconciled by the tender owner.',
    taskId: null,
  },
] satisfies FixtureIntegrationException[]);
