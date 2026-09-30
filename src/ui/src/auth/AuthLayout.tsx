/**
 * The centred auth surface (`.tiq-auth-page`): wordmark, one card, optional extra content below (the dev-only demo
 * accounts). Sign-in, forgot and reset password render outside the app shell.
 */
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { PrototypeBanner } from '../components/shell/PrototypeBanner';
import { Card } from '../components/ui/Card';
import { t } from '../lib/i18n';

export interface AuthLayoutProps {
  readonly title: string;
  readonly subtitle?: ReactNode;
  readonly children: ReactNode;
  readonly below?: ReactNode;
  readonly wide?: boolean;
}

export function Wordmark() {
  return (
    <span className="tiq-brand-name">
      {t('shell.brand.tender')}
      <span className="tiq-brand-iq">{t('shell.brand.iq')}</span>
    </span>
  );
}

export function AuthLayout({ title, subtitle, children, below, wide = false }: AuthLayoutProps) {
  useEffect(() => {
    document.title = t('shell.documentTitle', { title });
  }, [title]);
  return (
    <>
      <PrototypeBanner />
      <main className="tiq-auth-page">
        <div className="tiq-auth-brand">
          <Wordmark />
          <span className="tiq-brand-sub">{t('shell.brand.sub')}</span>
        </div>
        <Card
          className={wide ? 'tiq-auth-card tiq-auth-card--wide' : 'tiq-auth-card'}
          headingLevel={2}
        >
          <h1 className="tiq-card-title">{title}</h1>
          {subtitle !== undefined && <p className="tiq-card-sub">{subtitle}</p>}
          {children}
        </Card>
        {below}
      </main>
    </>
  );
}
