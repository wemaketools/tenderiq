/**
 * Contracts contract (domain 14): contract formation from awarded lot outcomes, review and differences from the
 * award, signature and commencement, procurement handover, obligations and milestones, securities, performance,
 * the financial view, changes and disputes, renewal options and closeout (buyer CON-01 … CON-11) plus the supplier's
 * own contracts (SUP-23).
 *
 * Business rules the contract fixes for both stages (PRD §7.15, §7.16, §8.3, §13.1; BR-04, BR-33, BR-35 … BR-37):
 * - A contract is created from final-awarded lot outcomes through allocations whose sum per lot outcome never exceeds
 *   the awarded value (BR-33, `ALLOCATION_EXCEEDS_AWARD`). The contracting legal entity and the supplier legal party
 *   are required (BR-04).
 * - A contract that differs from the approved award carries `differsFromAward`, an explanation and a
 *   `contract_difference` approval; signature and commencement are refused until it is approved
 *   (`DIFFERENCE_NOT_APPROVED`, AC-28, DD-14).
 * - Signature, effective date, notice to proceed, delivery start and handover acceptance are separate milestones
 *   (BR-35). Signatures are either in-app or recorded from external evidence; in-app evidence is never fabricated.
 * - Losing bids and internal evaluation deliberations never appear in the handover or any supplier projection.
 * - Obligation evidence is decided with reasons and remediation; acceptance never implies payment readiness (AC-30).
 * - Change authority is checked on the CUMULATIVE contract value after the change, not on the single change (AC-31).
 * - Renewal options are decided explicitly; a notice window only alerts (`noAutomaticRenewal: true`, AC-32, BR-37).
 * - `renewal_options` is buyer-internal ([R], DD-03): no supplier response schema carries it.
 * - The supplier audience sees only its own contracts once they leave internal preparation (never `draft` or
 *   `under_review`), and only supplier-shared records (PRD §4.3, §13.1).
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import { CustomFieldValues } from './policy/shared.js';

import {
  ActorRef,
  CalendarDate,
  DecimalString,
  Id,
  IdParam,
  Instant,
  Money,
  NonNegativeMoney,
  OfficialDeadline,
  PersonRef,
  QueryBoolean,
  ReasonText,
  Reference,
  Slug,
  TimeZone,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from './common.js';
import { defineEndpoint } from './endpoint.js';
import {
  AcceptanceDecisionsDecision,
  ApprovalRequestsStatus,
  ApprovalRequestsSubjectType,
  AuthorityLimitsDecisionType,
  ChangeRequestsRaisedByParty,
  ChangeRequestsStatus,
  ContractCloseoutsStatus,
  ContractDisputesDisputeType,
  ContractDisputesStatus,
  ContractIncidentsIncidentType,
  ContractIncidentsSeverity,
  ContractIncidentsStatus,
  ContractInvoicesAcceptanceStatus,
  ContractInvoicesPaymentStatus,
  ContractInvoicesSource,
  ContractSecuritiesSecurityType,
  ContractSecuritiesStatus,
  ContractSignatoriesMethod,
  ContractSignatoriesParty,
  ContractSignatoriesStatus,
  ContractsStatus,
  HandoversStatus,
  HoldsBlockedActions,
  HoldsHoldType,
  ImprovementActionsStatus,
  LotOutcomesOutcome,
  LotOutcomesStatus,
  ObligationsKind,
  ObligationsParty,
  ObligationsStatus,
  PerformanceReviewsOverallRating,
  PerformanceReviewsStatus,
  RenewalOptionsDecision,
  RenewalOptionsOptionType,
  RenewalOptionsStatus,
} from './enums.js';

// ---------------------------------------------------------------------------------------------------------
// Contract-defined presentational enumerations (not stored; derived by the service)
// ---------------------------------------------------------------------------------------------------------

/** State of one readiness / precondition / closeout check (rendered by ReadinessChecklist). */
export const CONTRACT_CHECK_STATES = ['passed', 'warning', 'blocking'] as const;
export const ContractCheckState = z.enum(CONTRACT_CHECK_STATES);
export type ContractCheckState = z.infer<typeof ContractCheckState>;

/** The next decision a contract needs (CON-01 "identify upcoming decisions"). */
export const CONTRACT_DECISION_KINDS = [
  'difference_approval',
  'review_approval',
  'signature',
  'commencement',
  'handover_acceptance',
  'renewal_notice',
  'change_approval',
  'security_expiry',
  'closeout',
] as const;
export const ContractDecisionKind = z.enum(CONTRACT_DECISION_KINDS);
export type ContractDecisionKind = z.infer<typeof ContractDecisionKind>;

/** The separate commencement milestones of BR-35. */
export const CONTRACT_MILESTONE_KEYS = [
  'signed',
  'effective',
  'notice_to_proceed',
  'delivery_start',
  'handover_accepted',
] as const;
export const ContractMilestoneKey = z.enum(CONTRACT_MILESTONE_KEYS);
export type ContractMilestoneKey = z.infer<typeof ContractMilestoneKey>;

export const CONTRACT_MILESTONE_STATES = ['done', 'pending', 'blocked'] as const;
export const ContractMilestoneState = z.enum(CONTRACT_MILESTONE_STATES);
export type ContractMilestoneState = z.infer<typeof ContractMilestoneState>;

/** Where a renewal notice window stands relative to the request time. */
export const RENEWAL_WINDOW_STATES = ['not_open', 'open', 'closed'] as const;
export const RenewalWindowState = z.enum(RENEWAL_WINDOW_STATES);
export type RenewalWindowState = z.infer<typeof RenewalWindowState>;

/** A contract-level review decision (CON-02). */
export const CONTRACT_REVIEW_DECISIONS = ['approve', 'return'] as const;
export const ContractReviewDecision = z.enum(CONTRACT_REVIEW_DECISIONS);
export type ContractReviewDecision = z.infer<typeof ContractReviewDecision>;

/** A change-request approval decision (CON-09). */
export const CHANGE_DECISIONS = ['approve', 'reject', 'return'] as const;
export const ChangeDecision = z.enum(CHANGE_DECISIONS);
export type ChangeDecision = z.infer<typeof ChangeDecision>;

/** Who a contract assignee list is for (CON-01 owners, obligation owners, remediation owners). */
export const CONTRACT_ASSIGNEE_PURPOSES = ['owner', 'contract_manager', 'obligation_owner', 'signatory'] as const;
export const ContractAssigneePurpose = z.enum(CONTRACT_ASSIGNEE_PURPOSES);
export type ContractAssigneePurpose = z.infer<typeof ContractAssigneePurpose>;

/** Dispute types a supplier may raise itself (remedies, credits and penalties are buyer decisions). */
export const SUPPLIER_DISPUTE_TYPES = ['dispute', 'claim'] as const;
export const SupplierDisputeType = z.enum(SUPPLIER_DISPUTE_TYPES);
export type SupplierDisputeType = z.infer<typeof SupplierDisputeType>;

// ---------------------------------------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------------------------------------

function queryInteger(code: string, min: number, max: number) {
  return z
    .union([z.number(), z.string().regex(/^\d{1,6}$/, issue(code, 'Must be a whole number.'))])
    .transform((value) => Number(value))
    .pipe(
      z
        .number()
        .int(issue(code, 'Must be a whole number.'))
        .min(min, issue(code, `Must be at least ${min}.`))
        .max(max, issue(code, `Must be at most ${max}.`)),
    );
}

const Title = z
  .string({ error: issue('TITLE_REQUIRED', 'A title is required.') })
  .trim()
  .min(3, issue('TITLE_TOO_SHORT', 'At least 3 characters.'))
  .max(200, issue('TEXT_TOO_LONG', 'At most 200 characters.'));

const LongText = z.string().trim().max(8000, issue('TEXT_TOO_LONG', 'At most 8000 characters.'));
const ShortText = z.string().trim().max(500, issue('TEXT_TOO_LONG', 'At most 500 characters.'));

/** Money that must be strictly positive (allocations, invoices). */
const PositiveMoney = NonNegativeMoney.refine((money) => !/^0+(\.0+)?$/.test(money.amount), {
  message: issue('AMOUNT_MUST_BE_POSITIVE', 'The amount must be greater than zero.'),
  path: ['amount'],
});

/** An explicit confirmation of a consequential action (COM-02). */
const Confirmation = z.literal(true, { error: issue('CONFIRMATION_REQUIRED', 'Confirm the action to continue.') });

/** `CR-0001` display of `change_requests.number` (DD-09). */
export function changeRequestLabel(number: number): string {
  return `CR-${String(number).padStart(4, '0')}`;
}

// ---------------------------------------------------------------------------------------------------------
// References
// ---------------------------------------------------------------------------------------------------------

/** The supplier legal party (`contracts.supplier_tenant_id`). */
export const SupplierPartyRef = z.object({
  tenantId: Id,
  name: z.string().min(1),
  slug: Slug,
});
export type SupplierPartyRef = z.infer<typeof SupplierPartyRef>;

/** The buyer organization as a supplier sees it. */
export const BuyerPartyRef = z.object({
  tenantId: Id,
  name: z.string().min(1),
});
export type BuyerPartyRef = z.infer<typeof BuyerPartyRef>;

/** The contracting legal entity (`contracts.legal_entity_id`, BR-04). */
export const LegalEntityRef = z.object({
  legalEntityId: Id,
  name: z.string().min(1),
  registrationNumber: z.string().nullable(),
});
export type LegalEntityRef = z.infer<typeof LegalEntityRef>;

/** The tender a contract results from; `null` for an imported historical contract without one. */
export const ContractTenderRef = z.object({
  tenderId: Id,
  reference: Reference,
  title: z.string().min(1),
});
export type ContractTenderRef = z.infer<typeof ContractTenderRef>;

/** An approval linked to a contract record (`approval_requests`, DD-14 subject types). */
export const ContractApprovalRef = z.object({
  approvalId: Id,
  subjectType: ApprovalRequestsSubjectType,
  status: ApprovalRequestsStatus,
  title: z.string().min(1),
  amount: Money.nullable(),
  requestedBy: PersonRef,
  requestedAt: Instant,
  currentApprover: PersonRef.nullable(),
  decidedAt: Instant.nullable(),
  /**
   * Resolved per viewer: true only when the approval workspace (`/me/approvals/:approvalId`) holds this request AND
   * opens it for the viewer (the requester, an approver or a delegate). Otherwise the SPA shows plain text.
   */
  inApprovalWorkspace: z.boolean(),
});
export type ContractApprovalRef = z.infer<typeof ContractApprovalRef>;

/** One readiness, precondition or closeout check. */
export const ContractCheck = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  detail: z.string().nullable(),
  state: ContractCheckState,
});
export type ContractCheck = z.infer<typeof ContractCheck>;

/** A document reference (signed edition, schedules, evidence). */
export const ContractDocumentRef = z.object({
  documentId: Id,
  versionId: Id.nullable(),
  title: z.string().min(1),
  fileName: z.string().nullable(),
});
export type ContractDocumentRef = z.infer<typeof ContractDocumentRef>;

/** The next decision a contract needs, with its official deadline. */
export const ContractNextDecision = z.object({
  kind: ContractDecisionKind,
  dueAt: OfficialDeadline.nullable(),
  detail: z.string().nullable(),
});
export type ContractNextDecision = z.infer<typeof ContractNextDecision>;

// ---------------------------------------------------------------------------------------------------------
// CON-01 register
// ---------------------------------------------------------------------------------------------------------

/** One row of the contract register (`contracts` + derived figures). */
export const ContractRow = z.object({
  id: Id,
  reference: Reference,
  title: z.string().min(1),
  status: ContractsStatus,
  supplier: SupplierPartyRef,
  legalEntity: LegalEntityRef,
  tender: ContractTenderRef.nullable(),
  owner: PersonRef.nullable(),
  contractManager: PersonRef.nullable(),
  scopeSummary: z.string(),
  /** Original contract value (`contracts.value`). */
  value: Money,
  /** Value after agreed or incorporated changes. */
  currentValue: Money,
  ceiling: Money.nullable(),
  remainingCeiling: Money.nullable(),
  termStart: CalendarDate.nullable(),
  termEnd: CalendarDate.nullable(),
  /** The earliest undecided renewal / extension / termination notice deadline. */
  nextRenewalDeadline: OfficialDeadline.nullable(),
  /** The notice window of that same option: its opening date, state and days until it opens (AC-32). */
  nextRenewalWindow: z
    .object({
      windowStart: CalendarDate.nullable(),
      state: RenewalWindowState,
      daysUntilOpens: z.number().int().nullable(),
    })
    .nullable(),
  nextDecision: ContractNextDecision.nullable(),
  differsFromAward: z.boolean(),
  handoverStatus: HandoversStatus.nullable(),
  overdueObligations: z.number().int().min(0),
  /** Provenance of an imported historical contract (`import_batches.origin`), else `null`. */
  origin: z.string().nullable(),
});
export type ContractRow = z.infer<typeof ContractRow>;

