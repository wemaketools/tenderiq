/** Gate helpers: gate checks → readiness items, and the count of blocking checks. */
import type { GateCheck } from '@contracts/awards';

import type { ReadinessItem } from '../../../components/ui';
import { t } from '../../../lib/i18n';

export function gateItems(checks: readonly GateCheck[]): ReadinessItem[] {
  return checks.map((check) => ({
    id: check.code,
    label: t(`awards.gate.${check.code}`),
    detail: check.detail ?? undefined,
    status: check.status,
  }));
}

/** Number of blocking checks in a gate. */
export function blockingCount(checks: readonly GateCheck[]): number {
  return checks.filter((check) => check.status === 'blocking').length;
}
