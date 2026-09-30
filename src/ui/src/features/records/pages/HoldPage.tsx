/**
 * ADM-14 — One legal or investigation hold (PRD §18.3, BR-40, AC-35): its record, scope, authority, reason, owner
 * and review date; every record it protects, including records whose ordinary retention has already ended; the
 * disposal requests it blocks; and its history. Releasing a hold disposes of nothing: the records return to ordinary
 * eligibility review.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { recordsEndpoints } from '@contracts/records';
import type { DisposalRequestRow, HeldRecord, HoldDetail } from '@contracts/records';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  QueryView,
  StatusChip,
  Timeline,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCalendarDate, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { idOf } from '../../reports/lib/shared';
import { RecordsHeader } from '../components/RecordsHeader';
import { recordsPaths } from '../lib/permissions';

export default function HoldPage() {
  const { holdId: raw = '' } = useParams();
  const holdId = idOf(raw);
  const query = useApiQuery(
    recordsEndpoints.getHold,
    holdId === undefined ? null : { params: { holdId } },
  );
  const [released, setReleased] = useState<HoldDetail | null>(null);
  const back = { to: recordsPaths.holds, label: t('records.holds.back') };
  if (holdId === undefined) {
    return (
      <div className="tiq-page">
        <RecordsHeader title={t('records.holds.detailTitle')} back={back} />
        <Card>
          <EmptyState icon="compass" title={t('records.holds.notFound')} />
        </Card>
      </div>
    );
  }
  return (
    <div className="tiq-page">
      <QueryView
        query={query}
        loading={<RecordsHeader title={t('records.holds.detailTitle')} back={back} />}
      >
        {(hold) => <HoldView hold={released ?? hold} onReleased={setReleased} back={back} />}
      </QueryView>
    </div>
  );
}

function HoldView({
  hold,
  onReleased,
  back,
}: {
  readonly hold: HoldDetail;
  readonly onReleased: (hold: HoldDetail) => void;
  readonly back: { readonly to: string; readonly label: string };
}) {
  const tenant = useActiveTenant();
  const toast = useToast();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const canManage = usePermission('records.hold.manage');
  const [releasing, setReleasing] = useState(false);
  const release = useApiMutation(recordsEndpoints.releaseHold);
  const pastRetention = hold.affectedRecords.filter((record) => record.pastRetention).length;

  const recordColumns: DataTableColumn<HeldRecord>[] = [
    {
      id: 'label',
      header: t('records.holds.col.record'),
      cell: (row) => (
        <>
          {row.to === null ? <span>{row.label}</span> : <Link to={row.to}>{row.label}</Link>}
          <span className="tiq-cell-sub">
            {[row.reference, row.entityType].filter((part) => part !== null).join(' · ')}
          </span>
        </>
      ),
    },
    {
      id: 'class',
      header: t('records.holds.col.class'),
      cell: (row) => tEnum('retention_classes.record_class', row.recordClass),
    },
    {
      id: 'retention',
      header: t('records.holds.col.retention'),
      cell: (row) =>
        row.retentionEndedOn === null ? (
          <span className="tiq-text-muted">{t('records.holds.retentionRunning')}</span>
        ) : (
          <span className="tiq-inline">
            {formatCalendarDate(row.retentionEndedOn)}
            {row.pastRetention && (
              <Chip tone="warning" size="sm">
                {t('records.holds.pastRetention')}
              </Chip>
            )}
          </span>
        ),
    },
    {
      id: 'status',
      header: t('records.holds.col.protection'),
      cell: () =>
        hold.state === 'active' ? (
          <Chip tone="danger" size="sm" icon="lock">
            {t('records.holds.disposalBlocked')}
          </Chip>
        ) : (
          <Chip tone="neutral" size="sm">
            {t('records.holds.ordinaryReview')}
          </Chip>
        ),
    },
  ];
  const disposalColumns: DataTableColumn<DisposalRequestRow>[] = [
    {
      id: 'scope',
      header: t('records.disposals.col.scope'),
      cell: (row) => <Link to={recordsPaths.disposal(row.id)}>{row.scopeLabel}</Link>,
    },
    {
      id: 'status',
      header: t('records.disposals.col.status'),
      cell: (row) => <StatusChip enum="disposal_requests.status" value={row.status} size="sm" />,
    },
    {
      id: 'disposition',
      header: t('records.disposals.col.disposition'),
      cell: (row) => tEnum('retention_classes.disposition', row.disposition),
    },
    {
      id: 'proposed',
      header: t('records.disposals.col.proposed'),
      cell: (row) => formatDateTime(row.proposedAt, timeZone),
    },
  ];

  return (
    <>
      <RecordsHeader
        title={t('records.holds.heading', {
          type: tEnum('holds.hold_type', hold.holdType),
          subject: hold.subjectReference ?? hold.subjectLabel,
        })}
        subtitle={hold.subjectLabel}
        back={back}
        meta={
          <>
            <Chip tone={hold.state === 'active' ? 'danger' : 'neutral'} size="sm" icon="lock">
              {t(`records.holds.states.${hold.state}`)}
            </Chip>
            <span className="tiq-text-muted">
              {hold.state === 'active'
                ? t('records.holds.nextAction', { date: formatCalendarDate(hold.reviewDate) })
                : t('records.holds.releasedNext')}
            </span>
          </>
        }
        primaryAction={
          canManage && hold.state === 'active' ? (
            <Button
              variant="primary"
              icon="unlock"
              onClick={() => {
                release.reset();
                setReleasing(true);
              }}
            >
              {t('records.holds.release')}
            </Button>
          ) : undefined
        }
      />

      {hold.state === 'active' ? (
        <Banner tone="warning" title={t('records.holds.activeBannerTitle')}>
          <p>
            {t('records.holds.activeBanner', {
              records: hold.affectedRecordCount,
              past: pastRetention,
              blocked: hold.blockedDisposalCount,
            })}
          </p>
        </Banner>
      ) : (
        <Banner tone="info" title={t('records.holds.releasedBannerTitle')}>
          <p>{t('records.holds.releasedBanner')}</p>
        </Banner>
      )}

      <Card title={t('records.holds.about')}>
        <DetailList
          items={[
            {
              key: 'type',
              label: t('records.holds.type'),
              value: tEnum('holds.hold_type', hold.holdType),
            },
            {
              key: 'subject',
              label: t('records.holds.subjectType'),
              value: tEnum('holds.subject_type', hold.subjectType),
            },
            { key: 'scope', label: t('records.holds.scope'), value: hold.scopeDescription },
            { key: 'reason', label: t('records.holds.reason'), value: hold.reason },
            { key: 'authority', label: t('records.holds.authority'), value: hold.authorityNote },
            { key: 'owner', label: t('records.holds.owner'), value: hold.owner.fullName },
            {
              key: 'started',
              label: t('records.holds.col.started'),
              value: formatDateTime(hold.startedAt, timeZone),
            },
            {
              key: 'review',
              label: t('records.holds.col.review'),
              value: `${formatCalendarDate(hold.reviewDate)}${hold.reviewDue ? ` · ${t('records.holds.reviewDue')}` : ''}`,
            },
            {
              key: 'blocked',
              label: t('records.holds.blockedActions'),
              value: hold.blockedActions
                .map((action) => tEnum('holds.blocked_actions', action))
                .join(', '),
            },
            {
              key: 'released',
              label: t('records.holds.released'),
              value:
                hold.releasedAt === null
                  ? null
                  : t('records.holds.releasedValue', {
                      when: formatDateTime(hold.releasedAt, timeZone),
                      name: hold.releasedBy?.fullName ?? t('records.audit.system'),
                      reason: hold.releaseReason ?? '',
                    }),
            },
          ]}
        />
      </Card>

      <Card
        flush
        title={t('records.holds.recordsTitle')}
        subtitle={t('records.holds.recordsSubtitle', { count: hold.affectedRecords.length })}
      >
        <DataTable
          caption={t('records.holds.recordsTitle')}
          columns={recordColumns}
          rows={hold.affectedRecords}
          rowKey={(row) => `${row.entityType}-${row.entityId}`}
          empty={<EmptyState compact icon="archive" title={t('records.holds.noRecords')} />}
        />
      </Card>

      <div className="tiq-grid tiq-grid--sidebar">
        <Card
          flush
          title={t('records.holds.blockedTitle')}
          subtitle={t('records.holds.blockedSubtitle')}
        >
          <DataTable
            caption={t('records.holds.blockedTitle')}
            columns={disposalColumns}
            rows={hold.blockedDisposals}
            rowKey={(row) => String(row.id)}
            empty={<EmptyState compact icon="checkCircle" title={t('records.holds.noBlocked')} />}
          />
        </Card>
        <Card title={t('records.holds.history')} subtitle={t('records.holds.historySubtitle')}>
          {hold.history.length === 0 ? (
            <EmptyState compact icon="history" title={t('records.holds.noHistory')} />
          ) : (
            <Timeline
              label={t('records.holds.history')}
              items={hold.history.map((entry, index) => ({
                id: `${entry.at}-${index}`,
                title: entry.action,
                meta: `${formatDateTime(entry.at, timeZone)} · ${entry.actor?.fullName ?? t('records.audit.system')}`,
                detail: entry.note ?? undefined,
                tone: 'info',
              }))}
            />
          )}
        </Card>
      </div>

      <ConfirmActionDialog
        open={releasing}
        title={t('records.holds.releaseTitle')}
        scope={t('records.holds.releaseScope', {
          subject: hold.subjectReference ?? hold.subjectLabel,
          count: hold.affectedRecordCount,
        })}
        consequence={t('records.holds.releaseConsequence')}
        confirmLabel={t('records.holds.release')}
        reason={{ label: t('records.holds.releaseReason'), required: true }}
        acknowledgement={t('records.holds.releaseAck')}
        pending={release.pending}
        error={release.error}
        onCancel={() => setReleasing(false)}
        onConfirm={async ({ reason }) => {
          try {
            const result = await release.mutate({ params: { holdId: hold.id }, body: { reason } });
            invalidateApiQueries('buyer.records.');
            onReleased(result);
            setReleasing(false);
            toast.show(t('records.holds.releasedToast'), 'success');
          } catch {
            // Shown in the dialog.
          }
        }}
      />
    </>
  );
}