export const CONTRACT_SORT_FIELDS = ['reference', 'title', 'status', 'value', 'termEnd', 'nextDecision', 'supplier'] as const;

export const ContractListQuery = listQueryWithSort(CONTRACT_SORT_FIELDS).extend({
  status: queryList(ContractsStatus).optional(),
  ownerUserId: IdParam.optional(),
  contractManagerUserId: IdParam.optional(),
  supplierTenantId: IdParam.optional(),
  legalEntityId: IdParam.optional(),
  termEndFrom: CalendarDate.optional(),
  termEndTo: CalendarDate.optional(),
  /** Only contracts with an undecided renewal notice deadline within this many days. */
  renewalWithinDays: queryInteger('INVALID_DAYS', 1, 3650).optional(),
  /** Only contracts that need a decision (`nextDecision` not null). */
  upcomingDecision: QueryBoolean.optional(),
  differsFromAward: QueryBoolean.optional(),
});
export type ContractListQuery = z.output<typeof ContractListQuery>;

/** Register totals over every contract the caller may see (not only the current page, BR-43). */
export const ContractRegisterSummary = z.object({
  byStatus: z.array(z.object({ status: ContractsStatus, count: z.number().int().min(0) })),
  upcomingDecisions: z.number().int().min(0),
  /** Contracts with an undecided option whose notice window opens, or whose notice deadline falls, within 90 days. */
  renewalsWithin90Days: z.number().int().min(0),
  overdueObligations: z.number().int().min(0),
  /** Current value per currency (never summed across currencies). */
  currentValueByCurrency: z.array(Money),
});
export type ContractRegisterSummary = z.infer<typeof ContractRegisterSummary>;

export const ContractListResponse = pageOf(ContractRow).extend({ summary: ContractRegisterSummary });
export type ContractListResponse = z.infer<typeof ContractListResponse>;

// ---------------------------------------------------------------------------------------------------------
// CON-05 overview (contract detail)
// ---------------------------------------------------------------------------------------------------------

/** One awarded lot allocated to the contract (`contract_lot_allocations`, BR-33). */
export const ContractLotAllocation = z.object({
  id: Id,
  lotOutcomeId: Id,
  tenderReference: Reference,
  lotNumber: z.number().int().min(1),
  lotTitle: z.string().min(1),
  awardedValue: Money,
  allocatedValue: Money,
  /** Allocated to other contracts from the same lot outcome. */
  allocatedElsewhere: Money,
  /** Awarded value not yet allocated to any contract. */
  unallocated: Money,
});
export type ContractLotAllocation = z.infer<typeof ContractLotAllocation>;

/** One BR-35 milestone. */
export const ContractMilestone = z.object({
  key: ContractMilestoneKey,
  state: ContractMilestoneState,
  at: Instant.nullable(),
  date: CalendarDate.nullable(),
  detail: z.string().nullable(),
});
export type ContractMilestone = z.infer<typeof ContractMilestone>;

/** A key contact of either party. */
export const ContractContact = z.object({
  party: ObligationsParty,
  name: z.string().min(1),
  role: z.string().min(1),
  email: z.string().nullable(),
  phone: z.string().nullable(),
});
export type ContractContact = z.infer<typeof ContractContact>;

/** A bond, guarantee, insurance, license, certification or retention (`contract_securities`). */
export const ContractSecurity = z.object({
  id: Id,
  securityType: ContractSecuritiesSecurityType,
  issuer: z.string().nullable(),
  amount: Money.nullable(),
  expiresAt: Instant.nullable(),
  status: ContractSecuritiesStatus,
  releasedAt: Instant.nullable(),
  releaseApproval: ContractApprovalRef.nullable(),
  evidence: z.object({ evidenceItemId: Id, title: z.string().min(1) }).nullable(),
});
export type ContractSecurity = z.infer<typeof ContractSecurity>;

/** An active hold on the contract (`holds`, e.g. a suspension). */
export const ContractHold = z.object({
  holdId: Id,
  holdType: HoldsHoldType,
  reason: z.string().min(1),
  blockedActions: z.array(HoldsBlockedActions),
  startedAt: Instant,
  reviewDate: CalendarDate.nullable(),
  owner: PersonRef.nullable(),
});
export type ContractHold = z.infer<typeof ContractHold>;

export const ObligationCounts = z.object({
  total: z.number().int().min(0),
  open: z.number().int().min(0),
  overdue: z.number().int().min(0),
  rejected: z.number().int().min(0),
  awaitingReview: z.number().int().min(0),
  surviving: z.number().int().min(0),
});
export type ObligationCounts = z.infer<typeof ObligationCounts>;

export const ContractDetail = ContractRow.extend({
  /** The buyer's official time zone; every deadline of the contract travels with it. */
  timeZone: TimeZone,
  recommendationId: Id.nullable(),
  scope: z.string(),
  optionsSummary: z.string().nullable(),
  serviceLocations: z.string().nullable(),
  paymentTerms: z.string().nullable(),
  securitiesSummary: z.string().nullable(),
  signedAt: Instant.nullable(),
  effectiveDate: CalendarDate.nullable(),
  noticeToProceedAt: Instant.nullable(),
  deliveryStartAt: Instant.nullable(),
  signedOutsideApp: z.boolean(),
  externalSignatureEvidence: z.string().nullable(),
  signedDocument: ContractDocumentRef.nullable(),
  differenceExplanation: z.string().nullable(),
  differenceApproval: ContractApprovalRef.nullable(),
  allocations: z.array(ContractLotAllocation),
  milestones: z.array(ContractMilestone),
  contacts: z.array(ContractContact),
  securities: z.array(ContractSecurity),
  holds: z.array(ContractHold),
  obligationCounts: ObligationCounts,
  /** Original business date of an imported contract (`import_records.original_business_date`). */
  originalBusinessDate: CalendarDate.nullable(),
  createdAt: Instant,
  /** The organization's additional business fields of the contract form (ADM-07); absent when none are recorded. */
  customFields: CustomFieldValues.optional(),
});
export type ContractDetail = z.infer<typeof ContractDetail>;

// ---------------------------------------------------------------------------------------------------------
// CON-02 preparation and review
// ---------------------------------------------------------------------------------------------------------

/** A final-awarded lot outcome that can back a contract (`lot_outcomes`). */
export const AwardSource = z.object({
  lotOutcomeId: Id,
  tender: ContractTenderRef,
  lotNumber: z.number().int().min(1),
  lotTitle: z.string().min(1),
  supplier: SupplierPartyRef.nullable(),
  /** `null` while the lot is still under assessment and has no recommended outcome. */
  outcome: LotOutcomesOutcome.nullable(),
  status: LotOutcomesStatus.nullable(),
  awardedValue: Money.nullable(),
  allocatedValue: Money,
  remainingValue: Money.nullable(),
  contracts: z.array(z.object({ contractId: Id, reference: Reference, allocatedValue: Money })),
  finalAwardedAt: Instant.nullable(),
  conditions: z.string().nullable(),
  availableForContract: z.boolean(),
  unavailableReason: z.string().nullable(),
});
export type AwardSource = z.infer<typeof AwardSource>;

export const AwardSourcesResponse = z.object({
  lotOutcomes: z.array(AwardSource),
  legalEntities: z.array(LegalEntityRef),
});
export type AwardSourcesResponse = z.infer<typeof AwardSourcesResponse>;

/** An agreed document in order of precedence. */
export const ContractAgreedDocument = z.object({
  id: Id,
  precedence: z.number().int().min(1),
  title: z.string().min(1),
  kind: z.string().min(1),
  document: ContractDocumentRef.nullable(),
  isSigned: z.boolean(),
});
export type ContractAgreedDocument = z.infer<typeof ContractAgreedDocument>;

/** A negotiated or accepted exception to the tender terms. */
export const ContractException = z.object({
  id: Id,
  clause: z.string().min(1),
  description: z.string().min(1),
  agreedPosition: z.string().min(1),
});
export type ContractException = z.infer<typeof ContractException>;

/** One difference between the approved award and the proposed contract (AC-28). */
export const AwardDifference = z.object({
  field: z.string().min(1),
  label: z.string().min(1),
  awarded: z.string(),
  proposed: z.string(),
  amountDelta: Money.nullable(),
  material: z.boolean(),
});
export type AwardDifference = z.infer<typeof AwardDifference>;

export const ContractPreparation = z.object({
  contractId: Id,
  reference: Reference,
  status: ContractsStatus,
  /** Increases with every material edit; an approval targets one version. */
  version: z.number().int().min(1),
  awardedScope: z.array(ContractLotAllocation),
  agreedDocuments: z.array(ContractAgreedDocument),
  exceptions: z.array(ContractException),
  differences: z.array(AwardDifference),
  differsFromAward: z.boolean(),
  differenceExplanation: z.string().nullable(),
  differenceApproval: ContractApprovalRef.nullable(),
  approvalHistory: z.array(ContractApprovalRef),
  checks: z.array(ContractCheck),
});
export type ContractPreparation = z.infer<typeof ContractPreparation>;

export const ContractAllocationInput = z.object({
  lotOutcomeId: Id,
  allocatedValue: PositiveMoney,
});

export const CreateContractBody = z
  .object({
    title: Title,
    tenderId: Id,
    supplierTenantId: Id,
    legalEntityId: z
      .number({ error: issue('LEGAL_ENTITY_REQUIRED', 'Choose the contracting legal entity (BR-04).') })
      .int(issue('LEGAL_ENTITY_REQUIRED', 'Choose the contracting legal entity (BR-04).'))
      .positive(issue('LEGAL_ENTITY_REQUIRED', 'Choose the contracting legal entity (BR-04).')),
    allocations: z
      .array(ContractAllocationInput)
      .min(1, issue('ALLOCATION_REQUIRED', 'Allocate at least one awarded lot.')),
    value: PositiveMoney,
    ceiling: NonNegativeMoney.optional(),
    termStart: CalendarDate.optional(),
    termEnd: CalendarDate.optional(),
    scope: LongText.min(1, issue('SCOPE_REQUIRED', 'Describe the contracted scope.')),
    paymentTerms: LongText.optional(),
    serviceLocations: LongText.optional(),
    optionsSummary: LongText.optional(),
    differenceExplanation: LongText.optional(),
    ownerUserId: Id.optional(),
    contractManagerUserId: Id.optional(),
    /**
     * Values of the organization's additional business fields (ADM-07). A save rejects values of the wrong type
     * (`customFields.<key>`); required fields are checked when the draft is submitted for review.
     */
    customFields: CustomFieldValues.optional(),
  })
  .superRefine((body, ctx) => {
    if (body.termStart !== undefined && body.termEnd !== undefined && body.termEnd < body.termStart) {
      ctx.addIssue({ code: 'custom', path: ['termEnd'], message: issue('TERM_END_BEFORE_START', 'The term must end after it starts.') });
    }
    if (body.ceiling !== undefined && body.ceiling.currency !== body.value.currency) {
      ctx.addIssue({ code: 'custom', path: ['ceiling'], message: issue('CURRENCY_MISMATCH', 'The ceiling must use the contract currency.') });
    }
  });
export type CreateContractBody = z.input<typeof CreateContractBody>;

export const UpdateContractBody = z
  .object({
    title: Title.optional(),
    scope: LongText.optional(),
    value: PositiveMoney.optional(),
    ceiling: NonNegativeMoney.nullable().optional(),
    termStart: CalendarDate.nullable().optional(),
    termEnd: CalendarDate.nullable().optional(),
    paymentTerms: LongText.nullable().optional(),
    serviceLocations: LongText.nullable().optional(),
    optionsSummary: LongText.nullable().optional(),
    securitiesSummary: LongText.nullable().optional(),
    differenceExplanation: LongText.nullable().optional(),
    /** Values of the organization's additional business fields (ADM-07); see `CreateContractBody.customFields`. */
    customFields: CustomFieldValues.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: issue('NOTHING_TO_UPDATE', 'Change at least one field.'),
  });
export type UpdateContractBody = z.input<typeof UpdateContractBody>;

