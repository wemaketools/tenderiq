/**
 * A business gate of the selection stage (`{ allowed, blockers }`): when blocked, every reason is listed in words so
 * the user sees why the action is unavailable and what decision unblocks it (AC-23, AC-24); the machine code stays
 * in `data-code` for tests and support, never in the visible text. Blocking reasons
 * are shown as an error, an open gate as a success, so blocks, warnings and completed decisions look distinct.
 */
import type { ReactNode } from 'react';

import type { SelectionGate } from '@contracts/selection';

import { Banner } from '../../../components/ui';
import { t } from '../../../lib/i18n';

export interface GatePanelProps {
  readonly gate: SelectionGate;
  /** Title while the action is blocked, for example "Final offers are blocked". */
  readonly blockedTitle: string;
  /** Title while the action is available; omit to render nothing when open. */
  readonly allowedTitle?: string;
  readonly actions?: ReactNode;
}

export function GatePanel({ gate, blockedTitle, allowedTitle, actions }: GatePanelProps) {
  if (gate.allowed) {
    if (allowedTitle === undefined) return null;
    return <Banner tone="success" title={allowedTitle} actions={actions} />;
  }
  return (
    <Banner tone="error" title={blockedTitle} actions={actions}>
      {gate.blockers.length === 0 ? (
        <p>{t('selection.gate.noDetail')}</p>
      ) : (
        <ul>
          {gate.blockers.map((blocker) => (
            <li key={blocker.code} data-code={blocker.code}>
              {blocker.message}
            </li>
          ))}
        </ul>
      )}
    </Banner>
  );
}
