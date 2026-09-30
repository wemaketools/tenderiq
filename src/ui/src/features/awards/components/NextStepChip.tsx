/** The next required action of an award file (PRD §19), as a chip. */
import type { AwardNextStep } from '@contracts/awards';

import { Chip } from '../../../components/ui';
import { NEXT_STEP_TONE, nextStepLabel } from '../lib/labels';

export interface NextStepChipProps {
  readonly step: AwardNextStep;
  readonly size?: 'sm' | 'md';
}

export function NextStepChip({ step, size }: NextStepChipProps) {
  return (
    <Chip tone={NEXT_STEP_TONE[step]} size={size} icon="arrowRight">
      {nextStepLabel(step)}
    </Chip>
  );
}
