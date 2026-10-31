/**
 * Small marks of the buyer workspace (docs/plan/design1): pastel icon tiles, initials avatars, a status dot that
 * always carries its label, blue check marks with a label (a successful check), and the amber / red attention line.
 * None of them signals by colour alone.
 */
import type { ReactNode } from 'react';

import type { ChipTone } from '@contracts/enums';

import { initialsOf } from '../../lib/format';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export type MarkTone = 'accent' | 'warning' | 'danger' | 'info' | 'success' | 'neutral';

export interface IconTileProps {
  readonly icon: IconName;
  readonly tone?: MarkTone;
  readonly size?: 'sm' | 'md' | 'lg';
  /** Accessible name when the tile carries meaning on its own; omit next to visible text. */
  readonly label?: string;
}

export function IconTile({ icon, tone = 'accent', size = 'md', label }: IconTileProps) {
  const classes = ['tiq-tile'];
  if (tone !== 'accent') classes.push(`tiq-tile--${tone}`);
  if (size !== 'md') classes.push(`tiq-tile--${size}`);
  return (
    <span className={classes.join(' ')} aria-hidden={label === undefined ? true : undefined}>
      <Icon name={icon} label={label} />
    </span>
  );
}

const AVATAR_TONES = ['soft', 'info', 'warning', 'neutral'] as const;

/** A stable pastel tone for a name, so the same person always gets the same colour. */
function toneOfName(name: string): (typeof AVATAR_TONES)[number] {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return AVATAR_TONES[hash % AVATAR_TONES.length] ?? 'soft';
}

export interface AvatarProps {
  readonly name: string;
  readonly size?: 'sm' | 'md';
}

/** Initials on a pastel disc. Decorative: the name is always printed next to it by the caller. */
export function Avatar({ name, size = 'md' }: AvatarProps) {
  const classes = ['tiq-avatar', `tiq-avatar--${toneOfName(name)}`];
  if (size === 'sm') classes.push('tiq-avatar--sm');
  return (
    <span className={classes.join(' ')} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}

/** A person: avatar and name. */
export function Person({ name, size = 'md' }: AvatarProps) {
  return (
    <span className="tiq-person">
      <Avatar name={name} size={size} />
      <span className="tiq-person-name">{name}</span>
    </span>
  );
}

export interface StatusLabelProps {
  readonly tone: ChipTone | MarkTone;
  readonly children: ReactNode;
  /** A second, quieter line under the label ("Awaiting final approval"). */
  readonly sub?: ReactNode;
  readonly title?: string;
}

/** A coloured dot followed by its label (and an optional second line). */
export function StatusLabel({ tone, children, sub, title }: StatusLabelProps) {
  return (
    <span className={`tiq-status tiq-status--${tone}`} title={title} data-tone={tone}>
      <span className="tiq-status-dot" aria-hidden="true" />
      <span>
        {children}
        {sub !== undefined && <span className="tiq-status-sub">{sub}</span>}
      </span>
    </span>
  );
}

export type CheckState = 'done' | 'pending' | 'warning' | 'danger';

const CHECK_ICON: Readonly<Record<CheckState, IconName | null>> = {
  done: 'check',
  pending: null,
  warning: 'alertTriangle',
  danger: 'x',
};

export interface CheckMarkProps {
  readonly state?: CheckState;
}

/** A blue (done), hollow (pending), amber or red circle; always placed before a label. */
export function CheckMark({ state = 'done' }: CheckMarkProps) {
  const icon = CHECK_ICON[state];
  return (
    <span
      className={state === 'done' ? 'tiq-check-mark' : `tiq-check-mark tiq-check-mark--${state}`}
      aria-hidden="true"
    >
      {icon !== null && <Icon name={icon} />}
    </span>
  );
}

export interface CheckItem {
  readonly id: string;
  readonly label: ReactNode;
  readonly detail?: ReactNode;
  readonly state: CheckState;
  /** The state in words for assistive technology ("Passed", "Not yet"). */
  readonly stateLabel: string;
}

/** A plain list of checks: each a mark, the state in words (visually hidden) and the label. */
export function CheckList({
  items,
  label,
}: {
  readonly items: readonly CheckItem[];
  readonly label: string;
}) {
  return (
    <ul className="tiq-check-list-plain" aria-label={label}>
      {items.map((item) => (
        <li key={item.id} className="tiq-checkitem" data-state={item.state}>
          <CheckMark state={item.state} />
          <span>
            <span className="tiq-visually-hidden">{item.stateLabel}: </span>
            {item.label}
            {item.detail !== undefined && <span className="tiq-check-detail">{item.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export interface AttentionProps {
  readonly tone?: 'warning' | 'danger' | 'accent';
  readonly icon?: IconName;
  readonly children: ReactNode;
}

/** "2 overdue", "Today": a short coloured line with an optional icon; the text carries the meaning. */
export function Attention({ tone = 'warning', icon, children }: AttentionProps) {
  return (
    <span className={tone === 'warning' ? 'tiq-attention' : `tiq-attention tiq-attention--${tone}`}>
      {icon !== undefined && <Icon name={icon} />}
      {children}
    </span>
  );
}
