/**
 * Row types of the tender authoring fixtures. They mirror the blueprint tables of Migration 07 (camelCase) and
 * carry `tenantId` so handlers filter per tenant (foundation contract §2.3). Handlers project them onto the
 * contract schemas of `src/contracts/tenders.ts`; the fixture test parses every projection.
 */
import type {
  ApprovalRequestsStatus,
  DocumentsClassification,
  EvaluationCriteriaEnvelope,
  EvaluationPlansAggregationMethod,
  EvaluationPlansPriceMethod,
  EvaluationPlansStatus,
  EvaluationPlansThresholdScope,
  LotsStage,
  ParticipationConditionsConditionType,
  PricingItemsChargeType,
  PricingItemsRecurrence,
  ProcurementStrategiesStatus,
  ReleaseChecksCheckArea,
  ReleaseChecksStatus,
  RequirementsEnvelope,
  RequirementsMissingConsequence,
  RequirementsResponseType,
  RequirementsTreatment,
  TemplatesStatus,
  TenderEnvelopesEnvelope,
  TenderMilestonesMilestone,
  TenderTeamMembersTeamRole,
  TenderTermsTermType,
  TendersAwardModel,
  TendersEventType,
  TendersLinkType,
  TendersOpeningMode,
  TendersParticipation,
  TendersProcedure,
  TendersStatus,
  TieBreakRulesRule,
} from '../../../contracts/enums.js';
import type {
  CorrectionStatus,
  DiscountType,
  PriceEntryType,
  TenderCopySection,
  TenderCreationSource,
  TenderSection,
} from '../../../contracts/tenders.js';

export interface FxTender {
  readonly id: number;
  readonly tenantId: number;
  readonly reference: string;
  readonly title: string;
  readonly summary: string | null;
  readonly eventType: TendersEventType;
  readonly procedure: TendersProcedure;
  readonly participation: TendersParticipation;
  readonly status: TendersStatus;
  readonly ownerUserId: number;
  readonly legalEntityId: number | null;
  readonly categoryId: number | null;
  readonly departmentId: number | null;
  readonly projectId: number | null;
  readonly sourceRequestId: number | null;
  readonly strategyId: number | null;
  readonly policyVersionId: number | null;
  /** When the policy version was frozen onto the event (release, BR-09). */
  readonly policyFrozenAt: string | null;
  readonly calendarId: number | null;
  readonly officialTimeZone: string;
  readonly currency: string;
  readonly acceptedCurrencies: readonly string[];
  readonly acceptedLanguages: readonly string[];
  readonly bidValidityDays: number | null;
  readonly estimatedValue: string | null;
  readonly budgetAmount: string | null;
  readonly affordabilityAssumptions: string | null;
  readonly awardModel: TendersAwardModel;
  readonly maxLotsPerSupplier: number | null;
  readonly eligibilitySummary: string | null;
  readonly deliveryRequirements: string | null;
  readonly partialBidsAllowed: boolean;
  readonly alternativesAllowed: boolean;
  readonly negotiationPermitted: boolean;
  readonly demonstrationsPermitted: boolean;
  readonly referencesPermitted: boolean;
  readonly bafoPermitted: boolean;
  readonly openingMode: TendersOpeningMode;
  readonly independentEvaluation: boolean;
  readonly anonymizedEvaluation: boolean;
  readonly anonymizationLimitations: string | null;
  readonly submissionRules: string | null;
  readonly lateMaterialRule: string | null;
  readonly communicationChannelNote: string | null;
  readonly draftRevision: number;
  readonly currentVersionNo: number;
  readonly scheduledReleaseAt: string | null;
  readonly releasedAt: string | null;
  readonly closedAt: string | null;
  readonly cancelledAt: string | null;
  readonly cancellationReason: string | null;
  readonly isTemplate: boolean;
  readonly linkedFromTenderId: number | null;
  readonly linkType: TendersLinkType | null;
  readonly stageNo: number;
  readonly provenance: { readonly source: TenderCreationSource; readonly sourceId: number | null; readonly label: string };
  readonly createdBy: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Additional business field values saved in this session's command (absent: the recorded values, ADM-07). */
  readonly customFields?: Readonly<Record<string, string | boolean | null>>;
}

export interface FxLot {
  readonly id: number;
  readonly tenantId: number;
  readonly tenderId: number;
  readonly lotNo: number;
  readonly title: string;
  readonly description: string | null;
  readonly quantityDescription: string | null;
  readonly estimatedValue: string | null;
  readonly deliveryLocation: string | null;
  readonly deliveryDate: string | null;
  readonly submissionDeadline: string | null;
  readonly ownerUserId: number | null;
  readonly stage: LotsStage;
  readonly outcomeReason: string | null;
}

