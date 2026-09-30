/**
 * Evidence sharing and formal submissions of the supplier libraries (`evidence_shares`, `evidence_submissions`;
 * SUP-05, FR-02, BR-25, AC-08, AC-09). The items themselves live in `evidence-items.ts` (the single source).
 *
 * - Submissions are NOT invented here: they are the formal submissions the other domains already record, so SUP-05
 *   ("where each edition was formally submitted"), the qualification screens and the bid receipts agree:
 *   - qualification applications: every evidence citation of a submitted (non-draft) application, plus evidence
 *     supplied in answer to an information request (qualification fixtures, `evidenceSubmissionId`);
 *   - bid revisions: every evidence snapshot of a submitted bid revision (bids fixtures, `evidenceSubmissionId`).
 *   Submission ids are the ids those domains use.
 * - Shares are per edition and per buyer. A lineage is shared with each buyer it was submitted to, from the first
 *   edition submitted there: replacing an edition moves the share to the new edition (the older share is withdrawn at
 *   the replacement). Withdrawing a share only stops FUTURE sharing: earlier submissions stay in the buyer's record
 *   (Tsodilo withdrew its environmental policy from KWU on 1 Aug 2026; QA-2026-0002 and QA-2026-0004 still show it).
 */
import type { EvidenceSubmissionsContextType } from '../../../contracts/enums.js';
import { BID_TENDERS } from '../bids/catalog.js';
import { BIDS, BID_EVIDENCE, BID_REVISIONS } from '../bids/responses.js';
import { TENANT_IDS } from '../platform.js';
import { QUALIFICATION_ANSWERS, QUALIFICATION_APPLICATIONS, QUALIFICATION_INFO_REQUESTS } from '../qualification/applications.js';
import { QUALIFICATION_PROGRAMS as QUALIFICATION_PROGRAM_DEFINITIONS, QUALIFICATION_PROGRAM_VERSIONS } from '../qualification/programs.js';
import { EVIDENCE_ITEMS } from './evidence-items.js';
import type { FixtureEvidenceItem } from './evidence-items.js';

export * from './evidence-items.js';

export interface FixtureEvidenceShare {
  readonly id: number;
  readonly tenantId: number;
  readonly evidenceItemId: number;
  readonly buyerTenantId: number;
  readonly sharedAt: string;
  readonly sharedByUserId: number;
  readonly withdrawnAt: string | null;
  readonly withdrawnByUserId: number | null;
}

export interface FixtureEvidenceSubmission {
  readonly id: number;
  /** Buyer tenant that owns the procurement record (DD-12). */
  readonly tenantId: number;
  readonly supplierTenantId: number;
  readonly evidenceItemId: number;
  readonly contextType: EvidenceSubmissionsContextType;
  readonly contextId: number;
  readonly contextReference: string;
  readonly contextTitle: string;
  readonly submittedAt: string;
}

// ---------------------------------------------------------------------------------------------------------
// Formal submissions (from the qualification and bids records)
// ---------------------------------------------------------------------------------------------------------

function programNameOf(programVersionId: number): string {
  const version = QUALIFICATION_PROGRAM_VERSIONS.find((candidate) => candidate.id === programVersionId);
  const program = version === undefined ? undefined : QUALIFICATION_PROGRAM_DEFINITIONS.find((candidate) => candidate.id === version.programId);
  if (program === undefined) {
    throw new Error(`No qualification program for version ${programVersionId}.`);
  }
  return program.name;
}

function qualificationSubmissions(): FixtureEvidenceSubmission[] {
  const rows: FixtureEvidenceSubmission[] = [];
  for (const application of QUALIFICATION_APPLICATIONS) {
    if (application.submittedAt === null || application.reference === null) {
      continue;
    }
    const context = {
      tenantId: application.tenantId,
      supplierTenantId: application.supplierTenantId,
      contextType: 'qualification_application' as const,
      contextId: application.id,
      contextReference: application.reference,
      contextTitle: `Qualification application — ${programNameOf(application.programVersionId)}`,
    };
    const citations = [
      ...QUALIFICATION_ANSWERS.filter((answer) => answer.applicationId === application.id).flatMap((answer) => answer.evidence),
      ...QUALIFICATION_INFO_REQUESTS.filter((request) => request.applicationId === application.id).flatMap((request) => request.responseEvidence),
    ];
    const seen = new Set<number>();
    for (const citation of citations) {
      if (seen.has(citation.evidenceItemId)) {
        continue;
      }
      seen.add(citation.evidenceItemId);
      rows.push({ id: citation.evidenceSubmissionId, ...context, evidenceItemId: citation.evidenceItemId, submittedAt: citation.submittedAt });
    }
  }
  return rows;
}

function bidSubmissions(): FixtureEvidenceSubmission[] {
  return BID_EVIDENCE.flatMap((snapshot) => {
    const revision = BID_REVISIONS.find((candidate) => candidate.id === snapshot.revisionId);
    const bid = revision === undefined ? undefined : BIDS.find((candidate) => candidate.id === revision.bidId);
    const tender = bid === undefined ? undefined : BID_TENDERS.find((candidate) => candidate.id === bid.tenderId);
    if (snapshot.evidenceSubmissionId === null || revision?.submittedAt === null || revision === undefined || bid === undefined || tender === undefined) {
      return [];
    }
    return [
      {
        id: snapshot.evidenceSubmissionId,
        tenantId: bid.buyerTenantId,
        supplierTenantId: bid.supplierTenantId,
        evidenceItemId: snapshot.evidenceItemId,
        contextType: 'bid_revision' as const,
        contextId: revision.id,
        contextReference: tender.reference,
        contextTitle: `${tender.title} — response revision ${revision.revisionNo}`,
        submittedAt: revision.submittedAt,
      },
    ];
  });
}

