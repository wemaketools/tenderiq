/**
 * Small pieces of the public portal (PUB-01..PUB-03, PUB-07): the language choice, the visitor's route into
 * participation (register, sign in, or the supplier workspace when signed in as a supplier), notice cards and
 * status labels that make closed and cancelled notices unmistakable.
 */
import { useEffect, useState } from 'react';

import type { PublicNoticeSummary } from '@contracts/publication';

import {
  ButtonLink,
  Card,
  Chip,
  EmptyState,
  OfficialDeadline,
  Reference,
  Select,
  StatusChip,
} from '../../../components/ui';
import { formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { portalPaths } from '../../publication/lib/paths';
import { languageName, usePortalViewer } from '../lib/viewer';

const LANGUAGE_KEY = 'tiq.portalLanguage';

function readLanguage(): string | null {
  try {
    return window.localStorage.getItem(LANGUAGE_KEY);
  } catch {
    return null;
  }
}

function writeLanguage(value: string): void {
  try {
    window.localStorage.setItem(LANGUAGE_KEY, value);
  } catch {
    // Storage unavailable: the choice lasts for this page only.
  }
}

/**
 * Chooses the portal language among the languages the buyer publishes in. The choice is remembered in this browser
 * and sets the document language; notice content stays in the language it was published in.
 */
export function LanguagePicker({ languages }: { readonly languages: readonly string[] }) {
  const available: readonly string[] = languages.length === 0 ? ['en'] : languages;
  const fallback = available[0] ?? 'en';
  const [language, setLanguage] = useState(() => {
    const stored = readLanguage();
    return stored !== null && available.includes(stored) ? stored : fallback;
  });

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <Select
      label={t('public-portal.language.label')}
      hint={t('public-portal.language.hint')}
      value={language}
      options={available.map((code) => ({ value: code, label: languageName(code) }))}
      onChange={(value) => {
        setLanguage(value);
        writeLanguage(value);
      }}
    />
  );
}

/** A status chip plus an explicit label for notices that no longer accept responses (PUB-02). */
export function NoticeStatus({
  notice,
}: {
  readonly notice: Pick<PublicNoticeSummary, 'status' | 'isAcceptingResponses'>;
}) {
  return (
    <span className="tiq-inline">
      <StatusChip enum="tenders.status" value={notice.status} size="sm" />
      {notice.isAcceptingResponses ? (
        <Chip tone="success" size="sm" outlined>
          {t('public-portal.status.accepting')}
        </Chip>
      ) : (
        <Chip tone={notice.status === 'cancelled' ? 'danger' : 'neutral'} size="sm" outlined>
          {notice.status === 'cancelled'
            ? t('public-portal.status.cancelled')
            : t('public-portal.status.closed')}
        </Chip>
      )}
    </span>
  );
}

/** Notice cards for the home pages (PUB-01). */
export function NoticeCards({
  notices,
  emptyTitle,
}: {
  readonly notices: readonly PublicNoticeSummary[];
  readonly emptyTitle: string;
}) {
  if (notices.length === 0) {
    return <EmptyState compact icon="search" title={emptyTitle} />;
  }
  return (
    <div className="tiq-grid tiq-grid--2">
      {notices.map((notice) => (
        <Card
          key={`${notice.buyer.slug}/${notice.reference}`}
          headingLevel={3}
          title={notice.title}
          subtitle={
            <span className="tiq-inline">
              <Reference value={notice.reference} to={notice.linkPath} />
              <span>{notice.buyer.name}</span>
            </span>
          }
          footer={
            <ButtonLink to={notice.linkPath} size="sm" iconAfter="arrowRight">
              {t('public-portal.actions.openNotice')}
            </ButtonLink>
          }
        >
          <div className="tiq-stack">
            <span className="tiq-inline">
              <NoticeStatus notice={notice} />
            </span>
            {notice.summary !== null && <p>{notice.summary}</p>}
            <p className="tiq-text-muted">
              {t('public-portal.card.meta', {
                category: notice.category.name,
                procedure: tEnum('tenders.procedure', notice.procedure),
                published: formatInstantDate(
                  notice.publishedAt,
                  notice.closingAt?.timeZone ?? 'UTC',
                ),
              })}
            </p>
            {notice.closingAt !== null && (
              <OfficialDeadline
                deadline={notice.closingAt}
                label={t('public-portal.card.closing')}
                showRemaining={notice.isAcceptingResponses}
              />
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

/** The call to register or sign in, for visitors (PUB-01 "navigate to registration"). */
export function RegistrationCallout() {
  const viewer = usePortalViewer();
  return (
    <Card title={t('public-portal.registration.title')}>
      <div className="tiq-stack">
        <p>{t('public-portal.registration.body')}</p>
        {viewer.signedIn ? (
          <p className="tiq-text-muted">
            {viewer.supplierName === null
              ? t('public-portal.registration.signedIn')
              : t('public-portal.registration.signedInSupplier', { name: viewer.supplierName })}
          </p>
        ) : (
          <div className="tiq-inline">
            <ButtonLink to={portalPaths.register} variant="primary" icon="userPlus">
              {t('public-portal.actions.register')}
            </ButtonLink>
            <ButtonLink to={portalPaths.signIn} icon="logIn">
              {t('public-portal.actions.signIn')}
            </ButtonLink>
          </div>
        )}
        <ButtonLink to={portalPaths.guidance} variant="link" iconAfter="arrowRight">
          {t('public-portal.actions.readGuidance')}
        </ButtonLink>
      </div>
    </Card>
  );
}
