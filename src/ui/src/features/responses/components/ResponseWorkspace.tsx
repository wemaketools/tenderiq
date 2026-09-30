/**
 * The response workspace frame (SUP-12..SUP-17). It loads the response once and shows, on every tab, the current
 * organization (legal party), the record (tender and round), the official status, the working revision, the
 * official deadline and the next required action (PRD §19), then the workspace tabs. After a successful submission
 * or withdrawal the page applies the official result through `applyBid`; that state is authoritative for this view,
 * so the header never contradicts a receipt or a withdrawal confirmation (AC-11, AC-14).
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { getBid } from '@contracts/bids';
import type { BidDetail } from '@contracts/bids';

import { useApiQuery } from '../../../api/hooks';
import {
  ButtonLink,
  EmptyState,
  ErrorState,
  LinkTabs,
  OfficialDeadline,
  PageHeader,
  SkeletonBlock,
  StatusChip,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { useIdParam } from '../lib/hooks';
import { nextActionOf } from '../lib/nextAction';
import { responsePaths } from '../lib/paths';

export type WorkspaceTab = 'answers' | 'pricing' | 'declarations' | 'review' | 'submit' | 'history';

export interface ResponseWorkspaceProps {
  readonly tab: WorkspaceTab;
  /** The screen title (plain text; also the document title). */
  readonly title: string;
  readonly primaryAction?: (bid: BidDetail) => ReactNode;
  readonly actions?: (bid: BidDetail) => ReactNode;
  readonly children: (
    bid: BidDetail,
    reloadBid: () => void,
    applyBid: (bid: BidDetail) => void,
  ) => ReactNode;
}

export function ResponseWorkspace({
  tab,
  title,
  primaryAction,
  actions,
  children,
}: ResponseWorkspaceProps) {
  const bidId = useIdParam('bidId');
  const query = useApiQuery(getBid, bidId === null ? null : { params: { bidId } });
  const [applied, setApplied] = useState<BidDetail | null>(null);

  if (bidId === null || (query.error !== null && query.error.kind === 'not_found')) {
    return (
      <div className="tiq-page">
        <PageHeader title={title} back={{ to: responsePaths.list, label: t('responses.back') }} />
        <EmptyState
          title={t('responses.workspace.notFound')}
          description={t('responses.workspace.notFoundHint')}
          action={
            <ButtonLink to={responsePaths.list} variant="primary">
              {t('responses.workspace.toList')}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const bid = applied !== null && applied.id === bidId ? applied : query.data;
  if (bid === undefined) {
    return (
      <div className="tiq-page">
        <PageHeader title={title} back={{ to: responsePaths.list, label: t('responses.back') }} />
        {query.error !== null ? (
          <ErrorState error={query.error} onRetry={query.reload} />
        ) : (
          <SkeletonBlock lines={6} />
        )}
      </div>
    );
  }

  const next = nextActionOf(bid);
  const tabs = [
    { to: responsePaths.answers(bid.id), label: t('responses.tabs.answers') },
    { to: responsePaths.pricing(bid.id), label: t('responses.tabs.pricing') },
    { to: responsePaths.declarations(bid.id), label: t('responses.tabs.declarations') },
    { to: responsePaths.review(bid.id), label: t('responses.tabs.review') },
    { to: responsePaths.submit(bid.id), label: t('responses.tabs.submit') },
    { to: responsePaths.history(bid.id), label: t('responses.tabs.history') },
  ];

  return (
    <div className="tiq-page" data-tab={tab}>
      <PageHeader
        title={title}
        back={{ to: responsePaths.list, label: t('responses.back') }}
        subtitle={t('responses.workspace.subtitle', {
          reference: bid.tender.reference,
          title: bid.tender.title,
          buyer: bid.tender.buyer.name,
          round: tEnum('bids.round_type', bid.roundType),
        })}
        meta={
          <>
            <span>{t('responses.workspace.legalParty', { name: bid.legalParty.legalName })}</span>
            <StatusChip enum="bids.submission_state" value={bid.submissionState} />
            {bid.workingRevision !== null && (
              <span className="tiq-inline">
                {t('responses.workspace.workingRevision', { no: bid.workingRevision.revisionNo })}
                <StatusChip
                  enum="bid_revisions.status"
                  value={bid.workingRevision.status}
                  size="sm"
                />
              </span>
            )}
            <OfficialDeadline deadline={bid.deadline} showRemaining={bid.submissionWindowOpen} />
            <span>
              {t('responses.workspace.nextAction')}{' '}
              <Link to={next.to}>{t(`responses.next.${next.key}`)}</Link>
            </span>
          </>
        }
        primaryAction={primaryAction?.(bid)}
        actions={actions?.(bid)}
      />
      <LinkTabs tabs={tabs} label={t('responses.tabs.label')} />
      {children(bid, query.reload, setApplied)}
    </div>
  );
}
