/**
 * Row types of the evaluation fixtures (domain 11). They mirror the blueprint tables of Migration 10
 * (`evaluation_assignments`, `evaluation_scores`, `score_corrections`, `moderation_sessions`, `moderated_scores`,
 * `commercial_evaluations`, `evaluation_results`, `evaluation_reports`, `evaluation_report_signoffs`,
 * `price_gate_releases`) plus the Migration 02 declarations. Every row carries its buyer `tenantId`; people are user
 * ids that the handlers resolve to `PersonRef`s through the platform fixtures.
 *
 * Contract sub-shapes (plan, tender/lot/bid references, responses, FX basis) are typed with the contract schemas so
 * a fixture that drifts from the contract fails the typecheck, and the fixture test parses every assembled view.
 */
import type { Money } from '../../../contracts/common.js';
import type {
  AbnormallyLowOutcome,
  CommercialState,
  CorrectionStatus,
  CostComponent,
  CriterionResponse,
  EvaluationBidRef,
  EvaluationLotRef,
  EvaluationPlan,
  EvaluationTenderRef,
  FxBasis,
  ResultState,
} from '../../../contracts/evaluation.js';
import type {
  CommercialEvaluationsAffordability,
  CommercialEvaluationsStatus,
  ConflictDeclarationsDisposition,
  ConflictDeclarationsNature,
  EvaluationAssignmentsStatus,
  EvaluationReportSignoffsDecision,
  EvaluationReportsStatus,
  EvaluationScoresStatus,
  ModerationSessionsMethod,
  ModerationSessionsStatus,
} from '../../../contracts/enums.js';

/** A bid in an evaluation, with its opened technical responses per criterion. */
export interface FixtureBid extends EvaluationBidRef {
  /** `false` for a bid that is not eligible for ranking (for example failed a mandatory gate). */
  readonly eligible: boolean;
  /** Why its commercial envelope stays sealed, when it does. */
  readonly sealedReason: string | null;
  readonly responses: readonly CriterionResponse[];
}

export interface FixtureModeratedScore {
  readonly moderatedScoreId: number;
  readonly bidId: number;
  readonly criterionId: number;
  readonly finalScore: string;
  readonly method: ModerationSessionsMethod;
  readonly reasons: string;
  readonly moderatedByUserId: number;
  readonly recordedAt: string;
  readonly supersededById: number | null;
}

export interface FixtureModerationSession {
  readonly sessionId: number;
  readonly method: ModerationSessionsMethod;
  readonly status: ModerationSessionsStatus;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly finalizedAt: string | null;
  readonly scores: readonly FixtureModeratedScore[];
}

export interface FixtureCommercialRow {
  readonly commercialEvaluationId: number;
  readonly bidId: number;
  readonly revisionId: number;
  readonly submittedTotal: Money;
  readonly arithmeticCorrection: Money | null;
  readonly correctionRule: string | null;
  readonly correctionStatus: CorrectionStatus;
  /** Who proposed the correction (never its approver, CORRECTION_SELF_APPROVAL). */
  readonly correctionProposedByUserId: number | null;
  readonly correctionProposedAt: string | null;
  readonly correctionApprovedByUserId: number | null;
  readonly supplierAckAt: string | null;
  readonly fx: FxBasis | null;
  readonly evaluatedCost: Money;
  readonly costComponents: readonly CostComponent[];
  readonly excludedItemsNote: string | null;
  readonly assumptions: string | null;
  readonly abnormallyLowFlag: boolean;
  readonly abnormallyLowOutcome: AbnormallyLowOutcome | null;
  readonly abnormallyLowReview: string | null;
  readonly inReferenceSet: boolean;
  readonly referenceExclusionReason: string | null;
  readonly affordability: CommercialEvaluationsAffordability;
  readonly status: CommercialEvaluationsStatus;
}

export interface FixtureCommercial {
  readonly status: CommercialState;
  readonly reviewerUserId: number | null;
  readonly taxTreatment: string | null;
  readonly basisNote: string | null;
  readonly approvedAt: string | null;
  readonly approvedByUserId: number | null;
  readonly rows: readonly FixtureCommercialRow[];
}

/** Per-bid facts of `evaluation_results` that are decisions, not arithmetic (gate failures, explanations, ties). */
export interface FixtureResultFacts {
  readonly resultId: number;
  readonly bidId: number;
  readonly gateFailures: readonly string[];
  readonly explanation: string;
  readonly tieBreakApplied: string | null;
}

export interface FixtureResults {
  readonly status: ResultState;
  readonly computedAt: string | null;
  readonly facts: readonly FixtureResultFacts[];
}

export interface FixtureSignoff {
  readonly signoffId: number | null;
  readonly userId: number;
  readonly decision: EvaluationReportSignoffsDecision | null;
  readonly note: string | null;
  readonly decidedAt: string | null;
}

