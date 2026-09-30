/**
 * BUY-14 Publication and distribution of one tender: the notice, its approved audience, the release approval and
 * its date, every channel with its confirmation or failure, and the publication checks. Actions: publish now or
 * schedule, cancel a schedule, distribute invitations, retry a failed external notice and reconcile it with the
 * official version. AC-33: a failed or unconfirmed external notice keeps the event visibly NOT advertised until it
 * is reconciled.
 */
import { useState } from 'react';

import { publicationEndpoints } from '@contracts/publication';
import type {
  PublicationOutcome,
  PublicationOverview,
  PublicationRow,
} from '@contracts/publication';

import { invalidateApiQueries, useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chip,
  DataTable,
  DetailList,
  EmptyState,
  ErrorState,
  KpiCard,
  KpiGrid,
  OrDash,
  PageHeader,
  ReadinessChecklist,
  Reference,
  RestrictedState,
  SkeletonBlock,
  StatusChip,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn, ReadinessItem } from '../../../components/ui';
import { formatCount, formatDateTime, formatOfficialTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import {
  CancelScheduleDialog,
  DistributeDialog,
  PublishDialog,
  ReconcileDialog,
  RetryDialog,
} from '../components/PublicationDialogs';
import { TenderPublicationHeader } from '../components/TenderPublicationHeader';
import { useIdParam } from '../lib/hooks';
import { publicationPaths } from '../lib/paths';
import { DISTRIBUTE, PUBLICATION_MANAGE } from '../lib/permissions';

type Dialog = 'publish' | 'cancelSchedule' | 'distribute' | null;

/** True when every external channel of the current version is confirmed and reconciled (AC-33). */
function advertisedOf(rows: readonly PublicationRow[], fallback: boolean): boolean {
  const current = rows.filter((row) => row.isCurrentVersion);
  if (current.length === 0) return fallback;
  const external = current.filter((row) => row.channel === 'external_notice');
  const portalLive = current.some(
    (row) => row.channel === 'portal' && (row.status === 'published' || row.status === 'confirmed'),
  );
  if (external.length === 0) return fallback || portalLive;
  return external.every((row) => row.status === 'confirmed' && row.reconciled);
}

/** A current external notice that went out (or failed) and is not yet confirmed and reconciled (AC-33). */
function isUnconfirmedExternal(row: PublicationRow): boolean {
  return (
    row.isCurrentVersion &&
    row.channel === 'external_notice' &&
    (row.status === 'failed' ||
      (row.publishedAt !== null && !(row.status === 'confirmed' && row.reconciled)))
  );
}

/** The next required action (PRD §19). */
function nextActionOf(overview: PublicationOverview, rows: readonly PublicationRow[]): string {
  const failed = rows.find(isUnconfirmedExternal);
  if (failed !== undefined) return t('publication.next.reconcile');
  const blocking = overview.checks.find((check) => check.status === 'blocking');
  if (blocking !== undefined) return blocking.detail ?? blocking.label;
  if (overview.capabilities.canPublish || overview.capabilities.canSchedule) {
    return t('publication.next.publish');
  }
  if (overview.audience.pendingInvitationCount > 0) return t('publication.next.distribute');
  if (overview.tender.scheduledReleaseAt !== null && overview.tender.releasedAt === null) {
    return t('publication.next.awaitRelease', {
      at: formatOfficialTime(overview.tender.scheduledReleaseAt, overview.tender.officialTimeZone),
    });
  }
  return t('publication.next.monitor');
}

export default function TenderPublicationPage() {
  const tenderId = useIdParam('tenderId');
  const query = useApiQuery(
    publicationEndpoints.publicationOverview,
    tenderId === null ? null : { params: { tenderId } },
  );

  if (tenderId === null || query.error?.kind === 'not_found') {
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('publication.tender.notFoundTitle')}
          back={{ to: publicationPaths.register, label: t('publication.common.backToRegister') }}
        />
        <EmptyState
          icon="fileText"
          title={t('publication.tender.notFoundTitle')}
          description={t('publication.tender.notFound')}
          action={
            <ButtonLink to={publicationPaths.register}>
              {t('publication.common.backToRegister')}
            </ButtonLink>
          }
        />
      </div>
    );
  }
  if (query.data === undefined) {
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('publication.tender.loadingTitle')}
          back={{ to: publicationPaths.register, label: t('publication.common.backToRegister') }}
        />
        {query.error === null ? (
          <SkeletonBlock lines={8} />
        ) : query.error.kind === 'forbidden' ? (
          <RestrictedState description={t('publication.tender.restricted')} />
        ) : (
          <ErrorState error={query.error} onRetry={query.reload} />
        )}
      </div>
    );
  }
  return <PublicationView key={tenderId} overview={query.data} reload={query.reload} />;
}

