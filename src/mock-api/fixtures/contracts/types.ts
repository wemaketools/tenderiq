/**
 * Row shapes of the contracts fixtures (domain 14). They mirror the blueprint tables of Migration 12
 * (docs/plan/schema-blueprint.md) in camelCase and keep the internal columns (`tenantId`, `supplierTenantId`, user ids)
 * that the handlers strip or resolve before answering. Sub-shapes that leave the API unchanged reuse the contract
 * types, so the fixture test can parse them directly.
 */
import type { Money } from '../../../contracts/common.js';
import type {
  AwardDifference,
  ContractAgreedDocument,
  ContractContact,
  ContractDocumentRef,
  ContractException,
  ContractTenderRef,
  LegalEntityRef,
} from '../../../contracts/contracts.js';
import type {
  AcceptanceDecisionsDecision,
  ApprovalRequestsStatus,
  ApprovalRequestsSubjectType,
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
} from '../../../contracts/enums.js';

export interface FixtureLegalEntity extends LegalEntityRef {
  readonly tenantId: number;
  readonly active: boolean;
}

/** `lot_outcomes` as the contracts domain reads them (owned by awards; ids agreed in the cross-fixture test). */
export interface FixtureLotOutcome {
  readonly id: number;
  readonly tenantId: number;
  readonly tender: ContractTenderRef;
  readonly lotNumber: number;
  readonly lotTitle: string;
  readonly supplierTenantId: number | null;
  /** `null` while the lot is still under assessment and no outcome has been recommended. */
  readonly outcome: LotOutcomesOutcome | null;
  readonly status: LotOutcomesStatus | null;
  readonly awardedValue: Money | null;
  readonly finalAwardedAt: string | null;
  readonly conditions: string | null;
  readonly reason: string | null;
}

/** `contracts` */
export interface FixtureContract {
  readonly id: number;
  readonly tenantId: number;
  readonly supplierTenantId: number;
  readonly reference: string;
  readonly title: string;
  readonly status: ContractsStatus;
  readonly legalEntityId: number;
  readonly tender: ContractTenderRef | null;
  readonly recommendationId: number | null;
  readonly ownerUserId: number | null;
  readonly contractManagerUserId: number | null;
  readonly scope: string;
  readonly scopeSummary: string;
  readonly value: Money;
  readonly ceiling: Money | null;
  readonly termStart: string | null;
  readonly termEnd: string | null;
  readonly optionsSummary: string | null;
  readonly serviceLocations: string | null;
  readonly paymentTerms: string | null;
  readonly securitiesSummary: string | null;
  readonly signedAt: string | null;
  readonly effectiveDate: string | null;
  readonly noticeToProceedAt: string | null;
  readonly deliveryStartAt: string | null;
  readonly signedOutsideApp: boolean;
  readonly externalSignatureEvidence: string | null;
  readonly signedDocument: ContractDocumentRef | null;
  readonly issuedVersion: ContractDocumentRef | null;
  readonly issuedAt: string | null;
  readonly differsFromAward: boolean;
  readonly differenceExplanation: string | null;
  readonly differenceApprovalId: number | null;
  readonly contractApprovalIds: readonly number[];
  readonly version: number;
  readonly origin: string | null;
  readonly originalBusinessDate: string | null;
  readonly createdAt: string;
  readonly contacts: readonly ContractContact[];
  readonly agreedDocuments: readonly ContractAgreedDocument[];
  readonly exceptions: readonly ContractException[];
  readonly differences: readonly AwardDifference[];
  readonly fundingNote: string | null;
  readonly transitionNeeds: string | null;
}

/** `contract_lot_allocations` */
export interface FixtureAllocation {
  readonly id: number;
  readonly contractId: number;
  readonly lotOutcomeId: number;
  readonly allocatedValue: Money;
}

/** `approval_requests` rows whose subject is a contract record (DD-14 subject types). */
export interface FixtureContractApproval {
  readonly id: number;
  readonly tenantId: number;
  readonly subjectType: ApprovalRequestsSubjectType;
  readonly subjectId: number;
  readonly status: ApprovalRequestsStatus;
  readonly title: string;
  readonly amount: Money | null;
  readonly requestedByUserId: number;
  readonly requestedAt: string;
  readonly currentApproverUserId: number | null;
  readonly decidedAt: string | null;
  /** True when the approvals domain holds this request under the same id, so `/me/approvals/:id` opens it. */
  readonly inApprovalWorkspace: boolean;
}

