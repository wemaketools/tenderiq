/**
 * ADM-12 — Notification rules and messages: event types, recipients, mandatory notices, templates, reminders and
 * escalations, plus the register of delivery exceptions (BR-42). Messages are audience-specific and general alerts
 * never embed confidential bid content (BR-43).
 */

import { NOTIFICATION_RULES_EVENT_TYPE, NOTIFICATIONS_CATEGORY } from '@contracts/enums';
import type { NotificationRulesEventType, NotificationsCategory } from '@contracts/enums';
import {
  NOTIFICATION_RULE_SORT_FIELDS,
  listDeliveryExceptions,
  listNotificationRules,
} from '@contracts/notification-rules';
import type { NotificationRuleSummary } from '@contracts/notification-rules';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import {
  Card,
  Checkbox,
  Chip,
  DataTable,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  PageHeader,
  Select,
  Tabs,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import {
  compact,
  directionOf,
  formatHours,
  oneOf,
  triState,
  useDisplayTimeZone,
} from '../../tasks/lib/shared';
import { DeliveryExceptionsPanel } from '../components/DeliveryExceptionsPanel';
import { notificationPaths } from '../lib/paths';

type SortField = (typeof NOTIFICATION_RULE_SORT_FIELDS)[number];

const DEFAULTS = {
  view: 'rules',
  eventType: '',
  category: '',
  mandatory: '',
  active: '',
  reminders: false,
  escalation: false,
  sort: 'eventType',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

function sortField(value: string): SortField {
  return (NOTIFICATION_RULE_SORT_FIELDS as readonly string[]).includes(value)
    ? (value as SortField)
    : 'eventType';
}

export default function NotificationRulesPage() {
  const timeZone = useDisplayTimeZone();
  const [filters, setFilters, clearFilters] = useScreenFilters('ADM-12', DEFAULTS);
  const view = filters.view === 'exceptions' ? 'exceptions' : 'rules';
  const overview = useApiQuery(listNotificationRules, { query: { pageSize: 100 } });
  const openExceptions = useApiQuery(listDeliveryExceptions, {
    query: { state: ['open'], pageSize: 1 },
  });
  const query = useApiQuery(listNotificationRules, {
    query: compact({
      eventType: oneOf<NotificationRulesEventType>(
        filters.eventType,
        NOTIFICATION_RULES_EVENT_TYPE,
      ),
      category: oneOf<NotificationsCategory>(filters.category, NOTIFICATIONS_CATEGORY),
      mandatory: triState(filters.mandatory),
      active: triState(filters.active),
      hasReminders: filters.reminders ? true : undefined,
      hasEscalation: filters.escalation ? true : undefined,
      sort: sortField(filters.sort),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });

  const all = overview.data?.items ?? [];
  const count = (predicate: (row: NotificationRuleSummary) => boolean): string =>
    overview.data === undefined ? '…' : formatCount(all.filter(predicate).length);
  const filtered =
    filters.reminders ||
    filters.escalation ||
    [filters.eventType, filters.category, filters.mandatory, filters.active].some(
      (value) => value !== '',
    );

  const columns: DataTableColumn<NotificationRuleSummary>[] = [
    {
      id: 'eventType',
      header: t('notifications.rules.col.event'),
      sortable: true,
      cell: (row) => (
        <>
          <span className="tiq-inline">
            <span>{tEnum('notification_rules.event_type', row.eventType)}</span>
            {row.mandatory && (
              <Chip tone="neutral" size="sm" icon="lock">
                {row.mandatoryLocked
                  ? t('notifications.rules.locked')
                  : t('notifications.rules.mandatory')}
              </Chip>
            )}
          </span>
          <span className="tiq-cell-sub">{tEnum('notifications.category', row.category)}</span>
        </>
      ),
    },
    {
      id: 'recipients',
      header: t('notifications.rules.col.recipients'),
      cell: (row) =>
        row.recipientRoles.map((role) => t(`notifications.recipient.${role}`)).join(', '),
    },
    {
      id: 'subject',
      header: t('notifications.rules.col.subject'),
      cell: (row) => <span className="tiq-mono">{row.subjectTemplate}</span>,
    },
    {
      id: 'reminders',
      header: t('notifications.rules.col.reminders'),
      cell: (row) =>
        row.reminderOffsetsHours.length === 0 ? (
          <span className="tiq-text-muted">{t('notifications.rules.noReminders')}</span>
        ) : (
          t('notifications.rules.remindersBefore', {
            list: row.reminderOffsetsHours.map(formatHours).join(', '),
          })
        ),
    },
    {
      id: 'escalation',
      header: t('notifications.rules.col.escalation'),
      cell: (row) =>
        row.escalateAfterHours === null || row.escalationRole === null ? (
          <span className="tiq-text-muted">{t('notifications.rules.noEscalation')}</span>
        ) : (
          t('notifications.rules.escalationLine', {
            delay: formatHours(row.escalateAfterHours),
            role: t(`notifications.recipient.${row.escalationRole}`),
          })
        ),
    },
    {
      id: 'status',
      header: t('notifications.rules.col.status'),
      cell: (row) => (
        <Chip tone={row.active ? 'success' : 'neutral'} size="sm">
          {row.active ? t('notifications.rules.active') : t('notifications.rules.inactive')}
        </Chip>
      ),
    },
    {
      id: 'updatedAt',
      header: t('notifications.rules.col.updated'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{formatInstantDate(row.updatedAt, timeZone)}</span>
          {row.updatedBy !== null && (
            <span className="tiq-cell-sub">
              {t('notifications.rules.updatedBy', { name: row.updatedBy.fullName })}
            </span>
          )}
        </>
      ),
    },
  ];

  const rulesView = (
    <div className="tiq-stack">
      <FilterBar
        label={t('notifications.rules.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <Select
          label={t('notifications.rules.event')}
          placeholder={t('notifications.rules.allEvents')}
          value={filters.eventType}
          options={NOTIFICATION_RULES_EVENT_TYPE.map((value) => ({
            value,
            label: tEnum('notification_rules.event_type', value),
          }))}
          onChange={(eventType) => setFilters({ eventType, page: 1 })}
        />
        <Select
          label={t('notifications.rules.category')}
          placeholder={t('notifications.rules.allCategories')}
          value={filters.category}
          options={NOTIFICATIONS_CATEGORY.map((value) => ({
            value,
            label: tEnum('notifications.category', value),
          }))}
          onChange={(category) => setFilters({ category, page: 1 })}
        />
        <Select
          label={t('notifications.rules.mandatory')}
          placeholder={t('notifications.rules.anyMandatory')}
          value={filters.mandatory}
          options={[
            { value: 'true', label: t('notifications.rules.mandatoryOnly') },
            { value: 'false', label: t('notifications.rules.optionalOnly') },
          ]}
          onChange={(mandatory) => setFilters({ mandatory, page: 1 })}
        />
        <Select
          label={t('notifications.rules.status')}
          placeholder={t('notifications.rules.anyStatus')}
          value={filters.active}
          options={[
            { value: 'true', label: t('notifications.rules.activeOnly') },
            { value: 'false', label: t('notifications.rules.inactiveOnly') },
          ]}
          onChange={(active) => setFilters({ active, page: 1 })}
        />
        <Checkbox
          label={t('notifications.rules.withReminders')}
          checked={filters.reminders}
          onChange={(reminders) => setFilters({ reminders, page: 1 })}
        />
        <Checkbox
          label={t('notifications.rules.withEscalation')}
          checked={filters.escalation}
          onChange={(escalation) => setFilters({ escalation, page: 1 })}
        />
      </FilterBar>
      <Card flush>
        <DataTable
          caption={t('notifications.rules.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => tEnum('notification_rules.event_type', row.eventType)}
          rowHref={(row) => notificationPaths.rule(row.id)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={{ key: sortField(filters.sort), dir: directionOf(filters.dir) }}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              icon="bell"
              title={
                filtered ? t('notifications.rules.emptyFiltered') : t('notifications.rules.empty')
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

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('notifications.rules.title')}
        subtitle={t('notifications.rules.intro')}
      />
      <KpiGrid>
        <KpiCard
          label={t('notifications.rules.kpi.active')}
          icon="bell"
          value={count((row) => row.active)}
          hint={t('notifications.rules.kpi.activeHint', { count: all.length })}
        />
        <KpiCard
          label={t('notifications.rules.kpi.mandatory')}
          icon="lock"
          tone="info"
          value={count((row) => row.mandatory)}
          hint={t('notifications.rules.kpi.mandatoryHint')}
        />
        <KpiCard
          label={t('notifications.rules.kpi.reminders')}
          icon="clock"
          tone="success"
          value={count((row) => row.reminderOffsetsHours.length > 0)}
          hint={t('notifications.rules.kpi.remindersHint')}
        />
        <KpiCard
          label={t('notifications.rules.kpi.exceptions')}
          icon="alertOctagon"
          tone="danger"
          value={openExceptions.data === undefined ? '…' : formatCount(openExceptions.data.total)}
          hint={t('notifications.rules.kpi.exceptionsHint')}
        />
      </KpiGrid>
      <Tabs
        label={t('notifications.rules.tabs')}
        selected={view}
        onSelect={(next) => setFilters({ view: next })}
        tabs={[
          { id: 'rules', label: t('notifications.rules.rulesTab'), count: overview.data?.total },
          {
            id: 'exceptions',
            label: t('notifications.rules.exceptionsTab'),
            count: openExceptions.data?.total,
          },
        ]}
      >
        {view === 'rules' ? rulesView : <DeliveryExceptionsPanel />}
      </Tabs>
    </div>
  );
}
