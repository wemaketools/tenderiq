/**
 * The draft of a BUY-35 decision (record or supersede): seeding from a recommendation or the decision being
 * superseded, the contract fields it maps to, and a dirty flag against its seed.
 */
import { useState } from 'react';

import type {
  QualificationDecisionsBlockedGate,
  QualificationDecisionsOutcome,
} from '@contracts/enums';

import type { ConditionValue, ScopeValue } from '../components/TermFields';
import { moneyOrNull, textOrNull } from './validation';

export interface DecisionDraft {
  readonly outcome: QualificationDecisionsOutcome | '';
  readonly scope: ScopeValue;
  readonly terms: ConditionValue;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
  readonly reassessmentDate: string;
  readonly reasons: string;
  readonly supplierExplanation: string;
  readonly appealRoute: string;
  readonly notifySupplier: boolean;
}

export interface DecisionDraftSeed {
  readonly outcome?: QualificationDecisionsOutcome | '';
  readonly categoryId: number | null;
  readonly maxValue: { readonly amount: string; readonly currency: string } | null;
  readonly geography: string | null;
  readonly conditions?: string | null;
  readonly allowedActivities?: string | null;
  readonly blockedGate?: QualificationDecisionsBlockedGate;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string | null;
  readonly reassessmentDate?: string | null;
  readonly appealRoute?: string | null;
  readonly currency: string;
}

export function seedDraft(seed: DecisionDraftSeed): DecisionDraft {
  return {
    outcome: seed.outcome ?? '',
    scope: {
      categoryId: seed.categoryId === null ? '' : String(seed.categoryId),
      maxValue: {
        amount: seed.maxValue?.amount ?? '',
        currency: seed.maxValue?.currency ?? seed.currency,
      },
      geography: seed.geography ?? '',
    },
    terms: {
      conditions: seed.conditions ?? '',
      allowedActivities: seed.allowedActivities ?? '',
      blockedGate: seed.blockedGate ?? 'none',
    },
    effectiveFrom: seed.effectiveFrom,
    effectiveTo: seed.effectiveTo ?? '',
    reassessmentDate: seed.reassessmentDate ?? '',
    reasons: '',
    supplierExplanation: '',
    appealRoute: seed.appealRoute ?? '',
    notifySupplier: true,
  };
}

/** The contract fields of the draft (outcome-specific extras are added by the caller). */
export function decisionFields(draft: DecisionDraft) {
  return {
    outcome: draft.outcome === '' ? undefined : draft.outcome,
    scopeCategoryId: draft.scope.categoryId === '' ? undefined : Number(draft.scope.categoryId),
    scopeMaxValue: moneyOrNull(draft.scope.maxValue),
    scopeGeography: textOrNull(draft.scope.geography),
    effectiveFrom: draft.effectiveFrom === '' ? undefined : draft.effectiveFrom,
    effectiveTo: draft.effectiveTo === '' ? null : draft.effectiveTo,
    reassessmentDate: draft.reassessmentDate === '' ? null : draft.reassessmentDate,
    conditions: textOrNull(draft.terms.conditions),
    allowedActivities: textOrNull(draft.terms.allowedActivities),
    blockedGate: draft.terms.blockedGate,
    reasons: draft.reasons,
    supplierExplanation: draft.supplierExplanation,
    appealRoute: textOrNull(draft.appealRoute),
    notifySupplier: draft.notifySupplier,
  };
}

export const DECISION_FIELDS = [
  'outcome',
  'scopeCategoryId',
  'scopeMaxValue',
  'scopeGeography',
  'effectiveFrom',
  'effectiveTo',
  'reassessmentDate',
  'conditions',
  'allowedActivities',
  'blockedGate',
  'reasons',
  'supplierExplanation',
  'appealRoute',
  'notifySupplier',
  'supersedeReason',
  'triggerId',
];

/** Draft state with a dirty flag against its seed. */
export function useDecisionDraft(seed: () => DecisionDraft) {
  const [baseline] = useState(seed);
  const [draft, setDraft] = useState(baseline);
  return { draft, setDraft, dirty: JSON.stringify(draft) !== JSON.stringify(baseline) } as const;
}