export const ContractUpdateResult = z.object({
  contractId: Id,
  status: ContractsStatus,
  version: z.number().int().min(1),
  differsFromAward: z.boolean(),
  /** A material edit invalidates a pending or approved difference/contract approval (BR-10). */
  approvalsInvalidated: z.boolean(),
});
export type ContractUpdateResult = z.infer<typeof ContractUpdateResult>;

export const ContractStatusResult = z.object({
  contractId: Id,
  reference: Reference,
  status: ContractsStatus,
  differsFromAward: z.boolean(),
  /** True when a `contract_difference` approval must be approved before signature (AC-28). */
  differenceApprovalRequired: z.boolean(),
  message: z.string().min(1),
});
export type ContractStatusResult = z.infer<typeof ContractStatusResult>;

export const ContractReviewDecisionBody = z.object({
  decision: ContractReviewDecision,
  reason: ReasonText,
});

export const AssignOwnersBody = z
  .object({
    ownerUserId: Id.optional(),
    contractManagerUserId: Id.optional(),
  })
  .refine((body) => body.ownerUserId !== undefined || body.contractManagerUserId !== undefined, {
    message: issue('ASSIGNEE_REQUIRED', 'Choose an owner or a contract manager.'),
  });

export const AssignOwnersResult = z.object({
  contractId: Id,
  owner: PersonRef.nullable(),
  contractManager: PersonRef.nullable(),
});

export const ContractAssignee = z.object({
  userId: Id,
  fullName: z.string().min(1),
  capacity: z.string().nullable(),
  canManage: z.boolean(),
  canSign: z.boolean(),
  canApproveChanges: z.boolean(),
  /** Authority held for the purpose (signature or change approval), `null` when none is recorded. */
  authorityLimit: Money.nullable(),
});
export type ContractAssignee = z.infer<typeof ContractAssignee>;

export const ContractAssigneesQuery = z.object({
  purpose: ContractAssigneePurpose.optional(),
  q: z.string().trim().max(200, issue('QUERY_TOO_LONG', 'At most 200 characters.')).optional(),
});

export const ContractAssigneesResponse = z.object({ items: z.array(ContractAssignee) });

// ---------------------------------------------------------------------------------------------------------
// CON-03 signature and commencement
// ---------------------------------------------------------------------------------------------------------

export const ContractSignatory = z.object({
  id: Id,
  party: ContractSignatoriesParty,
  user: PersonRef.nullable(),
  name: z.string().min(1),
  organizationName: z.string().min(1),
  authorityNote: z.string().nullable(),
  /** The `contract_signature` authority used or available (`authority_limits`), when recorded. */
  authorityLimit: Money.nullable(),
  /** `null` for a supplier signatory, whose authority is the supplier's own record. */
  authoritySufficient: z.boolean().nullable(),
  status: ContractSignatoriesStatus,
  method: ContractSignatoriesMethod.nullable(),
  signedAt: Instant.nullable(),
  verificationNote: z.string().nullable(),
  refusalReason: z.string().nullable(),
});
export type ContractSignatory = z.infer<typeof ContractSignatory>;

export const ContractSignature = z.object({
  contractId: Id,
  reference: Reference,
  status: ContractsStatus,
  timeZone: TimeZone,
  contractValue: Money,
  issuedVersion: ContractDocumentRef.nullable(),
  issuedAt: Instant.nullable(),
  signedOutsideApp: z.boolean(),
  externalSignatureEvidence: z.string().nullable(),
  signatories: z.array(ContractSignatory),
  signedAt: Instant.nullable(),
  effectiveDate: CalendarDate.nullable(),
  noticeToProceedAt: Instant.nullable(),
  deliveryStartAt: Instant.nullable(),
  differsFromAward: z.boolean(),
  differenceApproval: ContractApprovalRef.nullable(),
  /** Signature preconditions (difference approval, legal entity, holds, authority). */
  signatureChecks: z.array(ContractCheck),
  /** Commencement preconditions (signatures, securities, insurance). */
  commencementChecks: z.array(ContractCheck),
  milestones: z.array(ContractMilestone),
});
export type ContractSignature = z.infer<typeof ContractSignature>;

export const AddSignatoryBody = z.object({
  party: ContractSignatoriesParty,
  userId: Id.optional(),
  name: z.string().trim().min(2, issue('NAME_REQUIRED', 'Name the signatory.')).max(200),
  authorityNote: ShortText.optional(),
});

export const SignBody = z.object({
  confirm: Confirmation,
});

export const RefuseSignatureBody = z.object({
  reason: ReasonText,
});

export const RecordExternalSignatureBody = z.object({
  signedAt: Instant,
  verificationNote: ReasonText,
  evidenceDocumentId: Id,
});

export const SignatureResult = z.object({
  signatory: ContractSignatory,
  contractId: Id,
  contractStatus: ContractsStatus,
  allSigned: z.boolean(),
  message: z.string().min(1),
});
export type SignatureResult = z.infer<typeof SignatureResult>;

export const ReturnToReviewBody = z.object({ reason: ReasonText });

export const CommencementBody = z
  .object({
    effectiveDate: CalendarDate,
    noticeToProceedAt: Instant.optional(),
    deliveryStartAt: Instant.optional(),
  })
  .superRefine((body, ctx) => {
    if (body.noticeToProceedAt !== undefined && body.deliveryStartAt !== undefined && body.deliveryStartAt < body.noticeToProceedAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['deliveryStartAt'],
        message: issue('DELIVERY_BEFORE_NOTICE', 'Delivery cannot start before the notice to proceed.'),
      });
    }
  });

export const CommencementResult = z.object({
  contractId: Id,
  status: ContractsStatus,
  effectiveDate: CalendarDate,
  noticeToProceedAt: Instant.nullable(),
  deliveryStartAt: Instant.nullable(),
  message: z.string().min(1),
});

// ---------------------------------------------------------------------------------------------------------
// CON-04 handover
// ---------------------------------------------------------------------------------------------------------

/** One priced line of the WINNING offer only (losing bids never appear, CON-04). */
export const HandoverPriceLine = z.object({
  id: Id,
  item: z.string().min(1),
  unit: z.string().min(1),
  quantity: DecimalString,
  rate: Money,
  total: Money,
});

export const HandoverMilestone = z.object({
  obligationId: Id,
  title: z.string().min(1),
  dueAt: OfficialDeadline.nullable(),
  amount: Money.nullable(),
});

export const ContractHandover = z.object({
  contractId: Id,
  reference: Reference,
  handoverId: Id,
  status: HandoversStatus,
  tender: ContractTenderRef.nullable(),
  supplier: SupplierPartyRef,
  finalScope: z.string().nullable(),
  winningCommitments: z.string().nullable(),
  negotiatedExceptions: z.string().nullable(),
  performanceMeasuresSummary: z.string().nullable(),
  risks: z.string().nullable(),
  outstandingConditions: z.string().nullable(),
  renewalDatesSummary: z.string().nullable(),
  securityExpirySummary: z.string().nullable(),
  keyContacts: z.array(ContractContact),
  pricing: z.array(HandoverPriceLine),
  milestones: z.array(HandoverMilestone),
  obligationsCount: z.number().int().min(0),
  awardEvidence: z.array(ContractDocumentRef),
  contractManager: PersonRef.nullable(),
  submittedBy: PersonRef.nullable(),
  submittedAt: Instant.nullable(),
  acceptedAt: Instant.nullable(),
  returnedAt: Instant.nullable(),
  omissions: z.string().nullable(),
  /** The procurement event closeout reads this gate (AC-29). */
  closeoutGate: z.object({
    tenderReference: Reference.nullable(),
    blocksEventCloseout: z.boolean(),
    detail: z.string().min(1),
  }),
  /** Always true: the handover never carries unsuccessful suppliers' proposals or score deliberations. */
  excludesLosingBids: z.literal(true),
  checks: z.array(ContractCheck),
});
export type ContractHandover = z.infer<typeof ContractHandover>;

export const AcceptHandoverBody = z.object({ note: ShortText.optional() });
export const ReturnHandoverBody = z.object({
  omissions: z
    .string({ error: issue('OMISSIONS_REQUIRED', 'List what is missing from the handover.') })
    .trim()
    .min(1, issue('OMISSIONS_REQUIRED', 'List what is missing from the handover.'))
    .max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')),
});

export const HandoverResult = z.object({
  contractId: Id,
  handoverId: Id,
  status: HandoversStatus,
  submittedAt: Instant.nullable(),
  acceptedAt: Instant.nullable(),
  returnedAt: Instant.nullable(),
  omissions: z.string().nullable(),
  message: z.string().min(1),
});
export type HandoverResult = z.infer<typeof HandoverResult>;

// ---------------------------------------------------------------------------------------------------------
// CON-05 / CON-06 obligations, milestones and acceptance
// ---------------------------------------------------------------------------------------------------------

export const AcceptanceDecisionView = z.object({
  id: Id,
  decision: AcceptanceDecisionsDecision,
  reasons: z.string().min(1),
  remediationRequired: z.string().nullable(),
  remediationOwner: PersonRef.nullable(),
  remediationDueAt: OfficialDeadline.nullable(),
  decidedBy: PersonRef,
  decidedAt: Instant,
});
export type AcceptanceDecisionView = z.infer<typeof AcceptanceDecisionView>;

export const ObligationEvidenceView = z.object({
  id: Id,
  submittedBy: ActorRef,
  organizationName: z.string().min(1),
  document: ContractDocumentRef,
  note: z.string().nullable(),
  submittedAt: Instant,
});
export type ObligationEvidenceView = z.infer<typeof ObligationEvidenceView>;

export const ObligationRow = z.object({
  id: Id,
  contractId: Id,
  kind: ObligationsKind,
  party: ObligationsParty,
  title: z.string().min(1),
  owner: PersonRef.nullable(),
  supplierContact: z.string().nullable(),
  dueAt: OfficialDeadline.nullable(),
  recurrence: z.string().nullable(),
  status: ObligationsStatus,
  isPaymentMilestone: z.boolean(),
  amount: Money.nullable(),
  survivesCloseout: z.boolean(),
  isOverdue: z.boolean(),
  evidenceCount: z.number().int().min(0),
  latestDecision: z.object({ decision: AcceptanceDecisionsDecision, decidedAt: Instant }).nullable(),
});
export type ObligationRow = z.infer<typeof ObligationRow>;

/** The payment view of a milestone, stated separately so acceptance never reads as payment readiness (AC-30). */
export const ObligationPaymentStatus = z.object({
  invoiceRef: z.string().nullable(),
  acceptanceStatus: ContractInvoicesAcceptanceStatus,
  paymentStatus: ContractInvoicesPaymentStatus,
  source: ContractInvoicesSource.nullable(),
  asOf: Instant.nullable(),
});

export const ObligationDetail = ObligationRow.extend({
  description: z.string().nullable(),
  acceptanceCriteria: z.string().nullable(),
  evidenceRequired: z.string().nullable(),
  consequence: z.string().nullable(),
  dependsOn: z.object({ obligationId: Id, title: z.string().min(1) }).nullable(),
  escalationUser: PersonRef.nullable(),
  waiverApproval: ContractApprovalRef.nullable(),
  evidence: z.array(ObligationEvidenceView),
  decisions: z.array(AcceptanceDecisionView),
  payment: ObligationPaymentStatus.nullable(),
});
export type ObligationDetail = z.infer<typeof ObligationDetail>;

export const OBLIGATION_SORT_FIELDS = ['dueAt', 'title', 'status', 'kind'] as const;

export const ObligationListQuery = listQueryWithSort(OBLIGATION_SORT_FIELDS).extend({
  kind: queryList(ObligationsKind).optional(),
  party: ObligationsParty.optional(),
  status: queryList(ObligationsStatus).optional(),
  ownerUserId: IdParam.optional(),
  dueFrom: CalendarDate.optional(),
  dueTo: CalendarDate.optional(),
  overdue: QueryBoolean.optional(),
  survivesCloseout: QueryBoolean.optional(),
  paymentMilestone: QueryBoolean.optional(),
});
export type ObligationListQuery = z.output<typeof ObligationListQuery>;

export const ObligationListResponse = pageOf(ObligationRow).extend({ counts: ObligationCounts });

