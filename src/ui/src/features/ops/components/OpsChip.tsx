/** A chip with tone and label for an operations value the contract defines itself (see `lib/labels.ts`). */
import type { ChipTone } from '@contracts/enums';

import { Chip } from '../../../components/ui';
import { OPS_TONES, opsLabel } from '../lib/labels';
import type { OpsChipKind } from '../lib/labels';

export interface OpsChipProps {
  readonly kind: OpsChipKind;
  readonly value: string;
  readonly size?: 'md' | 'sm';
}

/** A chip with tone and label for a contract-defined value; the label is always shown. */
export function OpsChip({ kind, value, size }: OpsChipProps) {
  const tones: Readonly<Record<string, ChipTone>> = OPS_TONES[kind];
  return (
    <Chip tone={tones[value] ?? 'neutral'} size={size}>
      {opsLabel(kind, value)}
    </Chip>
  );
}
