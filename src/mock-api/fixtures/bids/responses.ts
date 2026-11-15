/**
 * Bids fixtures, part 2: the supplier responses of the demo world (docs/plan/demo-storyline.md; AC-03, AC-10..AC-15).
 *
 * Every row carries its supplier tenant (`supplierTenantId`) and the owning buyer tenant (`buyerTenantId`), so the
 * handlers can enforce supplier isolation and buyer tenancy. Content is generated deterministically at module load
 * from the declarative specs below (standard complete content for historical responses, explicit overrides for the
 * responses the scenarios revolve around); nothing is mutated afterwards.
 *
 * Scenario anchors:
 * - Bid 4 (Gaborone Metering, T-2026-0002): revision 1 received; the supplement required by addendum 1 (revision 2)
 *   failed during the 24 Sep service incident, so revision 1 stays effective and no receipt was issued for the
 *   failed attempt (AC-12). The window is still open, so the supplement can be submitted again.
 * - Bid 5 (Chobe, T-2026-0002): a draft; addendum 1 is not acknowledged and its new requirement is unanswered.
 * - Bid 6 (Tsodilo, T-2026-0002): revision 1 superseded by the supplement (revision 2) after addendum 1 (AC-10).
 * - Bid 7 (Serowe ICT, T-2026-0002): approved internally, never submitted, shown as "Not submitted" (AC-11).
 * - Bid 14 (Tsodilo, T-2026-0006): draft with work assigned to the contributor (AC-03), an expired tax certificate,
 *   missing pricing, and an executive approval invalidated by a later pricing change (BR-10).
 * - Bid 15 (Chobe, T-2026-0006): effective receipt plus an internally approved replacement, ready to submit or
 *   withdraw while the window is open (AC-14).
 * - Bid 19 (Chobe, T-2026-0008): its replacement completed 38 s after the deadline and was rejected with the true
 *   time; revision 1 stays effective (AC-13, BR-19).
 * - Bid 20 (Tsodilo, T-2026-0008): withdrawn with confirmation WDR-2026-000001 (AC-14 history).
 */
import { sha256Hex } from '../../sha256.js';

import { mul, round } from '../../../contracts/decimal.js';
import type {
  BidAnswersEnvelope,
  BidAnswersProgress,
  BidDeclarationsDeclarationType,
  BidInternalApprovalsApprovalType,
  BidInternalApprovalsStatus,
  BidPricesPriceStatus,
  BidRevisionsStatus,
  BidsRoundType,
  BidsSubmissionState,
  SubmissionAttemptsOutcome,
  SubmissionReceiptsStatus,
} from '../../../contracts/enums.js';
import { BID_DECLARATIONS_DECLARATION_TYPE } from '../../../contracts/enums.js';
import { PERSONAS, TENANTS, TENANT_IDS } from '../platform.js';
import {
  BID_EVIDENCE_ITEMS,
  BID_PRICE_SCHEDULES,
  BID_REQUIREMENTS,
  BID_TENDERS,
  SUPPLIER_APPROVAL_POLICIES,
} from './catalog.js';
import type { FixtureBidTender, FixtureRequirement } from './catalog.js';

// ---------------------------------------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------------------------------------

export interface FixtureBid {
  readonly id: number;
  readonly supplierTenantId: number;
  readonly buyerTenantId: number;
  readonly tenderId: number;
  readonly roundType: BidsRoundType;
  readonly lotIds: readonly number[];
  readonly isAlternative: boolean;
  readonly isConsortium: boolean;
  readonly leadMemberName: string | null;
  readonly submissionState: BidsSubmissionState;
  readonly bidManagerUserId: number | null;
  readonly createdAt: string;
}

