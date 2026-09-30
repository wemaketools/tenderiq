/**
 * Text helpers of the qualification screens: category and scope labels, the blocked gate as a sentence and
 * calendar dates.
 */
import type { NonNegativeMoney } from '@contracts/common';
import type { CategoryRef } from '@contracts/qualification';
import type { QualificationDecisionsBlockedGate } from '@contracts/enums';

import { formatCalendarDate, formatMoney } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';

/** `WTR-PUMP Pumps`. */
export function categoryLabel(category: CategoryRef): string {
  return `${category.code} ${category.name}`;
}

/** `WTR-PUMP Pumps · up to BWP 3,000,000 · Botswana`. */
export function scopeText(
  category: CategoryRef | null,
  maxValue: NonNegativeMoney | null,
  geography?: string | null,
): string {
  if (category === null) return t('qualification.common.noScope');
  const parts = [categoryLabel(category)];
  parts.push(
    maxValue === null
      ? t('qualification.common.noValueLimit')
      : t('qualification.common.upTo', { value: formatMoney(maxValue) }),
  );
  if (geography !== undefined && geography !== null && geography !== '') parts.push(geography);
  return parts.join(' · ');
}

/** The blocked gate as a sentence ("Award blocked" / "No gate blocked"). */
export function gateText(gate: QualificationDecisionsBlockedGate | null): string {
  if (gate === null || gate === 'none') return t('qualification.common.noGateBlocked');
  return t('qualification.common.gateBlocked', {
    gate: tEnum('qualification_decisions.blocked_gate', gate),
  });
}

/** Formats a calendar date or the dash. */
export function dateOrDash(value: string | null): string | null {
  return value === null ? null : formatCalendarDate(value);
}

/** Inline style of a stacked table cell: chips keep their natural width instead of stretching. */
export const cellStack = { alignItems: 'flex-start' } as const;
