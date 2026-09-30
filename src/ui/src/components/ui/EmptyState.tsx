/**
 * Empty, restricted and error states (PRD §11: every list has an empty state and a restricted-access explanation).
 * A restricted area shows an explanation, never a zero (BR-43), and reveals nothing about other organizations.
 */
import type { ReactNode } from 'react';

import { t } from '../../lib/i18n';
import type { ApiError } from '../../api/client';
import { Button } from './Button';
import { Banner } from './Banner';
import { describeError } from './errors';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export interface EmptyStateProps {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly icon?: IconName;
  readonly action?: ReactNode;
  readonly compact?: boolean;
}

export function EmptyState({
  title,
  description,
  icon = 'inbox',
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div className={compact ? 'tiq-empty tiq-empty--compact' : 'tiq-empty'} role="status">
      <Icon name={icon} />
      <p className="tiq-empty-title">{title}</p>
      {description !== undefined && <p>{description}</p>}
      {action}
    </div>
  );
}

export interface RestrictedStateProps {
  readonly title?: ReactNode;
  /** Why access is restricted, in business terms (for example "Sealed until the opening session"). */
  readonly description?: ReactNode;
  readonly action?: ReactNode;
  readonly compact?: boolean;
}

export function RestrictedState({
  title,
  description,
  action,
  compact = false,
}: RestrictedStateProps) {
  return (
    <div
      className={
        compact ? 'tiq-empty tiq-empty--compact tiq-restricted' : 'tiq-empty tiq-restricted'
      }
      role="status"
      data-state="restricted"
    >
      <Icon name="lock" />
      <p className="tiq-empty-title">{title ?? t('ui.restricted.title')}</p>
      <p>{description ?? t('ui.restricted.description')}</p>
      {action}
    </div>
  );
}

export interface ErrorStateProps {
  readonly error: ApiError;
  readonly onRetry?: () => void;
  readonly title?: ReactNode;
}

/** A failed load. A 403 renders the restricted state instead of an error. */
export function ErrorState({ error, onRetry, title }: ErrorStateProps) {
  if (error.kind === 'forbidden') {
    return <RestrictedState />;
  }
  return (
    <Banner
      tone="error"
      title={title ?? t('ui.error.loadTitle')}
      actions={
        onRetry !== undefined ? (
          <Button size="sm" icon="refresh" onClick={onRetry}>
            {t('ui.action.retry')}
          </Button>
        ) : undefined
      }
    >
      <p>{describeError(error)}</p>
      {error.correlationId !== null && (
        <p className="tiq-mono">{t('ui.error.correlation', { id: error.correlationId })}</p>
      )}
    </Banner>
  );
}
