/**
 * ADM-10 — one working calendar: settings (name, official zone, working days), holidays, the active events that
 * use it, approval by an independent administrator (BR-07), default selection and retirement. A change to a
 * calendar used by active events is reviewed against their deadlines first (BR-12); nothing moves a published
 * deadline (BR-16).
 */
import { useState } from 'react';

import {
  addHoliday,
  approveCalendar,
  getCalendar,
  removeHoliday,
  retireCalendar,
  reviewCalendarImpact,
  setDefaultCalendar,
  updateCalendar,
} from '@contracts/calendars';
import type { CalendarDetail, CalendarHoliday, CalendarImpact } from '@contracts/calendars';

import { ApiError, call, isApiError } from '../../../api/client';
import { useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import { HistoryTimeline } from '../../../components/audit';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DateInput,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
  Reference,
  SkeletonBlock,
  StatusChip,
  TextField,
  UnsavedChangesGuard,
  formErrors,
  useToast,
} from '../../../components/ui';
import { formatCalendarDate, formatOfficialTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import {
  errorMessage,
  localizeError,
  useCommandResult,
  useDisplayTimeZone,
  useIdParam,
} from '../../tasks/lib/shared';
import { CalendarStatus, ImpactReview, WorkingDaysField } from '../components/CalendarParts';
import { calendarPaths, isoWeekday, sameDays } from '../lib/calendars';

type Change =
  | {
      readonly kind: 'save';
      readonly name: string;
      readonly timeZone: string;
      readonly workingDays: readonly number[];
    }
  | { readonly kind: 'add'; readonly date: string; readonly name: string }
  | { readonly kind: 'remove'; readonly holiday: CalendarHoliday }
  | { readonly kind: 'approve' }
  | { readonly kind: 'default' }
  | { readonly kind: 'retire' };

function toApiError(caught: unknown, endpointId: string): ApiError {
  if (isApiError(caught)) return caught;
  return new ApiError({
    kind: 'network',
    status: 0,
    title: caught instanceof Error ? caught.message : t('tasks.errors.unexpected'),
    endpointId,
  });
}

function CalendarView({
  calendar,
  onChanged,
}: {
  readonly calendar: CalendarDetail;
  readonly onChanged: (calendar: CalendarDetail) => void;
}) {
  const timeZone = useDisplayTimeZone();
  const canAudit = usePermission('audit.view');
  const toast = useToast();
  const { capabilities } = calendar;
  const editable = capabilities.canEdit && calendar.status !== 'retired';

  const [name, setName] = useState(calendar.name);
  const [zone, setZone] = useState(calendar.timeZone);
  const [days, setDays] = useState<readonly number[]>(calendar.workingDays);
  const [settingsProblems, setSettingsProblems] = useState<Record<string, string>>({});
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [holidayProblems, setHolidayProblems] = useState<Record<string, string>>({});

  const [change, setChange] = useState<Change | null>(null);
  const [impact, setImpact] = useState<CalendarImpact | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const dirty =
    name !== calendar.name || zone !== calendar.timeZone || !sameDays(days, calendar.workingDays);
  const inUse = calendar.activeEventCount > 0;
  const settingsErrors = formErrors(change?.kind === 'save' ? error : null, [
    'name',
    'timeZone',
    'workingDays',
  ]);
  const holidayErrors = formErrors(change?.kind === 'add' ? error : null, ['date', 'name']);

  const needsReview = (next: Change): boolean => {
    if (!inUse) return false;
    if (next.kind === 'add' || next.kind === 'remove') return true;
    return next.kind === 'save' && !sameDays(next.workingDays, calendar.workingDays);
  };

  const run = async (next: Change, reviewed: boolean, reason: string): Promise<void> => {
    setPending(true);
    setError(null);
    const params = { calendarId: calendar.id };
    try {
      let result: CalendarDetail;
      let message: string;
      switch (next.kind) {
        case 'save':
          result = await call(updateCalendar, {
            params,
            body: {
              name: next.name,
              timeZone: next.timeZone,
              workingDays: [...next.workingDays],
              impactReviewed: reviewed,
            },
          });
          message = t('calendars.detail.saved');
          break;
        case 'add':
          result = await call(addHoliday, {
            params,
            body: { date: next.date, name: next.name, impactReviewed: reviewed },
          });
          message = t('calendars.detail.holidayAdded');
          break;
        case 'remove':
          result = await call(removeHoliday, {
            params: { calendarId: calendar.id, holidayId: next.holiday.id },
            query: { impactReviewed: reviewed },
          });
          message = t('calendars.detail.holidayRemoved');
          break;
        case 'approve':
          result = await call(approveCalendar, {
            params,
            body: reason === '' ? {} : { note: reason },
          });
          message = t('calendars.confirm.approved');
          break;
        case 'default':
          result = await call(setDefaultCalendar, { params });
          message = t('calendars.confirm.defaultDone');
          break;
        case 'retire':
          result = await call(retireCalendar, { params, body: { reason } });
          message = t('calendars.confirm.retired');
          break;
      }
      toast.show(message, 'success');
      setChange(null);
      setImpact(null);
      if (next.kind === 'add') {
        setHolidayDate('');
        setHolidayName('');
      }
      onChanged(result);
    } catch (caught) {
      setError(toApiError(caught, updateCalendar.id));
    } finally {
      setPending(false);
    }
  };

  /** Reviews the impact when the calendar is in use, then asks for confirmation (or runs a plain draft edit). */
  const start = async (next: Change): Promise<void> => {
    setError(null);
    setImpact(null);
    if (needsReview(next)) {
      setReviewing(true);
      try {
        const body =
          next.kind === 'add'
            ? { addHolidays: [{ date: next.date, name: next.name }] }
            : next.kind === 'remove'
              ? { removeHolidayIds: [next.holiday.id] }
              : next.kind === 'save'
                ? { workingDays: [...next.workingDays] }
                : {};
        const result = await call(reviewCalendarImpact, {
          params: { calendarId: calendar.id },
          body,
        });
        setImpact(result);
        setChange(next);
      } catch (caught) {
        toast.show(`${t('calendars.impact.failed')} ${errorMessage(caught, 'calendars')}`, 'error');
      } finally {
        setReviewing(false);
      }
      return;
    }
    if (next.kind === 'add' || next.kind === 'remove') {
      setChange(next);
      await run(next, false, '');
      return;
    }
    setChange(next);
  };

  const saveSettings = (): void => {
    const problems: Record<string, string> = {};
    if (name.trim() === '') problems.name = t('calendars.detail.nameRequired');
    if (!/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+$|^UTC$/.test(zone.trim())) {
      problems.timeZone = t('calendars.detail.zoneRequired');
    }
    if (days.length === 0) problems.workingDays = t('calendars.detail.daysRequired');
    setSettingsProblems(problems);
    if (Object.keys(problems).length > 0) return;
    void start({ kind: 'save', name: name.trim(), timeZone: zone.trim(), workingDays: days });
  };

  const addNewHoliday = (): void => {
    const problems: Record<string, string> = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(holidayDate)) {
      problems.date = t('calendars.detail.holidayDateRequired');
    }
    if (holidayName.trim() === '') problems.name = t('calendars.detail.holidayNameRequired');
    setHolidayProblems(problems);
    if (Object.keys(problems).length > 0) return;
    void start({ kind: 'add', date: holidayDate, name: holidayName.trim() });
  };

  const scope = t('calendars.confirm.scope', { name: calendar.name, zone: calendar.timeZone });
  const dialog = ((): {
    title: string;
    scope: string;
    consequence: string;
    confirmLabel: string;
    tone: 'primary' | 'danger';
    reason?: { label: string; required: boolean };
  } | null => {
    if (change === null) return null;
    switch (change.kind) {
      case 'save':
        return {
          title: t('calendars.confirm.saveTitle'),
          scope,
          consequence:
            calendar.status === 'approved'
              ? t('calendars.confirm.saveConsequenceApproved')
              : t('calendars.confirm.saveConsequence'),
          confirmLabel: t('calendars.detail.save'),
          tone: 'primary',
        };
      case 'add':
        return {
          title: t('calendars.confirm.addTitle'),
          scope: t('calendars.confirm.addScope', {
            name: change.name,
            date: formatCalendarDate(change.date),
            calendar: calendar.name,
          }),
          consequence: t('calendars.confirm.addConsequence'),
          confirmLabel: t('calendars.detail.addHoliday'),
          tone: 'primary',
        };
      case 'remove':
        return {
          title: t('calendars.confirm.removeTitle'),
          scope: t('calendars.confirm.addScope', {
            name: change.holiday.name,
            date: formatCalendarDate(change.holiday.date),
            calendar: calendar.name,
          }),
          consequence: t('calendars.confirm.removeConsequence'),
          confirmLabel: t('calendars.detail.remove'),
          tone: 'danger',
        };
      case 'approve':
        return {
          title: t('calendars.confirm.approveTitle'),
          scope,
          consequence: t('calendars.confirm.approveConsequence'),
          confirmLabel: t('calendars.detail.approve'),
          tone: 'primary',
          reason: { label: t('calendars.confirm.approveNote'), required: false },
        };
      case 'default':
        return {
          title: t('calendars.confirm.defaultTitle'),
          scope,
          consequence: t('calendars.confirm.defaultConsequence'),
          confirmLabel: t('calendars.detail.setDefault'),
          tone: 'primary',
        };
      case 'retire':
        return {
          title: t('calendars.confirm.retireTitle'),
          scope,
          consequence: t('calendars.confirm.retireConsequence'),
          confirmLabel: t('calendars.detail.retire'),
          tone: 'danger',
          reason: { label: t('calendars.confirm.retireReason'), required: true },
        };
    }
  })();
  const inlineChange = change !== null && (change.kind === 'add' || change.kind === 'remove');
  const showDialog = dialog !== null && change !== null && (!inlineChange || impact !== null);

  const stateLine =
    calendar.status === 'draft'
      ? t('calendars.detail.stateDraft')
      : calendar.status === 'retired'
        ? t('calendars.detail.stateRetired')
        : calendar.approvedAt === null
          ? ''
          : calendar.approvedBy === null
            ? t('calendars.detail.stateApprovedNoName', {
                time: formatOfficialTime(calendar.approvedAt, timeZone),
              })
            : t('calendars.detail.stateApproved', {
                time: formatOfficialTime(calendar.approvedAt, timeZone),
                name: calendar.approvedBy.fullName,
              });
  const approveBlocked = capabilities.approveBlockedReason ?? null;

  return (
    <div className="tiq-page">
      <UnsavedChangesGuard when={dirty} />
      <PageHeader
        title={calendar.name}
        back={{ to: calendarPaths.list, label: t('calendars.detail.back') }}
        subtitle={stateLine}
        meta={
          <>
            <CalendarStatus status={calendar.status} />
            {calendar.isDefault && (
              <Chip tone="accent" size="sm" icon="star">
                {t('calendars.list.default')}
              </Chip>
            )}
            <span className="tiq-text-muted">
              {t('calendars.detail.zone', { zone: calendar.timeZone })}
            </span>
            <span className="tiq-text-muted">
              {t('calendars.detail.events', { count: calendar.activeEventCount })}
            </span>
          </>
        }
        primaryAction={
          capabilities.canApprove ? (
            <Button
              variant="primary"
              icon="checkCircle"
              onClick={() => void start({ kind: 'approve' })}
            >
              {t('calendars.detail.approve')}
            </Button>
          ) : capabilities.canSetDefault ? (
            <Button variant="primary" icon="star" onClick={() => void start({ kind: 'default' })}>
              {t('calendars.detail.setDefault')}
            </Button>
          ) : undefined
        }
        actions={
          <>
            {capabilities.canApprove && capabilities.canSetDefault && (
              <Button icon="star" onClick={() => void start({ kind: 'default' })}>
                {t('calendars.detail.setDefault')}
              </Button>
            )}
            {capabilities.canRetire && (
              <Button
                variant="danger-soft"
                icon="archive"
                onClick={() => void start({ kind: 'retire' })}
              >
                {t('calendars.detail.retire')}
              </Button>
            )}
          </>
        }
      />
      {calendar.status === 'draft' && approveBlocked !== null && (
        <Banner tone="warning">{t(`calendars.detail.approveBlocked.${approveBlocked}`)}</Banner>
      )}
      {error !== null && !showDialog && error.fieldErrors.length === 0 && (
        <Banner tone="error" title={error.title}>
          {errorMessage(error, 'calendars')}
        </Banner>
      )}
      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack">
          <Card
            title={t('calendars.detail.settings')}
            footer={
              editable ? (
                <div className="tiq-inline">
                  <span className={dirty ? 'tiq-text-warning' : 'tiq-text-muted'} role="status">
                    {dirty ? t('calendars.detail.unsaved') : t('calendars.detail.upToDate')}
                  </span>
                  <Button
                    variant="primary"
                    disabled={!dirty}
                    loading={reviewing && change === null}
                    onClick={saveSettings}
                  >
                    {t('calendars.detail.save')}
                  </Button>
                </div>
              ) : undefined
            }
          >
            <div className="tiq-form-grid">
              <TextField
                label={t('calendars.detail.name')}
                required
                disabled={!editable}
                value={name}
                onChange={setName}
                error={settingsProblems.name ?? settingsErrors.forField('name')}
              />
              <TextField
                label={t('calendars.detail.timeZone')}
                hint={t('calendars.detail.timeZoneHint')}
                required
                disabled={!editable}
                value={zone}
                onChange={setZone}
                error={settingsProblems.timeZone ?? settingsErrors.forField('timeZone')}
              />
              <WorkingDaysField
                value={days}
                onChange={setDays}
                disabled={!editable}
                error={settingsProblems.workingDays ?? settingsErrors.forField('workingDays')}
              />
            </div>
          </Card>
          <Card title={t('calendars.detail.holidays')} flush>
            {editable && (
              <div className="tiq-filterbar">
                <DateInput
                  label={t('calendars.detail.newHolidayDate')}
                  required
                  value={holidayDate}
                  onChange={setHolidayDate}
                  error={holidayProblems.date ?? holidayErrors.forField('date')}
                />
                <TextField
                  label={t('calendars.detail.newHolidayName')}
                  required
                  value={holidayName}
                  onChange={setHolidayName}
                  error={holidayProblems.name ?? holidayErrors.forField('name')}
                />
                <div className="tiq-filterbar-actions">
                  <Button icon="plus" loading={reviewing || pending} onClick={addNewHoliday}>
                    {t('calendars.detail.addHoliday')}
                  </Button>
                </div>
              </div>
            )}
            <DataTable
              caption={t('calendars.detail.holidaysCaption')}
              rows={calendar.holidays}
              rowKey={(row) => String(row.id)}
              empty={
                <EmptyState compact icon="calendar" title={t('calendars.detail.holidaysEmpty')} />
              }
              columns={[
                {
                  id: 'date',
                  header: t('calendars.detail.holidayDate'),
                  cell: (row) => formatCalendarDate(row.date),
                },
                {
                  id: 'day',
                  header: t('calendars.detail.holidayDay'),
                  cell: (row) => t(`calendars.weekday.long.${isoWeekday(row.date)}`),
                },
                { id: 'name', header: t('calendars.detail.holidayName'), cell: (row) => row.name },
                {
                  id: 'actions',
                  header: (
                    <span className="tiq-visually-hidden">{t('calendars.detail.remove')}</span>
                  ),
                  cell: (row) =>
                    editable ? (
                      <div className="tiq-row-actions">
                        <IconButton
                          icon="trash"
                          label={t('calendars.detail.removeLabel', {
                            name: row.name,
                            date: formatCalendarDate(row.date),
                          })}
                          onClick={() => void start({ kind: 'remove', holiday: row })}
                        />
                      </div>
                    ) : null,
                },
              ]}
            />
          </Card>
        </div>
        <div className="tiq-stack">
          <Card title={t('calendars.detail.usedBy')} flush={calendar.usedBy.length > 0}>
            {calendar.usedBy.length === 0 ? (
              <p className="tiq-text-muted">{t('calendars.detail.usedByEmpty')}</p>
            ) : (
              <DataTable
                caption={t('calendars.detail.usedByCaption')}
                rows={calendar.usedBy}
                rowKey={(row) => String(row.tenderId)}
                columns={[
                  {
                    id: 'reference',
                    header: t('calendars.detail.usedCol.reference'),
                    cell: (row) => (
                      <>
                        <Reference value={row.reference} to={`/buyer/tenders/${row.tenderId}`} />
                        <span className="tiq-cell-sub">{row.title}</span>
                      </>
                    ),
                  },
                  {
                    id: 'status',
                    header: t('calendars.detail.usedCol.status'),
                    cell: (row) => (
                      <StatusChip enum="tenders.status" value={row.status} size="sm" />
                    ),
                  },
                ]}
              />
            )}
          </Card>
          {canAudit && (
            <HistoryTimeline
              entityType="calendar"
              entityId={calendar.id}
              title={t('calendars.detail.history')}
            />
          )}
        </div>
      </div>
      {showDialog && (
        <ConfirmActionDialog
          open
          title={dialog.title}
          scope={dialog.scope}
          consequence={dialog.consequence}
          confirmLabel={dialog.confirmLabel}
          tone={dialog.tone}
          reason={dialog.reason}
          acknowledgement={impact !== null ? t('calendars.impact.acknowledge') : undefined}
          pending={pending}
          error={localizeError(error, 'calendars')}
          onCancel={() => {
            setChange(null);
            setImpact(null);
            setError(null);
          }}
          onConfirm={async ({ reason }) => {
            await run(change, impact !== null, reason);
          }}
        >
          {impact !== null && <ImpactReview impact={impact} />}
        </ConfirmActionDialog>
      )}
    </div>
  );
}

export default function CalendarPage() {
  const calendarId = useIdParam('calendarId');
  const query = useApiQuery(getCalendar, calendarId === null ? null : { params: { calendarId } });
  const [result, setResult] = useCommandResult<CalendarDetail>(calendarId);
  const calendar = result ?? query.data;
  if (calendar === undefined) {
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('calendars.detail.loadingTitle')}
          back={{ to: calendarPaths.list, label: t('calendars.detail.back') }}
        />
        {calendarId === null ? (
          <EmptyState icon="alertCircle" title={t('calendars.detail.notFound')} />
        ) : query.error === null ? (
          <SkeletonBlock lines={8} />
        ) : (
          <ErrorState error={query.error} onRetry={query.reload} />
        )}
      </div>
    );
  }
  return (
    <CalendarView
      key={`${calendar.id}:${calendar.updatedAt}:${calendar.status}:${calendar.holidays.length}:${String(calendar.isDefault)}`}
      calendar={calendar}
      onChanged={setResult}
    />
  );
}
