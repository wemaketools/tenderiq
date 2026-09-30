/**
 * Tender projections the clarifications domain needs (demo storyline: T-2026-0001, 0002, 0003, 0006, 0007, 0008 for
 * `kwu` and T-2026-0011 for `odc`). Nothing here is copied: every fact is DERIVED from the owning fixtures so the
 * domains describe one demo world.
 * - title, status, event type, participation, owner, official zone, current version, lots, requirements and the
 *   tender submission deadline (the current round): the bids domain's tender projections (`bids/catalog.ts`), which
 *   follow the issued addenda of this domain (T-2026-0002 Addendum 1 moved the deadline from 14 to 21 October);
 * - the questions deadline: the tenders domain timetable (`tender_milestones`);
 * - participants and their receipts: the bids fixtures (`BIDS`, `SUBMISSION_RECEIPTS`), plus registered
 *   participants without a response (listed below);
 * - tender documents and session minutes: the documents domain fixtures (published documents only).
 * The cross-fixture consistency test (`fixtures.test.ts`) checks the natural keys against the owners.
 */
import type {
  LotsStage,
  RequirementsTreatment,
  SubmissionReceiptsStatus,
  TendersEventType,
  TendersParticipation,
  TendersStatus,
} from '../../../contracts/enums.js';
import { BIDS, BID_REQUIREMENTS, BID_TENDERS, SUBMISSION_RECEIPTS } from '../bids/index.js';
import type { FixtureBidTender } from '../bids/index.js';
import { DOCUMENTS } from '../documents.js';
import { TENANT_IDS } from '../platform.js';
import { MILESTONES } from '../tenders/timetable.js';

export interface ClarificationLotFixture {
  readonly lotId: number;
  readonly lotNo: number;
  readonly title: string;
  readonly stage: LotsStage;
  /** `lots.submission_deadline`; null = the tender's deadline applies (DD-15). */
  readonly submissionDeadline: string | null;
}

export interface ClarificationRequirementFixture {
  readonly requirementId: number;
  readonly lotId: number | null;
  readonly section: string;
  readonly refCode: string;
  readonly text: string;
  readonly treatment: RequirementsTreatment;
  /** Added by an addendum: listed from that tender version onwards. */
  readonly addedByAddendumId: number | null;
}

export interface ClarificationParticipantFixture {
  readonly supplierTenantId: number;
  readonly hasEffectiveSubmission: boolean;
  readonly effectiveReceiptNo: string | null;
  readonly receivedAt: string | null;
}

export interface ClarificationTenderFixture {
  readonly id: number;
  readonly tenantId: number;
  readonly reference: string;
  readonly title: string;
  readonly status: TendersStatus;
  readonly eventType: TendersEventType;
  readonly participation: TendersParticipation;
  readonly officialTimeZone: string;
  readonly currentVersionNo: number;
  readonly ownerUserId: number;
  /** `tender_milestones(questions_deadline)`. */
  readonly questionsDeadline: string | null;
  /** The tender-level `submission_deadline` milestone (after any issued addendum). */
  readonly submissionDeadline: string | null;
  /** Listed on the public portal (`v_public_tenders`, DD-13). */
  readonly onPublicPortal: boolean;
  readonly lots: readonly ClarificationLotFixture[];
  readonly requirements: readonly ClarificationRequirementFixture[];
  readonly documents: readonly { readonly documentId: number; readonly title: string }[];
  readonly participants: readonly ClarificationParticipantFixture[];
}

/** A submission receipt of the bids domain, reduced to what the clarifications screens show. */
export interface ClarificationReceiptFact {
  readonly receiptNo: string;
  readonly receivedAt: string;
  readonly status: SubmissionReceiptsStatus;
  readonly statusChangedAt: string;
}

/** Receipt statuses that make a submission the supplier's effective one (the bids domain's rule). */
const EFFECTIVE_RECEIPT_STATUSES: readonly SubmissionReceiptsStatus[] = ['received', 'selected_for_evaluation'];

interface TenderSpec {
  readonly id: number;
  readonly onPublicPortal: boolean;
  /** Registered participants (downloaded the documents, registered for a session) without a response. */
  readonly registeredWithoutResponse: readonly number[];
}

const TENDER_SPECS: readonly TenderSpec[] = [
  { id: 1, onPublicPortal: true, registeredWithoutResponse: [] },
  { id: 2, onPublicPortal: true, registeredWithoutResponse: [] },
  { id: 3, onPublicPortal: true, registeredWithoutResponse: [] },
  // Public notices without clarification traffic: PUB-03 links every public notice to its PUB-04 edition, which
  // must resolve to an empty edition rather than a dead link.
  { id: 4, onPublicPortal: true, registeredWithoutResponse: [] },
  { id: 6, onPublicPortal: false, registeredWithoutResponse: [] },
  { id: 7, onPublicPortal: true, registeredWithoutResponse: [] },
  { id: 8, onPublicPortal: true, registeredWithoutResponse: [TENANT_IDS.makgadikgadi] },
  { id: 10, onPublicPortal: true, registeredWithoutResponse: [] },
  { id: 11, onPublicPortal: true, registeredWithoutResponse: [] },
];

function bidTender(tenderId: number): FixtureBidTender {
  const tender = BID_TENDERS.find((row) => row.id === tenderId);
  if (tender === undefined) {
    throw new Error(`The bids fixtures have no tender ${tenderId}.`);
  }
  return tender;
}

