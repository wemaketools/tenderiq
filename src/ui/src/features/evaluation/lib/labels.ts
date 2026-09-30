/**
 * Display labels shared by the evaluation screens.
 */
import { GATE_FAILURE_CODES } from '@contracts/evaluation';
import type { EvaluationBidRef, EvaluationLotRef, EvaluationPlan } from '@contracts/evaluation';

import { t } from '../../../lib/i18n';

/** "Lot 3: Pump control panels and telemetry", or null for a tender evaluated as a whole. */
export function lotLabel(lot: EvaluationLotRef | null | undefined): string | null {
  return lot === null || lot === undefined
    ? null
    : t('evaluation.common.lot', { number: lot.lotNumber, title: lot.title });
}

/** "Supplier A (Serowe ICT Solutions)", or the neutral label alone while the evaluation is anonymized. */
export function bidLabel(bid: Pick<EvaluationBidRef, 'label' | 'supplierName'>): string {
  return bid.supplierName === null ? bid.label : `${bid.label} (${bid.supplierName})`;
}

const GATE_FAILURE_KEYS: ReadonlySet<string> = new Set(GATE_FAILURE_CODES);

/** Plain-language label of a gate failure code (`CRITERION_MINIMUM:<criterion code>` names the criterion). */
export function gateFailureLabel(code: string, plan: EvaluationPlan): string {
  const [base = '', detail] = code.split(':');
  if (!GATE_FAILURE_KEYS.has(base)) {
    return t('evaluation.results.gateFailure.other');
  }
  const criterion = plan.criteria.find((row) => row.code === detail);
  return t(`evaluation.results.gateFailure.${base}`, {
    criterion: criterion?.name ?? detail ?? '',
  });
}
