/**
 * PublicShell: the public portal frame (PUB-01…PUB-07) for visitors without an account: wordmark, Opportunities,
 * Awards, Plans, Guidance, Sign in (or the workspace when signed in) and Register, and a footer.
 */
import { useEffect } from 'react';
import { Link, NavLink, Outlet } from 'react-router';

import { useAppSelector } from '../../app/hooks';
import { landingPath, sessionPhase } from '../../app/sessionSelectors';
import { t } from '../../lib/i18n';
import { ButtonLink } from '../ui/Button';
import { PrototypeBanner } from './PrototypeBanner';

const LINKS = [
  { to: '/opportunities', label: 'shell.public.opportunities' },
  { to: '/awards', label: 'shell.public.awards' },
  { to: '/plans', label: 'shell.public.plans' },
  { to: '/guidance', label: 'shell.public.guidance' },
] as const;

export function PublicShell() {
  const session = useAppSelector((state) => state.session);
  const ready = sessionPhase(session) === 'ready';

  useEffect(() => {
    document.title = t('shell.public.documentTitle');
  }, []);

  return (
    <div className="tiq-public">
      <a className="tiq-skip-link" href="#tiq-public-main">
        {t('shell.skipToContent')}
      </a>
      <header className="tiq-public-header">
        <div className="tiq-public-header-inner">
          <Link to="/" className="tiq-public-brand" aria-label={t('shell.public.home')}>
            <span className="tiq-brand-name">
              {t('shell.brand.tender')}
              <span className="tiq-brand-iq">{t('shell.brand.iq')}</span>
            </span>
            <span className="tiq-brand-sub">{t('shell.brand.sub')}</span>
          </Link>
          <nav aria-label={t('shell.public.navLabel')}>
            <ul className="tiq-public-nav">
              {LINKS.map((link) => (
                <li key={link.to}>
                  <NavLink to={link.to}>{t(link.label)}</NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="tiq-public-header-actions">
            {ready ? (
              <ButtonLink to={landingPath(session)} variant="primary" size="sm" icon="dashboard">
                {t('shell.public.workspace')}
              </ButtonLink>
            ) : (
              <>
                <ButtonLink to="/signin" variant="ghost" size="sm" icon="logIn">
                  {t('shell.public.signIn')}
                </ButtonLink>
                <ButtonLink to="/register" variant="primary" size="sm">
                  {t('shell.public.register')}
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      </header>
      <PrototypeBanner />
      <main className="tiq-public-main" id="tiq-public-main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="tiq-public-footer">
        <div className="tiq-public-footer-inner">
          <span>{t('shell.footer.copyright')}</span>
          <nav aria-label={t('shell.public.footerNav')}>
            <Link to="/guidance">{t('shell.public.guidance')}</Link>
            <Link to="/plans">{t('shell.public.plans')}</Link>
            <Link to="/awards">{t('shell.public.awards')}</Link>
          </nav>
          <span>{t('shell.public.footerNote')}</span>
        </div>
      </footer>
    </div>
  );
}
