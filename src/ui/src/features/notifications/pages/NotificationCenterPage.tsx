/**
 * COM-06 — Notification center: official notices, reminders and delivery exceptions relevant to the caller in every
 * active organization (DD-21), with unread state and required acknowledgment. Reading is visibly distinct from
 * acknowledging and from accepting terms (BR-41); a failed delivery never changes a deadline (BR-42). Views: Unread,
 * Requires acknowledgment, All, and the delivery preferences (mandatory notices locked).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { NOTIFICATION_RULES_EVENT_TYPE, NOTIFICATIONS_CATEGORY } from '@contracts/enums';
import type { NotificationRulesEventType, NotificationsCategory } from '@contracts/enums';
import {
  getMyNotificationSummary,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@contracts/notifications';
import type { NotificationItem } from '@contracts/notifications';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useAppDispatch, useScreenFilters } from '../../../app/hooks';
import { notificationCountsLoaded } from '../../../app/slices/badges';
import {
  Button,
  Card,
  Chip,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  OfficialDeadline,
  PageHeader,
  Reference,
  SearchField,
  Select,
  StatusChip,
  Tabs,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { clockDate } from '../../../lib/clock';
import { formatCount, formatOfficialTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import {
  compact,
  errorMessage,
  oneOf,
  positiveId,
  useDisplayTimeZone,
  useOrganizationOptions,
} from '../../tasks/lib/shared';
import { AcknowledgeDialog } from '../components/AcknowledgeDialog';
import { PreferencesPanel } from '../components/PreferencesPanel';

const VIEWS = ['unread', 'requiresAck', 'all', 'preferences'] as const;
type View = (typeof VIEWS)[number];

const DEFAULTS = {
  view: 'unread',
  q: '',
  tenant: '',
  category: '',
  eventType: '',
  from: '',
  to: '',
  page: 1,
  pageSize: 25,
};

function viewOf(value: string): View {
  return (VIEWS as readonly string[]).includes(value) ? (value as View) : 'unread';
}

/** A calendar date filter → the start (or end) of that day as an instant. */
function dayBoundary(date: string, end: boolean): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  return end ? `${date}T23:59:59Z` : `${date}T00:00:00Z`;
}

function rowKey(row: NotificationItem): string {
  return `${row.organization.tenantId}:${row.id}`;
}