export const CreateObligationBody = z
  .object({
    kind: ObligationsKind,
    party: ObligationsParty,
    title: Title,
    description: LongText.optional(),
    ownerUserId: Id.optional(),
    supplierContact: ShortText.optional(),
    dueAt: Instant.optional(),
    recurrence: ShortText.optional(),
    acceptanceCriteria: LongText.optional(),
    evidenceRequired: LongText.optional(),
    consequence: LongText.optional(),
    dependsOnId: Id.optional(),
    escalationUserId: Id.optional(),
    isPaymentMilestone: z.boolean().default(false),
    amount: PositiveMoney.optional(),
    survivesCloseout: z.boolean().default(false),
  })
  .superRefine((body, ctx) => {
    if (body.isPaymentMilestone && body.amount === undefined) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: issue('AMOUNT_REQUIRED', 'A payment milestone needs an amount.') });
    }
    if (body.isPaymentMilestone && body.kind !== 'milestone') {
      ctx.addIssue({
        code: 'custom',
        path: ['isPaymentMilestone'],
        message: issue('PAYMENT_MILESTONE_KIND', 'Only a milestone can be a payment milestone.'),
      });
    }
    if (body.kind !== 'obligation' && body.dueAt === undefined) {
      ctx.addIssue({ code: 'custom', path: ['dueAt'], message: issue('DUE_DATE_REQUIRED', 'A milestone or deliverable needs a due date.') });
    }
  });
export type CreateObligationBody = z.input<typeof CreateObligationBody>;

export const AssignObligationBody = z.object({
  ownerUserId: Id,
  escalationUserId: Id.nullable().optional(),
});

export const EscalateObligationBody = z.object({ reason: ReasonText });

export const EscalationResult = z.object({
  obligationId: Id,
  escalatedTo: PersonRef,
  escalatedAt: Instant,
  message: z.string().min(1),
});

export const ObligationDecisionBody = z
  .object({
    decision: AcceptanceDecisionsDecision,
    reasons: ReasonText,
    remediationRequired: LongText.optional(),
    remediationOwnerUserId: Id.optional(),
    remediationDueAt: Instant.optional(),
  })
  .superRefine((body, ctx) => {
    if (body.decision !== 'rejected') {
      return;
    }
    if (body.remediationRequired === undefined || body.remediationRequired.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['remediationRequired'],
        message: issue('REMEDIATION_REQUIRED', 'State the remediation the rejection requires.'),
      });
    }
    if (body.remediationOwnerUserId === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['remediationOwnerUserId'],
        message: issue('REMEDIATION_OWNER_REQUIRED', 'Name who owns the remediation.'),
      });
    }
    if (body.remediationDueAt === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['remediationDueAt'],
        message: issue('REMEDIATION_DUE_REQUIRED', 'Set the remediation due date.'),
      });
    }
  });
export type ObligationDecisionBody = z.input<typeof ObligationDecisionBody>;

export const ObligationDecisionResult = z.object({
  obligation: ObligationRow,
  decision: AcceptanceDecisionView,
  /** Invoice and payment status are unchanged by an acceptance decision (AC-30). */
  payment: ObligationPaymentStatus.nullable(),
  message: z.string().min(1),
});
export type ObligationDecisionResult = z.infer<typeof ObligationDecisionResult>;

export const SubmitEvidenceBody = z.object({
  documentVersionId: Id,
  note: LongText.optional(),
});

export const EvidenceResult = z.object({
  obligation: ObligationRow,
  evidence: ObligationEvidenceView,
  message: z.string().min(1),
});
export type EvidenceResult = z.infer<typeof EvidenceResult>;

export const ReleaseSecurityBody = z.object({ reason: ReasonText });

// ---------------------------------------------------------------------------------------------------------
// CON-07 performance and improvement
// ---------------------------------------------------------------------------------------------------------

export const PerformanceMeasureView = z.object({
  id: Id,
  name: z.string().min(1),
  target: z.string().min(1),
  unit: z.string().nullable(),
  frequency: z.string().nullable(),
  active: z.boolean(),
  latestActual: z.string().nullable(),
  latestRating: z.string().nullable(),
});
export type PerformanceMeasureView = z.infer<typeof PerformanceMeasureView>;

export const PerformanceReviewRow = z.object({
  id: Id,
  contractId: Id,
  periodStart: CalendarDate,
  periodEnd: CalendarDate,
  status: PerformanceReviewsStatus,
  overallRating: PerformanceReviewsOverallRating.nullable(),
  summary: z.string().nullable(),
  supplierResponse: z.string().nullable(),
  supplierDisputes: z.boolean(),
  sharedAt: Instant.nullable(),
  respondedAt: Instant.nullable(),
  finalizedBy: PersonRef.nullable(),
  finalizedAt: Instant.nullable(),
});
export type PerformanceReviewRow = z.infer<typeof PerformanceReviewRow>;

export const MeasureResultView = z.object({
  id: Id,
  measureId: Id,
  measureName: z.string().min(1),
  target: z.string().min(1),
  unit: z.string().nullable(),
  actual: z.string().nullable(),
  rating: z.string().nullable(),
  note: z.string().nullable(),
});
export type MeasureResultView = z.infer<typeof MeasureResultView>;

export const ContractIncidentView = z.object({
  id: Id,
  incidentType: ContractIncidentsIncidentType,
  severity: ContractIncidentsSeverity,
  description: z.string().min(1),
  occurredAt: Instant,
  status: ContractIncidentsStatus,
  correctiveAction: z.string().nullable(),
  owner: PersonRef.nullable(),
});
export type ContractIncidentView = z.infer<typeof ContractIncidentView>;

export const ImprovementActionView = z.object({
  id: Id,
  reviewId: Id.nullable(),
  action: z.string().min(1),
  owner: z.string().min(1),
  dueAt: OfficialDeadline.nullable(),
  status: ImprovementActionsStatus,
});
export type ImprovementActionView = z.infer<typeof ImprovementActionView>;

export const PerformanceReviewDetail = PerformanceReviewRow.extend({
  results: z.array(MeasureResultView),
  improvementActions: z.array(ImprovementActionView),
});
export type PerformanceReviewDetail = z.infer<typeof PerformanceReviewDetail>;

/**
 * The rating of the newest review that is not finalized yet (shared, answered or disputed by the supplier). It is a
 * proposal: it never counts as the contract's rating until the review is finalized after the supplier's response.
 */
export const ProposedRating = z.object({
  reviewId: Id,
  rating: PerformanceReviewsOverallRating,
  reviewStatus: PerformanceReviewsStatus,
  supplierDisputes: z.boolean(),
});
export type ProposedRating = z.infer<typeof ProposedRating>;

export const ContractPerformance = z.object({
  contractId: Id,
  reference: Reference,
  status: ContractsStatus,
  measures: z.array(PerformanceMeasureView),
  reviews: z.array(PerformanceReviewRow),
  incidents: z.array(ContractIncidentView),
  improvementActions: z.array(ImprovementActionView),
  scorecard: z.object({
    reviewsFinalized: z.number().int().min(0),
    reviewsDisputed: z.number().int().min(0),
    /** The rating of the latest FINALIZED review; `null` when no review is finalized. */
    latestRating: PerformanceReviewsOverallRating.nullable(),
    /** A newer rating still awaiting finalization (never presented as final). */
    latestProposedRating: ProposedRating.nullable(),
    openIncidents: z.number().int().min(0),
    openActions: z.number().int().min(0),
  }),
});
export type ContractPerformance = z.infer<typeof ContractPerformance>;

export const CreatePerformanceReviewBody = z
  .object({
    periodStart: CalendarDate,
    periodEnd: CalendarDate,
    overallRating: PerformanceReviewsOverallRating.optional(),
    summary: LongText.min(1, issue('SUMMARY_REQUIRED', 'Summarize the review.')),
    results: z
      .array(
        z.object({
          measureId: Id,
          actual: ShortText.optional(),
          rating: ShortText.optional(),
          note: LongText.optional(),
        }),
      )
      .default([]),
  })
  .superRefine((body, ctx) => {
    if (body.periodEnd < body.periodStart) {
      ctx.addIssue({ code: 'custom', path: ['periodEnd'], message: issue('INVALID_PERIOD', 'The period must end after it starts.') });
    }
  });
export type CreatePerformanceReviewBody = z.input<typeof CreatePerformanceReviewBody>;

export const FinalizeReviewBody = z.object({
  overallRating: PerformanceReviewsOverallRating,
  finalizationNote: ReasonText,
});

export const RecordIncidentBody = z.object({
  incidentType: ContractIncidentsIncidentType,
  severity: ContractIncidentsSeverity,
  description: LongText.min(1, issue('DESCRIPTION_REQUIRED', 'Describe the incident.')),
  occurredAt: Instant,
  correctiveAction: LongText.optional(),
  ownerUserId: Id.optional(),
});

export const CreateImprovementActionBody = z.object({
  reviewId: Id.optional(),
  action: z.string().trim().min(3, issue('ACTION_REQUIRED', 'Describe the action.')).max(2000),
  owner: z.string().trim().min(2, issue('OWNER_REQUIRED', 'Name the owner.')).max(200),
  dueAt: Instant.optional(),
});

export const UpdateImprovementActionBody = z.object({
  status: ImprovementActionsStatus,
  note: ShortText.optional(),
});

export const RespondReviewBody = z.object({
  response: ReasonText,
  disputes: z.boolean(),
});

// ---------------------------------------------------------------------------------------------------------
// CON-08 financial view
// ---------------------------------------------------------------------------------------------------------

/** One figure with its source and freshness; estimates are flagged and never counted as paid. */
export const FinancialFigure = z.object({
  amount: Money,
  /** The record the figure comes from ("Award record", "Contract record", "Change register", "Invoices"). */
  source: z.string().min(1),
  /** Invoice-derived figures state whether they are entered locally or supplied by the finance system. */
  sourceSystem: ContractInvoicesSource.nullable(),
  asOf: Instant.nullable(),
  isEstimate: z.boolean(),
});
export type FinancialFigure = z.infer<typeof FinancialFigure>;

export const ContractInvoiceView = z.object({
  id: Id,
  invoiceRef: z.string().min(1),
  obligation: z.object({ obligationId: Id, title: z.string().min(1), status: ObligationsStatus }).nullable(),
  amount: Money,
  invoiceDate: CalendarDate,
  acceptanceStatus: ContractInvoicesAcceptanceStatus,
  paymentStatus: ContractInvoicesPaymentStatus,
  source: ContractInvoicesSource,
  asOf: Instant,
  disputeReason: z.string().nullable(),
});
export type ContractInvoiceView = z.infer<typeof ContractInvoiceView>;

export const ContractFinancials = z.object({
  contractId: Id,
  reference: Reference,
  currency: z.string().length(3),
  awardValue: FinancialFigure.nullable(),
  originalValue: FinancialFigure,
  approvedChanges: FinancialFigure,
  /** Changes not yet approved: exposure, never spend. */
  pendingChanges: FinancialFigure,
  currentValue: FinancialFigure,
  ceiling: FinancialFigure.nullable(),
  remainingCeiling: FinancialFigure.nullable(),
  acceptedMilestones: FinancialFigure,
  invoiced: FinancialFigure,
  approvedForPayment: FinancialFigure,
  paid: FinancialFigure,
  disputed: FinancialFigure,
  invoices: z.array(ContractInvoiceView),
  reconciliation: z.object({
    acceptedNotInvoiced: Money,
    invoicedNotAccepted: Money,
    disputedInvoices: z.number().int().min(0),
  }),
  notes: z.array(z.string().min(1)),
});
export type ContractFinancials = z.infer<typeof ContractFinancials>;

export const RecordInvoiceBody = z.object({
  invoiceRef: z.string().trim().min(2, issue('INVOICE_REF_REQUIRED', 'Enter the invoice reference.')).max(80),
  obligationId: Id.optional(),
  amount: PositiveMoney,
  invoiceDate: CalendarDate,
  note: ShortText.optional(),
});

export const DisputeInvoiceBody = z.object({ reason: ReasonText });

// ---------------------------------------------------------------------------------------------------------
// CON-09 changes, disputes and remedies
// ---------------------------------------------------------------------------------------------------------

/** The authority check on the CUMULATIVE contract value after the change (AC-31, BR-36). */
export const ChangeAuthorityCheck = z.object({
  decisionType: AuthorityLimitsDecisionType,
  basis: z.literal('cumulative_value'),
  originalValue: Money,
  singleChangeAmount: Money,
  cumulativeChanges: Money,
  /** Cumulative change as a percentage of the original value (decimal string, 2 places). */
  cumulativeChangePercent: DecimalString,
  checkedAmount: Money,
  /** The person checked (the caller on a decision, else the first approver on the route). */
  checkedApprover: PersonRef.nullable(),
  checkedLimit: Money.nullable(),
  sufficient: z.boolean(),
  requiredApprover: PersonRef.nullable(),
  explanation: z.string().min(1),
});
export type ChangeAuthorityCheck = z.infer<typeof ChangeAuthorityCheck>;

