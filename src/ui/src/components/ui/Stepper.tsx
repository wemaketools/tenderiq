/**
 * Stepper: progress through a multi-step process (tender authoring, response preparation, contract finalization).
 * Each step is complete, current, upcoming or blocked; the state is also given in text for assistive technology.
 */
import type { ReactNode } from 'react';

import { t } from '../../lib/i18n';
import { Icon } from './Icon';

export type StepState = 'complete' | 'current' | 'upcoming' | 'blocked';

export interface StepItem {
  readonly id: string;
  readonly label: ReactNode;
  readonly description?: ReactNode;
  readonly state: StepState;
}

export interface StepperProps {
  readonly steps: readonly StepItem[];
  readonly label: string;
}

export function Stepper({ steps, label }: StepperProps) {
  return (
    <ol className="tiq-stepper" aria-label={label}>
      {steps.map((step, index) => (
        <li
          key={step.id}
          className={`tiq-step tiq-step--${step.state}`}
          aria-current={step.state === 'current' ? 'step' : undefined}
        >
          <span className="tiq-step-marker" aria-hidden="true">
            {step.state === 'complete' ? (
              <Icon name="check" />
            ) : step.state === 'blocked' ? (
              <Icon name="x" />
            ) : (
              index + 1
            )}
          </span>
          <span className="tiq-step-text">
            <span className="tiq-step-label">{step.label}</span>
            {step.description !== undefined && (
              <span className="tiq-step-desc">{step.description}</span>
            )}
            <span className="tiq-visually-hidden">{t(`ui.step.${step.state}`)}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