function PublicationView({
  overview,
  reload,
}: {
  readonly overview: PublicationOverview;
  readonly reload: () => void;
}) {
  const toast = useToast();
  const canManage = usePermission(PUBLICATION_MANAGE);
  const canDistribute = usePermission(DISTRIBUTE);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [retryRow, setRetryRow] = useState<PublicationRow | null>(null);
  const [reconcileRow, setReconcileRow] = useState<PublicationRow | null>(null);
  const [overrides, setOverrides] = useState<ReadonlyMap<number, PublicationRow>>(new Map());
  const [outcome, setOutcome] = useState<PublicationOutcome | null>(null);
  const [distributed, setDistributed] = useState<string | null>(null);

  const { tender, capabilities, audience, releaseApproval } = overview;
  const timeZone = tender.officialTimeZone;
  const baseRows =
    outcome === null
      ? overview.publications
      : mergeRows(overview.publications, outcome.publications);
  const rows = baseRows.map((row) => overrides.get(row.id) ?? row);
  const advertised = advertisedOf(rows, overview.isAdvertised);
  const released = (outcome?.releasedAt ?? tender.releasedAt) !== null;
  const scheduledAt = outcome === null ? tender.scheduledReleaseAt : outcome.scheduledReleaseAt;
  const external = rows.filter((row) => row.isCurrentVersion && row.channel === 'external_notice');
  const confirmedExternal = external.filter((row) => row.status === 'confirmed' && row.reconciled);

  const replaceRow = (row: PublicationRow, message: string): void => {
    setOverrides((current) => new Map(current).set(row.id, row));
    toast.show(message, 'success');
    invalidateApiQueries('buyer.publication.list');
  };

  const readiness: ReadinessItem[] = overview.checks.map((check) => {
    const row =
      check.id === 'external_confirmation' ? external.find(isUnconfirmedExternal) : undefined;
    const resolved =
      check.id === 'external_confirmation' && row === undefined && external.length > 0;
    return {
      id: check.id,
      label: check.label,
      detail: resolved ? t('publication.tender.externalResolved') : (check.detail ?? undefined),
      status: resolved ? 'passed' : check.status,
      action:
        row !== undefined && capabilities.canReconcile && canManage ? (
          <Button size="sm" onClick={() => setReconcileRow(row)}>
            {t('publication.actions.reconcile')}
          </Button>
        ) : check.id === 'release_approval' && releaseApproval.approvalRequestId !== null ? (
          <ButtonLink size="sm" to={publicationPaths.approval(releaseApproval.approvalRequestId)}>
            {t('publication.actions.openApproval')}
          </ButtonLink>
        ) : undefined,
    };
  });

  const columns: DataTableColumn<PublicationRow>[] = [
    {
      id: 'channel',
      header: t('publication.register.col.channel'),
      cell: (row) => (
        <>
          <span>{tEnum('publications.channel', row.channel)}</span>
          {row.channelName !== null && <span className="tiq-cell-sub">{row.channelName}</span>}
        </>
      ),
    },
    {
      id: 'version',
      header: t('publication.register.col.version'),
      cell: (row) => (
        <span className="tiq-inline">
          {t('publication.common.versionNo', { no: row.versionNo })}
          {!row.isCurrentVersion && (
            <Chip tone="neutral" size="sm">
              {t('publication.common.superseded')}
            </Chip>
          )}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('publication.register.col.status'),
      cell: (row) => <StatusChip enum="publications.status" value={row.status} />,
    },
    {
      id: 'dates',
      header: t('publication.tender.col.dates'),
      cell: (row) => (
        <>
          <span>
            {row.publishedAt === null
              ? row.scheduledAt === null
                ? t('publication.common.notPublished')
                : t('publication.tender.scheduledFor', {
                    at: formatDateTime(row.scheduledAt, timeZone),
                  })
              : t('publication.tender.publishedOn', {
                  at: formatDateTime(row.publishedAt, timeZone),
                })}
          </span>
        </>
      ),
    },
    {
      id: 'confirmation',
      header: t('publication.register.col.confirmation'),
      cell: (row) =>
        row.channel === 'portal' ? (
          <span className="tiq-text-muted">{t('publication.common.portalNoConfirmation')}</span>
        ) : row.confirmationReceivedAt !== null && row.reconciled ? (
          <>
            <span className="tiq-text-success">
              {t('publication.tender.confirmedOn', {
                at: formatDateTime(row.confirmationReceivedAt, timeZone),
              })}
            </span>
            <span className="tiq-cell-sub tiq-mono">{row.externalReference}</span>
          </>
        ) : row.publishedAt === null && row.status === 'scheduled' ? (
          <span className="tiq-text-muted">{t('publication.tender.awaitingRelease')}</span>
        ) : (
          <>
            <span className="tiq-text-danger">{t('publication.common.notConfirmed')}</span>
            {row.failureReason !== null && (
              <span className="tiq-cell-sub">{row.failureReason}</span>
            )}
          </>
        ),
    },
    {
      id: 'exception',
      header: t('publication.register.col.exception'),
      cell: (row) =>
        row.exception === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <>
            <span className="tiq-inline">
              <Reference value={t('publication.tender.exceptionNo', { id: row.exception.id })} />
              <StatusChip
                enum="integration_exceptions.status"
                value={row.exception.status}
                size="sm"
              />
            </span>
            <span className="tiq-cell-sub">{row.exception.description}</span>
            <span className="tiq-cell-sub">
              {t('publication.tender.exceptionOwner', {
                owner: row.exception.owner?.fullName ?? t('publication.common.unassigned'),
                at: formatDateTime(row.exception.openedAt, timeZone),
              })}
            </span>
            {row.exception.resolution !== null && (
              <span className="tiq-cell-sub">{row.exception.resolution}</span>
            )}
            {row.exception.taskId !== null && (
              <ButtonLink size="sm" variant="link" to={publicationPaths.taskInbox}>
                {t('publication.actions.openTask')}
              </ButtonLink>
            )}
          </>
        ),
    },
    {
      id: 'actions',
      header: <span className="tiq-visually-hidden">{t('publication.register.col.actions')}</span>,
      cell: (row) => {
        const external = row.channel === 'external_notice';
        const canRetry =
          external && row.status === 'failed' && capabilities.canRetryExternal && canManage;
        const canReconcile = isUnconfirmedExternal(row) && capabilities.canReconcile && canManage;
        if (!canRetry && !canReconcile) return null;
        return (
          <div className="tiq-row-actions">
            {canRetry && (
              <Button size="sm" icon="refresh" onClick={() => setRetryRow(row)}>
                {t('publication.actions.retry')}
              </Button>
            )}
            {canReconcile && (
              <Button size="sm" icon="checkCircle" onClick={() => setReconcileRow(row)}>
                {t('publication.actions.reconcile')}
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const canPublishAny = canManage && (capabilities.canPublish || capabilities.canSchedule);
  const pendingInvitations = audience.pendingInvitationCount;

  return (
    <div className="tiq-page">
      <TenderPublicationHeader
        tender={outcome === null ? tender : { ...tender, status: outcome.tenderStatus }}
        section="publication"
        nextAction={nextActionOf(overview, rows)}
        primaryAction={
          canPublishAny && outcome === null ? (
            <Button variant="primary" icon="megaphone" onClick={() => setDialog('publish')}>
              {t('publication.actions.publish')}
            </Button>
          ) : undefined
        }
        actions={
          <>
            {canManage && capabilities.canCancelSchedule && outcome === null && (
              <Button icon="xCircle" onClick={() => setDialog('cancelSchedule')}>
                {t('publication.actions.cancelSchedule')}
              </Button>
            )}
            {canDistribute && capabilities.canDistributeInvitations && pendingInvitations > 0 && (
              <Button icon="send" onClick={() => setDialog('distribute')}>
                {t('publication.actions.distribute', { count: pendingInvitations })}
              </Button>
            )}
            <Button icon="refresh" onClick={reload}>
              {t('publication.actions.refresh')}
            </Button>
          </>
        }
      />

      {outcome !== null && (
        <Banner tone="success" title={t('publication.tender.outcomeTitle')}>
          <p>{outcome.message}</p>
          <p>
            {t('publication.tender.outcomeStatus', {
              status: tEnum('tenders.status', outcome.tenderStatus),
            })}
          </p>
        </Banner>
      )}
      {distributed !== null && (
        <Banner tone="success" title={t('publication.tender.distributedTitle')}>
          <p>{distributed}</p>
        </Banner>
      )}
      {released && !advertised && (
        <Banner tone="error" title={t('publication.tender.notAdvertisedTitle')}>
          <p>{t('publication.tender.notAdvertised')}</p>
        </Banner>
      )}
      {releaseApproval.status === 'invalidated' && (
        <Banner tone="warning" title={t('publication.tender.approvalInvalidatedTitle')}>
          <p>{releaseApproval.invalidatedReason ?? t('publication.tender.approvalInvalidated')}</p>
        </Banner>
      )}

      <KpiGrid>
        <KpiCard
          label={t('publication.tender.kpi.advertised')}
          icon={advertised ? 'checkCircle' : 'alertOctagon'}
          tone={advertised ? 'success' : released ? 'danger' : 'warning'}
          value={
            advertised
              ? t('publication.tender.kpi.advertisedYes')
              : released
                ? t('publication.tender.kpi.advertisedNo')
                : t('publication.tender.kpi.notReleased')
          }
          hint={t('publication.tender.kpi.advertisedHint')}
        />
        <KpiCard
          label={t('publication.tender.kpi.external')}
          icon="globe"
          tone={confirmedExternal.length < external.length ? 'warning' : 'info'}
          value={t('publication.tender.kpi.externalValue', {
            confirmed: confirmedExternal.length,
            total: external.length,
          })}
          hint={t('publication.tender.kpi.externalHint')}
        />
        <KpiCard
          label={t('publication.tender.kpi.invitations')}
          icon="mail"
          tone={pendingInvitations > 0 ? 'warning' : 'accent'}
          value={formatCount(pendingInvitations)}
          hint={t('publication.tender.kpi.invitationsHint', { invited: audience.invitedCount })}
          to={publicationPaths.participants(tender.tenderId)}
        />
        <KpiCard
          label={t('publication.tender.kpi.deliveryFailures')}
          icon="alertTriangle"
          tone={audience.failedDeliveryCount > 0 ? 'danger' : 'success'}
          value={formatCount(audience.failedDeliveryCount)}
          hint={t('publication.tender.kpi.deliveryFailuresHint')}
          to={publicationPaths.participants(tender.tenderId)}
        />
      </KpiGrid>

      <div className="tiq-grid tiq-grid--2">
        <Card title={t('publication.tender.noticeTitle')}>
          <DetailList
            items={[
              { key: 'summary', label: t('publication.tender.summary'), value: tender.summary },
              {
                key: 'category',
                label: t('publication.tender.category'),
                value: tender.category.name,
              },
              {
                key: 'procedure',
                label: t('publication.tender.procedure'),
                value: `${tEnum('tenders.event_type', tender.eventType)} · ${tEnum('tenders.procedure', tender.procedure)}`,
              },
              {
                key: 'version',
                label: t('publication.tender.version'),
                value:
                  tender.currentVersionNo === 0
                    ? t('publication.tender.noVersion', { revision: tender.draftRevision })
                    : t('publication.tender.versionValue', {
                        version: tender.currentVersionNo,
                        revision: tender.draftRevision,
                      }),
              },
              {
                key: 'scheduled',
                label: t('publication.tender.scheduledRelease'),
                value: scheduledAt === null ? null : formatOfficialTime(scheduledAt, timeZone),
              },
              {
                key: 'released',
                label: t('publication.tender.releasedAt'),
                value:
                  (outcome?.releasedAt ?? tender.releasedAt) === null
                    ? null
                    : formatOfficialTime(outcome?.releasedAt ?? tender.releasedAt ?? '', timeZone),
              },
              { key: 'owner', label: t('publication.tender.owner'), value: tender.owner.fullName },
            ]}
          />
        </Card>
        <Card title={t('publication.tender.audienceTitle')}>
          <DetailList
            items={[
              {
                key: 'participation',
                label: t('publication.tender.participation'),
                value: tEnum('tenders.participation', audience.participation),
              },
              {
                key: 'description',
                label: t('publication.tender.audience'),
                value: audience.description,
              },
              {
                key: 'public',
                label: t('publication.tender.publicNotice'),
                value:
                  audience.publicNoticePath === null ? (
                    <span className="tiq-text-muted">{t('publication.tender.notPublic')}</span>
                  ) : (
                    <Reference value={tender.reference} to={audience.publicNoticePath} />
                  ),
              },
              {
                key: 'invited',
                label: t('publication.tender.invited'),
                value: t('publication.tender.invitedValue', {
                  invited: audience.invitedCount,
                  pending: audience.pendingInvitationCount,
                }),
              },
            ]}
          />
          <ButtonLink
            to={publicationPaths.participants(tender.tenderId)}
            size="sm"
            iconAfter="arrowRight"
          >
            {t('publication.tender.openParticipants')}
          </ButtonLink>
        </Card>
        <Card title={t('publication.tender.approvalTitle')}>
          {releaseApproval.approvalRequestId === null ? (
            <EmptyState
              compact
              icon="shieldCheck"
              title={t('publication.tender.noApproval')}
              description={
                overview.checks.find((check) => check.id === 'release_approval')?.status ===
                'passed'
                  ? (overview.checks.find((check) => check.id === 'release_approval')?.detail ??
                    t('publication.tender.noApprovalHint'))
                  : t('publication.tender.noApprovalHint')
              }
            />
          ) : (
            <DetailList
              items={[
                {
                  key: 'status',
                  label: t('publication.tender.approvalStatus'),
                  value:
                    releaseApproval.status === null ? null : (
                      <StatusChip enum="approval_requests.status" value={releaseApproval.status} />
                    ),
                },
                {
                  key: 'version',
                  label: t('publication.tender.approvalRevision'),
                  value:
                    releaseApproval.subjectVersion === null
                      ? null
                      : t('publication.tender.revisionNo', { no: releaseApproval.subjectVersion }),
                },
                {
                  key: 'approvedAt',
                  label: t('publication.tender.approvedAt'),
                  value:
                    releaseApproval.approvedAt === null
                      ? null
                      : formatOfficialTime(releaseApproval.approvedAt, timeZone),
                },
                {
                  key: 'approvedBy',
                  label: t('publication.tender.approvedBy'),
                  value: releaseApproval.approvedBy?.fullName,
                },
                {
                  key: 'link',
                  label: t('publication.tender.approvalRecord'),
                  value: (
                    <Reference
                      value={t('publication.tender.approvalNo', {
                        id: releaseApproval.approvalRequestId,
                      })}
                      to={publicationPaths.approval(releaseApproval.approvalRequestId)}
                    />
                  ),
                },
              ]}
            />
          )}
        </Card>
        <Card
          title={t('publication.tender.checksTitle')}
          subtitle={t('publication.tender.checksIntro')}
        >
          <ReadinessChecklist items={readiness} label={t('publication.tender.checksTitle')} />
        </Card>
      </div>

      <Card
        flush
        title={t('publication.tender.channelsTitle')}
        subtitle={t('publication.tender.channelsIntro')}
      >
        <DataTable
          caption={t('publication.tender.channelsCaption')}
          columns={columns}
          rows={rows}
          rowKey={(row) => String(row.id)}
          empty={
            <EmptyState
              compact
              icon="megaphone"
              title={t('publication.tender.noChannels')}
              description={
                scheduledAt === null
                  ? t('publication.tender.noChannelsHint')
                  : t('publication.tender.noChannelsScheduled', {
                      at: formatOfficialTime(scheduledAt, timeZone),
                    })
              }
            />
          }
        />
      </Card>

      {dialog === 'publish' && (
        <PublishDialog
          open
          overview={overview}
          onClose={() => setDialog(null)}
          onDone={(next) => {
            setDialog(null);
            setOutcome(next);
            toast.show(next.message, 'success');
            invalidateApiQueries('buyer.publication.list');
          }}
        />
      )}
      {dialog === 'cancelSchedule' && (
        <CancelScheduleDialog
          open
          overview={overview}
          onClose={() => setDialog(null)}
          onDone={(next) => {
            setDialog(null);
            setOutcome(next);
            toast.show(next.message, 'success');
            invalidateApiQueries('buyer.publication.list');
          }}
        />
      )}
      {dialog === 'distribute' && (
        <DistributeDialog
          open
          tender={tender}
          pendingCount={pendingInvitations}
          onClose={() => setDialog(null)}
          onDone={(result) => {
            setDialog(null);
            setDistributed(result.message);
            toast.show(result.message, 'success');
            invalidateApiQueries('buyer.participants.');
          }}
        />
      )}
      <RetryDialog
        row={retryRow}
        timeZone={timeZone}
        onClose={() => setRetryRow(null)}
        onDone={(row) => {
          setRetryRow(null);
          replaceRow(
            row,
            t('publication.tender.retried', { status: tEnum('publications.status', row.status) }),
          );
        }}
      />
      <ReconcileDialog
        row={reconcileRow}
        currentVersionNo={Math.max(tender.currentVersionNo, 1)}
        timeZone={timeZone}
        onClose={() => setReconcileRow(null)}
        onDone={(row) => {
          setReconcileRow(null);
          replaceRow(row, t('publication.tender.reconciled'));
        }}
      />
    </div>
  );
}

function mergeRows(
  base: readonly PublicationRow[],
  next: readonly PublicationRow[],
): PublicationRow[] {
  // One publication per (tender, version, channel) (DD-07): a new outcome row replaces the row it updates.
  const keyOf = (row: PublicationRow): string => `${row.versionNo}:${row.channel}`;
  const keys = new Set(next.map(keyOf));
  return [...next, ...base.filter((row) => !keys.has(keyOf(row)))];
}