export interface FxTeamMember {
  readonly id: number;
  readonly tenantId: number;
  readonly tenderId: number;
  readonly lotId: number | null;
  readonly userId: number;
  readonly teamRole: TenderTeamMembersTeamRole;
  readonly assignedBy: number | null;
  readonly assignedAt: string;
  readonly removedAt: string | null;
  readonly removalReason: string | null;
  readonly conflictReviewPending: boolean;
}

export interface FxRequirement {
  readonly id: number;
  readonly tenantId: number;
  readonly tenderId: number;
  readonly lotId: number | null;
  readonly section: string;
  readonly refCode: string;
  readonly text: string;
  readonly ownerUserId: number | null;
  readonly applicability: string | null;
  readonly responseType: RequirementsResponseType;
  readonly choices: readonly string[];
  readonly responseInstructions: string | null;
  readonly evidenceRequired: string | null;
  readonly treatment: RequirementsTreatment;
  readonly envelope: RequirementsEnvelope;
  readonly missingConsequence: RequirementsMissingConsequence;
  readonly criterionId: number | null;
  readonly sortOrder: number;
}

export interface FxPricingItem {
  readonly id: number;
  readonly itemCode: string;
  readonly description: string;
  readonly unit: string;
  readonly quantity: string;
  readonly chargeType: PricingItemsChargeType;
  readonly recurrence: PricingItemsRecurrence | null;
  readonly isOptional: boolean;
  readonly isProvisional: boolean;
  readonly includeInEvaluation: boolean;
  readonly sortOrder: number;
}

export interface FxPricingSchedule {
  readonly id: number;
  readonly tenantId: number;
  readonly tenderId: number;
  readonly lotId: number | null;
  readonly name: string;
  readonly instructions: string | null;
  readonly taxTreatment: string | null;
  readonly evaluationPeriods: number | null;
  readonly discountsAccepted: readonly DiscountType[];
  readonly discountEvaluationNote: string | null;
  readonly priceEntries: readonly PriceEntryType[];
  readonly items: readonly FxPricingItem[];
}

export interface FxTerm {
  readonly id: number;
  readonly tenantId: number;
  readonly tenderId: number;
  readonly termType: TenderTermsTermType;
  readonly content: string;
  readonly documentId: number | null;
  readonly updatedAt: string;
}

export interface FxCriterion {
  readonly id: number;
  readonly parentId: number | null;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly maxPoints: string;
  readonly isPrice: boolean;
  readonly minScore: string | null;
  readonly scoringGuidance: string | null;
  readonly envelope: EvaluationCriteriaEnvelope;
  readonly naPermitted: boolean;
  readonly sortOrder: number;
}

export interface FxAnchor {
  readonly value: number;
  readonly label: string;
  readonly description: string | null;
}

export interface FxTieRule {
  readonly sequence: number;
  readonly rule: TieBreakRulesRule;
  readonly criterionId: number | null;
}

export interface FxPlanAmendment {
  readonly version: number;
  readonly amendedAt: string;
  readonly amendedBy: number;
  readonly note: string;
}

export interface FxEvaluationPlan {
  readonly id: number;
  readonly tenantId: number;
  readonly tenderId: number;
  readonly lotId: number | null;
  readonly status: EvaluationPlansStatus;
  readonly version: number;
  readonly scaleMax: number;
  readonly aggregationMethod: EvaluationPlansAggregationMethod;
  readonly priceMethod: EvaluationPlansPriceMethod;
  readonly priceWeight: string | null;
  readonly priceFormulaNote: string | null;
  readonly zeroPriceTreatment: string | null;
  readonly missingPriceTreatment: string | null;
  readonly thresholdScope: EvaluationPlansThresholdScope;
  readonly nonPriceThreshold: string | null;
  readonly decimalPlacesCalc: number;
  readonly decimalPlacesDisplay: number;
  readonly comparisonCurrency: string | null;
  readonly fxSource: string | null;
  readonly fxDate: string | null;
  readonly approvedAt: string | null;
  readonly approvedBy: number | null;
  readonly approvalRequestId: number | null;
  readonly criteria: readonly FxCriterion[];
  readonly anchors: readonly FxAnchor[];
  readonly tieBreakRules: readonly FxTieRule[];
  readonly amendments: readonly FxPlanAmendment[];
}

export interface FxMilestone {
  readonly id: number;
  readonly tenantId: number;
  readonly tenderId: number;
  readonly lotId: number | null;
  readonly milestone: TenderMilestonesMilestone;
  readonly at: string;
  readonly isDisclosed: boolean;
  readonly note: string | null;
}

export interface FxEnvelope {
  readonly tenantId: number;
  readonly tenderId: number;
  readonly envelope: TenderEnvelopesEnvelope;
  readonly openOrder: number;
}

