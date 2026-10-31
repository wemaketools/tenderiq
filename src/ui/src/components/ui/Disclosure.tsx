/**
 * An inline disclosure (docs/plan/design1, award readiness): a round chevron button with `aria-expanded` and
 * `aria-controls`, and the panel it controls, rendered only while open so its content leaves the tab order.
 */
import type { ReactNode } from 'react';

import { t } from '../../lib/i18n';
import { Icon } from './Icon';

export interface DisclosureToggleProps {
  readonly expanded: boolean;
  readonly onToggle: () => void;
  /** What the panel is about ("Facilities management readiness"), for the accessible name. */
  readonly label: string;
  readonly panelId: string;
}

export function DisclosureToggle({ expanded, onToggle, label, panelId }: DisclosureToggleProps) {
  const name = expanded
    ? t('ui.disclosure.collapse', { label })
    : t('ui.disclosure.expand', { label });
  return (
    <button
      type="button"
      className="tiq-disclosure-toggle"
      aria-expanded={expanded}
      aria-controls={panelId}
      aria-label={name}
      title={name}
      onClick={onToggle}
    >
      <Icon name="chevronDown" />
    </button>
  );
}

export interface DisclosurePanelProps {
  readonly id: string;
  readonly title?: ReactNode;
  readonly children: ReactNode;
}

export function DisclosurePanel({ id, title, children }: DisclosurePanelProps) {
  return (
    <div
      id={id}
      className="tiq-disclosure-panel"
      role="region"
      aria-label={typeof title === 'string' ? title : undefined}
    >
      {title !== undefined && <p className="tiq-disclosure-panel-title">{title}</p>}
      {children}
    </div>
  );
}
