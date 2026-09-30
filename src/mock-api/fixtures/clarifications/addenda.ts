/**
 * `addenda`, `addendum_lots`, `addendum_requirement_changes` and the addendum notices' recipients
 * (`notice_recipients` + `participant_acknowledgments`) of the demo world (FR-10, BR-16, BR-41; BUY-17, SUP-10,
 * PUB-04). Every `addenda.status` appears. AC-10 is Addendum 1 of T-2026-0002: a new mandatory requirement (Q-05,
 * OIML R49 certificate) issued on 24 Sep 2026 after two submissions, moving the deadline from 14 to 21 October and
 * requiring acknowledgment and a supplement, with the prior receipts left intact.
 *
 * Alignment with the owning domains:
 * - prior receipts and completed supplements are DERIVED from the bids fixtures (`tenders.ts` helpers);
 * - acknowledgment times match the bids domain's `participant_acknowledgments` projection;
 * - requirement ids, codes and texts are the bids domain's requirements (id = tender id × 1000 + n);
 * - `approvalRequestId` is set only where the approvals fixtures hold the request (44: Addendum 3 of T-2026-0002,
 *   subject id 23, pending); the other approved addenda record the decision in their history.
 */
import type {
  AddendaExistingSubmissionAction,
  AddendaMateriality,
  AddendaStatus,
  AddendumRequirementChangesChangeType,
  ApprovalRequestsStatus,
  NoticeRecipientsDeliveryStatus,
  RequirementsTreatment,
} from '../../../contracts/enums.js';
import { TENANT_IDS } from '../platform.js';
import type { HistoryFixture } from './questions.js';
import { effectiveReceiptAt, receiptAfter, receiptStillEffective } from './tenders.js';

export interface RequirementChangeFixture {
  readonly id: number;
  readonly requirementId: number;
  readonly changeType: AddendumRequirementChangesChangeType;
  readonly previousText: string | null;
  readonly newText: string | null;
  readonly previousTreatment: RequirementsTreatment | null;
  readonly newTreatment: RequirementsTreatment | null;
}

export interface AddendumRecipientFixture {
  readonly supplierTenantId: number;
  readonly deliveryStatus: NoticeRecipientsDeliveryStatus;
  readonly deliveredAt: string | null;
  readonly openedAt: string | null;
  readonly acknowledgedAt: string | null;
  readonly acknowledgedBy: number | null;
  readonly failureReason: string | null;
  readonly hadSubmissionAtIssue: boolean;
  readonly priorReceiptNo: string | null;
  readonly priorReceivedAt: string | null;
  /** The prior receipt is still the supplier's effective one (false once the supplier's own later submission superseded it). */
  readonly priorReceiptStillEffective: boolean;
  readonly requiredAction: AddendaExistingSubmissionAction;
  readonly requiredActionCompleted: boolean;
}

export interface AddendumFixture {
  readonly id: number;
  readonly tenantId: number;
  readonly tenderId: number;
  readonly number: number;
  readonly title: string;
  readonly changeDescription: string;
  readonly reason: string;
  readonly materiality: AddendaMateriality;
  readonly changesScope: boolean;
  readonly changesTerms: boolean;
  readonly changesSubmission: boolean;
  readonly changesEvaluation: boolean;
  readonly newSubmissionDeadline: string | null;
  /** The tender deadline this addendum replaces (the before value of a date change). */
  readonly previousSubmissionDeadline: string | null;
  readonly responseTimeAssessment: string | null;
  readonly existingSubmissionAction: AddendaExistingSubmissionAction;
  readonly status: AddendaStatus;
  readonly approvalRequestId: number | null;
  readonly approvalStatus: ApprovalRequestsStatus | null;
  readonly issuedAt: string | null;
  readonly resultingVersionNo: number | null;
  readonly notice: { readonly noticeId: number; readonly noticeType: 'addendum' | 'deadline_change'; readonly title: string } | null;
  readonly acknowledgmentRequired: boolean;
  readonly lotIds: readonly number[];
  readonly requirementChanges: readonly RequirementChangeFixture[];
  readonly recipients: readonly AddendumRecipientFixture[];
  readonly withdrawnReason: string | null;
  readonly createdAt: string;
  readonly createdBy: number;
  readonly history: readonly HistoryFixture[];
}

