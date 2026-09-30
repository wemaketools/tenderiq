/**
 * The delivery exception register of ADM-12 (BR-42): every failed delivery, the recipient and their organization,
 * the unchanged official deadline and the exception task of the responsible owner.
 */
import { DELIVERY_EXCEPTION_STATES, listDeliveryExceptions } from '@contracts/notification-rules';
import type { DeliveryException, DeliveryExceptionState } from '@contracts/notification-rules';
import { NOTIFICATION_DELIVERIES_CHANNEL } from '@contracts/enums';
import type { NotificationDeliveriesChannel } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import {
  Banner,
  Card,
  Chip,
  DataTable,
  EmptyState,
  FilterBar,
  OfficialDeadline,
  Reference,
  Select,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatOfficialTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { compact, oneOf, useDisplayTimeZone } from '../../tasks/lib/shared';

const DEFAULTS = { state: '', channel: '', page: 1, pageSize: 25 };

export function DeliveryExceptionsPanel() {
  const timeZone = useDisplayTimeZone();
  const [filters, setFilters, clearFilters] = useScreenFilters('ADM-12-exceptions', DEFAULTS);
  const query = useApiQuery(listDeliveryExceptions, {
    query: compact({
      state: oneOf<DeliveryExceptionState>(filters.state, DELIVERY_EXCEPTION_STATES),
      channel: oneOf<NotificationDeliveriesChannel>(
        filters.channel,
        NOTIFICATION_DELIVERIES_CHANNEL,
      ),
      sort: 'attemptedAt' as const,
      dir: 'desc' as const,
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const filtered = filters.state !== '' || filters.channel !== '';

  const columns: DataTableColumn<DeliveryException>[] = [
    {
      id: 'notice',
      header: t('notifications.exceptions.col.notice'),
      cell: (row) => (
        <>
          <span>{row.title}</span>
          <span className="tiq-cell-sub">
            {tEnum('notification_rules.event_type', row.eventType)}
            {row.sourceReference !== null && ' · '}
            {row.sourceReference !== null && (
              <Reference value={row.sourceReference} to={row.linkPath} />
            )}
          </span>
        </>
      ),
    },
    {
      id: 'recipient',
      header: t('notifications.exceptions.col.recipient'),
      cell: (row) => (
        <>
          <span>{row.recipient.fullName}</span>
          <span className="tiq-cell-sub">{row.recipientOrganization}</span>
        </>
      ),
    },
    {
      id: 'channel',
      header: t('notifications.exceptions.col.channel'),
      cell: (row) => tEnum('notification_deliveries.channel', row.channel),
    },
    {
      id: 'attempted',
      header: t('notifications.exceptions.col.attempted'),
      cell: (row) => formatOfficialTime(row.attemptedAt, timeZone),
    },
    {
      id: 'reason',
      header: t('notifications.exceptions.col.reason'),
      cell: (row) => <span className="tiq-text-danger">{row.failureReason}</span>,
    },
    {
      id: 'deadline',
      header: t('notifications.exceptions.col.deadline'),
      cell: (row) =>
        row.deadline === null ? (
          '—'
        ) : (
          <OfficialDeadline deadline={row.deadline} showLocal={false} />
        ),
    },
    {
      id: 'task',
      header: t('notifications.exceptions.col.task'),
      cell: (row) => (
        <>
          {row.exceptionTaskStatus === null ? (
            <span className="tiq-text-muted">{t('notifications.exceptions.noTask')}</span>
          ) : (
            <StatusChip enum="tasks.status" value={row.exceptionTaskStatus} size="sm" />
          )}
          {row.owner !== null && (
            <span className="tiq-cell-sub">
              {t('notifications.exceptions.owner', { name: row.owner.fullName })}
            </span>
          )}
          {row.resolutionNote !== null && (
            <span className="tiq-cell-sub">{row.resolutionNote}</span>
          )}
        </>
      ),
    },
    {
      id: 'state',
      header: t('notifications.exceptions.col.state'),
      cell: (row) => (
        <Chip tone={row.state === 'open' ? 'warning' : 'success'} size="sm">
          {t(`notifications.exceptions.stateValue.${row.state}`)}
        </Chip>
      ),
    },
  ];

  return (
    <div className="tiq-stack">
      <Banner tone="info">{t('notifications.exceptions.intro')}</Banner>
      <FilterBar
        label={t('notifications.exceptions.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <Select
          label={t('notifications.exceptions.state')}
          placeholder={t('notifications.exceptions.allStates')}
          value={filters.state}
          options={DELIVERY_EXCEPTION_STATES.map((value) => ({
            value,
            label: t(`notifications.exceptions.stateValue.${value}`),
          }))}
          onChange={(state) => setFilters({ state, page: 1 })}
        />
        <Select
          label={t('notifications.exceptions.channel')}
          placeholder={t('notifications.exceptions.allChannels')}
          value={filters.channel}
          options={NOTIFICATION_DELIVERIES_CHANNEL.map((value) => ({
            value,
            label: tEnum('notification_deliveries.channel', value),
          }))}
          onChange={(channel) => setFilters({ channel, page: 1 })}
        />
      </FilterBar>
      <Card flush>
        <DataTable
          caption={t('notifications.exceptions.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => row.title}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          empty={
            <EmptyState
              compact
              icon="checkCircle"
              title={
                filtered
                  ? t('notifications.exceptions.emptyFiltered')
                  : t('notifications.exceptions.empty')
              }
            />
          }
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
}
