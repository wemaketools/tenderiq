/**
 * Building blocks of ADM-10: the working-days field, the impact review of active events (BR-12) and the deadline
 * policy (official zone, default calendar, reminder periods and notice rules).
 */
import type { CalendarImpact, DeadlinePolicy } from '@contracts/calendars';

import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Card,
  Checkbox,
  Chip,
  DataTable,
  DetailList,
  EmptyState,
  OfficialDeadline,
  Reference,
  StatusChip,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { notificationPaths } from '../../notifications/lib/paths';
import { formatHours } from '../../tasks/lib/shared';
import { ISO_WEEKDAYS, calendarPaths, formatWorkingDays } from '../lib/calendars';

export function WorkingDaysField({
  value,
  onChange,
  error,
  disabled = false,
}: {
  readonly value: readonly number[];
  readonly onChange: (days: number[]) => void;
  readonly error?: string;
  readonly disabled?: boolean;
}) {
  return (
    <fieldset className="tiq-fieldset tiq-form-full">
      <legend className="tiq-field-label">{t('calendars.detail.workingDays')}</legend>
      <span className="tiq-field-hint">{t('calendars.detail.workingDaysHint')}</span>
      <div className="tiq-inline">
        {ISO_WEEKDAYS.map((day) => (
          <Checkbox
            key={day}
            label={t(`calendars.weekday.long.${day}`)}
            checked={value.includes(day)}
            disabled={disabled}
            onChange={(checked) =>
              onChange(
                checked
                  ? [...value, day].sort((a, b) => a - b)
                  : value.filter((item) => item !== day),
              )
            }
          />
        ))}
      </div>
      {error !== undefined && <span className="tiq-field-error">{error}</span>}
    </fieldset>
  );
}

export function ImpactReview({ impact }: { readonly impact: CalendarImpact }) {
  return (
    <div className="tiq-stack">
      <Banner tone="warning" title={t('calendars.impact.title')}>
        {t('calendars.impact.intro')}
      </Banner>
      {impact.items.length === 0 ? (
        <EmptyState compact icon="checkCircle" title={t('calendars.impact.none')} />
      ) : (
        <DataTable
          caption={t('calendars.impact.caption')}
          rows={impact.items}
          rowKey={(row) => `${row.tenderId}-${row.lotId ?? 0}-${row.milestone}`}
          columns={[
            {
              id: 'event',
              header: t('calendars.impact.col.event'),
              cell: (row) => (
                <>
                  <Reference value={row.reference} to={`/buyer/tenders/${row.tenderId}`} />
                  <span className="tiq-cell-sub">{row.title}</span>
                </>
              ),
            },
            {
              id: 'milestone',
              header: t('calendars.impact.col.milestone'),
              cell: (row) => tEnum('tender_milestones.milestone', row.milestone),
            },
            {
              id: 'deadline',
              header: t('calendars.impact.col.deadline'),
              cell: (row) => <OfficialDeadline deadline={row.deadline} showLocal={false} />,
            },
            {
              id: 'days',
              header: t('calendars.impact.col.workingDays'),
              numeric: true,
              cell: (row) => (
                <span
                  className={
                    row.workingDaysAfter !== row.workingDaysBefore ? 'tiq-text-warning' : undefined
                  }
                >
                  {t('calendars.impact.workingDaysValue', {
                    before: row.workingDaysBefore,
                    after: row.workingDaysAfter,
                  })}
                </span>
              ),
            },
            {
              id: 'flag',
              header: t('calendars.impact.col.flag'),
              cell: (row) =>
                row.fallsOnNonWorkingDay ? (
                  <Chip tone="danger" size="sm" icon="alertTriangle">
                    {t('calendars.impact.nonWorking')}
                  </Chip>
                ) : (
                  <span className="tiq-text-muted">{t('calendars.impact.ok')}</span>
                ),
            },
          ]}
        />
      )}
    </div>
  );
}

export function DeadlinePolicyCard({ policy }: { readonly policy: DeadlinePolicy }) {
  const canOpenRules = usePermission('org.notifications.manage');
  return (
    <Card title={t('calendars.policy.title')} subtitle={t('calendars.policy.intro')}>
      <div className="tiq-stack">
        <DetailList
          items={[
            { key: 'zone', label: t('calendars.policy.zone'), value: policy.officialTimeZone },
            {
              key: 'default',
              label: t('calendars.policy.defaultCalendar'),
              value:
                policy.defaultCalendar === null ? (
                  t('calendars.policy.noDefault')
                ) : (
                  <span className="tiq-inline">
                    <Reference
                      value={policy.defaultCalendar.name}
                      to={calendarPaths.calendar(policy.defaultCalendar.id)}
                    />
                    <span className="tiq-text-muted">
                      {formatWorkingDays(policy.defaultCalendar.workingDays)}
                    </span>
                  </span>
                ),
            },
            {
              key: 'basis',
              label: t('calendars.policy.basis'),
              value: tEnum('notices.period_start_basis', policy.noticePeriodStartBasis),
            },
            {
              key: 'addendum',
              label: t('calendars.policy.addendumDays'),
              value: t('calendars.policy.addendumDaysValue', {
                count: policy.minimumAddendumResponseWorkingDays,
              }),
            },
            {
              key: 'moves',
              label: t('calendars.policy.moves'),
              value: t('calendars.policy.movesValue'),
            },
          ]}
        />
        <DataTable
          caption={t('calendars.policy.remindersCaption')}
          rows={policy.reminders}
          rowKey={(row) => row.eventType}
          columns={[
            {
              id: 'event',
              header: t('calendars.policy.reminderEvent'),
              cell: (row) =>
                canOpenRules && row.ruleId !== null ? (
                  <Reference
                    value={tEnum('notification_rules.event_type', row.eventType)}
                    to={notificationPaths.rule(row.ruleId)}
                  />
                ) : (
                  tEnum('notification_rules.event_type', row.eventType)
                ),
            },
            {
              id: 'offsets',
              header: t('calendars.policy.reminderOffsets'),
              cell: (row) =>
                row.reminderOffsetsHours.length === 0
                  ? t('calendars.policy.none')
                  : row.reminderOffsetsHours.map(formatHours).join(', '),
            },
            {
              id: 'escalation',
              header: t('calendars.policy.reminderEscalation'),
              cell: (row) =>
                row.escalateAfterHours === null || row.escalationRole === null
                  ? t('calendars.policy.none')
                  : t('calendars.policy.escalationLine', {
                      delay: formatHours(row.escalateAfterHours),
                      role: t(`notifications.recipient.${row.escalationRole}`),
                    }),
            },
            {
              id: 'state',
              header: t('calendars.policy.reminderState'),
              cell: (row) => (
                <span className="tiq-inline">
                  <Chip tone={row.active ? 'success' : 'neutral'} size="sm">
                    {row.active ? t('calendars.policy.active') : t('calendars.policy.inactive')}
                  </Chip>
                  {row.mandatory && (
                    <Chip tone="neutral-outlined" size="sm" icon="lock">
                      {t('calendars.policy.mandatory')}
                    </Chip>
                  )}
                </span>
              ),
            },
          ]}
        />
      </div>
    </Card>
  );
}

/** Status chip of a calendar, for lists and headers. */
export function CalendarStatus({ status }: { readonly status: string }) {
  return <StatusChip enum="calendars.status" value={status} size="sm" />;
}