export const ChangeRequestRow = z.object({
  id: Id,
  contractId: Id,
  number: z.number().int().min(1),
  displayNumber: z.string().regex(/^CR-\d{4,}$/),
  title: z.string().min(1),
  raisedByParty: ChangeRequestsRaisedByParty,
  raisedBy: PersonRef.nullable(),
  status: ChangeRequestsStatus,
  costImpact: Money.nullable(),
  scheduleImpactDays: z.number().int().nullable(),
  cumulativeValueAfter: Money.nullable(),
  affectsProcurementBasis: z.boolean(),
  supplierAgreedAt: Instant.nullable(),
  approval: ContractApprovalRef.nullable(),
  createdAt: Instant,
});
export type ChangeRequestRow = z.infer<typeof ChangeRequestRow>;

export const ChangeRequestDetail = ChangeRequestRow.extend({
  reason: z.string().min(1),
  scopeChange: z.string().nullable(),
  fundingNote: z.string().nullable(),
  impactAssessment: z.string().nullable(),
  authority: ChangeAuthorityCheck.nullable(),
});
export type ChangeRequestDetail = z.infer<typeof ChangeRequestDetail>;

export const ChangeListQuery = z.object({
  status: queryList(ChangeRequestsStatus).optional(),
  raisedByParty: ChangeRequestsRaisedByParty.optional(),
});

export const ContractChanges = z.object({
  contractId: Id,
  reference: Reference,
  originalValue: Money,
  currentValue: Money,
  ceiling: Money.nullable(),
  approvedChanges: Money,
  pendingChanges: Money,
  /** Original value + approved + pending changes. */
  cumulativeExposure: Money,
  items: z.array(ChangeRequestRow),
  /** The authority check of the change awaiting approval, if any. */
  pendingAuthority: ChangeAuthorityCheck.nullable(),
});
export type ContractChanges = z.infer<typeof ContractChanges>;

export const CreateChangeBody = z.object({
  title: Title,
  reason: ReasonText,
  scopeChange: LongText.optional(),
  costImpact: Money.optional(),
  scheduleImpactDays: z.number().int().min(-3650).max(3650).optional(),
  fundingNote: LongText.optional(),
  submit: z.boolean().default(true),
});
export type CreateChangeBody = z.input<typeof CreateChangeBody>;

export const AssessChangeBody = z.object({
  scopeChange: LongText.min(1, issue('SCOPE_REQUIRED', 'Describe the scope change.')),
  costImpact: Money,
  scheduleImpactDays: z.number().int().min(-3650).max(3650),
  fundingNote: LongText.min(1, issue('FUNDING_NOTE_REQUIRED', 'State how the change is funded (BR-36).')),
  impactAssessment: LongText.min(1, issue('ASSESSMENT_REQUIRED', 'Record the impact assessment.')),
  affectsProcurementBasis: z.boolean(),
});

export const RequestChangeApprovalBody = z.object({ justification: ReasonText });

export const ChangeDecisionBody = z.object({
  decision: ChangeDecision,
  reason: ReasonText,
});

export const WithdrawChangeBody = z.object({ reason: ReasonText });

export const AgreeChangeBody = z.object({ confirm: Confirmation });

export const ContractDisputeView = z.object({
  id: Id,
  contractId: Id,
  disputeType: ContractDisputesDisputeType,
  amount: Money.nullable(),
  description: z.string().min(1),
  contractBasis: z.string().nullable(),
  status: ContractDisputesStatus,
  raisedBy: ActorRef.nullable(),
  raisedByOrganization: z.string().min(1),
  raisedAt: Instant,
  authorizedDecision: ContractApprovalRef.nullable(),
  resolutionNote: z.string().nullable(),
});
export type ContractDisputeView = z.infer<typeof ContractDisputeView>;

export const DisputeListQuery = z.object({
  status: queryList(ContractDisputesStatus).optional(),
  disputeType: queryList(ContractDisputesDisputeType).optional(),
});

export const ContractDisputes = z.object({
  contractId: Id,
  reference: Reference,
  items: z.array(ContractDisputeView),
  /** A missed measure never authorizes a deduction by itself (FR-19). */
  remedyRule: z.string().min(1),
});

const REMEDY_TYPES: readonly string[] = ['remedy', 'credit', 'penalty', 'settlement'];

export const RecordDisputeBody = z
  .object({
    disputeType: ContractDisputesDisputeType,
    amount: Money.optional(),
    description: LongText.min(1, issue('DESCRIPTION_REQUIRED', 'Describe the dispute.')),
    contractBasis: LongText.optional(),
  })
  .superRefine((body, ctx) => {
    if (REMEDY_TYPES.includes(body.disputeType) && (body.contractBasis === undefined || body.contractBasis.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['contractBasis'],
        message: issue('REMEDY_BASIS_REQUIRED', 'Cite the agreed contract terms that permit this remedy.'),
      });
    }
  });

export const UpdateDisputeBody = z.object({
  status: ContractDisputesStatus,
  note: ReasonText,
});

export const SupplierRaiseDisputeBody = z.object({
  disputeType: SupplierDisputeType,
  amount: Money.optional(),
  description: LongText.min(1, issue('DESCRIPTION_REQUIRED', 'Describe the dispute or claim.')),
  contractBasis: LongText.optional(),
});

// ---------------------------------------------------------------------------------------------------------
// CON-10 renewal, extension and termination (buyer-internal, [R])
// ---------------------------------------------------------------------------------------------------------

export const RenewalOptionView = z.object({
  id: Id,
  optionType: RenewalOptionsOptionType,
  periodMonths: z.number().int().min(1).nullable(),
  noticeWindowStart: CalendarDate.nullable(),
  noticeDeadline: OfficialDeadline.nullable(),
  windowState: RenewalWindowState,
  /** Whole days from the request time to the window opening (negative once open). */
  daysUntilWindowOpens: z.number().int().nullable(),
  status: RenewalOptionsStatus,
  decision: RenewalOptionsDecision.nullable(),
  justification: z.string().nullable(),
  performanceBasis: z.string().nullable(),
  fundingConfirmed: z.boolean().nullable(),
  approval: ContractApprovalRef.nullable(),
  supplierConsentAt: Instant.nullable(),
  decidedBy: PersonRef.nullable(),
  decidedAt: Instant.nullable(),
  supplierNotifiedAt: Instant.nullable(),
});
export type RenewalOptionView = z.infer<typeof RenewalOptionView>;

export const ContractRenewals = z.object({
  contractId: Id,
  reference: Reference,
  status: ContractsStatus,
  termEnd: CalendarDate.nullable(),
  currentValue: Money,
  remainingCeiling: Money.nullable(),
  performance: z.object({
    /** The rating of the latest FINALIZED review; `null` when no review is finalized. */
    latestRating: PerformanceReviewsOverallRating.nullable(),
    /** A newer rating still awaiting finalization (never presented as final). */
    latestProposedRating: ProposedRating.nullable(),
    reviewsDisputed: z.number().int().min(0),
    openIncidents: z.number().int().min(0),
    rejectedMilestones: z.number().int().min(0),
  }),
  fundingNote: z.string().nullable(),
  transitionNeeds: z.string().nullable(),
  /** Who the renewal-window job alerts (contract owner and manager). */
  alertRecipients: z.array(PersonRef),
  options: z.array(RenewalOptionView),
  /** Always true: an elapsed date never renews, extends or records supplier consent (BR-37, AC-32). */
  noAutomaticRenewal: z.literal(true),
});
export type ContractRenewals = z.infer<typeof ContractRenewals>;

const FUNDED_DECISIONS: readonly string[] = ['renew', 'extend'];

export const RenewalDecisionBody = z
  .object({
    decision: RenewalOptionsDecision,
    justification: ReasonText,
    performanceBasis: ReasonText,
    fundingConfirmed: z.boolean(),
    transitionNotes: LongText.optional(),
  })
  .superRefine((body, ctx) => {
    if (FUNDED_DECISIONS.includes(body.decision) && !body.fundingConfirmed) {
      ctx.addIssue({
        code: 'custom',
        path: ['fundingConfirmed'],
        message: issue('FUNDING_NOT_CONFIRMED', 'Confirm funding before renewing or extending (BR-36).'),
      });
    }
  });
export type RenewalDecisionBody = z.input<typeof RenewalDecisionBody>;

export const RenewalDecisionResult = z.object({
  option: RenewalOptionView,
  approvalRequired: z.boolean(),
  supplierConsentRequired: z.boolean(),
  message: z.string().min(1),
});
export type RenewalDecisionResult = z.infer<typeof RenewalDecisionResult>;

export const RenewalNotifyResult = z.object({
  optionId: Id,
  noticeType: z.literal('contract_notice'),
  notifiedAt: Instant,
  message: z.string().min(1),
});

// ---------------------------------------------------------------------------------------------------------
// CON-11 closeout
// ---------------------------------------------------------------------------------------------------------

export const ContractCloseout = z.object({
  contractId: Id,
  reference: Reference,
  contractStatus: ContractsStatus,
  closeoutId: Id.nullable(),
  status: ContractCloseoutsStatus.nullable(),
  finalAcceptanceAt: Instant.nullable(),
  reconciliationNote: z.string().nullable(),
  outstandingClaims: z.string().nullable(),
  securitiesReleased: z.boolean().nullable(),
  warrantyUntil: CalendarDate.nullable(),
  lessonsLearned: z.string().nullable(),
  retentionStart: CalendarDate.nullable(),
  closedBy: PersonRef.nullable(),
  closedAt: Instant.nullable(),
  reconciliation: z.object({
    finalValue: Money,
    invoiced: Money,
    paid: Money,
    /** Invoiced amounts neither paid nor disputed. */
    invoicedUnpaid: Money,
    /** Disputed invoice amounts, shown apart from the unpaid balance. */
    disputed: Money,
    /** Final contract value not yet invoiced: never an amount owed. */
    notYetInvoiced: Money,
  }),
  survivingObligations: z.array(ObligationRow),
  securities: z.array(ContractSecurity),
  openDisputes: z.array(ContractDisputeView),
  checks: z.array(ContractCheck),
  canClose: z.boolean(),
});
export type ContractCloseout = z.infer<typeof ContractCloseout>;

export const SaveCloseoutBody = z
  .object({
    finalAcceptanceAt: Instant.nullable().optional(),
    reconciliationNote: LongText.nullable().optional(),
    outstandingClaims: LongText.nullable().optional(),
    warrantyUntil: CalendarDate.nullable().optional(),
    lessonsLearned: LongText.nullable().optional(),
    retentionStart: CalendarDate.nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: issue('NOTHING_TO_UPDATE', 'Change at least one field.') });

export const SaveCloseoutResult = z.object({
  contractId: Id,
  closeoutId: Id,
  status: ContractCloseoutsStatus,
  message: z.string().min(1),
});

export const CloseContractBody = z.object({ confirm: Confirmation });

export const CloseContractResult = z.object({
  contractId: Id,
  status: ContractsStatus,
  closedAt: Instant,
  survivingObligations: z.number().int().min(0),
  message: z.string().min(1),
});

// ---------------------------------------------------------------------------------------------------------
// SUP-23 supplier projections (own contracts only; no [R] data, no handover, no allocations, no other bids)
// ---------------------------------------------------------------------------------------------------------

export const SupplierContractRow = z.object({
  id: Id,
  reference: Reference,
  title: z.string().min(1),
  status: ContractsStatus,
  buyer: BuyerPartyRef,
  legalEntity: LegalEntityRef,
  tender: ContractTenderRef.nullable(),
  value: Money,
  currentValue: Money,
  termStart: CalendarDate.nullable(),
  termEnd: CalendarDate.nullable(),
  mySignatureStatus: ContractSignatoriesStatus.nullable(),
  openObligations: z.number().int().min(0),
  overdueObligations: z.number().int().min(0),
  pendingChangeRequests: z.number().int().min(0),
  nextDueAt: OfficialDeadline.nullable(),
});
export type SupplierContractRow = z.infer<typeof SupplierContractRow>;

export const SUPPLIER_CONTRACT_SORT_FIELDS = ['reference', 'title', 'status', 'termEnd'] as const;

export const SupplierContractListQuery = listQueryWithSort(SUPPLIER_CONTRACT_SORT_FIELDS).extend({
  status: queryList(ContractsStatus).optional(),
  buyerTenantId: IdParam.optional(),
  actionRequired: QueryBoolean.optional(),
});