export default function NotificationCenterPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const toast = useToast();
  const timeZone = useDisplayTimeZone();
  const organizations = useOrganizationOptions();
  const [filters, setFilters, clearFilters] = useScreenFilters('COM-06', DEFAULTS);
  const view = viewOf(filters.view);
  const [results, setResults] = useState<ReadonlyMap<string, NotificationItem>>(new Map());
  const [readAll, setReadAll] = useState<{ tenantId: number | null; at: string } | null>(null);
  const [acknowledging, setAcknowledging] = useState<NotificationItem | null>(null);
  const markRead = useApiMutation(markNotificationRead);
  const markAll = useApiMutation(markAllNotificationsRead);

  const summary = useApiQuery(getMyNotificationSummary, {});
  const query = useApiQuery(
    listMyNotifications,
    view === 'preferences'
      ? null
      : {
          query: compact({
            q: filters.q.trim(),
            tenantId: positiveId(filters.tenant),
            category: oneOf<NotificationsCategory>(filters.category, NOTIFICATIONS_CATEGORY),
            eventType: oneOf<NotificationRulesEventType>(
              filters.eventType,
              NOTIFICATION_RULES_EVENT_TYPE,
            ),
            unread: view === 'unread' ? true : undefined,
            awaitingAcknowledgment: view === 'requiresAck' ? true : undefined,
            from: dayBoundary(filters.from, false),
            to: dayBoundary(filters.to, true),
            page: filters.page,
            pageSize: filters.pageSize,
          }),
        },
  );

  const overlay = (row: NotificationItem): NotificationItem => {
    const result = results.get(rowKey(row));
    if (result !== undefined) return result;
    if (
      readAll !== null &&
      row.readAt === null &&
      (readAll.tenantId === null || readAll.tenantId === row.organization.tenantId)
    ) {
      return { ...row, readAt: readAll.at };
    }
    return row;
  };
  const rows = query.data?.items.map(overlay);
  const store = (result: NotificationItem): void => {
    setResults((previous) => new Map(previous).set(rowKey(result), result));
  };
  const filtered = [
    filters.q,
    filters.tenant,
    filters.category,
    filters.eventType,
    filters.from,
    filters.to,
  ].some((value) => value !== '');

  const read = async (row: NotificationItem): Promise<NotificationItem | null> => {
    try {
      const result = await markRead.mutate(
        { params: { notificationId: row.id } },
        { tenantId: row.organization.tenantId },
      );
      store(result);
      return result;
    } catch (error) {
      toast.show(errorMessage(error, 'notifications'), 'error');
      return null;
    }
  };

  const open = async (row: NotificationItem): Promise<void> => {
    if (row.readAt === null) await read(row);
    if (row.linkPath !== null) void navigate(row.linkPath);
  };

  const readEverything = async (): Promise<void> => {
    const tenantId = positiveId(filters.tenant) ?? null;
    try {
      const result = await markAll.mutate({ body: tenantId === null ? {} : { tenantId } });
      setReadAll({ tenantId, at: clockDate().toISOString() });
      dispatch(
        notificationCountsLoaded({
          unread: result.summary.unread,
          requiresAcknowledgment: result.summary.requiresAcknowledgment,
        }),
      );
      toast.show(
        result.updated === 0
          ? t('notifications.center.markAllReadNone')
          : t('notifications.center.markAllReadDone', { count: result.updated }),
        'success',
      );
    } catch (error) {
      toast.show(errorMessage(error, 'notifications'), 'error');
    }
  };

  const columns: DataTableColumn<NotificationItem>[] = [
    {
      id: 'notification',
      header: t('notifications.list.col.notification'),
      cell: (row) => (
        <>
          <span className="tiq-inline">
            {row.readAt === null && (
              <Chip tone="accent" size="sm">
                {t('notifications.list.unreadChip')}
              </Chip>
            )}
            <strong>{row.title}</strong>
          </span>
          <span className="tiq-cell-sub">{row.body}</span>
          <span className="tiq-inline">
            <StatusChip enum="notifications.category" value={row.category} size="sm" />
            {row.mandatory && (
              <Chip tone="neutral-outlined" size="sm" icon="lock">
                {t('notifications.list.mandatory')}
              </Chip>
            )}
            <span className="tiq-text-muted">
              {tEnum('notification_rules.event_type', row.eventType)}
            </span>
          </span>
        </>
      ),
    },
    {
      id: 'organization',
      header: t('notifications.list.col.organization'),
      cell: (row) => row.organization.tenantName,
    },
    {
      id: 'source',
      header: t('notifications.list.col.source'),
      cell: (row) =>
        row.sourceReference === null ? (
          '—'
        ) : (
          <Reference value={row.sourceReference} to={row.linkPath} />
        ),
    },
    {
      id: 'deadline',
      header: t('notifications.list.col.deadline'),
      cell: (row) =>
        row.deadline === null || row.deadline === undefined ? (
          t('notifications.list.noDeadline')
        ) : (
          <OfficialDeadline deadline={row.deadline} showLocal={false} />
        ),
    },
    {
      id: 'received',
      header: t('notifications.list.col.received'),
      cell: (row) => formatOfficialTime(row.createdAt, timeZone),
    },
    {
      id: 'state',
      header: t('notifications.list.col.state'),
      cell: (row) => (
        <span className="tiq-stack">
          <span className={row.readAt === null ? undefined : 'tiq-text-muted'}>
            {row.readAt === null
              ? t('notifications.list.unreadChip')
              : t('notifications.list.readChip', {
                  time: formatOfficialTime(row.readAt, timeZone),
                })}
          </span>
          {row.requiresAcknowledgment &&
            (row.acknowledgedAt === null ? (
              <Chip tone="warning" size="sm" icon="alertTriangle">
                {t('notifications.list.ackRequired')}
              </Chip>
            ) : (
              <Chip tone="success" size="sm" icon="checkCircle">
                {row.acknowledgedBy !== undefined && row.acknowledgedBy !== null
                  ? t('notifications.list.acknowledgedBy', {
                      name: row.acknowledgedBy.fullName,
                      time: formatOfficialTime(row.acknowledgedAt, timeZone),
                    })
                  : t('notifications.list.acknowledged', {
                      time: formatOfficialTime(row.acknowledgedAt, timeZone),
                    })}
              </Chip>
            ))}
          {row.hasTerms === true &&
            (row.termsAcceptedAt === null || row.termsAcceptedAt === undefined ? (
              <Chip tone="neutral-outlined" size="sm">
                {t('notifications.list.termsPending')}
              </Chip>
            ) : (
              <Chip tone="success" size="sm">
                {t('notifications.list.termsAccepted', {
                  time: formatOfficialTime(row.termsAcceptedAt, timeZone),
                })}
              </Chip>
            ))}
        </span>
      ),
    },
    {
      id: 'delivery',
      header: t('notifications.list.col.delivery'),
      cell: (row) => (
        <span className="tiq-stack">
          {row.deliveries.map((delivery) =>
            delivery.status === 'failed' ? (
              <span key={delivery.channel} className="tiq-text-danger">
                {t('notifications.list.deliveryFailed', {
                  channel: tEnum('notification_deliveries.channel', delivery.channel),
                  reason: delivery.failureReason ?? '—',
                })}
              </span>
            ) : (
              <span key={delivery.channel} className="tiq-text-muted">
                {t('notifications.list.deliveryLine', {
                  channel: tEnum('notification_deliveries.channel', delivery.channel),
                  status: tEnum('notification_deliveries.status', delivery.status),
                })}
              </span>
            ),
          )}
          {row.deliveries.some((delivery) => delivery.status === 'failed') &&
            row.deadline !== null &&
            row.deadline !== undefined && (
              <span className="tiq-text-muted">{t('notifications.list.deadlineUnchanged')}</span>
            )}
        </span>
      ),
    },
    {
      id: 'actions',
      header: <span className="tiq-visually-hidden">{t('notifications.list.col.actions')}</span>,
      cell: (row) => (
        <div
          className="tiq-row-actions"
          aria-label={t('notifications.list.rowActions', { title: row.title })}
        >
          {row.linkPath !== null && (
            <Button size="sm" variant="ghost" icon="externalLink" onClick={() => void open(row)}>
              {t('notifications.list.open')}
            </Button>
          )}
          {row.readAt === null && (
            <Button
              size="sm"
              onClick={() =>
                void read(row).then((result) => {
                  if (result !== null) toast.show(t('notifications.list.markedRead'), 'success');
                })
              }
            >
              {t('notifications.list.markRead')}
            </Button>
          )}
          {row.requiresAcknowledgment &&
            row.acknowledgedAt === null &&
            (row.canAcknowledge === false ? (
              <span className="tiq-text-muted">
                {t('notifications.list.ackHandledByBidManager')}
              </span>
            ) : (
              <Button size="sm" variant="primary" onClick={() => setAcknowledging(row)}>
                {t('notifications.list.acknowledge')}
              </Button>
            ))}
        </div>
      ),
    },
  ];

  const emptyTitle = filtered
    ? t('notifications.list.emptyFiltered')
    : view === 'unread'
      ? t('notifications.list.emptyUnread')
      : view === 'requiresAck'
        ? t('notifications.list.emptyAck')
        : t('notifications.list.emptyAll');
  const pageRows = rows ?? [];

  const list = (
    <div className="tiq-stack">
      <FilterBar label={t('notifications.list.filters')} onClear={clearFilters} canClear={filtered}>
        <SearchField
          label={t('notifications.list.search')}
          placeholder={t('notifications.list.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('notifications.list.organization')}
          placeholder={t('notifications.list.allOrganizations')}
          value={filters.tenant}
          options={organizations}
          onChange={(tenant) => setFilters({ tenant, page: 1 })}
        />
        <Select
          label={t('notifications.list.category')}
          placeholder={t('notifications.list.allCategories')}
          value={filters.category}
          options={NOTIFICATIONS_CATEGORY.map((value) => ({
            value,
            label: tEnum('notifications.category', value),
          }))}
          onChange={(category) => setFilters({ category, page: 1 })}
        />
        <Select
          label={t('notifications.list.event')}
          placeholder={t('notifications.list.allEvents')}
          value={filters.eventType}
          options={NOTIFICATION_RULES_EVENT_TYPE.map((value) => ({
            value,
            label: tEnum('notification_rules.event_type', value),
          }))}
          onChange={(eventType) => setFilters({ eventType, page: 1 })}
        />
        <DateInput
          label={t('notifications.list.from')}
          value={filters.from}
          onChange={(from) => setFilters({ from, page: 1 })}
        />
        <DateInput
          label={t('notifications.list.to')}
          value={filters.to}
          onChange={(to) => setFilters({ to, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('notifications.kpi.unread')}
          icon="bell"
          value={summary.data === undefined ? '…' : formatCount(summary.data.unread)}
          hint={t('notifications.kpi.unreadHint')}
        />
        <KpiCard
          label={t('notifications.kpi.ack')}
          icon="clipboardCheck"
          tone="warning"
          value={
            summary.data === undefined ? '…' : formatCount(summary.data.requiresAcknowledgment)
          }
          hint={t('notifications.kpi.ackHint')}
        />
        <KpiCard
          label={t('notifications.kpi.formal')}
          icon="megaphone"
          tone="info"
          value={
            rows === undefined
              ? '…'
              : formatCount(pageRows.filter((row) => row.category === 'formal_notice').length)
          }
          hint={t('notifications.kpi.formalHint')}
        />
        <KpiCard
          label={t('notifications.kpi.failed')}
          icon="alertOctagon"
          tone="danger"
          value={
            rows === undefined
              ? '…'
              : formatCount(
                  pageRows.filter((row) =>
                    row.deliveries.some((delivery) => delivery.status === 'failed'),
                  ).length,
                )
          }
          hint={t('notifications.kpi.failedHint')}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('notifications.list.caption')}
          columns={columns}
          rows={rows}
          rowKey={rowKey}
          rowLabel={(row) => row.title}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          empty={<EmptyState compact icon="bell" title={emptyTitle} />}
          pagination={
            query.data === undefined
              ? undefined
              : {
                  page: query.data.page,
                  pageSize: query.data.pageSize,
                  total: query.data.total,
                  onPageChange: (page) => setFilters({ page }),
                  onPageSizeChange: (pageSize) => setFilters({ pageSize, page: 1 }),
                }
          }
        />
      </Card>
    </div>
  );

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('notifications.center.title')}
        subtitle={t('notifications.center.intro')}
        primaryAction={
          <Button
            variant="primary"
            icon="checkCircle"
            loading={markAll.pending}
            onClick={() => void readEverything()}
          >
            {t('notifications.center.markAllRead')}
          </Button>
        }
      />
      <Tabs
        label={t('notifications.center.tabs')}
        selected={view}
        onSelect={(next) => setFilters({ view: next, page: 1 })}
        tabs={[
          { id: 'unread', label: t('notifications.center.unread'), count: summary.data?.unread },
          {
            id: 'requiresAck',
            label: t('notifications.center.requiresAck'),
            count: summary.data?.requiresAcknowledgment,
          },
          { id: 'all', label: t('notifications.center.all') },
          { id: 'preferences', label: t('notifications.center.preferences') },
        ]}
      >
        {view === 'preferences' ? <PreferencesPanel /> : list}
      </Tabs>
      {acknowledging !== null && (
        <AcknowledgeDialog
          notification={acknowledging}
          onClose={() => setAcknowledging(null)}
          onDone={(result) => {
            store(result);
            setAcknowledging(null);
          }}
        />
      )}
    </div>
  );
}
