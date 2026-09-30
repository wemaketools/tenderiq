/**
 * The editable draft of a policy version's rules (ADM-06): numbers stay strings while typing and convert to the
 * contract's `PolicyRulesInput` on save, where the contract's cross-field rules are checked.
 */
import type {
  PolicyProfileVersionsLateSubmissionPolicy,
  PolicyProfileVersionsStandstillDayType,
  TendersProcedureWrite,
} from '@contracts/enums';
import type { PolicyRulesInput, PolicyVersionDetail } from '@contracts/policy';

type Rules = PolicyVersionDetail['rules'];

export interface ThresholdDraft {
  readonly procedure: string;
  readonly minValue: string;
  readonly maxValue: string;
  readonly currency: string;
  readonly requiredApprovalLevel: string;
  readonly requiresPublicNotice: boolean;
}

export interface RulesDraft {
  readonly permittedProcedures: readonly string[];
  readonly requiresReleaseApproval: boolean;
  readonly stagedOpeningDefault: boolean;
  readonly openingQuorum: string;
  readonly openingRequiresSecondPerson: boolean;
  readonly independentEvaluation: boolean;
  readonly negotiationPermitted: boolean;
  readonly bafoPermitted: boolean;
  readonly lateSubmissionPolicy: string;
  readonly questionDeadlineDaysBeforeClose: string;
  readonly minResponseDays: string;
  readonly standstillRequired: boolean;
  readonly standstillLength: string;
  readonly standstillDayType: string;
  readonly complaintWindowDays: string;
  readonly complaintRequiresIndependentReview: boolean;
  readonly publicAwardNoticeRequired: boolean;
  readonly approvalRouteNote: string;
  readonly thresholds: readonly ThresholdDraft[];
}

/** An empty draft for a new profile (every procedure rule must be chosen explicitly, PRD §17.2). */
export function emptyRulesDraft(currency: string): RulesDraft {
  return {
    permittedProcedures: [],
    requiresReleaseApproval: true,
    stagedOpeningDefault: false,
    openingQuorum: '2',
    openingRequiresSecondPerson: true,
    independentEvaluation: true,
    negotiationPermitted: false,
    bafoPermitted: false,
    lateSubmissionPolicy: 'reject',
    questionDeadlineDaysBeforeClose: '',
    minResponseDays: '',
    standstillRequired: false,
    standstillLength: '',
    standstillDayType: '',
    complaintWindowDays: '',
    complaintRequiresIndependentReview: false,
    publicAwardNoticeRequired: true,
    approvalRouteNote: '',
    thresholds: [
      {
        procedure: '',
        minValue: '0.00',
        maxValue: '',
        currency,
        requiredApprovalLevel: '',
        requiresPublicNotice: true,
      },
    ],
  };
}

export function rulesToDraft(rules: Rules): RulesDraft {
  return {
    permittedProcedures: [...rules.permittedProcedures],
    requiresReleaseApproval: rules.requiresReleaseApproval,
    stagedOpeningDefault: rules.stagedOpeningDefault,
    openingQuorum: String(rules.openingQuorum),
    openingRequiresSecondPerson: rules.openingRequiresSecondPerson,
    independentEvaluation: rules.independentEvaluation,
    negotiationPermitted: rules.negotiationPermitted,
    bafoPermitted: rules.bafoPermitted,
    lateSubmissionPolicy: rules.lateSubmissionPolicy,
    questionDeadlineDaysBeforeClose: String(rules.questionDeadlineDaysBeforeClose),
    minResponseDays: String(rules.minResponseDays),
    standstillRequired: rules.standstillRequired,
    standstillLength: rules.standstillLength === null ? '' : String(rules.standstillLength),
    standstillDayType: rules.standstillDayType ?? '',
    complaintWindowDays: String(rules.complaintWindowDays),
    complaintRequiresIndependentReview: rules.complaintRequiresIndependentReview,
    publicAwardNoticeRequired: rules.publicAwardNoticeRequired,
    approvalRouteNote: rules.approvalRouteNote ?? '',
    thresholds: rules.thresholds.map((band) => ({
      procedure: band.procedure,
      minValue: band.minValue,
      maxValue: band.maxValue ?? '',
      currency: band.currency,
      requiredApprovalLevel: band.requiredApprovalLevel,
      requiresPublicNotice: band.requiresPublicNotice,
    })),
  };
}

function wholeNumber(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value);
}

/** The draft as the contract input (invalid entries stay invalid so the schema reports them). */
export function draftToRules(draft: RulesDraft): PolicyRulesInput {
  return {
    permittedProcedures: draft.permittedProcedures as TendersProcedureWrite[],
    requiresReleaseApproval: draft.requiresReleaseApproval,
    stagedOpeningDefault: draft.stagedOpeningDefault,
    openingQuorum: wholeNumber(draft.openingQuorum),
    openingRequiresSecondPerson: draft.openingRequiresSecondPerson,
    independentEvaluation: draft.independentEvaluation,
    negotiationPermitted: draft.negotiationPermitted,
    bafoPermitted: draft.bafoPermitted,
    lateSubmissionPolicy: draft.lateSubmissionPolicy as PolicyProfileVersionsLateSubmissionPolicy,
    questionDeadlineDaysBeforeClose: wholeNumber(draft.questionDeadlineDaysBeforeClose),
    minResponseDays: wholeNumber(draft.minResponseDays),
    standstillRequired: draft.standstillRequired,
    standstillLength: draft.standstillLength.trim() === '' ? null : Number(draft.standstillLength),
    standstillDayType:
      draft.standstillDayType === ''
        ? null
        : (draft.standstillDayType as PolicyProfileVersionsStandstillDayType),
    complaintWindowDays: wholeNumber(draft.complaintWindowDays),
    complaintRequiresIndependentReview: draft.complaintRequiresIndependentReview,
    publicAwardNoticeRequired: draft.publicAwardNoticeRequired,
    approvalRouteNote:
      draft.approvalRouteNote.trim() === '' ? null : draft.approvalRouteNote.trim(),
    thresholds: draft.thresholds.map((band) => ({
      procedure: band.procedure as TendersProcedureWrite,
      minValue: band.minValue.trim(),
      maxValue: band.maxValue.trim() === '' ? null : band.maxValue.trim(),
      currency: band.currency.trim().toUpperCase(),
      requiredApprovalLevel: band.requiredApprovalLevel,
      requiresPublicNotice: band.requiresPublicNotice,
    })),
  };
}