export interface FixtureRevision {
  readonly id: number;
  readonly bidId: number;
  readonly supplierTenantId: number;
  readonly revisionNo: number;
  readonly status: BidRevisionsStatus;
  readonly basedOnRevisionId: number | null;
  readonly contentHash: string;
  readonly acknowledgedTenderVersion: number;
  readonly internallyApprovedAt: string | null;
  readonly submittedAt: string | null;
  readonly createdBy: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface FixtureAnswer {
  readonly id: number;
  readonly revisionId: number;
  readonly requirementId: number;
  readonly answerText: string | null;
  readonly answerNumber: string | null;
  readonly answerChoice: string | null;
  readonly answerBool: boolean | null;
  readonly isDeviation: boolean;
  readonly deviationNote: string | null;
  readonly assignedUserId: number | null;
  readonly dueAt: string | null;
  readonly progress: BidAnswersProgress;
  readonly reuse: {
    readonly sourceAnswerId: number;
    readonly reusedAt: string;
    readonly reusedBy: number;
    readonly reviewedAt: string | null;
    readonly reviewedBy: number | null;
  } | null;
  readonly updatedBy: number | null;
  readonly updatedAt: string | null;
}

export interface FixtureAnswerAttachment {
  readonly id: number;
  readonly answerId: number;
  readonly revisionId: number;
  readonly documentId: number;
  readonly documentVersionId: number;
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly envelope: BidAnswersEnvelope;
  readonly evidenceItemId: number | null;
  readonly evidenceSubmissionId: number | null;
  readonly attachedAt: string;
  readonly attachedBy: number;
}

export interface FixturePrice {
  readonly revisionId: number;
  readonly pricingItemId: number;
  readonly priceStatus: BidPricesPriceStatus;
  readonly unitPrice: string | null;
  readonly quantity: string | null;
  readonly currency: string | null;
  readonly taxRate: string | null;
  readonly discountAmount: string | null;
  readonly notes: string | null;
}

export interface FixtureCommercialTerms {
  readonly revisionId: number;
  readonly validityDays: number | null;
  readonly paymentTerms: string | null;
  readonly conditionalDiscounts: string | null;
  readonly assumptions: string | null;
  readonly currency: string;
}

export interface FixtureDeclaration {
  readonly revisionId: number;
  readonly declarationType: BidDeclarationsDeclarationType;
  readonly accepted: boolean | null;
  readonly explanation: string | null;
  readonly declaredBy: number | null;
  readonly declaredAt: string | null;
}

export interface FixtureSubcontractor {
  readonly id: number;
  readonly revisionId: number;
  readonly name: string;
  readonly scope: string;
  readonly sharePercent: string;
  readonly qualificationEvidenceDocumentId: number | null;
  readonly qualificationEvidenceFileName: string | null;
}

export interface FixtureKeyPerson {
  readonly id: number;
  readonly revisionId: number;
  readonly name: string;
  readonly role: string;
  readonly qualifications: string | null;
  readonly cvDocumentId: number | null;
  readonly cvFileName: string | null;
}

export interface FixtureConsortiumMember {
  readonly id: number;
  readonly bidId: number;
  readonly memberTenantId: number | null;
  readonly memberName: string;
  readonly isLead: boolean;
  readonly responsibilities: string | null;
  readonly authorityEvidenceDocumentId: number | null;
}

export interface FixtureBidException {
  readonly id: number;
  readonly revisionId: number;
  readonly clauseRef: string;
  readonly proposedChange: string;
  readonly rationale: string | null;
}

export interface FixtureBidEvidence {
  readonly revisionId: number;
  readonly evidenceItemId: number;
  readonly evidenceSubmissionId: number | null;
  readonly attachedAt: string;
  readonly attachedBy: number;
}

export interface FixtureInternalApproval {
  readonly id: number;
  readonly bidId: number;
  readonly revisionId: number;
  readonly supplierTenantId: number;
  readonly approvalType: BidInternalApprovalsApprovalType;
  readonly approverUserId: number;
  readonly status: BidInternalApprovalsStatus;
  readonly requestedBy: number;
  readonly requestedAt: string;
  readonly contentHashAtDecision: string | null;
  readonly decidedAt: string | null;
  readonly note: string | null;
  readonly invalidatedAt: string | null;
}

export interface FixtureBidComment {
  readonly id: number;
  readonly bidId: number;
  readonly revisionId: number;
  readonly requirementId: number | null;
  readonly authorUserId: number;
  readonly body: string;
  readonly createdAt: string;
}

export interface FixtureAttempt {
  readonly id: number;
  readonly bidId: number;
  readonly revisionId: number;
  readonly supplierTenantId: number;
  readonly attemptedBy: number;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly outcome: SubmissionAttemptsOutcome;
  readonly failureReason: string | null;
  readonly deadlineAtAttempt: string;
  readonly receiptId: number | null;
}

export interface FixtureReceipt {
  readonly id: number;
  readonly buyerTenantId: number;
  readonly supplierTenantId: number;
  readonly bidId: number;
  readonly revisionId: number;
  readonly receiptNo: string;
  readonly receivedAt: string;
  readonly submittedBy: number;
  readonly submitterAuthorityNote: string | null;
  readonly status: SubmissionReceiptsStatus;
  readonly statusChangedAt: string;
  readonly tenderVersionNo: number;
}

export interface FixtureInventoryItem {
  readonly id: number;
  readonly receiptId: number;
  readonly documentVersionId: number;
  readonly fileName: string;
  readonly sha256: string;
  readonly sizeBytes: number;
  readonly envelope: BidAnswersEnvelope;
}

export interface FixtureWithdrawal {
  readonly id: number;
  readonly bidId: number;
  readonly revisionId: number;
  readonly receiptId: number;
  readonly supplierTenantId: number;
  readonly withdrawnBy: number;
  readonly withdrawnAt: string;
  readonly confirmationNo: string;
  readonly reason: string;
}

// ---------------------------------------------------------------------------------------------------------
// Declarative specs
// ---------------------------------------------------------------------------------------------------------

interface RevisionSpec {
  readonly no: number;
  readonly status: BidRevisionsStatus;
  readonly createdAt: string;
  readonly updatedAt?: string;
  readonly acknowledgedTenderVersion?: number;
  readonly internallyApprovedAt?: string;
  /** Official receipt time (a receipt is issued, including a late-rejected one). */
  readonly receivedAt?: string;
  readonly receiptStatus?: SubmissionReceiptsStatus;
  readonly receiptStatusChangedAt?: string;
  readonly attempt?: {
    readonly startedAt: string;
    readonly completedAt: string | null;
    readonly outcome: SubmissionAttemptsOutcome;
    readonly failureReason: string | null;
  };
  /** Distinguishes content versions for the content hash. */
  readonly variant?: string;
}

interface BidSpec {
  readonly id: number;
  readonly supplier: keyof typeof TENANT_IDS;
  readonly tenderId: number;
  readonly roundType?: BidsRoundType;
  readonly lotIds: readonly number[];
  readonly state: BidsSubmissionState;
  /** Base lump-sum amount for the standard price schedules. */
  readonly priceBase: string;
  readonly revisions: readonly RevisionSpec[];
  readonly consortium?: { readonly leadMemberName: string };
}

/** The personas of each supplier (bid manager, contributor, signatory, admin). */
const SUPPLIER_PEOPLE: Readonly<Record<number, { manager: number; contributor: number | null; signatory: number }>> = {
  [TENANT_IDS.tsodilo]: { manager: 25, contributor: 26, signatory: 27 },
  [TENANT_IDS['chobe-pipe']]: { manager: 29, contributor: 30, signatory: 31 },
  [TENANT_IDS['serowe-ict']]: { manager: 33, contributor: 34, signatory: 35 },
  [TENANT_IDS['gaborone-meter']]: { manager: 37, contributor: 38, signatory: 39 },
  [TENANT_IDS.makgadikgadi]: { manager: 40, contributor: null, signatory: 40 },
  [TENANT_IDS['limpopo-env']]: { manager: 41, contributor: null, signatory: 41 },
};

/** The standard received-and-selected revision of a historical response. */
function received(receivedAt: string, createdAt: string, status: SubmissionReceiptsStatus = 'selected_for_evaluation', statusChangedAt?: string): RevisionSpec {
  return {
    no: 1,
    status: 'submitted',
    createdAt,
    internallyApprovedAt: shift(receivedAt, -86_400),
    receivedAt,
    receiptStatus: status,
    receiptStatusChangedAt: statusChangedAt ?? receivedAt,
  };
}

function shift(instant: string, seconds: number): string {
  return new Date(Date.parse(instant) + seconds * 1000).toISOString().replace('.000Z', 'Z');
}

const BID_SPECS: readonly BidSpec[] = [
  // T-2026-0001: three lots, several revisions (AC-34 counts unique suppliers). Deadline 24 Jul 2026 10:00.
  {
    id: 1,
    supplier: 'tsodilo',
    tenderId: 1,
    lotIds: [101, 103],
    state: 'submitted',
    priceBase: '1860000.00',
    revisions: [
      {
        no: 1,
        status: 'superseded',
        createdAt: '2026-06-15T08:00:00Z',
        internallyApprovedAt: '2026-07-19T15:00:00Z',
        receivedAt: '2026-07-20T09:12:00Z',
        receiptStatus: 'superseded',
        receiptStatusChangedAt: '2026-07-23T14:05:00Z',
      },
      {
        no: 2,
        status: 'submitted',
        createdAt: '2026-07-21T07:30:00Z',
        internallyApprovedAt: '2026-07-23T11:00:00Z',
        receivedAt: '2026-07-23T14:05:00Z',
        receiptStatus: 'selected_for_evaluation',
        receiptStatusChangedAt: '2026-07-28T08:00:00Z',
        variant: 'price-update',
      },
    ],
  },
  {
    id: 2,
    supplier: 'chobe-pipe',
    tenderId: 1,
    lotIds: [101, 102, 103],
    state: 'submitted',
    priceBase: '1995000.00',
    revisions: [received('2026-07-22T11:30:00Z', '2026-06-25T09:00:00Z', 'selected_for_evaluation', '2026-07-28T08:00:00Z')],
  },
  {
    id: 3,
    supplier: 'makgadikgadi',
    tenderId: 1,
    lotIds: [102],
    state: 'submitted',
    priceBase: '1240000.00',
    revisions: [received('2026-07-24T07:47:00Z', '2026-06-28T10:00:00Z', 'selected_for_evaluation', '2026-07-28T08:00:00Z')],
  },
  // T-2026-0002: open until 21 Oct 2026 12:00 (addendum 1 of 24 Sep).
  {
    id: 4,
    supplier: 'gaborone-meter',
    tenderId: 2,
    lotIds: [201],
    state: 'submitted',
    priceBase: '0',
    revisions: [
      {
        no: 1,
        status: 'submitted',
        createdAt: '2026-09-02T08:00:00Z',
        acknowledgedTenderVersion: 1,
        internallyApprovedAt: '2026-09-17T16:00:00Z',
        receivedAt: '2026-09-18T09:12:44Z',
        receiptStatus: 'received',
      },
      {
        no: 2,
        status: 'submission_failed',
        createdAt: '2026-09-24T09:00:00Z',
        updatedAt: '2026-09-24T13:42:55Z',
        acknowledgedTenderVersion: 2,
        internallyApprovedAt: '2026-09-24T12:30:00Z',
        attempt: {
          startedAt: '2026-09-24T13:38:02Z',
          completedAt: '2026-09-24T13:42:55Z',
          outcome: 'failed_error',
          failureReason:
            'The submission could not be finalized: 2 of 9 files did not finish transferring during service incident 1. No receipt was issued; the receipt of revision 1 remains effective.',
        },
        variant: 'supplement',
      },
    ],
  },
  {
    id: 5,
    supplier: 'chobe-pipe',
    tenderId: 2,
    lotIds: [201],
    state: 'not_submitted',
    priceBase: '0',
    revisions: [
      {
        no: 1,
        status: 'draft',
        createdAt: '2026-09-10T08:00:00Z',
        updatedAt: '2026-09-28T15:10:00Z',
        acknowledgedTenderVersion: 1,
        variant: 'draft',
      },
    ],
  },
  {
    id: 6,
    supplier: 'tsodilo',
    tenderId: 2,
    lotIds: [201],
    state: 'submitted',
    priceBase: '0',
    revisions: [
      {
        no: 1,
        status: 'superseded',
        createdAt: '2026-09-08T08:00:00Z',
        acknowledgedTenderVersion: 1,
        internallyApprovedAt: '2026-09-21T11:30:00Z',
        receivedAt: '2026-09-21T14:03:10Z',
        receiptStatus: 'superseded',
        receiptStatusChangedAt: '2026-09-25T09:20:00Z',
      },
      {
        no: 2,
        status: 'submitted',
        createdAt: '2026-09-24T11:00:00Z',
        acknowledgedTenderVersion: 2,
        internallyApprovedAt: '2026-09-25T08:30:00Z',
        receivedAt: '2026-09-25T09:20:00Z',
        receiptStatus: 'received',
        variant: 'supplement',
      },
    ],
  },
  {
    id: 7,
    supplier: 'serowe-ict',
    tenderId: 2,
    lotIds: [201],
    state: 'not_submitted',
    priceBase: '0',
    consortium: { leadMemberName: 'Serowe ICT Solutions (Pty) Ltd' },
    revisions: [
      {
        no: 1,
        status: 'approved_internally',
        createdAt: '2026-09-10T08:00:00Z',
        updatedAt: '2026-09-28T09:00:00Z',
        acknowledgedTenderVersion: 2,
        internallyApprovedAt: '2026-09-28T09:00:00Z',
      },
    ],
  },
  // T-2026-0003 SCADA (staged opening, under assessment). Deadline 28 Aug 2026 10:00.
  {
    id: 8,
    supplier: 'serowe-ict',
    tenderId: 3,
    lotIds: [301],
    state: 'submitted',
    priceBase: '4180000.00',
    revisions: [received('2026-08-27T15:10:00Z', '2026-08-01T08:00:00Z', 'selected_for_evaluation', '2026-09-02T09:00:00Z')],
  },
  {
    id: 9,
    supplier: 'tsodilo',
    tenderId: 3,
    lotIds: [301],
    state: 'submitted',
    priceBase: '4990000.00',
    revisions: [received('2026-08-28T07:55:00Z', '2026-08-03T08:00:00Z', 'selected_for_evaluation', '2026-09-02T09:00:00Z')],
  },
  {
    id: 10,
    supplier: 'makgadikgadi',
    tenderId: 3,
    lotIds: [301],
    state: 'submitted',
    priceBase: '3870000.00',
    revisions: [received('2026-08-26T12:00:00Z', '2026-08-05T08:00:00Z', 'selected_for_evaluation', '2026-09-02T09:00:00Z')],
  },
  // T-2026-0004 RFI responses. Deadline 5 Jun 2026 15:00.
  { id: 11, supplier: 'tsodilo', tenderId: 4, lotIds: [401], state: 'submitted', priceBase: '85000.00', revisions: [received('2026-06-01T10:00:00Z', '2026-05-18T08:00:00Z', 'received')] },
  { id: 12, supplier: 'limpopo-env', tenderId: 4, lotIds: [401], state: 'submitted', priceBase: '92000.00', revisions: [received('2026-06-03T13:00:00Z', '2026-05-19T08:00:00Z', 'received')] },
  { id: 13, supplier: 'serowe-ict', tenderId: 4, lotIds: [401], state: 'submitted', priceBase: '78000.00', revisions: [received('2026-06-05T09:40:00Z', '2026-05-20T08:00:00Z', 'received')] },
  // T-2026-0006 Chlorine dosing (invitation only, open until 14 Oct 2026 12:00).
  {
    id: 14,
    supplier: 'tsodilo',
    tenderId: 6,
    lotIds: [601],
    state: 'not_submitted',
    priceBase: '0',
    revisions: [
      {
        no: 1,
        status: 'draft',
        createdAt: '2026-09-16T08:00:00Z',
        updatedAt: '2026-09-28T11:20:00Z',
        acknowledgedTenderVersion: 1,
        variant: 'v3',
      },
    ],
  },
  {
    id: 15,
    supplier: 'chobe-pipe',
    tenderId: 6,
    lotIds: [601],
    state: 'submitted',
    priceBase: '0',
    revisions: [
      {
        no: 1,
        status: 'submitted',
        createdAt: '2026-09-14T08:00:00Z',
        acknowledgedTenderVersion: 1,
        internallyApprovedAt: '2026-09-23T15:00:00Z',
        receivedAt: '2026-09-24T10:30:00Z',
        receiptStatus: 'received',
      },
      {
        no: 2,
        status: 'approved_internally',
        createdAt: '2026-09-26T08:30:00Z',
        updatedAt: '2026-09-29T14:00:00Z',
        acknowledgedTenderVersion: 1,
        internallyApprovedAt: '2026-09-29T14:00:00Z',
        variant: 'replacement',
      },
    ],
  },
  // T-2026-0007 Reservoir rehabilitation (award pending). Deadline 26 Jun 2026 10:00.
  {
    id: 16,
    supplier: 'makgadikgadi',
    tenderId: 7,
    lotIds: [701],
    state: 'submitted',
    priceBase: '6450000.00',
    revisions: [received('2026-06-25T11:00:00Z', '2026-06-01T08:00:00Z', 'selected_for_evaluation', '2026-06-30T08:00:00Z')],
  },
  {
    id: 17,
    supplier: 'limpopo-env',
    tenderId: 7,
    lotIds: [701],
    state: 'submitted',
    priceBase: '6980000.00',
    revisions: [received('2026-06-26T07:30:00Z', '2026-06-03T08:00:00Z', 'selected_for_evaluation', '2026-06-30T08:00:00Z')],
  },
  {
    id: 18,
    supplier: 'tsodilo',
    tenderId: 7,
    lotIds: [701],
    state: 'submitted',
    priceBase: '7120000.00',
    revisions: [received('2026-06-24T14:20:00Z', '2026-06-04T08:00:00Z', 'selected_for_evaluation', '2026-06-30T08:00:00Z')],
  },
  // T-2026-0008 Pipeline valves (closed 25 Sep 2026 10:00, awaiting opening).
  {
    id: 19,
    supplier: 'chobe-pipe',
    tenderId: 8,
    lotIds: [801, 802],
    state: 'submitted',
    priceBase: '2310000.00',
    revisions: [
      received('2026-09-22T10:00:00Z', '2026-09-01T08:00:00Z', 'received'),
      {
        no: 2,
        status: 'late_rejected',
        createdAt: '2026-09-23T08:00:00Z',
        updatedAt: '2026-09-25T08:00:38Z',
        internallyApprovedAt: '2026-09-24T16:00:00Z',
        receivedAt: '2026-09-25T08:00:38Z',
        receiptStatus: 'late_rejected',
        attempt: {
          startedAt: '2026-09-25T07:58:12Z',
          completedAt: '2026-09-25T08:00:38Z',
          outcome: 'failed_late',
          failureReason:
            'Final receipt completed at 25 Sep 2026, 10:00:38 (UTC+02:00) Africa/Gaborone, 38 seconds after the official deadline. The late replacement is recorded and rejected; the receipt of revision 1 remains effective.',
        },
        variant: 'replacement',
      },
    ],
  },
  {
    id: 20,
    supplier: 'tsodilo',
    tenderId: 8,
    lotIds: [801],
    state: 'withdrawn',
    priceBase: '1580000.00',
    revisions: [{ ...received('2026-09-19T15:00:00Z', '2026-09-02T08:00:00Z', 'withdrawn', '2026-09-23T08:30:00Z'), status: 'withdrawn' }],
  },
  // T-2026-0009 Acoustic leak detection (restricted, multi-stage: initial and next-stage rounds). Stage one: Serowe ICT,
  // Limpopo Environmental and Gaborone Metering; the approved shortlist (2 of 3) takes Serowe ICT and Limpopo to stage two.
  {
    id: 21,
    supplier: 'serowe-ict',
    tenderId: 9,
    roundType: 'initial',
    lotIds: [901],
    state: 'submitted',
    priceBase: '1320000.00',
    revisions: [received('2026-06-29T14:00:00Z', '2026-06-10T08:00:00Z', 'selected_for_evaluation', '2026-07-02T08:00:00Z')],
  },
  {
    id: 22,
    supplier: 'limpopo-env',
    tenderId: 9,
    roundType: 'initial',
    lotIds: [901],
    state: 'submitted',
    priceBase: '1410000.00',
    revisions: [received('2026-06-30T08:00:00Z', '2026-06-11T08:00:00Z', 'selected_for_evaluation', '2026-07-02T08:00:00Z')],
  },
  {
    id: 23,
    supplier: 'gaborone-meter',
    tenderId: 9,
    roundType: 'initial',
    lotIds: [901],
    state: 'submitted',
    priceBase: '1250000.00',
    revisions: [received('2026-06-30T09:30:00Z', '2026-06-12T08:00:00Z', 'selected_for_evaluation', '2026-07-02T08:00:00Z')],
  },
  {
    id: 24,
    supplier: 'serowe-ict',
    tenderId: 9,
    roundType: 'next_stage',
    lotIds: [901],
    state: 'submitted',
    priceBase: '1290000.00',
    revisions: [received('2026-08-13T12:00:00Z', '2026-07-20T08:00:00Z', 'selected_for_evaluation', '2026-08-17T08:00:00Z')],
  },
  {
    id: 25,
    supplier: 'limpopo-env',
    tenderId: 9,
    roundType: 'next_stage',
    lotIds: [901],
    state: 'submitted',
    priceBase: '1365000.00',
    revisions: [received('2026-08-14T07:15:00Z', '2026-07-20T09:00:00Z', 'selected_for_evaluation', '2026-08-17T08:00:00Z')],
  },
  // T-2026-0010 Fleet maintenance (awarded). Deadline 3 Apr 2026 10:00.
  {
    id: 26,
    supplier: 'tsodilo',
    tenderId: 10,
    lotIds: [1001],
    state: 'submitted',
    priceBase: '940000.00',
    revisions: [received('2026-02-02T13:00:00Z', '2026-01-16T08:00:00Z', 'selected_for_evaluation', '2026-02-04T08:00:00Z')],
  },
  {
    id: 27,
    supplier: 'makgadikgadi',
    tenderId: 10,
    lotIds: [1001],
    state: 'submitted',
    priceBase: '1015000.00',
    revisions: [received('2026-02-03T07:00:00Z', '2026-01-19T08:00:00Z', 'selected_for_evaluation', '2026-02-04T08:00:00Z')],
  },
  // T-2026-0011 Office cleaning (ODC, open until 23 Oct 2026 12:00 after addendum 1).
  {
    id: 28,
    supplier: 'limpopo-env',
    tenderId: 11,
    lotIds: [1101, 1102],
    state: 'submitted',
    priceBase: '612000.00',
    revisions: [received('2026-09-29T10:00:00Z', '2026-09-18T08:00:00Z', 'received')],
  },
  {
    id: 29,
    supplier: 'makgadikgadi',
    tenderId: 11,
    lotIds: [1101],
    state: 'submitted',
    priceBase: '398000.00',
    revisions: [received('2026-09-26T13:00:00Z', '2026-09-15T08:00:00Z', 'received')],
  },
];

// ---------------------------------------------------------------------------------------------------------
// Content overrides for the scenario responses
// ---------------------------------------------------------------------------------------------------------

type AnswerOverride = Partial<Omit<FixtureAnswer, 'id' | 'revisionId' | 'requirementId'>> & {
  /** Evidence items attached to a document answer (snapshots). */
  readonly evidenceItemIds?: readonly number[];
  /** Uploaded files attached to the answer. */
  readonly uploads?: readonly string[];
};

const SPECIFIC_TEXT: Readonly<Record<number, string>> = {
  2003: '{supplier} offers ISO 4064 class R400 meters for DN15–DN20 and R160 bulk meters; type-approval details are in the qualification section.',
  2004: '{supplier} proposes LoRaWAN AMR modules with a hosted head-end in Gaborone, hourly reads and a documented export interface for the billing system.',
  2006: '{supplier} will install 1,000 meters per month from the second month after order with six two-person crews, starting in Gaborone West.',
  2007: '{supplier} commissions each bulk meter with a calibrated reference test, logger configuration and chamber reinstatement within 48 hours.',
  6003: '{supplier} offers vacuum-regulated gas chlorinators from 0 to 20 kg/h with automatic duty/standby changeover and flow-paced control from the residual analyser.',
  6004: '{supplier} installed dosing systems at Mmamashia (2022), Letsibogo (2023) and Masama (2025); references are listed in the attached schedule.',
  6007: '{supplier} provides two on-site training sessions for eight operators and O&M manuals in English.',
};

const DEFAULT_NUMBERS: Readonly<Record<number, Readonly<Record<string, string>>>> = {
  2002: { 'gaborone-meter': '46000', 'chobe-pipe': '8200', tsodilo: '3100', 'serowe-ict': '5400' },
  6006: { 'chobe-pipe': '16', tsodilo: '12' },
  6008: { 'chobe-pipe': '12', tsodilo: '10' },
};

const DEFAULT_CHOICES: Readonly<Record<number, Readonly<Record<string, string>>>> = {
  2009: { 'gaborone-meter': '10 years', 'chobe-pipe': '5 years', tsodilo: '5 years', 'serowe-ict': '5 years' },
};

/** Evidence attached by default to the eligibility document answer, per supplier. */
const ELIGIBILITY_EVIDENCE: Readonly<Record<number, readonly number[]>> = {
  [TENANT_IDS.tsodilo]: [401, 404],
  [TENANT_IDS['chobe-pipe']]: [501, 504],
  [TENANT_IDS['serowe-ict']]: [701, 703],
  [TENANT_IDS['gaborone-meter']]: [901, 903],
  [TENANT_IDS.makgadikgadi]: [601],
  [TENANT_IDS['limpopo-env']]: [801],
};

const ANSWER_OVERRIDES: Readonly<Record<number, Readonly<Record<number, AnswerOverride>>>> = {
  // Gaborone r2 (the failed supplement) answers the new OIML R49 requirement of addendum 1.
  42: { 2008: { evidenceItemIds: [902, 904] } },
  // Chobe's T-2026-0002 draft: work in progress, the addendum requirement still open.
  51: {
    2004: { assignedUserId: 30, progress: 'in_progress', dueAt: '2026-10-09T15:00:00Z', updatedBy: 30, updatedAt: '2026-09-28T15:10:00Z' },
    2006: { assignedUserId: 42, progress: 'ready_for_review', dueAt: '2026-10-09T15:00:00Z', updatedBy: 42, updatedAt: '2026-09-26T10:00:00Z' },
  },
  // Tsodilo's supplement answers the OIML requirement with its partner's certificates.
  62: { 2008: { uploads: ['tsodilo-oiml-r49-certificates.pdf'] } },
  71: { 2008: { uploads: ['mogobe-oiml-r49-certificates.pdf'] } },
  // Tsodilo's T-2026-0010 quotation (2 Feb 2026) predates its current liability policy (added 1 Mar 2026).
  261: { 10001: { evidenceItemIds: [401] } },
  // Tsodilo T-2026-0006 draft: assigned work, partial content, reused content awaiting review (AC-03).
  141: {
    6001: { assignedUserId: 25, evidenceItemIds: [403], updatedAt: '2026-09-18T10:00:00Z' },
    6002: { assignedUserId: 25, evidenceItemIds: [402], updatedAt: '2026-09-18T10:05:00Z' },
    6003: {
      assignedUserId: 26,
      progress: 'in_progress',
      dueAt: '2026-10-09T15:00:00Z',
      answerText:
        'Tsodilo Engineering offers vacuum-regulated gas chlorinators from 0 to 20 kg/h with automatic duty/standby changeover. Control philosophy to follow.',
      updatedBy: 26,
      updatedAt: '2026-09-27T14:30:00Z',
    },
    6004: {
      assignedUserId: 42,
      progress: 'ready_for_review',
      dueAt: '2026-10-09T15:00:00Z',
      reuse: { sourceAnswerId: 1203, reusedAt: '2026-09-22T09:00:00Z', reusedBy: 42, reviewedAt: null, reviewedBy: null },
      updatedBy: 42,
      updatedAt: '2026-09-22T09:00:00Z',
    },
    6005: { assignedUserId: 26, updatedBy: 26, updatedAt: '2026-09-24T11:00:00Z' },
    6006: { assignedUserId: 26, progress: 'not_started', answerNumber: null, dueAt: '2026-10-12T15:00:00Z', updatedBy: null, updatedAt: null },
    6007: { assignedUserId: null, progress: 'not_started', answerText: null, updatedBy: null, updatedAt: null },
    6008: { assignedUserId: 25, updatedAt: '2026-09-28T11:20:00Z' },
  },
  // Chobe T-2026-0006: a declared deviation on the delivery lead time.
  151: {
    6001: { evidenceItemIds: [504] },
    6002: { evidenceItemIds: [502] },
    6006: { isDeviation: true, deviationNote: 'Lead time is 16 weeks for the 20 kg/h chlorinator (target 12 weeks); 12 weeks for analysers.' },
  },
  152: {
    6001: { evidenceItemIds: [504] },
    6002: { evidenceItemIds: [502] },
    6006: { isDeviation: true, deviationNote: 'Lead time is 16 weeks for the 20 kg/h chlorinator (target 12 weeks); 12 weeks for analysers.' },
  },
};

type PriceSpec = readonly [BidPricesPriceStatus | null, string | null];

const GABORONE_PRICES: Readonly<Record<string, PriceSpec>> = {
  'SM-01': ['priced', '1450.00'],
  'SM-02': ['priced', '1690.00'],
  'SM-03': ['priced', '310.00'],
  'SM-04': ['priced', '18500.00'],
  'SM-05': ['priced', '1450.00'],
  'BM-01': ['priced', '9800.00'],
  'BM-02': ['priced', '16400.00'],
  'BM-03': ['priced', '23900.00'],
  'BM-04': ['priced', '450000.00'],
};

const TSODILO_METER_PRICES: Readonly<Record<string, PriceSpec>> = {
  'SM-01': ['priced', '1510.00'],
  'SM-02': ['priced', '1745.00'],
  'SM-03': ['priced', '295.00'],
  'SM-04': ['priced', '19800.00'],
  'SM-05': ['not_offered', null],
  'BM-01': ['priced', '10250.00'],
  'BM-02': ['priced', '17100.00'],
  'BM-03': ['priced', '24800.00'],
  'BM-04': ['priced', '420000.00'],
};

/** Explicit prices per revision and item code; `[null, null]` = not yet entered. */
const PRICE_OVERRIDES: Readonly<Record<number, Readonly<Record<string, PriceSpec>>>> = {
  41: GABORONE_PRICES,
  42: { ...GABORONE_PRICES, 'SM-03': ['priced', '295.00'] },
  51: {
    'SM-01': ['priced', '1520.00'],
    'SM-02': ['priced', '1760.00'],
    'SM-03': ['included', null],
    'SM-04': ['priced', '21000.00'],
    'SM-05': ['not_offered', null],
    'BM-01': ['priced', '10900.00'],
    'BM-02': [null, null],
    'BM-03': [null, null],
    'BM-04': ['priced', '465000.00'],
  },
  61: TSODILO_METER_PRICES,
  62: TSODILO_METER_PRICES,
  71: {
    'SM-01': ['priced', '1480.00'],
    'SM-02': ['priced', '1710.00'],
    'SM-03': ['priced', '320.00'],
    'SM-04': ['priced', '16900.00'],
    'SM-05': ['priced', '1480.00'],
    'BM-01': ['priced', '9950.00'],
    'BM-02': ['priced', '16250.00'],
    'BM-03': ['priced', '24100.00'],
    'BM-04': ['priced', '480000.00'],
  },
  141: {
    'CD-01': ['priced', '385000.00'],
    'CD-02': ['priced', '42500.00'],
    'CD-03': ['priced', '310000.00'],
    'CD-04': ['included', null],
    'CD-05': [null, null],
    'CD-06': ['not_offered', null],
  },
  151: {
    'CD-01': ['priced', '402000.00'],
    'CD-02': ['priced', '39800.00'],
    'CD-03': ['priced', '285000.00'],
    'CD-04': ['priced', '45000.00'],
    'CD-05': ['priced', '96000.00'],
    'CD-06': ['priced', '28500.00'],
  },
  152: {
    'CD-01': ['priced', '396000.00'],
    'CD-02': ['priced', '39800.00'],
    'CD-03': ['priced', '285000.00'],
    'CD-04': ['priced', '45000.00'],
    'CD-05': ['priced', '96000.00'],
    'CD-06': ['priced', '28500.00'],
  },
};

const DECLARATION_OVERRIDES: Readonly<
  Record<number, Partial<Record<BidDeclarationsDeclarationType, { accepted: boolean | null; explanation: string | null }>>>
> = {
  51: { authority_to_bid: { accepted: null, explanation: null }, no_conflict: { accepted: null, explanation: null } },
  141: { no_conflict: { accepted: null, explanation: null } },
  152: {
    terms_acceptance: {
      accepted: false,
      explanation: 'Accepted except GCC 17.2 (limitation of liability); see the declared contract exception.',
    },
  },
};

// ---------------------------------------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------------------------------------

/** A deterministic SHA-256 hex digest for fixture content. */
export function fixtureHash(seed: string): string {
  return sha256Hex(seed);
}

function tenderOf(id: number): FixtureBidTender {
  const tender = BID_TENDERS.find((row) => row.id === id);
  if (tender === undefined) {
    throw new Error(`Unknown fixture tender ${id}.`);
  }
  return tender;
}

function slugOf(tenantId: number): string {
  const tenant = TENANTS.find((row) => row.id === tenantId);
  if (tenant === undefined) {
    throw new Error(`Unknown tenant ${tenantId}.`);
  }
  return tenant.slug;
}

function nameOf(tenantId: number): string {
  const tenant = TENANTS.find((row) => row.id === tenantId);
  return tenant === undefined ? 'The supplier' : tenant.name;
}

/** The deadline of a bid's round. */
export function roundDeadline(tender: FixtureBidTender, roundType: BidsRoundType): string {
  const round = tender.rounds.find((row) => row.roundType === roundType) ?? tender.rounds[tender.rounds.length - 1];
  if (round === undefined) {
    throw new Error(`Tender ${tender.reference} has no rounds.`);
  }
  return round.deadline;
}

/** Requirements that apply to a bid (general ones plus those of its lots). */
export function requirementsForLots(tenderId: number, lotIds: readonly number[]): FixtureRequirement[] {
  return BID_REQUIREMENTS.filter((row) => row.tenderId === tenderId && (row.lotId === null || lotIds.includes(row.lotId)));
}

function genericText(requirement: FixtureRequirement, supplier: string): string {
  const specific = SPECIFIC_TEXT[requirement.id];
  if (specific !== undefined) {
    return specific.replace('{supplier}', supplier);
  }
  if (requirement.responseType === 'document') {
    return `${supplier} attaches the requested documents from its evidence library.`;
  }
  if (requirement.refCode === 'T-02') {
    return `${supplier} completed three comparable contracts between 2022 and 2025 for public water and municipal clients in Botswana; client contacts are listed in the attached reference schedule.`;
  }
  return `${supplier} will deliver this scope with its own site team under a registered engineer. The method statement, programme and quality plan are set out in the attached technical proposal.`;
}

const bids: FixtureBid[] = [];
const revisions: FixtureRevision[] = [];
const answers: FixtureAnswer[] = [];
const attachments: FixtureAnswerAttachment[] = [];
const prices: FixturePrice[] = [];
const terms: FixtureCommercialTerms[] = [];
const declarations: FixtureDeclaration[] = [];
const subcontractors: FixtureSubcontractor[] = [];
const keyPersonnel: FixtureKeyPerson[] = [];
const consortiumMembers: FixtureConsortiumMember[] = [];
const exceptions: FixtureBidException[] = [];
const bidEvidence: FixtureBidEvidence[] = [];
const approvals: FixtureInternalApproval[] = [];
const attempts: FixtureAttempt[] = [];
const receipts: Array<Omit<FixtureReceipt, 'receiptNo'> & { receiptNo: string }> = [];
const inventory: FixtureInventoryItem[] = [];
const withdrawals: FixtureWithdrawal[] = [];

let attachmentSeq = 1;
let evidenceSubmissionSeq = 1;
let inventorySeq = 1;
let attemptSeq = 1;
let receiptSeq = 1;
let approvalSeq = 1;

function evidenceById(id: number) {
  const row = BID_EVIDENCE_ITEMS.find((item) => item.id === id);
  if (row === undefined) {
    throw new Error(`Unknown evidence item ${id}.`);
  }
  return row;
}

function buildRevisionContent(bid: FixtureBid, tender: FixtureBidTender, spec: RevisionSpec, revision: FixtureRevision): void {
  const supplierName = nameOf(bid.supplierTenantId);
  const slug = slugOf(bid.supplierTenantId);
  const people = SUPPLIER_PEOPLE[bid.supplierTenantId];
  if (people === undefined) {
    throw new Error(`No people for supplier ${bid.supplierTenantId}.`);
  }
  const submitted = spec.receivedAt !== undefined;
  const at = spec.updatedAt ?? spec.internallyApprovedAt ?? spec.createdAt;
  const overrides = ANSWER_OVERRIDES[revision.id] ?? {};
  const attachedEvidence = new Set<number>();

  requirementsForLots(tender.id, bid.lotIds).forEach((requirement, index) => {
    const override = overrides[requirement.id] ?? {};
    // A revision created before the addendum that added the requirement has no answer to it.
    const predates = requirement.addendumNumber !== null && revision.acknowledgedTenderVersion < 2 && overrides[requirement.id] === undefined;
    const numberValue = DEFAULT_NUMBERS[requirement.id]?.[slug] ?? (requirement.responseType === 'number' || requirement.responseType === 'quantity' ? '1' : null);
    const base: FixtureAnswer = {
      id: revision.id * 100 + index + 1,
      revisionId: revision.id,
      requirementId: requirement.id,
      answerText:
        predates
          ? null
          : requirement.responseType === 'text' || requirement.responseType === 'document'
            ? genericText(requirement, supplierName)
            : null,
      answerNumber: predates ? null : requirement.responseType === 'number' || requirement.responseType === 'quantity' ? numberValue : null,
      answerChoice: predates ? null : requirement.responseType === 'choice' ? (DEFAULT_CHOICES[requirement.id]?.[slug] ?? requirement.choices[0] ?? null) : null,
      answerBool: predates ? null : requirement.responseType === 'yes_no' ? true : null,
      isDeviation: false,
      deviationNote: null,
      assignedUserId: predates ? null : people.manager,
      dueAt: null,
      progress: predates ? 'not_started' : 'complete',
      reuse: null,
      updatedBy: predates ? null : people.manager,
      updatedAt: predates ? null : at,
    };
    const { evidenceItemIds, uploads, ...fields } = override;
    const answer: FixtureAnswer = { ...base, ...fields };
    answers.push(answer);

    if (answer.progress === 'not_started' && evidenceItemIds === undefined && uploads === undefined) {
      return;
    }
    const evidenceIds =
      evidenceItemIds ?? (requirement.responseType === 'document' && requirement.refCode === 'Q-01' ? (ELIGIBILITY_EVIDENCE[bid.supplierTenantId] ?? []) : []);
    for (const evidenceItemId of evidenceIds) {
      const item = evidenceById(evidenceItemId);
      const snapshotId = submitted ? evidenceSubmissionSeq++ : null;
      attachments.push({
        id: attachmentSeq++,
        answerId: answer.id,
        revisionId: revision.id,
        documentId: item.documentId,
        documentVersionId: item.documentVersionId,
        fileName: item.fileName,
        sizeBytes: 180_000 + (item.id % 50) * 7_300,
        sha256: fixtureHash(`evidence:${item.id}:${item.versionNo}`),
        envelope: requirement.envelope,
        evidenceItemId: item.id,
        evidenceSubmissionId: snapshotId,
        attachedAt: answer.updatedAt ?? spec.createdAt,
        attachedBy: answer.updatedBy ?? people.manager,
      });
      if (!attachedEvidence.has(item.id)) {
        attachedEvidence.add(item.id);
        bidEvidence.push({
          revisionId: revision.id,
          evidenceItemId: item.id,
          evidenceSubmissionId: snapshotId,
          attachedAt: answer.updatedAt ?? spec.createdAt,
          attachedBy: answer.updatedBy ?? people.manager,
        });
      }
    }
    const uploadNames = uploads ?? (requirement.responseType === 'text' && requirement.refCode === 'T-02' ? [`${slug}-references-${tender.reference.toLowerCase()}.pdf`] : []);
    for (const fileName of uploadNames) {
      const id = attachmentSeq++;
      attachments.push({
        id,
        answerId: answer.id,
        revisionId: revision.id,
        documentId: 80_000 + id,
        documentVersionId: 90_000 + id,
        fileName,
        sizeBytes: 240_000 + id * 1_111,
        sha256: fixtureHash(`upload:${revision.id}:${fileName}`),
        envelope: requirement.envelope,
        evidenceItemId: null,
        evidenceSubmissionId: null,
        attachedAt: answer.updatedAt ?? spec.createdAt,
        attachedBy: answer.updatedBy ?? people.manager,
      });
    }
  });

  // Insurance evidence for the chlorine dosing tender (AC-09: Chobe's expires within days).
  if (tender.id === 6) {
    const insurance = bid.supplierTenantId === TENANT_IDS['chobe-pipe'] ? 503 : 405;
    bidEvidence.push({
      revisionId: revision.id,
      evidenceItemId: insurance,
      evidenceSubmissionId: submitted ? evidenceSubmissionSeq++ : null,
      attachedAt: spec.createdAt,
      attachedBy: people.manager,
    });
  }

  // Prices.
  const priceOverride = PRICE_OVERRIDES[revision.id];
  for (const schedule of BID_PRICE_SCHEDULES.filter((row) => row.tenderId === tender.id && (row.lotId === null || bid.lotIds.includes(row.lotId)))) {
    schedule.items.forEach((pricingItem, index) => {
      let status: BidPricesPriceStatus | null;
      let unitPrice: string | null;
      if (priceOverride !== undefined) {
        const entry = priceOverride[pricingItem.itemCode];
        [status, unitPrice] = entry ?? [null, null];
      } else {
        status = 'priced';
        unitPrice = index === 0 ? spec.variant === 'price-update' ? round(mul('0.97', '1860000.00'), 2) : bidPriceBase(bid) : round(mul('0.18', bidPriceBase(bid)), 2);
      }
      if (status === null) {
        return;
      }
      prices.push({
        revisionId: revision.id,
        pricingItemId: pricingItem.id,
        priceStatus: status,
        unitPrice: status === 'priced' ? unitPrice : null,
        quantity: status === 'priced' ? pricingItem.quantity : null,
        currency: status === 'priced' ? tender.currency : null,
        taxRate: status === 'priced' ? '14' : null,
        discountAmount: null,
        notes: status === 'included' ? 'Included in the meter or equipment price.' : status === 'not_offered' ? 'Not offered.' : null,
      });
    });
  }
  terms.push({
    revisionId: revision.id,
    validityDays: tender.bidValidityDays,
    paymentTerms: '30 days from the date of a valid invoice after acceptance of each delivery.',
    conditionalDiscounts: revision.id === 152 ? '2% if all four skids are ordered in one purchase order.' : null,
    assumptions: tender.id === 6 ? 'Civil plinths and chlorine store ventilation are provided by the buyer.' : null,
    currency: tender.currency,
  });

  // Declarations.
  const declarationOverride = DECLARATION_OVERRIDES[revision.id] ?? {};
  for (const declarationType of BID_DECLARATIONS_DECLARATION_TYPE.filter((type) => type !== 'other')) {
    const override = declarationOverride[declarationType];
    const accepted = override === undefined ? true : override.accepted;
    declarations.push({
      revisionId: revision.id,
      declarationType,
      accepted,
      explanation: override?.explanation ?? null,
      declaredBy: accepted === null ? null : declarationType === 'authority_to_bid' ? people.signatory : people.manager,
      declaredAt: accepted === null ? null : at,
    });
  }
}

function bidPriceBase(bid: FixtureBid): string {
  return BID_SPECS.find((spec) => spec.id === bid.id)?.priceBase ?? '0';
}

for (const spec of BID_SPECS) {
  const supplierTenantId = TENANT_IDS[spec.supplier];
  const tender = tenderOf(spec.tenderId);
  const people = SUPPLIER_PEOPLE[supplierTenantId];
  if (people === undefined) {
    throw new Error(`No people for supplier ${spec.supplier}.`);
  }
  const bid: FixtureBid = {
    id: spec.id,
    supplierTenantId,
    buyerTenantId: tender.buyerTenantId,
    tenderId: tender.id,
    roundType: spec.roundType ?? 'initial',
    lotIds: spec.lotIds,
    isAlternative: false,
    isConsortium: spec.consortium !== undefined,
    leadMemberName: spec.consortium?.leadMemberName ?? null,
    submissionState: spec.state,
    bidManagerUserId: people.manager,
    createdAt: spec.revisions[0]?.createdAt ?? '2026-01-01T00:00:00Z',
  };
  bids.push(bid);
  const deadline = roundDeadline(tender, bid.roundType);
  const policy = SUPPLIER_APPROVAL_POLICIES[supplierTenantId] ?? [];

  let previous: FixtureRevision | null = null;
  for (const revisionSpec of spec.revisions) {
    const id = spec.id * 10 + revisionSpec.no;
    const revision: FixtureRevision = {
      id,
      bidId: spec.id,
      supplierTenantId,
      revisionNo: revisionSpec.no,
      status: revisionSpec.status,
      basedOnRevisionId: previous?.id ?? null,
      contentHash: fixtureHash(`bid:${spec.id}:rev:${revisionSpec.no}:${revisionSpec.variant ?? 'final'}`),
      acknowledgedTenderVersion: revisionSpec.acknowledgedTenderVersion ?? tender.currentVersionNo,
      internallyApprovedAt: revisionSpec.internallyApprovedAt ?? null,
      submittedAt: revisionSpec.receivedAt ?? null,
      createdBy: people.manager,
      createdAt: revisionSpec.createdAt,
      updatedAt: revisionSpec.updatedAt ?? revisionSpec.receivedAt ?? revisionSpec.internallyApprovedAt ?? revisionSpec.createdAt,
    };
    revisions.push(revision);
    buildRevisionContent(bid, tender, revisionSpec, revision);

    // Internal approvals given on the final content of the revision.
    if (revisionSpec.internallyApprovedAt !== undefined) {
      for (const approvalType of policy) {
        approvals.push({
          id: approvalSeq++,
          bidId: spec.id,
          revisionId: id,
          supplierTenantId,
          approvalType,
          approverUserId: people.signatory,
          status: 'approved',
          requestedBy: people.manager,
          requestedAt: shift(revisionSpec.internallyApprovedAt, -7_200),
          contentHashAtDecision: revision.contentHash,
          decidedAt: revisionSpec.internallyApprovedAt,
          note: approvalType === 'commercial' ? 'Margins and payment terms within the delegated limit.' : 'Approved for submission.',
          invalidatedAt: null,
        });
      }
    }

    // Receipt and the attempt that produced it.
    let receiptId: number | null = null;
    if (revisionSpec.receivedAt !== undefined) {
      receiptId = receiptSeq++;
      receipts.push({
        id: receiptId,
        buyerTenantId: tender.buyerTenantId,
        supplierTenantId,
        bidId: spec.id,
        revisionId: id,
        receiptNo: '',
        receivedAt: revisionSpec.receivedAt,
        submittedBy: people.signatory,
        submitterAuthorityNote:
          people.signatory === people.manager
            ? 'Submitted by the organization administrator as the registered representative.'
            : 'Authorized signatory under the board resolution of 12 Jan 2026.',
        status: revisionSpec.receiptStatus ?? 'received',
        statusChangedAt: revisionSpec.receiptStatusChangedAt ?? revisionSpec.receivedAt,
        tenderVersionNo: revision.acknowledgedTenderVersion,
      });
      const files: Array<{ fileName: string; envelope: BidAnswersEnvelope }> = [
        { fileName: '01 Qualification response.pdf', envelope: 'qualification' },
        { fileName: '02 Technical proposal.pdf', envelope: 'technical' },
        { fileName: '03 Price schedule.xlsx', envelope: 'commercial' },
      ];
      for (const attachment of attachments.filter((row) => row.revisionId === id)) {
        files.push({ fileName: attachment.fileName, envelope: attachment.envelope });
      }
      files.forEach((file, index) => {
        inventory.push({
          id: inventorySeq++,
          receiptId: receiptId as number,
          documentVersionId: 100_000 + id * 100 + index,
          fileName: file.fileName,
          sha256: fixtureHash(`inventory:${id}:${file.fileName}`),
          sizeBytes: 150_000 + index * 64_000 + (id % 17) * 3_000,
          envelope: file.envelope,
        });
      });
    }
    const attemptSpec =
      revisionSpec.attempt ??
      (revisionSpec.receivedAt === undefined
        ? undefined
        : { startedAt: shift(revisionSpec.receivedAt, -95), completedAt: revisionSpec.receivedAt, outcome: 'succeeded' as const, failureReason: null });
    if (attemptSpec !== undefined) {
      attempts.push({
        id: attemptSeq++,
        bidId: spec.id,
        revisionId: id,
        supplierTenantId,
        attemptedBy: people.signatory,
        startedAt: attemptSpec.startedAt,
        completedAt: attemptSpec.completedAt,
        outcome: attemptSpec.outcome,
        failureReason: attemptSpec.failureReason,
        deadlineAtAttempt: deadline,
        receiptId,
      });
    }
    previous = revision;
  }
}

// Receipt numbers: RCPT-<year>-NNNNNN per buyer tenant in order of receipt (DD-09).
for (const buyerTenantId of [...new Set(receipts.map((row) => row.buyerTenantId))]) {
  receipts
    .filter((row) => row.buyerTenantId === buyerTenantId)
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt) || a.id - b.id)
    .forEach((row, index) => {
      row.receiptNo = `RCPT-2026-${String(index + 1).padStart(6, '0')}`;
    });
}

