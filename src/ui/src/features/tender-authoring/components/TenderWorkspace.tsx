/**
 * The tender workspace shared by BUY-08..BUY-13: it loads the tender once (`buyer.tenders.get`), handles the loading,
 * not-found, restricted and error states, and gives each section page the record plus the effect of its commands.
 *
 * PRD §19: every section shows the organization (top bar), the record (reference and title), its stage, the submission
 * deadline in the official zone, and the next required action. A material edit reports its `ChangeImpact`; the
 * header then shows the new draft revision and, when the edit invalidated the release approval, says so (BR-10,
 * AC-06).
 */
import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { getTender } from '@contracts/tenders';
import type { ChangeImpact, TenderDetail } from '@contracts/tenders';

import { useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  ButtonLink,
  Chip,
  EmptyState,
  ErrorState,
  LinkTabs,
  OfficialDeadline,
  PageHeader,
  Reference,
  RestrictedState,
  SkeletonBlock,
  StatusChip,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { useIdParam } from '../lib/hooks';
import { versionChipText } from '../lib/lifecycle';
import { nextActionOf } from '../lib/nextAction';
import { tenderPaths } from '../lib/paths';
import { RELEASE_REVIEW, TENDER_EDIT, TENDER_RELEASE_APPROVE } from '../lib/permissions';
import { ChangeImpactBanner } from './ChangeImpactBanner';

export type WorkspaceSection =
  'overview' | 'scope' | 'pricing' | 'evaluation' | 'timetable' | 'release';

export interface TenderWorkspaceContext {
  readonly tender: TenderDetail;
  /** The organization may edit this tender now (permission and authoring status). */
  readonly canEdit: boolean;
  /** The membership may approve evaluation plans and releases. */
  readonly canApprove: boolean;
  /** The membership may record release checks and request corrections. */
  readonly canReview: boolean;
  /** Replaces the tender with the one a command returned. */
  readonly setTender: (tender: TenderDetail) => void;
  /** Records the change impact of a command (revision, hash, invalidated approval). */
  readonly reportChange: (change: ChangeImpact) => void;
  /** Reloads the tender. */
  readonly reload: () => void;
}

function applyChange(tender: TenderDetail, change: ChangeImpact | null): TenderDetail {
  if (change === null || change.draftRevision < tender.draftRevision) return tender;
  return {
    ...tender,
    draftRevision: change.draftRevision,
    contentHash: change.contentHash,
    status: change.tenderStatus,
    releaseApproval: change.invalidatedApproval ?? tender.releaseApproval,
  };
}

export interface TenderWorkspaceProps {
  readonly children: (context: TenderWorkspaceContext) => ReactNode;
}

export function TenderWorkspace({ children }: TenderWorkspaceProps) {
  const tenderId = useIdParam('tenderId');
  const query = useApiQuery(getTender, tenderId === null ? null : { params: { tenderId } });
  const [override, setOverride] = useState<TenderDetail | null>(null);
  const [change, setChange] = useState<ChangeImpact | null>(null);
  const hasEdit = usePermission(TENDER_EDIT);
  const canApprove = usePermission(TENDER_RELEASE_APPROVE);
  const canReviewPermission = usePermission(RELEASE_REVIEW);

  const base = override !== null && override.id === tenderId ? override : (query.data ?? null);
  const tender = useMemo(() => (base === null ? null : applyChange(base, change)), [base, change]);

  const reportChange = useCallback((next: ChangeImpact) => setChange(next), []);
  const setTender = useCallback((next: TenderDetail) => setOverride(next), []);

  if (tenderId === null) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('tender-authoring.workspace.notFoundTitle')} />
        <EmptyState
          icon="fileText"
          title={t('tender-authoring.workspace.notFoundTitle')}
          description={t('tender-authoring.workspace.notFound')}
          action={
            <ButtonLink to={tenderPaths.register}>
              {t('tender-authoring.workspace.backToRegister')}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  if (tender === null) {
    const error = query.error;
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('tender-authoring.workspace.loadingTitle')}
          back={{ to: tenderPaths.register, label: t('tender-authoring.workspace.backToRegister') }}
        />
        {error === null ? (
          <SkeletonBlock lines={8} />
        ) : error.kind === 'not_found' ? (
          <EmptyState
            icon="fileText"
            title={t('tender-authoring.workspace.notFoundTitle')}
            description={t('tender-authoring.workspace.notFound')}
            action={
              <ButtonLink to={tenderPaths.register}>
                {t('tender-authoring.workspace.backToRegister')}
              </ButtonLink>
            }
          />
        ) : error.kind === 'forbidden' ? (
          <RestrictedState description={t('tender-authoring.workspace.restricted')} />
        ) : (
          <ErrorState error={error} onRetry={query.reload} />
        )}
      </div>
    );
  }

  const context: TenderWorkspaceContext = {
    tender,
    canEdit: hasEdit && tender.editability.editable,
    canApprove,
    canReview: canReviewPermission && tender.editability.editable,
    setTender,
    reportChange,
    reload: query.reload,
  };

  return (
    <div className="tiq-page">
      {change !== null && <ChangeImpactBanner change={change} onDismiss={() => setChange(null)} />}
      {children(context)}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------------------------------------

const SECTION_TITLES: Readonly<Record<WorkspaceSection, string>> = {
  overview: 'tender-authoring.tabs.overview',
  scope: 'tender-authoring.tabs.scope',
  pricing: 'tender-authoring.tabs.pricing',
  evaluation: 'tender-authoring.tabs.evaluation',
  timetable: 'tender-authoring.tabs.timetable',
  release: 'tender-authoring.tabs.release',
};

export interface TenderHeaderProps {
  readonly context: TenderWorkspaceContext;
  readonly section: WorkspaceSection;
  readonly primaryAction?: ReactNode;
  readonly actions?: ReactNode;
}

export function TenderHeader({ context, section, primaryAction, actions }: TenderHeaderProps) {
  const { tender } = context;
  const submission = tender.keyDates.find(
    (item) => item.milestone === 'submission_deadline' && item.lot === null,
  );
  const approval = tender.releaseApproval;
  const nextAction = nextActionOf(tender);
  const tabs = [
    { to: tenderPaths.overview(tender.id), label: t('tender-authoring.tabs.overview'), end: true },
    { to: tenderPaths.scope(tender.id), label: t('tender-authoring.tabs.scope') },
    { to: tenderPaths.pricing(tender.id), label: t('tender-authoring.tabs.pricing') },
    { to: tenderPaths.evaluation(tender.id), label: t('tender-authoring.tabs.evaluation') },
    { to: tenderPaths.timetable(tender.id), label: t('tender-authoring.tabs.timetable') },
    { to: tenderPaths.release(tender.id), label: t('tender-authoring.tabs.release') },
  ];

  return (
    <>
      <PageHeader
        title={tender.title}
        subtitle={t(SECTION_TITLES[section])}
        back={{ to: tenderPaths.register, label: t('tender-authoring.workspace.backToRegister') }}
        primaryAction={primaryAction}
        actions={actions}
        meta={
          <span className="tiq-inline" data-testid="tender-meta">
            <Reference value={tender.reference} />
            <StatusChip enum="tenders.status" value={tender.status} />
            <Chip tone="neutral" size="sm">
              {versionChipText(tender)}
            </Chip>
            {approval === null ? (
              <Chip tone="neutral-outlined" size="sm">
                {t('tender-authoring.workspace.noApproval')}
              </Chip>
            ) : (
              <span className="tiq-inline">
                <span className="tiq-text-muted">
                  {t('tender-authoring.workspace.approvalLabel')}
                </span>
                <StatusChip enum="approval_requests.status" value={approval.status} size="sm" />
              </span>
            )}
            {submission !== undefined && (
              <OfficialDeadline
                deadline={submission.deadline}
                label={t('tender-authoring.workspace.submissionDeadline')}
              />
            )}
            {nextAction !== null && (
              <span>
                <span className="tiq-text-muted">
                  {t('tender-authoring.workspace.nextAction')}{' '}
                </span>
                {nextAction}
              </span>
            )}
          </span>
        }
      />
      <LinkTabs label={t('tender-authoring.tabs.label')} tabs={tabs} />
      {!tender.editability.editable && (
        <Banner tone="info" title={t('tender-authoring.workspace.lockedTitle')}>
          <p>
            {t(
              `tender-authoring.workspace.locked.${tender.editability.lockedReason ?? 'released_use_addendum'}`,
            )}
          </p>
        </Banner>
      )}
      {approval !== null && approval.status === 'invalidated' && (
        <Banner
          tone="warning"
          title={t('tender-authoring.workspace.invalidatedTitle', {
            id: approval.approvalId,
            revision: approval.subjectVersion,
          })}
          actions={
            section === 'release' ? undefined : (
              <ButtonLink to={tenderPaths.release(tender.id)} size="sm">
                {t('tender-authoring.workspace.openRelease')}
              </ButtonLink>
            )
          }
        >
          <p>
            {approval.invalidationReason ?? t('tender-authoring.workspace.invalidatedNoReason')}
          </p>
          <p>
            {t('tender-authoring.workspace.invalidatedCurrent', { revision: tender.draftRevision })}
          </p>
        </Banner>
      )}
      {tender.editability.editable && tender.editability.editInvalidatesApproval && (
        <Banner tone="warning" title={t('tender-authoring.workspace.editWarnsTitle')}>
          <p>{t('tender-authoring.workspace.editWarns')}</p>
        </Banner>
      )}
    </>
  );
}