/** Every receipt a supplier holds on a tender, oldest first. */
export function supplierReceipts(tenderId: number, supplierTenantId: number): ClarificationReceiptFact[] {
  const bidIds = new Set(BIDS.filter((bid) => bid.tenderId === tenderId && bid.supplierTenantId === supplierTenantId).map((bid) => bid.id));
  return SUBMISSION_RECEIPTS.filter((receipt) => bidIds.has(receipt.bidId))
    .map((receipt) => ({ receiptNo: receipt.receiptNo, receivedAt: receipt.receivedAt, status: receipt.status, statusChangedAt: receipt.statusChangedAt }))
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
}

/** The supplier's effective receipt today (null when it has none). */
export function currentEffectiveReceipt(tenderId: number, supplierTenantId: number): ClarificationReceiptFact | null {
  const effective = supplierReceipts(tenderId, supplierTenantId).filter((receipt) => EFFECTIVE_RECEIPT_STATUSES.includes(receipt.status));
  return effective[effective.length - 1] ?? null;
}

/** The receipt that was effective at an instant (the "prior submission" of an addendum issued then). */
export function effectiveReceiptAt(tenderId: number, supplierTenantId: number, at: string): ClarificationReceiptFact | null {
  const effective = supplierReceipts(tenderId, supplierTenantId).filter(
    (receipt) =>
      receipt.receivedAt <= at &&
      receipt.status !== 'late_rejected' &&
      !((receipt.status === 'superseded' || receipt.status === 'withdrawn') && receipt.statusChangedAt <= at),
  );
  return effective[effective.length - 1] ?? null;
}

/** True when the receipt is still the supplier's effective submission today. */
export function receiptStillEffective(receipt: ClarificationReceiptFact): boolean {
  return EFFECTIVE_RECEIPT_STATUSES.includes(receipt.status);
}

/** An effective receipt the supplier obtained after an instant (a supplement or replacement submitted then). */
export function receiptAfter(tenderId: number, supplierTenantId: number, at: string): ClarificationReceiptFact | null {
  return (
    supplierReceipts(tenderId, supplierTenantId).find((receipt) => receipt.receivedAt > at && EFFECTIVE_RECEIPT_STATUSES.includes(receipt.status)) ??
    null
  );
}

function participantsOf(tender: FixtureBidTender, spec: TenderSpec): ClarificationParticipantFixture[] {
  const suppliers =
    tender.invitedSupplierTenantIds ??
    BIDS.filter((bid) => bid.tenderId === tender.id)
      .sort((a, b) => a.id - b.id)
      .map((bid) => bid.supplierTenantId);
  const ordered = [...new Set([...suppliers, ...spec.registeredWithoutResponse])];
  return ordered.map((supplierTenantId) => {
    const receipt = currentEffectiveReceipt(tender.id, supplierTenantId);
    return {
      supplierTenantId,
      hasEffectiveSubmission: receipt !== null,
      effectiveReceiptNo: receipt?.receiptNo ?? null,
      receivedAt: receipt?.receivedAt ?? null,
    };
  });
}

function questionsDeadlineOf(tenderId: number): string | null {
  return MILESTONES.find((row) => row.tenderId === tenderId && row.lotId === null && row.milestone === 'questions_deadline')?.at ?? null;
}

/** Published documents the documents domain holds for a related record. */
function publishedDocuments(relatedType: 'tender' | 'session', relatedId: number): { documentId: number; title: string }[] {
  return DOCUMENTS.filter((row) => row.relatedType === relatedType && row.relatedId === relatedId && row.status === 'published').map((row) => ({
    documentId: row.id,
    title: row.title,
  }));
}

/** The official minutes documents of a session (documents related to the session, DD-12). */
export function sessionMinutesDocuments(sessionId: number): { documentId: number; title: string }[] {
  return publishedDocuments('session', sessionId);
}

function project(spec: TenderSpec): ClarificationTenderFixture {
  const tender = bidTender(spec.id);
  const round = tender.rounds[tender.rounds.length - 1];
  return {
    id: tender.id,
    tenantId: tender.buyerTenantId,
    reference: tender.reference,
    title: tender.title,
    status: tender.status,
    eventType: tender.eventType,
    participation: tender.participation,
    officialTimeZone: tender.officialTimeZone,
    currentVersionNo: tender.currentVersionNo,
    ownerUserId: tender.ownerUserId,
    questionsDeadline: questionsDeadlineOf(tender.id),
    submissionDeadline: round?.deadline ?? null,
    onPublicPortal: spec.onPublicPortal,
    lots: tender.lots.map((lot) => ({ lotId: lot.id, lotNo: lot.lotNo, title: lot.title, stage: lot.stage, submissionDeadline: lot.deadline })),
    requirements: BID_REQUIREMENTS.filter((row) => row.tenderId === tender.id).map((row) => ({
      requirementId: row.id,
      lotId: row.lotId,
      section: row.section,
      refCode: row.refCode,
      text: row.text,
      treatment: row.treatment,
      // Addendum ids follow tender id × 10 + addendum number (T-2026-0002 Addendum 1 = 21).
      addedByAddendumId: row.addendumNumber === null ? null : tender.id * 10 + row.addendumNumber,
    })),
    documents: publishedDocuments('tender', tender.id),
    participants: participantsOf(tender, spec),
  };
}

export const CLARIFICATION_TENDERS: readonly ClarificationTenderFixture[] = Object.freeze(TENDER_SPECS.map(project));

/** Tender statuses in which the buyer can still amend the tender and suppliers can still ask questions. */
export const AMENDABLE_TENDER_STATUSES: readonly TendersStatus[] = ['ready', 'open'];

export function clarificationTender(tenderId: number): ClarificationTenderFixture | undefined {
  return CLARIFICATION_TENDERS.find((tender) => tender.id === tenderId);
}