// ---------------------------------------------------------------------------------------------------------
// Scenario rows that are not generated
// ---------------------------------------------------------------------------------------------------------

// Tsodilo T-2026-0006 (bid 14): an executive approval invalidated by a later pricing change, and a pending
// commercial approval of the current content (BR-10, SUP-15).
approvals.push(
  {
    id: approvalSeq++,
    bidId: 14,
    revisionId: 141,
    supplierTenantId: TENANT_IDS.tsodilo,
    approvalType: 'executive',
    approverUserId: 27,
    status: 'invalidated',
    requestedBy: 25,
    requestedAt: '2026-09-25T15:00:00Z',
    contentHashAtDecision: fixtureHash('bid:14:rev:1:v2'),
    decidedAt: '2026-09-26T09:10:00Z',
    note: 'Approved subject to the price review.',
    invalidatedAt: '2026-09-28T11:20:00Z',
  },
  {
    id: approvalSeq,
    bidId: 14,
    revisionId: 141,
    supplierTenantId: TENANT_IDS.tsodilo,
    approvalType: 'commercial',
    approverUserId: 27,
    status: 'pending',
    requestedBy: 25,
    requestedAt: '2026-09-28T12:00:00Z',
    contentHashAtDecision: null,
    decidedAt: null,
    note: null,
    invalidatedAt: null,
  },
);