/** What an addendum requires of a participant (BR-16): a supplement or replacement only of an existing submission. */
export function requiredActionFor(
  addendum: Pick<AddendumFixture, 'existingSubmissionAction' | 'acknowledgmentRequired'>,
  hasSubmission: boolean,
): AddendaExistingSubmissionAction {
  if (hasSubmission) {
    return addendum.existingSubmissionAction === 'none' && addendum.acknowledgmentRequired ? 'acknowledge' : addendum.existingSubmissionAction;
  }
  return addendum.acknowledgmentRequired ? 'acknowledge' : 'none';
}

interface DeliverySpec {
  readonly supplierTenantId: number;
  readonly deliveryStatus: NoticeRecipientsDeliveryStatus;
  readonly deliveredAt: string | null;
  readonly openedAt: string | null;
  readonly acknowledgedAt: string | null;
  readonly acknowledgedBy: number | null;
  readonly failureReason?: string;
}

/** A recipient whose prior receipt and completed action come from the bids fixtures. */
function recipient(
  addendum: { readonly tenderId: number; readonly issuedAt: string; readonly existingSubmissionAction: AddendaExistingSubmissionAction; readonly acknowledgmentRequired: boolean },
  spec: DeliverySpec,
): AddendumRecipientFixture {
  const prior = effectiveReceiptAt(addendum.tenderId, spec.supplierTenantId, addendum.issuedAt);
  const requiredAction = requiredActionFor(addendum, prior !== null);
  const completed =
    requiredAction === 'none'
      ? true
      : requiredAction === 'acknowledge'
        ? spec.acknowledgedAt !== null
        : receiptAfter(addendum.tenderId, spec.supplierTenantId, addendum.issuedAt) !== null;
  return {
    supplierTenantId: spec.supplierTenantId,
    deliveryStatus: spec.deliveryStatus,
    deliveredAt: spec.deliveredAt,
    openedAt: spec.openedAt,
    acknowledgedAt: spec.acknowledgedAt,
    acknowledgedBy: spec.acknowledgedBy,
    failureReason: spec.failureReason ?? null,
    hadSubmissionAtIssue: prior !== null,
    priorReceiptNo: prior?.receiptNo ?? null,
    priorReceivedAt: prior?.receivedAt ?? null,
    priorReceiptStillEffective: prior === null ? false : receiptStillEffective(prior),
    requiredAction,
    requiredActionCompleted: completed,
  };
}

const KWU = TENANT_IDS.kwu;

const A21 = { tenderId: 2, issuedAt: '2026-09-24T08:00:00Z', existingSubmissionAction: 'supplement', acknowledgmentRequired: true } as const;
const A11 = { tenderId: 1, issuedAt: '2026-07-03T08:00:00Z', existingSubmissionAction: 'none', acknowledgmentRequired: true } as const;
const A31 = { tenderId: 3, issuedAt: '2026-08-05T09:30:00Z', existingSubmissionAction: 'acknowledge', acknowledgmentRequired: true } as const;
const A111 = { tenderId: 11, issuedAt: '2026-09-20T07:00:00Z', existingSubmissionAction: 'none', acknowledgmentRequired: true } as const;