/** `contract_signatories` */
export interface FixtureSignatory {
  readonly id: number;
  readonly contractId: number;
  readonly party: ContractSignatoriesParty;
  readonly userId: number | null;
  readonly name: string;
  readonly authorityNote: string | null;
  readonly authorityLimit: Money | null;
  readonly status: ContractSignatoriesStatus;
  readonly method: ContractSignatoriesMethod | null;
  readonly signedAt: string | null;
  readonly verificationNote: string | null;
  readonly refusalReason: string | null;
}

export interface FixturePriceLine {
  readonly id: number;
  readonly item: string;
  readonly unit: string;
  readonly quantity: string;
  readonly rate: Money;
  readonly total: Money;
}

/** `handovers` (+ the winning offer's priced lines and award evidence documents it packages). */
export interface FixtureHandover {
  readonly id: number;
  readonly contractId: number;
  readonly status: HandoversStatus;
  readonly finalScope: string | null;
  readonly winningCommitments: string | null;
  readonly negotiatedExceptions: string | null;
  readonly performanceMeasuresSummary: string | null;
  readonly risks: string | null;
  readonly outstandingConditions: string | null;
  readonly renewalDatesSummary: string | null;
  readonly securityExpirySummary: string | null;
  readonly contractManagerUserId: number | null;
  readonly submittedByUserId: number | null;
  readonly submittedAt: string | null;
  readonly acceptedAt: string | null;
  readonly returnedAt: string | null;
  readonly omissions: string | null;
  readonly pricing: readonly FixturePriceLine[];
  readonly awardEvidence: readonly ContractDocumentRef[];
}

/** `obligations` */
export interface FixtureObligation {
  readonly id: number;
  readonly contractId: number;
  readonly kind: ObligationsKind;
  readonly party: ObligationsParty;
  readonly title: string;
  readonly description: string | null;
  readonly ownerUserId: number | null;
  readonly supplierContact: string | null;
  readonly dueAt: string | null;
  readonly recurrence: string | null;
  readonly acceptanceCriteria: string | null;
  readonly evidenceRequired: string | null;
  readonly consequence: string | null;
  readonly dependsOnId: number | null;
  readonly escalationUserId: number | null;
  readonly isPaymentMilestone: boolean;
  readonly amount: Money | null;
  readonly status: ObligationsStatus;
  readonly waiverApprovalId: number | null;
  readonly survivesCloseout: boolean;
}

/** `obligation_evidence` */
export interface FixtureEvidence {
  readonly id: number;
  readonly obligationId: number;
  readonly submittedByUserId: number;
  readonly organizationTenantId: number;
  readonly document: ContractDocumentRef;
  readonly note: string | null;
  readonly submittedAt: string;
}

/** `acceptance_decisions` */
export interface FixtureAcceptanceDecision {
  readonly id: number;
  readonly obligationId: number;
  readonly decision: AcceptanceDecisionsDecision;
  readonly reasons: string;
  readonly remediationRequired: string | null;
  readonly remediationOwnerUserId: number | null;
  readonly remediationDueAt: string | null;
  readonly decidedByUserId: number;
  readonly decidedAt: string;
}

/** `performance_measures` */
export interface FixtureMeasure {
  readonly id: number;
  readonly contractId: number;
  readonly name: string;
  readonly target: string;
  readonly unit: string | null;
  readonly frequency: string | null;
  readonly active: boolean;
}

/** `performance_reviews` (+ sharing/response instants the service records in its audit trail). */
export interface FixtureReview {
  readonly id: number;
  readonly contractId: number;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly status: PerformanceReviewsStatus;
  readonly overallRating: PerformanceReviewsOverallRating | null;
  readonly summary: string | null;
  readonly supplierResponse: string | null;
  readonly supplierDisputes: boolean;
  readonly sharedAt: string | null;
  readonly respondedAt: string | null;
  readonly finalizedByUserId: number | null;
  readonly finalizedAt: string | null;
}

/** `measure_results` */
export interface FixtureMeasureResult {
  readonly id: number;
  readonly reviewId: number;
  readonly measureId: number;
  readonly actual: string | null;
  readonly rating: string | null;
  readonly note: string | null;
}

/** `contract_incidents` */
export interface FixtureIncident {
  readonly id: number;
  readonly contractId: number;
  readonly incidentType: ContractIncidentsIncidentType;
  readonly severity: ContractIncidentsSeverity;
  readonly description: string;
  readonly occurredAt: string;
  readonly status: ContractIncidentsStatus;
  readonly correctiveAction: string | null;
  readonly ownerUserId: number | null;
}