export const SupplierSignatoryView = z.object({
  id: Id,
  party: ContractSignatoriesParty,
  name: z.string().min(1),
  organizationName: z.string().min(1),
  isMe: z.boolean(),
  status: ContractSignatoriesStatus,
  method: ContractSignatoriesMethod.nullable(),
  signedAt: Instant.nullable(),
});
export type SupplierSignatoryView = z.infer<typeof SupplierSignatoryView>;

/** A supplier-visible obligation (buyer-internal owners are shown by organization only). */
export const SupplierObligationRow = z.object({
  id: Id,
  kind: ObligationsKind,
  party: ObligationsParty,
  title: z.string().min(1),
  dueAt: OfficialDeadline.nullable(),
  status: ObligationsStatus,
  isPaymentMilestone: z.boolean(),
  amount: Money.nullable(),
  survivesCloseout: z.boolean(),
  isOverdue: z.boolean(),
  latestDecision: z.object({ decision: AcceptanceDecisionsDecision, decidedAt: Instant }).nullable(),
});
export type SupplierObligationRow = z.infer<typeof SupplierObligationRow>;

export const SupplierObligationDetail = SupplierObligationRow.extend({
  description: z.string().nullable(),
  acceptanceCriteria: z.string().nullable(),
  evidenceRequired: z.string().nullable(),
  evidence: z.array(ObligationEvidenceView),
  decisions: z.array(AcceptanceDecisionView),
});
export type SupplierObligationDetail = z.infer<typeof SupplierObligationDetail>;

export const SupplierChangeRequestRow = z.object({
  id: Id,
  number: z.number().int().min(1),
  displayNumber: z.string().regex(/^CR-\d{4,}$/),
  title: z.string().min(1),
  reason: z.string().min(1),
  raisedByParty: ChangeRequestsRaisedByParty,
  status: ChangeRequestsStatus,
  costImpact: Money.nullable(),
  scheduleImpactDays: z.number().int().nullable(),
  supplierAgreedAt: Instant.nullable(),
  createdAt: Instant,
});
export type SupplierChangeRequestRow = z.infer<typeof SupplierChangeRequestRow>;

export const SupplierReviewView = PerformanceReviewRow.omit({ finalizedBy: true }).extend({
  results: z.array(MeasureResultView),
});
export type SupplierReviewView = z.infer<typeof SupplierReviewView>;

/** Shared financial status at the agreed level (invoice, acceptance and payment status with source). */
export const SupplierInvoiceView = ContractInvoiceView.omit({ obligation: true }).extend({
  obligationTitle: z.string().nullable(),
});

export const SupplierDisputeView = ContractDisputeView.omit({ authorizedDecision: true });

export const SupplierContractDetail = SupplierContractRow.extend({
  timeZone: TimeZone,
  scope: z.string(),
  paymentTerms: z.string().nullable(),
  serviceLocations: z.string().nullable(),
  signedAt: Instant.nullable(),
  effectiveDate: CalendarDate.nullable(),
  noticeToProceedAt: Instant.nullable(),
  deliveryStartAt: Instant.nullable(),
  signedOutsideApp: z.boolean(),
  /** Why signing is not possible yet (e.g. the buyer's difference approval is pending), else `null`. */
  signatureBlockedReason: z.string().nullable(),
  signatories: z.array(SupplierSignatoryView),
  obligations: z.array(SupplierObligationRow),
  changeRequests: z.array(SupplierChangeRequestRow),
  reviews: z.array(SupplierReviewView),
  incidents: z.array(ContractIncidentView.omit({ owner: true })),
  improvementActions: z.array(ImprovementActionView),
  invoices: z.array(SupplierInvoiceView),
  securities: z.array(ContractSecurity.omit({ releaseApproval: true })),
  disputes: z.array(SupplierDisputeView),
  contacts: z.array(ContractContact),
});
export type SupplierContractDetail = z.infer<typeof SupplierContractDetail>;

export const SupplierEvidenceResult = z.object({
  obligation: SupplierObligationRow,
  evidence: ObligationEvidenceView,
  message: z.string().min(1),
});

export const SupplierSignatureResult = z.object({
  signatory: SupplierSignatoryView,
  contractId: Id,
  contractStatus: ContractsStatus,
  allSigned: z.boolean(),
  message: z.string().min(1),
});

// ---------------------------------------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------------------------------------

const ContractParams = z.object({ contractId: IdParam });
const SignatoryParams = z.object({ contractId: IdParam, signatoryId: IdParam });
const ObligationParams = z.object({ contractId: IdParam, obligationId: IdParam });
const SecurityParams = z.object({ contractId: IdParam, securityId: IdParam });
const ReviewParams = z.object({ contractId: IdParam, reviewId: IdParam });
const ActionParams = z.object({ contractId: IdParam, actionId: IdParam });
const InvoiceParams = z.object({ contractId: IdParam, invoiceId: IdParam });
const ChangeParams = z.object({ contractId: IdParam, changeId: IdParam });
const DisputeParams = z.object({ contractId: IdParam, disputeId: IdParam });
const OptionParams = z.object({ contractId: IdParam, optionId: IdParam });

const B = '/api/v1/buyer/contracts';
const S = '/api/v1/supplier/contracts';

// ---------------------------------------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------------------------------------

