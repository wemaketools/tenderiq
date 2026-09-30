/**
 * The award file frame (BUY-26, BUY-28, BUY-30): the page header states the current organization, the tender, its
 * overall status, the next required action and the running standstill deadline (PRD §19), and the tabs switch
 * between the award decision, the notices and standstill, and the closeout of the same tender.
 */
import type { ReactNode } from 'react';

import type { AwardOverview } from '@contracts/awards';

import type { QueryResult } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Chip,
  ErrorState,
  LinkTabs,
  OfficialDeadline,
  PageHeader,
  Reference,
  SkeletonBlock,
  StatusChip,
} from '../../../components/ui';
import type { LinkTabItem } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { awardPaths } from '../lib/paths';
import { CLOSEOUT_READ, NOTICE_READ } from '../lib/permissions';
import { NextStepChip } from './NextStepChip';

export interface AwardFileLayoutProps {
  readonly tenderId: number;
  readonly overview: QueryResult<AwardOverview>;
  /** Page title; defaults to the tender reference and title. */
  readonly title?: string;
  readonly subtitle?: ReactNode;
  readonly primaryAction?: ReactNode;
  readonly actions?: ReactNode;
  readonly back?: { readonly to: string; readonly label: string };
  readonly children: ReactNode;
}

/** The earliest running standstill end of the tender's lots. */
function runningStandstill(overview: AwardOverview) {
  const running = overview.lots
    .filter(
      (lot) =>
        lot.standstillEndsAt !== null &&
        (lot.standstillStatus === 'running' || lot.standstillStatus === 'extended'),
    )
    .map((lot) => lot.standstillEndsAt)
    .filter((deadline) => deadline !== null)
    .sort((a, b) => a.at.localeCompare(b.at));
  return running[0] ?? null;
}

export function AwardFileLayout({
  tenderId,
  overview,
  title,
  subtitle,
  primaryAction,
  actions,
  back,
  children,
}: AwardFileLayoutProps) {
  const tenant = useActiveTenant();
  const canNotices = usePermission(NOTICE_READ);
  const canCloseout = usePermission(CLOSEOUT_READ);
  const data = overview.data;

  const tabs: LinkTabItem[] = [
    { to: awardPaths.file(tenderId), label: t('awards.tabs.award'), end: true },
  ];
  if (canNotices) {
    tabs.push({ to: awardPaths.notices(tenderId), label: t('awards.tabs.notices') });
  }
  if (canCloseout) {
    tabs.push({ to: awardPaths.closeout(tenderId), label: t('awards.tabs.closeout') });
  }

  if (data === undefined) {
    return (
      <>
        <PageHeader
          title={title ?? t('awards.file.title')}
          back={back ?? { to: awardPaths.register, label: t('awards.file.back') }}
        />
        {overview.error !== null ? (
          <ErrorState error={overview.error} onRetry={overview.reload} />
        ) : (
          <SkeletonBlock lines={6} />
        )}
      </>
    );
  }

  const standstill = runningStandstill(data);
  const activeHolds = data.holds.filter((hold) => hold.releasedAt === null).length;

  return (
    <>
      <PageHeader
        title={title ?? `${data.tender.reference} ${data.tender.title}`}
        subtitle={subtitle}
        back={back ?? { to: awardPaths.register, label: t('awards.file.back') }}
        primaryAction={primaryAction}
        actions={actions}
        meta={
          <>
            <span>{tenant?.name ?? ''}</span>
            <Reference value={data.tender.reference} to={awardPaths.tender(data.tender.tenderId)} />
            <StatusChip enum="tenders.status" value={data.tender.status} />
            <span className="tiq-inline">
              <span className="tiq-text-muted">{t('awards.file.nextStep')}</span>
              <NextStepChip step={data.nextStep} />
            </span>
            {activeHolds > 0 && (
              <Chip tone="danger" icon="pause">
                {t('awards.file.activeHolds', { count: activeHolds })}
              </Chip>
            )}
            {standstill !== null && (
              <span className="tiq-inline">
                <span className="tiq-text-muted">{t('awards.file.standstillEnds')}</span>
                <OfficialDeadline deadline={standstill} />
              </span>
            )}
          </>
        }
      />
      <LinkTabs label={t('awards.tabs.label')} tabs={tabs} />
      {children}
    </>
  );
}