/** `improvement_actions` */
export interface FixtureImprovementAction {
  readonly id: number;
  readonly contractId: number;
  readonly reviewId: number | null;
  readonly action: string;
  readonly owner: string;
  readonly dueAt: string | null;
  readonly status: ImprovementActionsStatus;
}

/** `contract_invoices` */
export interface FixtureInvoice {
  readonly id: number;
  readonly contractId: number;
  readonly obligationId: number | null;
  readonly invoiceRef: string;
  readonly description: string | null;
  readonly amount: Money;
  readonly invoiceDate: string;
  readonly acceptanceStatus: ContractInvoicesAcceptanceStatus;
  readonly paymentStatus: ContractInvoicesPaymentStatus;
  readonly source: ContractInvoicesSource;
  readonly asOf: string;
  readonly disputeReason: string | null;
}

/** `change_requests` */
export interface FixtureChange {
  readonly id: number;
  readonly contractId: number;
  readonly number: number;
  readonly title: string;
  readonly reason: string;
  readonly scopeChange: string | null;
  readonly costImpact: Money | null;
  readonly scheduleImpactDays: number | null;
  readonly fundingNote: string | null;
  readonly cumulativeValueAfter: Money | null;
  readonly raisedByParty: ChangeRequestsRaisedByParty;
  readonly raisedByUserId: number | null;
  readonly status: ChangeRequestsStatus;
  readonly supplierAgreedAt: string | null;
  readonly approvalRequestId: number | null;
  readonly affectsProcurementBasis: boolean;
  readonly impactAssessment: string | null;
  readonly createdAt: string;
}

/** `contract_disputes` */
export interface FixtureDispute {
  readonly id: number;
  readonly contractId: number;
  readonly disputeType: ContractDisputesDisputeType;
  readonly amount: Money | null;
  readonly description: string;
  readonly contractBasis: string | null;
  readonly authorizedDecisionId: number | null;
  readonly status: ContractDisputesStatus;
  readonly raisedByUserId: number | null;
  readonly raisedByTenantId: number;
  readonly raisedAt: string;
  readonly resolutionNote: string | null;
}

/** `renewal_options` ([R], buyer-internal) */
export interface FixtureRenewalOption {
  readonly id: number;
  readonly contractId: number;
  readonly optionType: RenewalOptionsOptionType;
  readonly periodMonths: number | null;
  readonly noticeWindowStart: string | null;
  readonly noticeDeadline: string | null;
  readonly status: RenewalOptionsStatus;
  readonly decision: RenewalOptionsDecision | null;
  readonly justification: string | null;
  readonly performanceBasis: string | null;
  readonly fundingConfirmed: boolean | null;
  readonly approvalRequestId: number | null;
  readonly supplierConsentAt: string | null;
  readonly decidedByUserId: number | null;
  readonly decidedAt: string | null;
  readonly supplierNotifiedAt: string | null;
}

/** `contract_securities` */
export interface FixtureSecurity {
  readonly id: number;
  readonly contractId: number;
  readonly securityType: ContractSecuritiesSecurityType;
  readonly issuer: string | null;
  readonly amount: Money | null;
  readonly expiresAt: string | null;
  readonly status: ContractSecuritiesStatus;
  readonly releasedAt: string | null;
  readonly releaseApprovalId: number | null;
  readonly evidence: { readonly evidenceItemId: number; readonly title: string } | null;
}

/** `contract_closeouts` */
export interface FixtureCloseout {
  readonly id: number;
  readonly contractId: number;
  readonly finalAcceptanceAt: string | null;
  readonly reconciliationNote: string | null;
  readonly outstandingClaims: string | null;
  readonly securitiesReleased: boolean;
  readonly warrantyUntil: string | null;
  readonly lessonsLearned: string | null;
  readonly retentionStart: string | null;
  readonly status: ContractCloseoutsStatus;
  readonly closedByUserId: number | null;
  readonly closedAt: string | null;
}

/** `holds` on a contract (owned by the core lifecycle service; the contracts screens show them). */
export interface FixtureContractHold {
  readonly id: number;
  readonly contractId: number;
  readonly holdType: HoldsHoldType;
  readonly reason: string;
  readonly blockedActions: readonly HoldsBlockedActions[];
  readonly startedAt: string;
  readonly reviewDate: string | null;
  readonly ownerUserId: number | null;
}
