/**
 * ADM-09 program header and criteria drafts: seeding from a program, mapping to the contract bodies, and change
 * detection for the unsaved-changes guard.
 */
import type {
  Criterion,
  CriterionInput,
  ProgramDetail,
  QualificationOptions,
} from '@contracts/qualification';
import type {
  EvidenceItemsEvidenceType,
  QualificationCriteriaArea,
  QualificationCriteriaResponseType,
  ReassessmentTriggersTriggerType,
} from '@contracts/enums';

import { moneyOrNull, textOrNull } from './validation';

export interface ProgramDraft {
  readonly name: string;
  readonly description: string;
  readonly categoryId: string;
  readonly geography: string;
  readonly maxContractValue: { readonly amount: string; readonly currency: string };
  readonly validityMonths: string;
  readonly renewalNoticeDays: string;
  readonly decisionRoleCode: string;
  readonly requiresIndependentApproval: boolean;
  readonly ownerUserId: string;
  readonly monitoredTriggerTypes: readonly ReassessmentTriggersTriggerType[];
}

export const PROGRAM_FIELDS = [
  'name',
  'description',
  'categoryId',
  'geography',
  'maxContractValue',
  'validityMonths',
  'renewalNoticeDays',
  'decisionRoleCode',
  'requiresIndependentApproval',
  'ownerUserId',
  'monitoredTriggerTypes',
];

export function emptyProgramDraft(options: QualificationOptions | undefined): ProgramDraft {
  return {
    name: '',
    description: '',
    categoryId: '',
    geography: '',
    maxContractValue: { amount: '', currency: options?.currencies[0] ?? '' },
    validityMonths: '',
    renewalNoticeDays: '',
    decisionRoleCode: '',
    requiresIndependentApproval: true,
    ownerUserId: '',
    monitoredTriggerTypes: [],
  };
}

export function programDraftOf(program: ProgramDetail, currency: string): ProgramDraft {
  return {
    name: program.name,
    description: program.description ?? '',
    categoryId: String(program.category.categoryId),
    geography: program.geography ?? '',
    maxContractValue: {
      amount: program.maxContractValue?.amount ?? '',
      currency: program.maxContractValue?.currency ?? currency,
    },
    validityMonths: String(program.validityMonths),
    renewalNoticeDays: String(program.renewalNoticeDays),
    decisionRoleCode: program.decisionRoleCode,
    requiresIndependentApproval: program.requiresIndependentApproval,
    ownerUserId: String(program.owner.userId),
    monitoredTriggerTypes: program.monitoredTriggerTypes,
  };
}

function wholeNumber(value: string): number | undefined {
  return /^\d+$/.test(value.trim()) ? Number(value.trim()) : undefined;
}

/** The create/update body of the draft (invalid inputs stay undefined so the schema reports them). */
export function programBody(draft: ProgramDraft) {
  return {
    name: draft.name,
    description: textOrNull(draft.description),
    categoryId: draft.categoryId === '' ? undefined : Number(draft.categoryId),
    geography: textOrNull(draft.geography),
    maxContractValue: moneyOrNull(draft.maxContractValue),
    validityMonths: wholeNumber(draft.validityMonths),
    renewalNoticeDays: wholeNumber(draft.renewalNoticeDays),
    decisionRoleCode: draft.decisionRoleCode,
    requiresIndependentApproval: draft.requiresIndependentApproval,
    ownerUserId: draft.ownerUserId === '' ? undefined : Number(draft.ownerUserId),
    monitoredTriggerTypes: [...draft.monitoredTriggerTypes],
  };
}

/** One editable criterion row (a client key keeps React rows stable while reordering). */
export interface CriterionDraft {
  readonly key: string;
  readonly area: QualificationCriteriaArea;
  readonly question: string;
  readonly guidance: string;
  readonly responseType: QualificationCriteriaResponseType;
  readonly mandatory: boolean;
  readonly evidenceTypes: readonly EvidenceItemsEvidenceType[];
  readonly requiresNaReason: boolean;
  readonly thresholdDescription: string;
}

export function criterionDraftOf(criterion: Criterion): CriterionDraft {
  return {
    key: `c${criterion.id}`,
    area: criterion.area,
    question: criterion.question,
    guidance: criterion.guidance ?? '',
    responseType: criterion.responseType,
    mandatory: criterion.mandatory,
    evidenceTypes: criterion.evidenceTypes,
    requiresNaReason: criterion.requiresNaReason,
    thresholdDescription: criterion.thresholdDescription ?? '',
  };
}

export function newCriterionDraft(key: string, area: QualificationCriteriaArea): CriterionDraft {
  return {
    key,
    area,
    question: '',
    guidance: '',
    responseType: 'document',
    mandatory: true,
    evidenceTypes: [],
    requiresNaReason: true,
    thresholdDescription: '',
  };
}

export function criteriaBody(rows: readonly CriterionDraft[]): { criteria: CriterionInput[] } {
  return {
    criteria: rows.map((row, index) => ({
      area: row.area,
      question: row.question,
      guidance: textOrNull(row.guidance),
      responseType: row.responseType,
      mandatory: row.mandatory,
      evidenceTypes: [...row.evidenceTypes],
      requiresNaReason: row.requiresNaReason,
      thresholdDescription: textOrNull(row.thresholdDescription),
      sortOrder: index,
    })),
  };
}