subcontractors.push(
  {
    id: 1,
    revisionId: 141,
    name: 'Kgalagadi Electrical (Pty) Ltd',
    scope: 'Electrical installation and cabling of the dosing skids and analysers.',
    sharePercent: '15.00',
    qualificationEvidenceDocumentId: 88_001,
    qualificationEvidenceFileName: 'kgalagadi-electrical-registration.pdf',
  },
  {
    id: 2,
    revisionId: 152,
    name: 'Okavango Instrumentation Services',
    scope: 'Calibration of the residual analysers.',
    sharePercent: '5.00',
    qualificationEvidenceDocumentId: null,
    qualificationEvidenceFileName: null,
  },
);

keyPersonnel.push(
  {
    id: 1,
    revisionId: 141,
    name: 'Onkemetse Rapula',
    role: 'Project engineer',
    qualifications: 'BEng Mechanical, ERB registered, 12 years in water treatment.',
    cvDocumentId: 88_101,
    cvFileName: 'cv-onkemetse-rapula.pdf',
  },
  {
    id: 2,
    revisionId: 141,
    name: 'Kelebogile Moatlhodi',
    role: 'Commissioning technician',
    qualifications: 'Diploma in Electrical Engineering, chlorine safety certified.',
    cvDocumentId: null,
    cvFileName: null,
  },
  {
    id: 3,
    revisionId: 152,
    name: 'Neo Kgosietsile',
    role: 'Site manager',
    qualifications: 'BTech Civil, 9 years of pipeline and treatment works projects.',
    cvDocumentId: 88_102,
    cvFileName: 'cv-neo-kgosietsile.pdf',
  },
);