export interface FixtureReport {
  readonly reportId: number;
  readonly version: number;
  readonly status: EvaluationReportsStatus;
  readonly summary: string | null;
  readonly documentId: number | null;
  readonly createdAt: string;
  readonly createdByUserId: number;
  readonly submittedForSignoffAt: string | null;
  readonly signedOffAt: string | null;
  readonly handedOffAt: string | null;
  readonly recommendedBidId: number | null;
  readonly signoffs: readonly FixtureSignoff[];
}

export interface FixturePriceGate {
  readonly applies: boolean;
  readonly releasedAt: string | null;
  readonly releasedByUserId: number | null;
  readonly nonPriceCompleteConfirmed: boolean | null;
  readonly note: string | null;
}

export interface FixtureTimelineEvent {
  readonly at: string;
  readonly title: string;
  readonly actorUserId: number | null;
  readonly detail: string | null;
  /**
   * What the detail discloses, when it is not for every committee member:
   * - `committee_results`: committee scores, moderation outcomes or the ranking; withheld from an evaluator whose own
   *   assessment is not submitted or whose conflict awaits review (PRD §4.3).
   * - `conflict_detail`: the nature of a conflict declaration; shown only to the chair and `subjectUserId` (the
   *   declarant).
   */
  readonly sensitivity?: 'committee_results' | 'conflict_detail';
  readonly subjectUserId?: number;
}

/** One evaluation: a tender evaluated as a whole, or one lot of it. */
export interface FixtureEvaluation {
  readonly key: string;
  readonly tenantId: number;
  readonly chairUserId: number;
  /** The tender owner (tender team `owner`); the award team sees an evaluation through the tender team (BR-26). */
  readonly tenderOwnerUserId: number;
  readonly tender: EvaluationTenderRef;
  readonly lot: EvaluationLotRef | null;
  readonly plan: EvaluationPlan;
  readonly bids: readonly FixtureBid[];
  readonly budget: Money | null;
  readonly priceGate: FixturePriceGate;
  readonly divergenceThreshold: string;
  readonly moderation: FixtureModerationSession | null;
  readonly commercial: FixtureCommercial;
  readonly results: FixtureResults;
  readonly lotConstraintNote: string;
  /** Newest first; the first one is the current report. */
  readonly reports: readonly FixtureReport[];
  readonly timeline: readonly FixtureTimelineEvent[];
}

export interface FixtureConflictDeclaration {
  readonly declarationId: number;
  readonly hasConflict: boolean;
  readonly nature: ConflictDeclarationsNature | null;
  readonly supplierTenantId: number | null;
  readonly details: string | null;
  readonly declaredAt: string;
  readonly disposition: ConflictDeclarationsDisposition;
  readonly reviewedByUserId: number | null;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
}

export interface FixtureAssignmentEvent {
  readonly at: string;
  readonly event: string;
  readonly actorUserId: number | null;
  readonly note: string | null;
}

export interface FixtureAssignment {
  readonly assignmentId: number;
  readonly tenantId: number;
  readonly evaluationKey: string;
  readonly evaluatorUserId: number;
  readonly bidId: number | null;
  readonly criterionIds: readonly number[];
  readonly isCommercial: boolean;
  readonly dueAt: string;
  readonly status: EvaluationAssignmentsStatus;
  readonly createdAt: string;
  readonly acceptedAt: string | null;
  readonly submittedAt: string | null;
  readonly undertaking: { readonly undertakingId: number; readonly textVersion: string; readonly acceptedAt: string } | null;
  readonly conflictDeclaration: FixtureConflictDeclaration | null;
  readonly reassignedToAssignmentId: number | null;
  readonly reassignmentReason: string | null;
  readonly reassignmentRequestedAt: string | null;
  readonly returnReason: string | null;
  readonly history: readonly FixtureAssignmentEvent[];
}

export interface FixtureScoreCorrection {
  readonly correctionId: number;
  readonly previousScore: string | null;
  readonly newScore: string | null;
  readonly previousRationale: string | null;
  readonly reason: string;
  readonly correctedByUserId: number;
  readonly correctedAt: string;
  readonly returnedByChair: boolean;
}

export interface FixtureScore {
  readonly scoreId: number;
  readonly tenantId: number;
  readonly assignmentId: number;
  readonly bidId: number;
  readonly criterionId: number;
  /** `null` = not yet scored (never zero, AC-18). */
  readonly score: string | null;
  readonly isNotApplicable: boolean;
  readonly rationale: string | null;
  readonly evidenceRefs: readonly string[];
  readonly clarificationNeeded: boolean;
  readonly clarificationQuestion: string | null;
  readonly status: EvaluationScoresStatus;
  readonly submittedAt: string | null;
  readonly version: number;
  readonly corrections: readonly FixtureScoreCorrection[];
}

/** Everything an evaluation fixture module contributes. */
export interface EvaluationFixtureSet {
  readonly evaluation: FixtureEvaluation;
  readonly assignments: readonly FixtureAssignment[];
  readonly scores: readonly FixtureScore[];
}