export const contractsEndpoints = {
  // CON-01 register and CON-05 overview
  list: defineEndpoint({
    id: 'buyer.contracts.list',
    method: 'GET',
    path: B,
    audience: 'buyer',
    permission: 'contract.view',
    query: ContractListQuery,
    response: ContractListResponse,
    errors: [],
    screens: ['CON-01'],
    summary: 'Contract register with parties, owner, value, remaining ceiling, term, status and renewal dates.',
  }),
  get: defineEndpoint({
    id: 'buyer.contracts.get',
    method: 'GET',
    path: `${B}/:contractId`,
    audience: 'buyer',
    permission: 'contract.view',
    params: ContractParams,
    response: ContractDetail,
    errors: [],
    screens: ['CON-05', 'CON-02', 'CON-03'],
    summary: 'Contract overview: parties, scope, allocations, milestones, contacts, securities and obligation counts.',
  }),
  awardSources: defineEndpoint({
    id: 'buyer.contracts.awardSources',
    method: 'GET',
    path: '/api/v1/buyer/contract-award-sources',
    audience: 'buyer',
    permission: 'contract.prepare',
    response: AwardSourcesResponse,
    errors: [],
    screens: ['CON-02'],
    summary: 'Final-awarded lot outcomes with allocated and remaining values, and the contracting legal entities.',
  }),
  assignees: defineEndpoint({
    id: 'buyer.contracts.assignees',
    method: 'GET',
    path: '/api/v1/buyer/contract-assignees',
    audience: 'buyer',
    permission: 'contract.view',
    query: ContractAssigneesQuery,
    response: ContractAssigneesResponse,
    errors: [],
    screens: ['CON-01', 'CON-03', 'CON-05', 'CON-06'],
    summary: 'Members eligible to own, manage or sign contracts, with their authority.',
  }),
  create: defineEndpoint({
    id: 'buyer.contracts.create',
    method: 'POST',
    path: B,
    audience: 'buyer',
    permission: 'contract.prepare',
    body: CreateContractBody,
    response: ContractRow,
    idempotent: true,
    errors: [
      'LOT_OUTCOME_NOT_FINAL',
      'LOT_OUTCOME_OTHER_TENDER',
      'SUPPLIER_PARTY_MISMATCH',
      'ALLOCATION_EXCEEDS_AWARD',
      'CURRENCY_MISMATCH',
      'LEGAL_ENTITY_INACTIVE',
      'DIFFERENCE_EXPLANATION_REQUIRED',
      'ASSIGNEE_NOT_ELIGIBLE',
    ],
    screens: ['CON-02'],
    summary: 'Creates a draft contract from final-awarded lot outcomes with reconciling allocations (BR-04, BR-33).',
  }),
  update: defineEndpoint({
    id: 'buyer.contracts.update',
    method: 'PATCH',
    path: `${B}/:contractId`,
    audience: 'buyer',
    permission: 'contract.prepare',
    params: ContractParams,
    body: UpdateContractBody,
    response: ContractUpdateResult,
    errors: ['CONTRACT_NOT_EDITABLE', 'DIFFERENCE_EXPLANATION_REQUIRED', 'CURRENCY_MISMATCH'],
    screens: ['CON-02'],
  }),
  preparation: defineEndpoint({
    id: 'buyer.contracts.preparation',
    method: 'GET',
    path: `${B}/:contractId/preparation`,
    audience: 'buyer',
    permission: 'contract.view',
    params: ContractParams,
    response: ContractPreparation,
    errors: [],
    screens: ['CON-02'],
    summary: 'Awarded scope, agreed documents, exceptions, differences from the award and approval history.',
  }),
  submitForReview: defineEndpoint({
    id: 'buyer.contracts.submitForReview',
    method: 'POST',
    path: `${B}/:contractId/submit-review`,
    audience: 'buyer',
    permission: 'contract.prepare',
    params: ContractParams,
    response: ContractStatusResult,
    errors: ['CONTRACT_NOT_DRAFT', 'DIFFERENCE_EXPLANATION_REQUIRED', 'ALLOCATION_EXCEEDS_AWARD', 'CUSTOM_FIELDS_INCOMPLETE'],
    screens: ['CON-02'],
  }),
  reviewDecision: defineEndpoint({
    id: 'buyer.contracts.reviewDecision',
    method: 'POST',
    path: `${B}/:contractId/review-decision`,
    audience: 'buyer',
    permission: 'contract.approve',
    params: ContractParams,
    body: ContractReviewDecisionBody,
    response: ContractStatusResult,
    errors: ['CONTRACT_NOT_UNDER_REVIEW', 'DIFFERENCE_NOT_APPROVED', 'HOLD_BLOCKS_CONTRACT', 'SELF_APPROVAL_BLOCKED'],
    screens: ['CON-02'],
    summary: 'Approves the final agreement (issuing it for signature) or returns it to preparation.',
  }),
  assignOwners: defineEndpoint({
    id: 'buyer.contracts.assignOwners',
    method: 'POST',
    path: `${B}/:contractId/owners`,
    audience: 'buyer',
    permission: ['contract.manage', 'contract.prepare'],
    params: ContractParams,
    body: AssignOwnersBody,
    response: AssignOwnersResult,
    errors: ['ASSIGNEE_NOT_ELIGIBLE', 'CONTRACT_CLOSED'],
    screens: ['CON-01', 'CON-05'],
  }),

  // CON-03 signature and commencement
  signature: defineEndpoint({
    id: 'buyer.contracts.signature',
    method: 'GET',
    path: `${B}/:contractId/signature`,
    audience: 'buyer',
    permission: 'contract.view',
    params: ContractParams,
    response: ContractSignature,
    errors: [],
    screens: ['CON-03'],
  }),
  addSignatory: defineEndpoint({
    id: 'buyer.contracts.addSignatory',
    method: 'POST',
    path: `${B}/:contractId/signatories`,
    audience: 'buyer',
    permission: 'contract.prepare',
    params: ContractParams,
    body: AddSignatoryBody,
    response: ContractSignatory,
    idempotent: true,
    errors: ['SIGNATORY_ALREADY_LISTED', 'SIGNATORY_AUTHORITY_INSUFFICIENT', 'CONTRACT_ALREADY_SIGNED'],
    screens: ['CON-03'],
  }),
  sign: defineEndpoint({
    id: 'buyer.contracts.sign',
    method: 'POST',
    path: `${B}/:contractId/signatories/:signatoryId/sign`,
    audience: 'buyer',
    permission: 'contract.sign',
    params: SignatoryParams,
    body: SignBody,
    response: SignatureResult,
    errors: [
      'CONTRACT_NOT_AWAITING_SIGNATURE',
      'DIFFERENCE_NOT_APPROVED',
      'NOT_YOUR_SIGNATURE',
      'SIGNATORY_AUTHORITY_INSUFFICIENT',
      'SIGNATURE_ALREADY_RECORDED',
      'HOLD_BLOCKS_SIGNATURE',
    ],
    screens: ['CON-03'],
    summary: 'In-app signature by the named buyer signatory, checked against contract_signature authority.',
  }),
  recordExternalSignature: defineEndpoint({
    id: 'buyer.contracts.recordExternalSignature',
    method: 'POST',
    path: `${B}/:contractId/signatories/:signatoryId/record-external`,
    audience: 'buyer',
    permission: 'contract.prepare',
    params: SignatoryParams,
    body: RecordExternalSignatureBody,
    response: SignatureResult,
    errors: ['CONTRACT_NOT_AWAITING_SIGNATURE', 'DIFFERENCE_NOT_APPROVED', 'SIGNATURE_ALREADY_RECORDED', 'HOLD_BLOCKS_SIGNATURE'],
    screens: ['CON-03'],
    summary: 'Records a signature made outside the app from its evidence; no in-app signing evidence is created.',
  }),
  returnToReview: defineEndpoint({
    id: 'buyer.contracts.returnToReview',
    method: 'POST',
    path: `${B}/:contractId/return-to-review`,
    audience: 'buyer',
    permission: 'contract.prepare',
    params: ContractParams,
    body: ReturnToReviewBody,
    response: ContractStatusResult,
    errors: ['CONTRACT_NOT_AWAITING_SIGNATURE'],
    screens: ['CON-03'],
    summary: 'Resolves a refusal by changing terms: the contract goes back through review and approval.',
  }),
  authorizeCommencement: defineEndpoint({
    id: 'buyer.contracts.authorizeCommencement',
    method: 'POST',
    path: `${B}/:contractId/commencement`,
    audience: 'buyer',
    permission: ['contract.manage', 'contract.prepare'],
    params: ContractParams,
    body: CommencementBody,
    response: CommencementResult,
    errors: ['CONTRACT_NOT_SIGNED', 'DIFFERENCE_NOT_APPROVED', 'COMMENCEMENT_PRECONDITIONS_OPEN', 'HOLD_BLOCKS_START'],
    screens: ['CON-03'],
    summary: 'Records the effective date, notice to proceed and delivery start as separate milestones (BR-35).',
  }),

  // CON-04 handover
  handover: defineEndpoint({
    id: 'buyer.contracts.handover',
    method: 'GET',
    path: `${B}/:contractId/handover`,
    audience: 'buyer',
    permission: 'contract.view',
    params: ContractParams,
    response: ContractHandover,
    errors: ['HANDOVER_NOT_APPLICABLE'],
    screens: ['CON-04'],
  }),
  submitHandover: defineEndpoint({
    id: 'buyer.contracts.submitHandover',
    method: 'POST',
    path: `${B}/:contractId/handover/submit`,
    audience: 'buyer',
    permission: 'contract.prepare',
    params: ContractParams,
    response: HandoverResult,
    errors: ['HANDOVER_NOT_APPLICABLE', 'HANDOVER_NOT_DRAFT', 'HANDOVER_INCOMPLETE'],
    screens: ['CON-04'],
  }),
  acceptHandover: defineEndpoint({
    id: 'buyer.contracts.acceptHandover',
    method: 'POST',
    path: `${B}/:contractId/handover/accept`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: ContractParams,
    body: AcceptHandoverBody,
    response: HandoverResult,
    errors: ['HANDOVER_NOT_APPLICABLE', 'HANDOVER_NOT_SUBMITTED', 'NOT_NAMED_CONTRACT_MANAGER'],
    screens: ['CON-04'],
  }),
  returnHandover: defineEndpoint({
    id: 'buyer.contracts.returnHandover',
    method: 'POST',
    path: `${B}/:contractId/handover/return`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: ContractParams,
    body: ReturnHandoverBody,
    response: HandoverResult,
    errors: ['HANDOVER_NOT_APPLICABLE', 'HANDOVER_NOT_SUBMITTED', 'NOT_NAMED_CONTRACT_MANAGER'],
    screens: ['CON-04'],
  }),

  // CON-05 / CON-06 obligations and acceptance
  obligations: defineEndpoint({
    id: 'buyer.contracts.obligations',
    method: 'GET',
    path: `${B}/:contractId/obligations`,
    audience: 'buyer',
    permission: 'contract.view',
    params: ContractParams,
    query: ObligationListQuery,
    response: ObligationListResponse,
    errors: [],
    screens: ['CON-05', 'CON-06'],
  }),
  obligation: defineEndpoint({
    id: 'buyer.contracts.obligation',
    method: 'GET',
    path: `${B}/:contractId/obligations/:obligationId`,
    audience: 'buyer',
    permission: 'contract.view',
    params: ObligationParams,
    response: ObligationDetail,
    errors: [],
    screens: ['CON-06'],
  }),
  createObligation: defineEndpoint({
    id: 'buyer.contracts.createObligation',
    method: 'POST',
    path: `${B}/:contractId/obligations`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: ContractParams,
    body: CreateObligationBody,
    response: ObligationRow,
    idempotent: true,
    errors: ['CONTRACT_CLOSED', 'ASSIGNEE_NOT_ELIGIBLE', 'DEPENDENCY_NOT_FOUND', 'CURRENCY_MISMATCH'],
    screens: ['CON-05'],
  }),
  assignObligation: defineEndpoint({
    id: 'buyer.contracts.assignObligation',
    method: 'POST',
    path: `${B}/:contractId/obligations/:obligationId/assign`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: ObligationParams,
    body: AssignObligationBody,
    response: ObligationRow,
    errors: ['ASSIGNEE_NOT_ELIGIBLE', 'OBLIGATION_CLOSED'],
    screens: ['CON-05'],
  }),
  escalateObligation: defineEndpoint({
    id: 'buyer.contracts.escalateObligation',
    method: 'POST',
    path: `${B}/:contractId/obligations/:obligationId/escalate`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: ObligationParams,
    body: EscalateObligationBody,
    response: EscalationResult,
    errors: ['OBLIGATION_NOT_OVERDUE', 'NO_ESCALATION_CONTACT'],
    screens: ['CON-05'],
  }),
  startObligationReview: defineEndpoint({
    id: 'buyer.contracts.startObligationReview',
    method: 'POST',
    path: `${B}/:contractId/obligations/:obligationId/start-review`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: ObligationParams,
    response: ObligationRow,
    errors: ['OBLIGATION_NO_EVIDENCE'],
    screens: ['CON-06'],
  }),
  decideObligation: defineEndpoint({
    id: 'buyer.contracts.decideObligation',
    method: 'POST',
    path: `${B}/:contractId/obligations/:obligationId/decision`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: ObligationParams,
    body: ObligationDecisionBody,
    response: ObligationDecisionResult,
    errors: ['OBLIGATION_NOT_UNDER_REVIEW', 'ASSIGNEE_NOT_ELIGIBLE'],
    screens: ['CON-06'],
    summary: 'Accepts or rejects submitted evidence with reasons; a rejection records remediation owner and due date (AC-30).',
  }),
  submitObligationEvidence: defineEndpoint({
    id: 'buyer.contracts.submitObligationEvidence',
    method: 'POST',
    path: `${B}/:contractId/obligations/:obligationId/evidence`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: ObligationParams,
    body: SubmitEvidenceBody,
    response: EvidenceResult,
    idempotent: true,
    errors: ['OBLIGATION_NOT_OPEN', 'OBLIGATION_WRONG_PARTY', 'DOCUMENT_NOT_CONFIRMED'],
    screens: ['CON-05', 'CON-06'],
  }),
  releaseSecurity: defineEndpoint({
    id: 'buyer.contracts.releaseSecurity',
    method: 'POST',
    path: `${B}/:contractId/securities/:securityId/release`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: SecurityParams,
    body: ReleaseSecurityBody,
    response: ContractSecurity,
    errors: ['SECURITY_RELEASE_NOT_APPROVED', 'SECURITY_ALREADY_RELEASED'],
    screens: ['CON-05', 'CON-11'],
    summary: 'Releases a security only on an approved security_release decision (BR-37).',
  }),

  // CON-07 performance
  performance: defineEndpoint({
    id: 'buyer.contracts.performance',
    method: 'GET',
    path: `${B}/:contractId/performance`,
    audience: 'buyer',
    permission: 'contract.view',
    params: ContractParams,
    response: ContractPerformance,
    errors: [],
    screens: ['CON-07'],
  }),
  performanceReview: defineEndpoint({
    id: 'buyer.contracts.performanceReview',
    method: 'GET',
    path: `${B}/:contractId/performance-reviews/:reviewId`,
    audience: 'buyer',
    permission: 'contract.view',
    params: ReviewParams,
    response: PerformanceReviewDetail,
    errors: [],
    screens: ['CON-07'],
  }),
  createPerformanceReview: defineEndpoint({
    id: 'buyer.contracts.createPerformanceReview',
    method: 'POST',
    path: `${B}/:contractId/performance-reviews`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: ContractParams,
    body: CreatePerformanceReviewBody,
    response: PerformanceReviewRow,
    idempotent: true,
    errors: ['REVIEW_PERIOD_OVERLAPS', 'MEASURE_NOT_FOUND', 'CONTRACT_NOT_STARTED'],
    screens: ['CON-07'],
  }),
  sharePerformanceReview: defineEndpoint({
    id: 'buyer.contracts.sharePerformanceReview',
    method: 'POST',
    path: `${B}/:contractId/performance-reviews/:reviewId/share`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: ReviewParams,
    response: PerformanceReviewRow,
    errors: ['REVIEW_NOT_DRAFT'],
    screens: ['CON-07'],
  }),
  finalizePerformanceReview: defineEndpoint({
    id: 'buyer.contracts.finalizePerformanceReview',
    method: 'POST',
    path: `${B}/:contractId/performance-reviews/:reviewId/finalize`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: ReviewParams,
    body: FinalizeReviewBody,
    response: PerformanceReviewRow,
    errors: ['REVIEW_NOT_SHARED', 'SUPPLIER_RESPONSE_PENDING', 'REVIEW_ALREADY_FINALIZED'],
    screens: ['CON-07'],
    summary: 'Finalizes a rating only after the supplier could respond (disputed reviews need a finalization note).',
  }),
  recordIncident: defineEndpoint({
    id: 'buyer.contracts.recordIncident',
    method: 'POST',
    path: `${B}/:contractId/incidents`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: ContractParams,
    body: RecordIncidentBody,
    response: ContractIncidentView,
    idempotent: true,
    errors: ['CONTRACT_NOT_STARTED', 'ASSIGNEE_NOT_ELIGIBLE'],
    screens: ['CON-07'],
  }),
  createImprovementAction: defineEndpoint({
    id: 'buyer.contracts.createImprovementAction',
    method: 'POST',
    path: `${B}/:contractId/improvement-actions`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: ContractParams,
    body: CreateImprovementActionBody,
    response: ImprovementActionView,
    idempotent: true,
    errors: ['REVIEW_NOT_FOUND', 'CONTRACT_CLOSED'],
    screens: ['CON-07'],
  }),
  updateImprovementAction: defineEndpoint({
    id: 'buyer.contracts.updateImprovementAction',
    method: 'POST',
    path: `${B}/:contractId/improvement-actions/:actionId/status`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: ActionParams,
    body: UpdateImprovementActionBody,
    response: ImprovementActionView,
    errors: ['ACTION_CLOSED'],
    screens: ['CON-07'],
  }),

  // CON-08 financial view
  financials: defineEndpoint({
    id: 'buyer.contracts.financials',
    method: 'GET',
    path: `${B}/:contractId/financials`,
    audience: 'buyer',
    permission: 'contract.financials.view',
    params: ContractParams,
    response: ContractFinancials,
    errors: [],
    screens: ['CON-08'],
    summary: 'Award, original value, changes, ceiling, accepted milestones, invoices and payments with source and as-of.',
  }),
  recordInvoice: defineEndpoint({
    id: 'buyer.contracts.recordInvoice',
    method: 'POST',
    path: `${B}/:contractId/invoices`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: ContractParams,
    body: RecordInvoiceBody,
    response: ContractInvoiceView,
    idempotent: true,
    errors: ['INVOICE_DUPLICATE_REFERENCE', 'INVOICE_EXCEEDS_REMAINING_CEILING', 'CURRENCY_MISMATCH', 'OBLIGATION_NOT_FOUND'],
    screens: ['CON-08'],
  }),
  disputeInvoice: defineEndpoint({
    id: 'buyer.contracts.disputeInvoice',
    method: 'POST',
    path: `${B}/:contractId/invoices/:invoiceId/dispute`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: InvoiceParams,
    body: DisputeInvoiceBody,
    response: ContractInvoiceView,
    errors: ['INVOICE_ALREADY_PAID', 'INVOICE_ALREADY_DISPUTED'],
    screens: ['CON-08'],
  }),

  // CON-09 changes, disputes and remedies
  changes: defineEndpoint({
    id: 'buyer.contracts.changes',
    method: 'GET',
    path: `${B}/:contractId/change-requests`,
    audience: 'buyer',
    permission: 'contract.view',
    params: ContractParams,
    query: ChangeListQuery,
    response: ContractChanges,
    errors: [],
    screens: ['CON-09'],
  }),
  changeRequest: defineEndpoint({
    id: 'buyer.contracts.changeRequest',
    method: 'GET',
    path: `${B}/:contractId/change-requests/:changeId`,
    audience: 'buyer',
    permission: 'contract.view',
    params: ChangeParams,
    response: ChangeRequestDetail,
    errors: [],
    screens: ['CON-09'],
  }),
  createChange: defineEndpoint({
    id: 'buyer.contracts.createChange',
    method: 'POST',
    path: `${B}/:contractId/change-requests`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: ContractParams,
    body: CreateChangeBody,
    response: ChangeRequestRow,
    idempotent: true,
    errors: ['CONTRACT_NOT_ACTIVE', 'CURRENCY_MISMATCH'],
    screens: ['CON-09'],
  }),
  assessChange: defineEndpoint({
    id: 'buyer.contracts.assessChange',
    method: 'POST',
    path: `${B}/:contractId/change-requests/:changeId/assess`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: ChangeParams,
    body: AssessChangeBody,
    response: ChangeRequestDetail,
    errors: ['CHANGE_NOT_ASSESSABLE', 'CURRENCY_MISMATCH'],
    screens: ['CON-09'],
  }),
  requestChangeApproval: defineEndpoint({
    id: 'buyer.contracts.requestChangeApproval',
    method: 'POST',
    path: `${B}/:contractId/change-requests/:changeId/request-approval`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: ChangeParams,
    body: RequestChangeApprovalBody,
    response: ChangeRequestDetail,
    errors: ['CHANGE_NOT_ASSESSED', 'FUNDING_REVIEW_REQUIRED'],
    screens: ['CON-09'],
    summary: 'Requests the contract_change approval; the route is chosen on the cumulative value (AC-31).',
  }),
  decideChange: defineEndpoint({
    id: 'buyer.contracts.decideChange',
    method: 'POST',
    path: `${B}/:contractId/change-requests/:changeId/decision`,
    audience: 'buyer',
    permission: 'contract.change.approve',
    params: ChangeParams,
    body: ChangeDecisionBody,
    response: ChangeRequestDetail,
    errors: ['CHANGE_NOT_PENDING_APPROVAL', 'CUMULATIVE_AUTHORITY_EXCEEDED', 'SELF_APPROVAL_BLOCKED'],
    screens: ['CON-09'],
    summary: 'Approves, rejects or returns a change; authority is checked on the cumulative contract value (AC-31).',
  }),
  withdrawChange: defineEndpoint({
    id: 'buyer.contracts.withdrawChange',
    method: 'POST',
    path: `${B}/:contractId/change-requests/:changeId/withdraw`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: ChangeParams,
    body: WithdrawChangeBody,
    response: ChangeRequestRow,
    errors: ['CHANGE_NOT_WITHDRAWABLE'],
    screens: ['CON-09'],
  }),
  incorporateChange: defineEndpoint({
    id: 'buyer.contracts.incorporateChange',
    method: 'POST',
    path: `${B}/:contractId/change-requests/:changeId/incorporate`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: ChangeParams,
    response: ChangeRequestRow,
    errors: ['CHANGE_NOT_AGREED', 'SUPPLIER_AGREEMENT_PENDING'],
    screens: ['CON-09'],
    summary: 'Incorporates an agreed change into the contract; the original terms stay preserved (BR-36).',
  }),
  disputes: defineEndpoint({
    id: 'buyer.contracts.disputes',
    method: 'GET',
    path: `${B}/:contractId/disputes`,
    audience: 'buyer',
    permission: 'contract.view',
    params: ContractParams,
    query: DisputeListQuery,
    response: ContractDisputes,
    errors: [],
    screens: ['CON-09'],
  }),
  recordDispute: defineEndpoint({
    id: 'buyer.contracts.recordDispute',
    method: 'POST',
    path: `${B}/:contractId/disputes`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: ContractParams,
    body: RecordDisputeBody,
    response: ContractDisputeView,
    idempotent: true,
    errors: ['CONTRACT_NOT_STARTED'],
    screens: ['CON-09'],
  }),
  updateDispute: defineEndpoint({
    id: 'buyer.contracts.updateDispute',
    method: 'POST',
    path: `${B}/:contractId/disputes/:disputeId/status`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: DisputeParams,
    body: UpdateDisputeBody,
    response: ContractDisputeView,
    errors: ['DISPUTE_CLOSED', 'DECISION_NOT_AUTHORIZED'],
    screens: ['CON-09'],
    summary: 'Moves a dispute on; resolving a remedy, credit, penalty or settlement needs an approved decision.',
  }),

  // CON-10 renewal
  renewals: defineEndpoint({
    id: 'buyer.contracts.renewals',
    method: 'GET',
    path: `${B}/:contractId/renewal-options`,
    audience: 'buyer',
    permission: 'contract.view',
    params: ContractParams,
    response: ContractRenewals,
    errors: [],
    screens: ['CON-10'],
  }),
  decideRenewal: defineEndpoint({
    id: 'buyer.contracts.decideRenewal',
    method: 'POST',
    path: `${B}/:contractId/renewal-options/:optionId/decision`,
    audience: 'buyer',
    permission: 'contract.renewal.decide',
    params: OptionParams,
    body: RenewalDecisionBody,
    response: RenewalDecisionResult,
    errors: ['RENEWAL_ALREADY_DECIDED', 'RENEWAL_DEADLINE_PASSED', 'RENEWAL_OPTION_NOT_APPLICABLE'],
    screens: ['CON-10'],
    summary: 'Records an explicit decision with justification; it goes to renewal approval and never auto-renews.',
  }),
  notifyRenewal: defineEndpoint({
    id: 'buyer.contracts.notifyRenewal',
    method: 'POST',
    path: `${B}/:contractId/renewal-options/:optionId/notify`,
    audience: 'buyer',
    permission: 'contract.renewal.decide',
    params: OptionParams,
    response: RenewalNotifyResult,
    errors: ['RENEWAL_NOT_APPROVED'],
    screens: ['CON-10'],
  }),

  // CON-11 closeout
  closeout: defineEndpoint({
    id: 'buyer.contracts.closeout',
    method: 'GET',
    path: `${B}/:contractId/closeout`,
    audience: 'buyer',
    permission: 'contract.view',
    params: ContractParams,
    response: ContractCloseout,
    errors: [],
    screens: ['CON-11'],
  }),
  saveCloseout: defineEndpoint({
    id: 'buyer.contracts.saveCloseout',
    method: 'PUT',
    path: `${B}/:contractId/closeout`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: ContractParams,
    body: SaveCloseoutBody,
    response: SaveCloseoutResult,
    errors: ['CONTRACT_NOT_CLOSABLE', 'CLOSEOUT_ALREADY_CLOSED'],
    screens: ['CON-11'],
  }),
  closeContract: defineEndpoint({
    id: 'buyer.contracts.closeContract',
    method: 'POST',
    path: `${B}/:contractId/closeout/close`,
    audience: 'buyer',
    permission: 'contract.manage',
    params: ContractParams,
    body: CloseContractBody,
    response: CloseContractResult,
    errors: ['CONTRACT_NOT_CLOSABLE', 'CLOSEOUT_ALREADY_CLOSED', 'CLOSEOUT_BLOCKED'],
    screens: ['CON-11'],
    summary: 'Closes the contract while surviving obligations stay tracked.',
  }),

  // SUP-23 supplier contracts and performance
  supplierList: defineEndpoint({
    id: 'supplier.contracts.list',
    method: 'GET',
    path: S,
    audience: 'supplier',
    permission: ['supplier.contract.participate', 'supplier.outcomes.view'],
    query: SupplierContractListQuery,
    response: pageOf(SupplierContractRow),
    errors: [],
    screens: ['SUP-23'],
  }),
  supplierGet: defineEndpoint({
    id: 'supplier.contracts.get',
    method: 'GET',
    path: `${S}/:contractId`,
    audience: 'supplier',
    permission: ['supplier.contract.participate', 'supplier.outcomes.view'],
    params: ContractParams,
    response: SupplierContractDetail,
    errors: [],
    screens: ['SUP-23'],
  }),
  supplierObligation: defineEndpoint({
    id: 'supplier.contracts.obligation',
    method: 'GET',
    path: `${S}/:contractId/obligations/:obligationId`,
    audience: 'supplier',
    permission: ['supplier.contract.participate', 'supplier.outcomes.view'],
    params: ObligationParams,
    response: SupplierObligationDetail,
    errors: [],
    screens: ['SUP-23'],
  }),
  supplierSign: defineEndpoint({
    id: 'supplier.contracts.sign',
    method: 'POST',
    path: `${S}/:contractId/signatories/:signatoryId/sign`,
    audience: 'supplier',
    permission: 'supplier.contract.participate',
    params: SignatoryParams,
    body: SignBody,
    response: SupplierSignatureResult,
    errors: ['CONTRACT_NOT_AWAITING_SIGNATURE', 'DIFFERENCE_NOT_APPROVED', 'NOT_YOUR_SIGNATURE', 'SIGNATURE_ALREADY_RECORDED'],
    screens: ['SUP-23'],
  }),
  supplierRefuseSignature: defineEndpoint({
    id: 'supplier.contracts.refuseSignature',
    method: 'POST',
    path: `${S}/:contractId/signatories/:signatoryId/refuse`,
    audience: 'supplier',
    permission: 'supplier.contract.participate',
    params: SignatoryParams,
    body: RefuseSignatureBody,
    response: SupplierSignatureResult,
    errors: ['CONTRACT_NOT_AWAITING_SIGNATURE', 'NOT_YOUR_SIGNATURE', 'SIGNATURE_ALREADY_RECORDED'],
    screens: ['SUP-23'],
  }),
  supplierSubmitEvidence: defineEndpoint({
    id: 'supplier.contracts.submitEvidence',
    method: 'POST',
    path: `${S}/:contractId/obligations/:obligationId/evidence`,
    audience: 'supplier',
    permission: 'supplier.contract.participate',
    params: ObligationParams,
    body: SubmitEvidenceBody,
    response: SupplierEvidenceResult,
    idempotent: true,
    errors: ['OBLIGATION_NOT_OPEN', 'OBLIGATION_WRONG_PARTY', 'DOCUMENT_NOT_CONFIRMED'],
    screens: ['SUP-23'],
  }),
  supplierRespondReview: defineEndpoint({
    id: 'supplier.contracts.respondReview',
    method: 'POST',
    path: `${S}/:contractId/performance-reviews/:reviewId/response`,
    audience: 'supplier',
    permission: 'supplier.contract.participate',
    params: ReviewParams,
    body: RespondReviewBody,
    response: SupplierReviewView,
    errors: ['REVIEW_NOT_SHARED', 'REVIEW_ALREADY_FINALIZED'],
    screens: ['SUP-23'],
  }),
  supplierRequestChange: defineEndpoint({
    id: 'supplier.contracts.requestChange',
    method: 'POST',
    path: `${S}/:contractId/change-requests`,
    audience: 'supplier',
    permission: 'supplier.contract.participate',
    params: ContractParams,
    body: CreateChangeBody,
    response: SupplierChangeRequestRow,
    idempotent: true,
    errors: ['CONTRACT_NOT_ACTIVE', 'CURRENCY_MISMATCH'],
    screens: ['SUP-23'],
  }),
  supplierAgreeChange: defineEndpoint({
    id: 'supplier.contracts.agreeChange',
    method: 'POST',
    path: `${S}/:contractId/change-requests/:changeId/agree`,
    audience: 'supplier',
    permission: 'supplier.contract.participate',
    params: ChangeParams,
    body: AgreeChangeBody,
    response: SupplierChangeRequestRow,
    errors: ['CHANGE_NOT_AGREEABLE', 'SUPPLIER_ALREADY_AGREED'],
    screens: ['SUP-23'],
  }),
  supplierRaiseDispute: defineEndpoint({
    id: 'supplier.contracts.raiseDispute',
    method: 'POST',
    path: `${S}/:contractId/disputes`,
    audience: 'supplier',
    permission: 'supplier.contract.participate',
    params: ContractParams,
    body: SupplierRaiseDisputeBody,
    response: SupplierDisputeView,
    idempotent: true,
    errors: ['CONTRACT_NOT_STARTED'],
    screens: ['SUP-23'],
  }),
};

export type ContractsEndpoints = typeof contractsEndpoints;
