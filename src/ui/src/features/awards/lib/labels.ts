/**
 * Labels and chip tones of the contract-level enumerations of the awards contract (next step, gate checks,
 * supplier results, decisions). Database enumerations use `StatusChip`/`tEnum` directly.
 */
import type {
  AwardNextStep,
  AwardValueBasis,
  SupplierLotResult,
  SupplierOutcomeResult,
} from '@contracts/awards';
import type { ChipTone } from '@contracts/enums';

import { t } from '../../../lib/i18n';

export const NEXT_STEP_TONE: Readonly<Record<AwardNextStep, ChipTone>> = {
  prepare_recommendation: 'info',
  submit_recommendation: 'info',
  await_recommendation_approval: 'warning',
  issue_intent_notice: 'accent',
  await_standstill: 'warning',
  resolve_complaint: 'danger',
  final_award: 'accent',
  publish_award_notice: 'accent',
  close_event: 'info',
  archive: 'neutral',
  none: 'neutral-outlined',
};

export const LOT_RESULT_TONE: Readonly<Record<SupplierLotResult, ChipTone>> = {
  preferred_bidder: 'warning',
  preferred_withdrawn: 'neutral-outlined',
  intent_to_award: 'accent',
  awarded: 'success',
  unsuccessful: 'neutral',
  no_award: 'neutral-outlined',
  cancelled: 'danger',
  pending: 'info',
};

export const OUTCOME_RESULT_TONE: Readonly<Record<SupplierOutcomeResult, ChipTone>> = {
  preferred_bidder: 'warning',
  preferred_withdrawn: 'neutral-outlined',
  intent_to_award: 'accent',
  awarded: 'success',
  unsuccessful: 'neutral',
  cancelled: 'danger',
  mixed: 'info',
};

/** What a value represents: recommended, approved, intended or final awarded (BR-31: never "awarded" too early). */
export function valueBasisLabel(basis: AwardValueBasis): string {
  return t(`awards.value.basis.${basis}`);
}

export function valueBasisHint(basis: AwardValueBasis): string {
  return t(`awards.value.hint.${basis}`);
}

export function nextStepLabel(step: AwardNextStep): string {
  return t(`awards.nextStep.${step}`);
}

export function lotLabel(lot: { readonly lotNo: number; readonly title: string }): string {
  return t('awards.common.lotLabel', { no: lot.lotNo, title: lot.title });
}

export function lotNosLabel(lotNos: readonly number[]): string {
  if (lotNos.length === 0) return t('awards.common.allLots');
  if (lotNos.length === 1) return t('awards.common.lotNo', { no: lotNos[0] ?? 0 });
  return t('awards.common.lotNos', { lots: lotNos.join(', ') });
}

export function yesNo(value: boolean): string {
  return value ? t('awards.common.yes') : t('awards.common.no');
}