consortiumMembers.push(
  {
    id: 1,
    bidId: 7,
    memberTenantId: TENANT_IDS['serowe-ict'],
    memberName: 'Serowe ICT Solutions (Pty) Ltd',
    isLead: true,
    responsibilities: 'Head-end system, data platform and project management.',
    authorityEvidenceDocumentId: 88_201,
  },
  {
    id: 2,
    bidId: 7,
    memberTenantId: null,
    memberName: 'Mogobe Meter Installations (Pty) Ltd',
    isLead: false,
    responsibilities: 'Supply and installation of the bulk meters and chambers.',
    authorityEvidenceDocumentId: 88_202,
  },
);

exceptions.push(
  {
    id: 1,
    revisionId: 141,
    clauseRef: 'GCC 17.2 Limitation of liability',
    proposedChange: 'Cap the total liability at 100% of the contract price.',
    rationale: 'Usual cap for equipment supply of this value.',
  },
  {
    id: 2,
    revisionId: 152,
    clauseRef: 'GCC 17.2 Limitation of liability',
    proposedChange: 'Cap the total liability at 100% of the contract price, excluding third-party injury.',
    rationale: 'Required by our insurer.',
  },
);

const comments: FixtureBidComment[] = [
  { id: 1, bidId: 14, revisionId: 141, requirementId: 6003, authorUserId: 25, body: 'Please add the behaviour on loss of chlorine feed and on analyser failure.', createdAt: '2026-09-27T08:15:00Z' },
  { id: 2, bidId: 14, revisionId: 141, requirementId: 6003, authorUserId: 26, body: 'Working on it with the controls supplier; draft by Friday.', createdAt: '2026-09-27T14:40:00Z' },
  { id: 3, bidId: 14, revisionId: 141, requirementId: 6004, authorUserId: 25, body: 'Reused from T-2026-0001: check that the references are current and relevant to chlorine dosing.', createdAt: '2026-09-22T10:00:00Z' },
  { id: 4, bidId: 14, revisionId: 141, requirementId: null, authorUserId: 27, body: 'Executive approval lapsed after the price change on 28 Sep; request it again when pricing is final.', createdAt: '2026-09-28T12:05:00Z' },
  { id: 5, bidId: 15, revisionId: 152, requirementId: 6006, authorUserId: 31, body: 'Deviation on lead time accepted; it is declared openly.', createdAt: '2026-09-29T13:00:00Z' },
  { id: 6, bidId: 7, revisionId: 71, requirementId: 2004, authorUserId: 35, body: 'Approved. Remember that approval is not submission: the signatory still has to submit.', createdAt: '2026-09-26T09:05:00Z' },
];