export const ADDENDA: readonly AddendumFixture[] = Object.freeze([
  // T-2026-0002 -----------------------------------------------------------------------------------------
  {
    id: 21,
    tenantId: KWU,
    ...A21,
    number: 1,
    title: 'OIML R49 type-approval certificate and deadline extension',
    changeDescription:
      'Adds mandatory requirement Q-05: a valid OIML R49 type-approval certificate for every offered meter model. The submission deadline moves from 14 October to 21 October 2026.',
    reason: 'The metrology regulator confirmed that only OIML R49 type-approved meters may be installed on public networks from 2027.',
    materiality: 'material',
    changesScope: false,
    changesTerms: false,
    changesSubmission: true,
    changesEvaluation: true,
    newSubmissionDeadline: '2026-10-21T10:00:00Z',
    previousSubmissionDeadline: '2026-10-14T10:00:00Z',
    responseTimeAssessment:
      'Manufacturers issue certified copies within five working days. Seven additional days let suppliers who already submitted supplement their offers.',
    status: 'issued',
    approvalRequestId: null,
    approvalStatus: 'approved',
    resultingVersionNo: 2,
    notice: { noticeId: 7021, noticeType: 'deadline_change', title: 'T-2026-0002 Addendum 1: OIML R49 certificate and new deadline' },
    lotIds: [201],
    requirementChanges: [
      {
        id: 2111,
        requirementId: 2008,
        changeType: 'added',
        previousText: null,
        newText: 'Provide a valid OIML R49 type-approval certificate for every offered meter model.',
        previousTreatment: null,
        newTreatment: 'mandatory_gate',
      },
    ],
    recipients: [
      recipient(A21, {
        supplierTenantId: TENANT_IDS['gaborone-meter'],
        deliveryStatus: 'delivered',
        deliveredAt: '2026-09-24T08:00:41Z',
        openedAt: '2026-09-24T09:30:12Z',
        acknowledgedAt: '2026-09-24T10:05:00Z',
        acknowledgedBy: 37,
      }),
      recipient(A21, {
        supplierTenantId: TENANT_IDS['chobe-pipe'],
        deliveryStatus: 'delivered',
        deliveredAt: '2026-09-24T08:00:44Z',
        openedAt: '2026-09-26T06:58:20Z',
        acknowledgedAt: null,
        acknowledgedBy: null,
      }),
      recipient(A21, {
        supplierTenantId: TENANT_IDS.tsodilo,
        deliveryStatus: 'delivered',
        deliveredAt: '2026-09-24T08:00:43Z',
        openedAt: '2026-09-24T12:14:55Z',
        acknowledgedAt: '2026-09-25T07:45:00Z',
        acknowledgedBy: 25,
      }),
      recipient(A21, {
        supplierTenantId: TENANT_IDS['serowe-ict'],
        deliveryStatus: 'delivered',
        deliveredAt: '2026-09-24T08:00:46Z',
        openedAt: '2026-09-27T08:10:00Z',
        acknowledgedAt: '2026-09-27T08:12:31Z',
        acknowledgedBy: 33,
      }),
    ],
    withdrawnReason: null,
    createdAt: '2026-09-19T13:00:00Z',
    createdBy: 5,
    history: [
      { at: '2026-09-19T13:00:00Z', action: 'drafted', actorUserId: 5, note: null },
      { at: '2026-09-22T09:00:00Z', action: 'approval_requested', actorUserId: 5, note: null },
      { at: '2026-09-23T15:40:00Z', action: 'approved', actorUserId: 4, note: 'Material change; seven days is proportionate.' },
      { at: '2026-09-24T08:00:00Z', action: 'issued', actorUserId: 5, note: 'Tender version 2; four recipients.' },
    ],
  },
  {
    id: 22,
    tenantId: KWU,
    tenderId: 2,
    number: 2,
    title: 'DLMS/COSEM accepted as meter reading export format',
    changeDescription:
      'Amends T-02 so that the meter data platform may export readings in DLMS/COSEM (IEC 62056) as an alternative to the CSV format of section 4.3.',
    reason: 'A supplier question showed that the CSV-only wording excludes a widely used utility standard.',
    materiality: 'material',
    changesScope: false,
    changesTerms: false,
    changesSubmission: true,
    changesEvaluation: false,
    newSubmissionDeadline: null,
    previousSubmissionDeadline: '2026-10-21T10:00:00Z',
    responseTimeAssessment: null,
    existingSubmissionAction: 'supplement',
    status: 'draft',
    approvalRequestId: null,
    approvalStatus: null,
    issuedAt: null,
    resultingVersionNo: null,
    notice: null,
    acknowledgmentRequired: true,
    lotIds: [201],
    requirementChanges: [
      {
        id: 2121,
        requirementId: 2004,
        changeType: 'modified',
        previousText: 'Describe the AMR communication technology and the meter data platform.',
        newText:
          'Describe the AMR communication technology and the meter data platform, including the reading export in the CSV format of section 4.3 or in DLMS/COSEM (IEC 62056).',
        previousTreatment: 'rated',
        newTreatment: 'rated',
      },
    ],
    recipients: [],
    withdrawnReason: null,
    createdAt: '2026-09-28T08:20:00Z',
    createdBy: 5,
    history: [{ at: '2026-09-28T08:20:00Z', action: 'drafted', actorUserId: 5, note: 'Escalated from a supplier question.' }],
  },
  {
    id: 23,
    tenantId: KWU,
    tenderId: 2,
    number: 3,
    title: 'Delivery schedule in two batches',
    changeDescription:
      'Amends D-01: the 12,000 domestic meters are delivered in two batches, in December 2026 and February 2027, instead of one consignment. The submission deadline is unchanged.',
    reason: 'Warehouse capacity at Francistown is limited until January 2027.',
    materiality: 'material',
    changesScope: false,
    changesTerms: true,
    changesSubmission: false,
    changesEvaluation: false,
    newSubmissionDeadline: null,
    previousSubmissionDeadline: '2026-10-21T10:00:00Z',
    responseTimeAssessment:
      'Suppliers only re-plan the delivery programme answered under D-01; three weeks remain before the deadline of 21 October.',
    existingSubmissionAction: 'supplement',
    status: 'awaiting_approval',
    approvalRequestId: 44,
    approvalStatus: 'pending',
    issuedAt: null,
    resultingVersionNo: null,
    notice: null,
    acknowledgmentRequired: true,
    lotIds: [201],
    requirementChanges: [
      {
        id: 2131,
        requirementId: 2006,
        changeType: 'modified',
        previousText: 'Provide the delivery and installation programme for 12,000 domestic meters.',
        newText: 'Provide the delivery and installation programme for 12,000 domestic meters, delivered in two batches (December 2026 and February 2027).',
        previousTreatment: 'rated',
        newTreatment: 'rated',
      },
    ],
    recipients: [],
    withdrawnReason: null,
    createdAt: '2026-09-27T10:00:00Z',
    createdBy: 4,
    history: [
      { at: '2026-09-27T10:00:00Z', action: 'drafted', actorUserId: 4, note: null },
      {
        at: '2026-09-29T07:00:00Z',
        action: 'approval_requested',
        actorUserId: 4,
        note: 'The drafter cannot approve his own addendum; another approver decides (BR-07).',
      },
    ],
  },

  // T-2026-0001 -----------------------------------------------------------------------------------------
  {
    id: 11,
    tenantId: KWU,
    ...A11,
    number: 1,
    title: 'Corrected pump duty points for lot 1',
    changeDescription:
      'Corrects the duty points of the lot 1 submersible pumps for boreholes 4, 9 and 12 in the specification schedule: 118 m head at 16 m³/h replaces 120 m at 18 m³/h.',
    reason: 'The pumping tests of June measured lower yields at three boreholes than the design assumed.',
    materiality: 'material',
    changesScope: true,
    changesTerms: false,
    changesSubmission: false,
    changesEvaluation: false,
    newSubmissionDeadline: null,
    previousSubmissionDeadline: '2026-07-24T08:00:00Z',
    responseTimeAssessment: 'Issued three weeks before the deadline and before any submission; the correction needs no extra time.',
    status: 'issued',
    approvalRequestId: null,
    approvalStatus: 'approved',
    resultingVersionNo: 2,
    notice: { noticeId: 7011, noticeType: 'addendum', title: 'T-2026-0001 Addendum 1: corrected pump duty points for lot 1' },
    lotIds: [101],
    requirementChanges: [],
    recipients: [
      recipient(A11, {
        supplierTenantId: TENANT_IDS.tsodilo,
        deliveryStatus: 'delivered',
        deliveredAt: '2026-07-03T08:00:30Z',
        openedAt: '2026-07-03T09:10:00Z',
        acknowledgedAt: '2026-07-03T09:12:00Z',
        acknowledgedBy: 25,
      }),
      recipient(A11, {
        supplierTenantId: TENANT_IDS['chobe-pipe'],
        deliveryStatus: 'delivered',
        deliveredAt: '2026-07-03T08:00:31Z',
        openedAt: '2026-07-06T07:30:00Z',
        acknowledgedAt: '2026-07-06T07:35:00Z',
        acknowledgedBy: 29,
      }),
      recipient(A11, {
        supplierTenantId: TENANT_IDS.makgadikgadi,
        deliveryStatus: 'delivered',
        deliveredAt: '2026-07-03T08:00:33Z',
        openedAt: '2026-07-07T11:00:00Z',
        acknowledgedAt: '2026-07-07T11:02:00Z',
        acknowledgedBy: 40,
      }),
    ],
    withdrawnReason: null,
    createdAt: '2026-06-26T09:00:00Z',
    createdBy: 5,
    history: [
      { at: '2026-06-26T09:00:00Z', action: 'drafted', actorUserId: 5, note: null },
      { at: '2026-07-02T14:00:00Z', action: 'approved', actorUserId: 4, note: null },
      { at: '2026-07-03T08:00:00Z', action: 'issued', actorUserId: 5, note: 'Tender version 2; three recipients.' },
    ],
  },
  {
    id: 12,
    tenantId: KWU,
    tenderId: 1,
    number: 2,
    title: 'Lot 2 solar array sizing for winter irradiance',
    changeDescription: 'Would have required the lot 2 solar arrays to be sized for June irradiance instead of the annual average.',
    reason: 'Two Kgalagadi boreholes ran dry in the winter of 2025.',
    materiality: 'material',
    changesScope: true,
    changesTerms: false,
    changesSubmission: false,
    changesEvaluation: false,
    newSubmissionDeadline: '2026-07-31T08:00:00Z',
    previousSubmissionDeadline: '2026-07-24T08:00:00Z',
    responseTimeAssessment: 'One extra week to resize the arrays.',
    existingSubmissionAction: 'supplement',
    status: 'withdrawn',
    approvalRequestId: null,
    approvalStatus: null,
    issuedAt: null,
    resultingVersionNo: null,
    notice: null,
    acknowledgmentRequired: true,
    lotIds: [102],
    requirementChanges: [],
    recipients: [],
    withdrawnReason: 'Superseded by the decision to cancel lot 2 and re-tender the solar pumping systems.',
    createdAt: '2026-07-08T10:00:00Z',
    createdBy: 5,
    history: [
      { at: '2026-07-08T10:00:00Z', action: 'drafted', actorUserId: 5, note: null },
      { at: '2026-07-13T08:00:00Z', action: 'withdrawn', actorUserId: 5, note: 'Lot 2 to be cancelled.' },
    ],
  },

  // T-2026-0003 -----------------------------------------------------------------------------------------
  {
    id: 31,
    tenantId: KWU,
    ...A31,
    number: 1,
    title: 'Sites using IEC 60870-5-104',
    changeDescription: 'Adds the list of eleven sites that use IEC 60870-5-104 today to the site list annex. T-01 is unchanged.',
    reason: 'Answer to a supplier question; the information helps every bidder size the RTU configuration.',
    materiality: 'non_material',
    changesScope: false,
    changesTerms: false,
    changesSubmission: false,
    changesEvaluation: false,
    newSubmissionDeadline: null,
    previousSubmissionDeadline: '2026-08-28T08:00:00Z',
    responseTimeAssessment: 'Information only; no additional time needed.',
    status: 'issued',
    approvalRequestId: null,
    approvalStatus: 'approved',
    resultingVersionNo: 2,
    notice: { noticeId: 7031, noticeType: 'addendum', title: 'T-2026-0003 Addendum 1: sites using IEC 60870-5-104' },
    lotIds: [301],
    requirementChanges: [],
    recipients: [
      recipient(A31, {
        supplierTenantId: TENANT_IDS['serowe-ict'],
        deliveryStatus: 'delivered',
        deliveredAt: '2026-08-05T09:30:20Z',
        openedAt: '2026-08-05T10:58:00Z',
        acknowledgedAt: '2026-08-05T11:00:00Z',
        acknowledgedBy: 33,
      }),
      recipient(A31, {
        supplierTenantId: TENANT_IDS.tsodilo,
        deliveryStatus: 'delivered',
        deliveredAt: '2026-08-05T09:30:21Z',
        openedAt: '2026-08-06T07:25:00Z',
        acknowledgedAt: '2026-08-06T07:30:00Z',
        acknowledgedBy: 25,
      }),
      recipient(A31, {
        supplierTenantId: TENANT_IDS.makgadikgadi,
        deliveryStatus: 'failed',
        deliveredAt: null,
        openedAt: null,
        acknowledgedAt: '2026-08-06T09:00:00Z',
        acknowledgedBy: 40,
        failureReason: 'The email address of the supplier contact bounced; the in-app notice was acknowledged.',
      }),
    ],
    withdrawnReason: null,
    createdAt: '2026-07-30T08:00:00Z',
    createdBy: 5,
    history: [
      { at: '2026-07-30T08:00:00Z', action: 'drafted', actorUserId: 5, note: null },
      { at: '2026-08-04T16:00:00Z', action: 'approved', actorUserId: 4, note: null },
      { at: '2026-08-05T09:30:00Z', action: 'issued', actorUserId: 5, note: 'Tender version 2; three recipients.' },
    ],
  },

  // T-2026-0006 -----------------------------------------------------------------------------------------
  {
    id: 61,
    tenantId: KWU,
    tenderId: 6,
    number: 1,
    title: 'Alternative date for the mandatory site visit',
    changeDescription: 'Adds a second date for the mandatory Mmashoro site visit on 9 October 2026. Attending either date meets the condition.',
    reason: 'One invited supplier cannot attend on 8 October; an alternative date keeps participation equal.',
    materiality: 'non_material',
    changesScope: false,
    changesTerms: false,
    changesSubmission: false,
    changesEvaluation: false,
    newSubmissionDeadline: null,
    previousSubmissionDeadline: '2026-10-14T10:00:00Z',
    responseTimeAssessment: 'No change to the submission deadline is needed.',
    existingSubmissionAction: 'acknowledge',
    status: 'approved',
    approvalRequestId: null,
    approvalStatus: 'approved',
    issuedAt: null,
    resultingVersionNo: null,
    notice: null,
    acknowledgmentRequired: true,
    lotIds: [601],
    requirementChanges: [],
    recipients: [],
    withdrawnReason: null,
    createdAt: '2026-09-26T09:00:00Z',
    createdBy: 5,
    history: [
      { at: '2026-09-26T09:00:00Z', action: 'drafted', actorUserId: 5, note: null },
      { at: '2026-09-29T11:00:00Z', action: 'approved', actorUserId: 4, note: null },
    ],
  },

  // T-2026-0011 (ODC) -----------------------------------------------------------------------------------
  {
    id: 111,
    tenantId: TENANT_IDS.odc,
    ...A111,
    number: 1,
    title: 'Revised floor plan and deadline extension',
    changeDescription:
      'Replaces the floor plan of lot 1: the cleaned area of the council headquarters grows from 3,200 m² to 3,850 m² with the library annex. The deadline moves from 16 to 23 October 2026.',
    reason: 'The library annex moves into council management on 1 November 2026.',
    materiality: 'material',
    changesScope: true,
    changesTerms: false,
    changesSubmission: false,
    changesEvaluation: false,
    newSubmissionDeadline: '2026-10-23T10:00:00Z',
    previousSubmissionDeadline: '2026-10-21T10:00:00Z',
    responseTimeAssessment: 'One week to re-measure and re-price the larger area.',
    status: 'issued',
    approvalRequestId: null,
    approvalStatus: 'approved',
    resultingVersionNo: 2,
    notice: { noticeId: 7111, noticeType: 'deadline_change', title: 'T-2026-0011 Addendum 1: revised floor plan and new deadline' },
    lotIds: [1101],
    requirementChanges: [],
    recipients: [
      recipient(A111, {
        supplierTenantId: TENANT_IDS['limpopo-env'],
        deliveryStatus: 'delivered',
        deliveredAt: '2026-09-20T07:00:25Z',
        openedAt: '2026-09-21T07:55:00Z',
        acknowledgedAt: '2026-09-21T08:00:00Z',
        acknowledgedBy: 41,
      }),
      recipient(A111, {
        supplierTenantId: TENANT_IDS.makgadikgadi,
        deliveryStatus: 'delivered',
        deliveredAt: '2026-09-20T07:00:27Z',
        openedAt: '2026-09-22T07:38:00Z',
        acknowledgedAt: '2026-09-22T07:40:00Z',
        acknowledgedBy: 40,
      }),
    ],
    withdrawnReason: null,
    createdAt: '2026-09-17T09:00:00Z',
    createdBy: 23,
    history: [
      { at: '2026-09-17T09:00:00Z', action: 'drafted', actorUserId: 23, note: null },
      { at: '2026-09-19T15:00:00Z', action: 'approved', actorUserId: null, note: 'Approved by the council tender committee.' },
      { at: '2026-09-20T07:00:00Z', action: 'issued', actorUserId: 23, note: 'Tender version 2; two recipients.' },
    ],
  },
]);
