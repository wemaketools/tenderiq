/**
 * Banners (PRD §19): a blocking condition (`error`), a warning, information, and a completed decision (`success`)
 * each look distinct: different colour, icon, border style and ARIA role (errors are alerts, the rest status).
 */
import type { ReactNode } from 'react';

import { Icon } from './Icon';
import type { IconName } from './Icon';

export type BannerTone = 'info' | 'success' | 'warning' | 'error';

const TONE_ICON: Readonly<Record<BannerTone, IconName>> = {
  info: 'info',
  success: 'checkCircle',
  warning: 'alertTriangle',
  error: 'alertOctagon',
};

export interface BannerProps {
  readonly tone: BannerTone;
  readonly title?: ReactNode;
  readonly children?: ReactNode;
  /** Buttons or links on the right. */
  readonly actions?: ReactNode;
  readonly className?: string;
}

export function Banner({ tone, title, children, actions, className }: BannerProps) {
  return (
    <div
      className={`tiq-banner tiq-banner--${tone}${className === undefined ? '' : ` ${className}`}`}
      role={tone === 'error' ? 'alert' : 'status'}
      data-tone={tone}
    >
      <Icon name={TONE_ICON[tone]} />
      <div className="tiq-banner-body">
        {title !== undefined && <p className="tiq-banner-title">{title}</p>}
        {children !== undefined && <div>{children}</div>}
      </div>
      {actions !== undefined && <div className="tiq-banner-actions">{actions}</div>}
    </div>
  );
}
