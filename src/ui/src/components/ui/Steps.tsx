/**
 * Step-like figures of the buyer workspace (docs/plan/design1): numbered steps ("What happens next"), the stage
 * summary (a filter / count view, never an editable stepper), the milestone row of an expanded award, and the
 * approval path (nodes joined by hairlines). Every state is given in words as well as by its mark.
 */
import type { ReactNode } from 'react';

import { formatCount } from '../../lib/format';
import { CheckMark } from './Marks';
import type { CheckState } from './Marks';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export interface NumberedStep {
  readonly id: string;
  readonly title: ReactNode;
  readonly text?: ReactNode;
  readonly current?: boolean;
  readonly done?: boolean;
}

export function NumberedSteps({
  steps,
  label,
}: {
  readonly steps: readonly NumberedStep[];
  readonly label: string;
}) {
  return (
    <ol className="tiq-steps" aria-label={label}>
      {steps.map((step, index) => (
        <li key={step.id} aria-current={step.current === true ? 'step' : undefined}>
          <span className="tiq-steps-no" aria-hidden="true">
            {step.done === true ? <Icon name="check" /> : index + 1}
          </span>
          <div>
            <p className="tiq-steps-title">{step.title}</p>
            {step.text !== undefined && <p className="tiq-steps-text">{step.text}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export interface StageSummaryItem {
  readonly id: string;
  readonly label: string;
  readonly note?: ReactNode;
  /** The count, or an icon when the stage is a terminal one ("Completed"). */
  readonly count: number | { readonly icon: IconName };
  readonly selected: boolean;
}

export interface StageSummaryProps {
  readonly items: readonly StageSummaryItem[];
  readonly label: string;
  /** Toggles the stage filter (`aria-pressed`). */
  readonly onToggle: (id: string) => void;
}

/** Stage filters with their counts, in process order. Pressing one filters the list below; pressing again clears it. */
export function StageSummary({ items, label, onToggle }: StageSummaryProps) {
  return (
    <ul className="tiq-stages" aria-label={label}>
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className="tiq-stage"
            aria-pressed={item.selected}
            onClick={() => onToggle(item.id)}
          >
            <span className="tiq-stage-count" aria-hidden="true">
              {typeof item.count === 'number' ? (
                formatCount(item.count)
              ) : (
                <Icon name={item.count.icon} />
              )}
            </span>
            <span className="tiq-stage-label">
              {item.label}
              {typeof item.count === 'number' && (
                <span className="tiq-visually-hidden">: {formatCount(item.count)}</span>
              )}
            </span>
            {item.note !== undefined && <span className="tiq-stage-note">{item.note}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

export interface MilestoneItem {
  readonly id: string;
  readonly label: ReactNode;
  readonly note?: ReactNode;
  readonly state: CheckState;
  readonly stateLabel: string;
}

export function Milestones({
  items,
  label,
}: {
  readonly items: readonly MilestoneItem[];
  readonly label: string;
}) {
  return (
    <ol className="tiq-milestones" aria-label={label}>
      {items.map((item) => (
        <li key={item.id} className="tiq-milestone" data-state={item.state}>
          <CheckMark state={item.state} />
          <span className="tiq-milestone-label">
            <span className="tiq-visually-hidden">{item.stateLabel}: </span>
            {item.label}
          </span>
          {item.note !== undefined && <span className="tiq-milestone-note">{item.note}</span>}
        </li>
      ))}
    </ol>
  );
}

export interface PathNode {
  readonly id: string;
  readonly label: ReactNode;
  readonly note?: ReactNode;
  readonly state: CheckState;
  readonly stateLabel: string;
  readonly current?: boolean;
}

/** The approval path: Procurement ✓ — Finance ✓ — ○ You. */
export function ApprovalPath({
  nodes,
  label,
}: {
  readonly nodes: readonly PathNode[];
  readonly label: string;
}) {
  return (
    <ol className="tiq-path" aria-label={label}>
      {nodes.map((node) => (
        <li key={node.id} aria-current={node.current === true ? 'step' : undefined}>
          <CheckMark state={node.state} />
          <span className={node.current === true ? 'tiq-path-current' : undefined}>
            <span className="tiq-visually-hidden">{node.stateLabel}: </span>
            {node.label}
            {node.note !== undefined && <span className="tiq-path-note"> {node.note}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
