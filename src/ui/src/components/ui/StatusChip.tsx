/**
 * Status chips (architecture-plan §7, DD-34). `StatusChip` renders any value of any enumeration in
 * `src/contracts/enums.ts` with its tone (`enumTone`) and label (`tEnum`): the tone map covers every value of every
 * enumeration, and the label text is always shown, so colour is never the only signal.
 */
import type { ReactNode } from 'react';

import { enumTone } from '@contracts/enums';
import type { ChipTone, EnumName, EnumValue } from '@contracts/enums';

import { t, tEnum } from '../../lib/i18n';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export interface ChipProps {
  readonly tone: ChipTone;
  readonly children: ReactNode;
  /** Transparent background with a coloured outline (overdue flags in the reference tables). */
  readonly outlined?: boolean;
  readonly size?: 'md' | 'sm';
  readonly icon?: IconName;
  readonly title?: string;
}

export function Chip({ tone, children, outlined = false, size = 'md', icon, title }: ChipProps) {
  const classes = ['tiq-chip', `tiq-chip--${tone}`];
  if (outlined) classes.push('tiq-chip--outlined');
  if (size === 'sm') classes.push('tiq-chip--sm');
  return (
    <span className={classes.join(' ')} data-tone={tone} title={title}>
      {icon !== undefined && <Icon name={icon} />}
      {children}
    </span>
  );
}

export interface StatusChipProps<N extends EnumName> {
  /** The enumeration (`table.column`), for example `tenders.status`. */
  readonly enum: N;
  readonly value: EnumValue<N> | (string & {});
  readonly size?: 'md' | 'sm';
  readonly icon?: IconName;
}

export function StatusChip<N extends EnumName>({
  enum: name,
  value,
  size,
  icon,
}: StatusChipProps<N>) {
  return (
    <Chip tone={enumTone(name, value)} size={size} icon={icon}>
      {tEnum(name, value)}
    </Chip>
  );
}

/** The danger "Overdue" flag used next to due dates (docs/technical/09-frontend.md §13 rule 9). */
export function OverdueChip() {
  return (
    <Chip tone="danger" outlined size="sm">
      {t('ui.overdue')}
    </Chip>
  );
}
