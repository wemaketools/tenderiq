/**
 * The readiness of an evaluation gate (price gate, moderation, comparison approval, report sign-off): blocking
 * errors, warnings and passed checks stay distinct (PRD §19).
 */
import type { ReadinessItem } from '@contracts/evaluation';

import { ReadinessChecklist } from '../../../components/ui';

export function Readiness({
  items,
  label,
}: {
  readonly items: readonly ReadinessItem[];
  readonly label: string;
}) {
  return (
    <ReadinessChecklist
      label={label}
      items={items.map((item) => ({
        id: item.id,
        label: item.label,
        detail: item.detail ?? undefined,
        status: item.status,
      }))}
    />
  );
}