export interface FxCondition {
  readonly id: number;
  readonly tenantId: number;
  readonly tenderId: number;
  readonly conditionType: ParticipationConditionsConditionType;
  readonly description: string;
  readonly qualificationProgramId: number | null;
  readonly sessionId: number | null;
  readonly blocking: boolean;
}

export interface FxReleaseCheck {
  readonly id: number;
  readonly tenantId: number;
  readonly tenderId: number;
  readonly checkArea: ReleaseChecksCheckArea;
  readonly status: ReleaseChecksStatus;
  readonly reviewerUserId: number | null;
  readonly note: string | null;
  readonly draftRevision: number;
  readonly checkedAt: string | null;
}

export interface FxReleaseApproval {
  readonly approvalId: number;
  readonly tenantId: number;
  readonly tenderId: number;
  readonly status: ApprovalRequestsStatus;
  readonly subjectVersion: number;
  readonly contentHash: string;
  readonly amount: string | null;
  readonly requestedBy: number;
  readonly requestedAt: string;
  readonly decidedBy: number | null;
  readonly decidedAt: string | null;
  readonly invalidatedAt: string | null;
  readonly invalidationReason: string | null;
}

export interface FxMaterialChange {
  readonly id: number;
  readonly tenantId: number;
  readonly tenderId: number;
  readonly changedAt: string;
  readonly changedBy: number;
  readonly section: TenderSection;
  readonly summary: string;
  readonly fromValue: string | null;
  readonly toValue: string | null;
  readonly draftRevision: number;
  readonly invalidatedApprovalId: number | null;
}

export interface FxCorrection {
  readonly id: number;
  readonly tenantId: number;
  readonly tenderId: number;
  readonly section: TenderSection;
  readonly lotId: number | null;
  readonly note: string;
  readonly assigneeUserId: number;
  readonly requestedBy: number;
  readonly requestedAt: string;
  readonly status: CorrectionStatus;
  readonly resolvedAt: string | null;
}

export interface FxPackageDocument {
  readonly documentId: number;
  readonly tenantId: number;
  readonly tenderId: number;
  readonly title: string;
  readonly fileName: string;
  readonly classification: DocumentsClassification;
  readonly language: string;
  readonly precedence: number | null;
  readonly versionNo: number;
  readonly relatedTo: 'tender' | 'lot' | 'tender_term';
  readonly lotId: number | null;
  /** The edition this document translates (language editions), if any. */
  readonly editionOf: number | null;
  readonly updatedAt: string;
}

export interface FxTenderVersion {
  readonly tenantId: number;
  readonly tenderId: number;
  readonly versionNo: number;
  readonly issuedAt: string;
  readonly issuedBy: number;
  readonly changeSummary: string;
  readonly addendumId: number | null;
}

// Reference data owned by other domains, mirrored here with the ids the storyline fixtures use.

export interface FxNamed {
  readonly id: number;
  readonly tenantId: number;
  readonly name: string;
}

export interface FxCategory extends FxNamed {
  readonly code: string;
  readonly parentId: number | null;
}

export interface FxCalendar extends FxNamed {
  readonly holidays: readonly { readonly date: string; readonly name: string }[];
}

export interface FxPolicyVersion {
  readonly id: number;
  readonly tenantId: number;
  readonly profileName: string;
  readonly versionNo: number;
  readonly permittedProcedures: readonly TendersProcedure[];
  readonly minResponseDays: number;
  readonly questionDeadlineDaysBeforeClose: number;
  readonly requiresReleaseApproval: boolean;
  readonly negotiationPermitted: boolean;
  readonly bafoPermitted: boolean;
}

export interface FxProject {
  readonly id: number;
  readonly tenantId: number;
  readonly reference: string;
  readonly title: string;
}

export interface FxRequest {
  readonly id: number;
  readonly tenantId: number;
  readonly reference: string;
  readonly title: string;
  readonly status: string;
  readonly estimatedValue: string | null;
  readonly categoryId: number | null;
  readonly convertedToTenderId: number | null;
}

export interface FxStrategy {
  readonly id: number;
  readonly tenantId: number;
  readonly title: string;
  readonly requestId: number | null;
  readonly eventType: TendersEventType;
  readonly procedure: TendersProcedure;
  readonly status: ProcurementStrategiesStatus;
  readonly usedByTenderId: number | null;
}

export interface FxTemplate {
  readonly id: number;
  readonly tenantId: number;
  readonly name: string;
  readonly procedure: TendersProcedure | null;
  readonly categoryId: number | null;
  readonly versionNo: number;
  readonly status: TemplatesStatus;
  readonly effectiveFrom: string | null;
  readonly reviewDate: string | null;
  readonly sourceTenderId: number;
  readonly sections: readonly TenderCopySection[];
}
