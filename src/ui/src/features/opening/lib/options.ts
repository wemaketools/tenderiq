/**
 * Select options and labels of the opening feature. Contract enumerations use `tEnum`; the derived projection
 * states of the opening contract (envelope, stage, progress, ineligibility, readiness) use this feature's catalog.
 */
import { enumValues } from '@contracts/enums';
import type { ChipTone, EnumName, EnumValue } from '@contracts/enums';
import type {
  EnvelopeState,
  IneligibleReason,
  OpeningProgress,
  OpeningReadinessCode,
  StageState,
} from '@contracts/opening';

import type { SelectOption } from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';

/** Options of a contract enumeration, optionally restricted to some values. */
export function enumSelectOptions<N extends EnumName>(
  name: N,
  only?: readonly EnumValue<N>[],
): SelectOption[] {
  const values: readonly EnumValue<N>[] = only ?? enumValues(name);
  return values.map((value) => ({ value, label: tEnum(name, value) }));
}

/** Options of a derived state list, labelled from `opening.<group>.<value>`. */
export function stateOptions(group: string, values: readonly string[]): SelectOption[] {
  return values.map((value) => ({ value, label: t(`opening.${group}.${value}`) }));
}

export function envelopeStateLabel(state: EnvelopeState): string {
  return t(`opening.envelopeState.${state}`);
}

export const ENVELOPE_STATE_TONE: Readonly<Record<EnvelopeState, ChipTone>> = {
  sealed: 'neutral',
  opened: 'success',
  withheld: 'warning',
};

export const STAGE_STATE_TONE: Readonly<Record<StageState, ChipTone>> = {
  sealed: 'neutral',
  scheduled: 'info',
  awaiting_quorum: 'warning',
  opened: 'success',
  blocked_by_price_gate: 'danger',
  cancelled: 'neutral',
};

export const PROGRESS_TONE: Readonly<Record<OpeningProgress, ChipTone>> = {
  not_closed: 'neutral',
  awaiting_opening: 'warning',
  partially_opened: 'info',
  fully_opened: 'success',
};

export function stageStateLabel(state: StageState): string {
  return t(`opening.stageState.${state}`);
}

export function progressLabel(progress: OpeningProgress): string {
  return t(`opening.progress.${progress}`);
}

export function ineligibleLabel(reason: IneligibleReason): string {
  return t(`opening.ineligible.${reason}`);
}

export function readinessLabel(code: OpeningReadinessCode): string {
  return t(`opening.readiness.${code}.label`);
}

/** Explains a readiness item in its current status (`opening.readiness.<code>.<status>`). */
export function readinessDetail(code: OpeningReadinessCode, status: string): string {
  return t(`opening.readiness.${code}.${status}`);
}
