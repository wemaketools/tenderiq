/**
 * ADM-10 — a new working calendar, saved as a draft. Another administrator approves it before events may use it
 * (BR-07); holidays are added on the calendar page.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { createCalendar } from '@contracts/calendars';
import type { CalendarDetail } from '@contracts/calendars';

import { useApiMutation } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import {
  Button,
  Card,
  ConfirmActionDialog,
  FormErrorSummary,
  PageHeader,
  TextField,
  UnsavedChangesGuard,
  formErrors,
  useToast,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { localizeError } from '../../tasks/lib/shared';
import { WorkingDaysField } from '../components/CalendarParts';
import { calendarPaths } from '../lib/calendars';

const WEEKDAYS = [1, 2, 3, 4, 5];

export default function CalendarNewPage() {
  const navigate = useNavigate();
  const tenant = useActiveTenant();
  const toast = useToast();
  const create = useApiMutation(createCalendar);
  const [name, setName] = useState('');
  const [zone, setZone] = useState(tenant?.officialTimeZone ?? '');
  const [days, setDays] = useState<readonly number[]>(WEEKDAYS);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [created, setCreated] = useState<CalendarDetail | null>(null);
  const errors = formErrors(create.error, ['name', 'timeZone', 'workingDays']);
  const dirty = created === null && (name !== '' || zone !== (tenant?.officialTimeZone ?? ''));

  useEffect(() => {
    if (created !== null) {
      void navigate(calendarPaths.calendar(created.id), { state: { record: created } });
    }
  }, [created, navigate]);

  const ask = (): void => {
    const found: Record<string, string> = {};
    if (name.trim() === '') found.name = t('calendars.detail.nameRequired');
    if (!/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+$|^UTC$/.test(zone.trim())) {
      found.timeZone = t('calendars.detail.zoneRequired');
    }
    if (days.length === 0) found.workingDays = t('calendars.detail.daysRequired');
    setProblems(found);
    if (Object.keys(found).length === 0) setConfirming(true);
  };

  return (
    <div className="tiq-page">
      <UnsavedChangesGuard when={dirty} />
      <PageHeader
        title={t('calendars.new.title')}
        subtitle={t('calendars.new.intro')}
        back={{ to: calendarPaths.list, label: t('calendars.detail.back') }}
      />
      <Card
        title={t('calendars.detail.settings')}
        footer={
          <Button variant="primary" icon="plus" onClick={ask}>
            {t('calendars.new.create')}
          </Button>
        }
      >
        {errors.other.length > 0 && (
          <FormErrorSummary title={create.error?.title ?? null} errors={errors.other} />
        )}
        <div className="tiq-form-grid">
          <TextField
            label={t('calendars.detail.name')}
            required
            value={name}
            onChange={setName}
            error={problems.name ?? errors.forField('name')}
          />
          <TextField
            label={t('calendars.detail.timeZone')}
            hint={t('calendars.detail.timeZoneHint')}
            required
            value={zone}
            onChange={setZone}
            error={problems.timeZone ?? errors.forField('timeZone')}
          />
          <WorkingDaysField
            value={days}
            onChange={setDays}
            error={problems.workingDays ?? errors.forField('workingDays')}
          />
        </div>
      </Card>
      <ConfirmActionDialog
        open={confirming}
        title={t('calendars.new.createTitle')}
        scope={t('calendars.confirm.scope', { name: name.trim(), zone: zone.trim() })}
        consequence={t('calendars.new.createConsequence')}
        confirmLabel={t('calendars.new.create')}
        pending={create.pending}
        error={localizeError(create.error, 'calendars')}
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          const result = await create
            .mutate({ body: { name: name.trim(), timeZone: zone.trim(), workingDays: [...days] } })
            .catch(() => null);
          if (result !== null) {
            setConfirming(false);
            toast.show(t('calendars.new.created'), 'success');
            setCreated(result);
          }
        }}
      />
    </div>
  );
}
