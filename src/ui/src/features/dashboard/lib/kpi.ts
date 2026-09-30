/** Maps a contract KPI delta to the KpiCard delta (`+2`, `-1`, `0`). */
import type { KpiDelta as ContractKpiDelta } from '@contracts/reporting';

import type { KpiDelta } from '../../../components/ui';

export function kpiDelta(delta: ContractKpiDelta | null): KpiDelta | undefined {
  if (delta === null) return undefined;
  const sign = delta.direction === 'up' ? '+' : delta.direction === 'down' ? '-' : '';
  return { direction: delta.direction, text: `${sign}${delta.value}`, positive: delta.positive };
}