// Withdrawal of Tsodilo's T-2026-0008 response (AC-14 history).
const withdrawnReceipt = receipts.find((row) => row.bidId === 20);
if (withdrawnReceipt !== undefined) {
  withdrawals.push({
    id: 1,
    bidId: 20,
    revisionId: withdrawnReceipt.revisionId,
    receiptId: withdrawnReceipt.id,
    supplierTenantId: TENANT_IDS.tsodilo,
    withdrawnBy: 27,
    withdrawnAt: '2026-09-23T08:30:00Z',
    confirmationNo: 'WDR-2026-000001',
    reason: 'Manufacturer withdrew the price guarantee for the DN600 valves.',
  });
}

// Every persona id used above must exist.
for (const userId of [...new Set([...approvals.map((row) => row.approverUserId), ...comments.map((row) => row.authorUserId)])]) {
  if (!PERSONAS.some((persona) => persona.userId === userId)) {
    throw new Error(`Bids fixtures reference unknown user ${userId}.`);
  }
}

export const BIDS: readonly FixtureBid[] = Object.freeze(bids);
export const BID_REVISIONS: readonly FixtureRevision[] = Object.freeze(revisions);
export const BID_ANSWERS: readonly FixtureAnswer[] = Object.freeze(answers);
export const BID_ANSWER_ATTACHMENTS: readonly FixtureAnswerAttachment[] = Object.freeze(attachments);
export const BID_PRICES: readonly FixturePrice[] = Object.freeze(prices);
export const BID_COMMERCIAL_TERMS: readonly FixtureCommercialTerms[] = Object.freeze(terms);
export const BID_DECLARATIONS: readonly FixtureDeclaration[] = Object.freeze(declarations);
export const BID_SUBCONTRACTORS: readonly FixtureSubcontractor[] = Object.freeze(subcontractors);
export const BID_KEY_PERSONNEL: readonly FixtureKeyPerson[] = Object.freeze(keyPersonnel);
export const BID_CONSORTIUM_MEMBERS: readonly FixtureConsortiumMember[] = Object.freeze(consortiumMembers);
export const BID_EXCEPTIONS: readonly FixtureBidException[] = Object.freeze(exceptions);
export const BID_EVIDENCE: readonly FixtureBidEvidence[] = Object.freeze(bidEvidence);
export const BID_INTERNAL_APPROVALS: readonly FixtureInternalApproval[] = Object.freeze(approvals);
export const BID_COMMENTS: readonly FixtureBidComment[] = Object.freeze(comments);
export const SUBMISSION_ATTEMPTS: readonly FixtureAttempt[] = Object.freeze(attempts);
export const SUBMISSION_RECEIPTS: readonly FixtureReceipt[] = Object.freeze(receipts);
export const RECEIPT_INVENTORY: readonly FixtureInventoryItem[] = Object.freeze(inventory);
export const BID_WITHDRAWALS: readonly FixtureWithdrawal[] = Object.freeze(withdrawals);

/** The personas of a supplier's response team (bid manager, contributor, signatory). */
export function supplierPeople(supplierTenantId: number): { manager: number; contributor: number | null; signatory: number } | undefined {
  return SUPPLIER_PEOPLE[supplierTenantId];
}
