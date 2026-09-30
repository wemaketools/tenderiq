/**
 * Chips of derived evaluation states (not database enumerations): the stage of an evaluation, the price gate, the
 * commercial comparison and result states, and a score that is not given ("Not scored", never zero, AC-18).
 */
import type {
  CommercialState,
  EvaluationStage,
  PriceGate,
  ResultState,
} from '@contracts/evaluation';

import { Chip } from '../../../components/ui';
import { formatDecimalString } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import {
  COMMERCIAL_STATE_TONES,
  PRICE_GATE_TONES,
  RESULT_STATE_TONES,
  STAGE_TONES,
  priceGateState,
} from '../lib/scores';

export function StageChip({ stage }: { readonly stage: EvaluationStage }) {
  return <Chip tone={STAGE_TONES[stage]}>{t(`evaluation.stage.${stage}`)}</Chip>;
}

export function PriceGateChip({
  gate,
  size,
}: {
  readonly gate: PriceGate;
  readonly size?: 'sm' | 'md';
}) {
  const state = priceGateState(gate);
  return (
    <Chip
      tone={PRICE_GATE_TONES[state]}
      size={size}
      icon={state === 'closed' ? 'lock' : state === 'released' ? 'unlock' : undefined}
    >
      {t(`evaluation.priceGate.state.${state}`)}
    </Chip>
  );
}

export function CommercialStateChip({ state }: { readonly state: CommercialState }) {
  return (
    <Chip tone={COMMERCIAL_STATE_TONES[state]}>{t(`evaluation.commercial.state.${state}`)}</Chip>
  );
}

export function ResultStateChip({ state }: { readonly state: ResultState }) {
  return <Chip tone={RESULT_STATE_TONES[state]}>{t(`evaluation.results.state.${state}`)}</Chip>;
}

/** A rating, "N/A", or the "Not scored" flag. A missing score is never shown as 0. */
export function ScoreValue({
  score,
  isNotApplicable = false,
  places,
}: {
  readonly score: string | null;
  readonly isNotApplicable?: boolean;
  readonly places?: number;
}) {
  if (isNotApplicable) {
    return (
      <Chip tone="neutral" size="sm">
        {t('evaluation.score.notApplicable')}
      </Chip>
    );
  }
  if (score === null) {
    return (
      <Chip tone="warning" size="sm" outlined icon="alertTriangle">
        {t('evaluation.score.notScored')}
      </Chip>
    );
  }
  return <span className="tiq-num">{formatDecimalString(score, places)}</span>;
}