export const EVIDENCE_SUBMISSIONS: readonly FixtureEvidenceSubmission[] = Object.freeze(
  [...qualificationSubmissions(), ...bidSubmissions()].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt) || a.id - b.id),
);

// ---------------------------------------------------------------------------------------------------------
// Shares
// ---------------------------------------------------------------------------------------------------------

const KWU = TENANT_IDS.kwu;
const ODC = TENANT_IDS.odc;

/** The supplier administrator who manages sharing (Makgadikgadi and Limpopo have only an administrator). */
const SHARING_ADMIN: Readonly<Record<number, number>> = { 4: 24, 5: 28, 6: 40, 7: 32, 8: 41, 9: 36 };

/** Library items shared without a formal submission yet (the supplier chose to share them ahead of a request). */
const EXTRA_SHARES: readonly (readonly [itemId: number, buyerTenantId: number])[] = [
  [417, KWU],
  [417, ODC],
  [418, KWU],
  [419, ODC],
  [915, KWU],
];

/** Shares the supplier withdrew for the future (submissions already made stay in the buyer's record). */
const WITHDRAWN_SHARES: readonly { readonly itemId: number; readonly buyerTenantId: number; readonly at: string; readonly byUserId: number }[] = [
  { itemId: 408, buyerTenantId: KWU, at: '2026-08-01T07:40:00Z', byUserId: 24 },
];

const itemsById = new Map(EVIDENCE_ITEMS.map((item) => [item.id, item]));

function lineageFrom(item: FixtureEvidenceItem): FixtureEvidenceItem[] {
  const chain = [item];
  let cursor = item;
  while (cursor.replacedById !== null) {
    const next = itemsById.get(cursor.replacedById);
    if (next === undefined) {
      break;
    }
    chain.push(next);
    cursor = next;
  }
  return chain;
}

function adminOf(tenantId: number): number {
  const admin = SHARING_ADMIN[tenantId];
  if (admin === undefined) {
    throw new Error(`No sharing administrator for supplier ${tenantId}.`);
  }
  return admin;
}

function buildShares(): FixtureEvidenceShare[] {
  /** The earliest edition of each lineage shared with each buyer. */
  const starts = new Map<string, FixtureEvidenceItem>();
  const note = (item: FixtureEvidenceItem, buyerTenantId: number) => {
    const key = `${item.tenantId}:${buyerTenantId}`;
    const lineageKey = `${key}:${rootOf(item).id}`;
    const existing = starts.get(lineageKey);
    if (existing === undefined || item.editionNo < existing.editionNo) {
      starts.set(lineageKey, item);
    }
  };
  for (const submission of EVIDENCE_SUBMISSIONS) {
    const item = itemsById.get(submission.evidenceItemId);
    if (item !== undefined) {
      note(item, submission.tenantId);
    }
  }
  for (const [itemId, buyerTenantId] of EXTRA_SHARES) {
    const item = itemsById.get(itemId);
    if (item !== undefined) {
      note(item, buyerTenantId);
    }
  }
  const shares: Omit<FixtureEvidenceShare, 'id'>[] = [];
  for (const [key, start] of starts) {
    const buyerTenantId = Number(key.split(':')[1]);
    const lineage = lineageFrom(start);
    lineage.forEach((edition, index) => {
      const next = lineage[index + 1];
      const explicit = WITHDRAWN_SHARES.find((row) => row.itemId === edition.id && row.buyerTenantId === buyerTenantId);
      const withdrawnAt =
        next !== undefined ? next.createdAt : explicit !== undefined ? explicit.at : edition.status === 'withdrawn' ? edition.updatedAt : null;
      const withdrawnByUserId =
        next !== undefined ? next.createdByUserId : explicit !== undefined ? explicit.byUserId : withdrawnAt !== null ? adminOf(edition.tenantId) : null;
      shares.push({
        tenantId: edition.tenantId,
        evidenceItemId: edition.id,
        buyerTenantId,
        sharedAt: edition.createdAt,
        sharedByUserId: adminOf(edition.tenantId),
        withdrawnAt,
        withdrawnByUserId,
      });
    });
  }
  return shares
    .sort((a, b) => a.tenantId - b.tenantId || a.buyerTenantId - b.buyerTenantId || a.evidenceItemId - b.evidenceItemId)
    .map((share, index) => ({ id: index + 1, ...share }));
}

function rootOf(item: FixtureEvidenceItem): FixtureEvidenceItem {
  let root = item;
  while (root.replacesId !== null) {
    const previous = itemsById.get(root.replacesId);
    if (previous === undefined) {
      break;
    }
    root = previous;
  }
  return root;
}

export const EVIDENCE_SHARES: readonly FixtureEvidenceShare[] = Object.freeze(buildShares());

