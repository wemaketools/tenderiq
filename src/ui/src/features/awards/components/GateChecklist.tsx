/**
 * A gate (recommendation submission, final award, closeout) as a readiness checklist: blocking conditions, warnings
 * and passed checks look distinct (PRD §19), and each code carries its record-specific explanation.
 */
import type { GateCheck } from '@contracts/awards';

import { ReadinessChecklist } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { gateItems } from '../lib/gates';

export interface GateChecklistProps {
  readonly checks: readonly GateCheck[];
  readonly label: string;
}

export function GateChecklist({ checks, label }: GateChecklistProps) {
  if (checks.length === 0) {
    return <p className="tiq-text-muted">{t('awards.gate.none')}</p>;
  }
  return <ReadinessChecklist label={label} items={gateItems(checks)} />;
}
