/**
 * Loading placeholders (`.tiq-skeleton`). The wrapper announces "Loading" once to assistive technology.
 */
import type { CSSProperties } from 'react';

import { t } from '../../lib/i18n';

export interface SkeletonProps {
  /** CSS width (token-free sizes such as `60%`). */
  readonly width?: string;
  /** CSS height, default one text line. */
  readonly height?: string;
}

export function Skeleton({ width = '100%', height = '14px' }: SkeletonProps) {
  const style: CSSProperties = { width, height };
  return <span className="tiq-skeleton" style={style} aria-hidden="true" />;
}

export interface SkeletonBlockProps {
  /** Number of text lines. */
  readonly lines?: number;
  readonly label?: string;
}

/** A block of skeleton lines with an accessible loading status. */
export function SkeletonBlock({ lines = 3, label }: SkeletonBlockProps) {
  return (
    <div className="tiq-skeleton-stack" role="status" aria-live="polite" aria-busy="true">
      <span className="tiq-visually-hidden">{label ?? t('ui.loading')}</span>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} width={index === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  );
}
