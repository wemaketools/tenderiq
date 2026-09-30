/**
 * The timetable editor (BUY-12): milestones entered in the tender's OFFICIAL time zone, with the working-day hint of
 * each date (weekend or public holiday of the tender's calendar, and the next working day) and the coherence checks
 * computed live by the contract's pure rules (the milestone order of MILESTONE_PREDECESSORS, response period against
 * the policy minimum, questions window). Hard ordering errors come back from the API as 422 field errors on the same
 * rows. Each milestone exists once per scope (the whole tender, or one lot): a row offers only the milestones and lots
 * no other row uses, in the order milestones occur, and a duplicate is flagged at once.
 */
import { useState } from 'react';

import type { FieldError } from '@contracts/common';
import { splitIssueMessage } from '@contracts/common';
import type { TenderMilestonesMilestone } from '@contracts/enums';
import {
  MILESTONE_SEQUENCE,
  UpdateTimetableBody,
  timetableIssues,
  updateTimetable,
  workingDayHint,
} from '@contracts/tenders';
import type { LotSummary, TenderTimetable, TimetableMutationResult } from '@contracts/tenders';

import { useApiMutation } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  DateTimeInput,
  FormErrorSummary,
  IconButton,
  Select,
  TextField,
  UnsavedChangesGuard,
} from '../../../components/ui';
import { formatCalendarDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { tenderErrorMessage } from '../lib/errors';
import { lotLabel } from '../lib/labels';
import { rowKey } from '../lib/planForm';
import { IssueList } from './IssueList';

interface Row {
  key: string;
  milestone: string;
  lot: string;
  at: string | null;
  isDisclosed: boolean;
  note: string;
}

function rowsOf(timetable: TenderTimetable): Row[] {
  return timetable.milestones.map((row) => ({
    key: `m-${row.id}`,
    milestone: row.milestone,
    lot: row.lot === null ? '' : String(row.lot.id),
    at: row.deadline.at,
    isDisclosed: row.isDisclosed,
    note: row.note ?? '',
  }));
}

export interface TimetableEditorProps {
  readonly tenderId: number;
  readonly draftRevision: number;
  readonly timetable: TenderTimetable;
  readonly lots: readonly LotSummary[];
  readonly onCancel: () => void;
  readonly onSaved: (result: TimetableMutationResult) => void;
}

export function WorkingDayChip({
  at,
  timeZone,
  holidays,
}: {
  readonly at: string;
  readonly timeZone: string;
  readonly holidays: TenderTimetable['holidays'];
}) {
  const hint = workingDayHint(at, timeZone, holidays);
  if (hint.isWorkingDay) {
    return (
      <Chip tone="success" size="sm" icon="checkCircle">
        {t('tender-authoring.timetable.workingDay')}
      </Chip>
    );
  }
  return (
    <Chip tone="warning" size="sm" icon="alertTriangle">
      {hint.reason === 'holiday'
        ? t('tender-authoring.timetable.holiday', {
            name: hint.holidayName ?? '',
            next: hint.nextWorkingDate === null ? '' : formatCalendarDate(hint.nextWorkingDate),
          })
        : t('tender-authoring.timetable.weekend', {
            next: hint.nextWorkingDate === null ? '' : formatCalendarDate(hint.nextWorkingDate),
          })}
    </Chip>
  );
}

export function TimetableEditor({
  tenderId,
  draftRevision,
  timetable,
  lots,
  onCancel,
  onSaved,
}: TimetableEditorProps) {
  const mutation = useApiMutation(updateTimetable);
  const [rows, setRows] = useState<Row[]>(() => rowsOf(timetable));
  const [release, setRelease] = useState<string | null>(timetable.scheduledReleaseAt);
  const [submitted, setSubmitted] = useState(false);
  const zone = timetable.officialTimeZone;
  const dirty =
    JSON.stringify(rows) !== JSON.stringify(rowsOf(timetable)) ||
    release !== timetable.scheduledReleaseAt;

  const complete = rows.filter((row) => row.at !== null && row.milestone !== '');
  const body = {
    expectedDraftRevision: draftRevision,
    scheduledReleaseAt: release,
    milestones: complete.map((row) => ({
      milestone: row.milestone as TenderMilestonesMilestone,
      lotId: row.lot === '' ? null : Number(row.lot),
      at: row.at ?? '',
      isDisclosed: row.isDisclosed,
      note: row.note.trim() === '' ? null : row.note.trim(),
    })),
  };
  const parsed = UpdateTimetableBody.safeParse(body);
  const localErrors: FieldError[] = parsed.success
    ? []
    : parsed.error.issues.map((issue) => {
        const { code, message } = splitIssueMessage(issue.message);
        return { field: issue.path.map(String).join('.'), code, message };
      });
  const incomplete = rows.some((row) => row.at === null || row.milestone === '');
  const serverErrors = mutation.error?.fieldErrors ?? [];
  const errors = serverErrors.length > 0 ? serverErrors : submitted ? localErrors : [];
  // Error paths index the complete rows; map them back to the editor rows.
  const indexOf = (row: Row): number => complete.indexOf(row);
  const rowError = (row: Row, field: string): string | undefined => {
    const index = indexOf(row);
    return index < 0
      ? undefined
      : errors.find((error) => error.field === `milestones.${index}.${field}`)?.message;
  };
  const known = (field: string): boolean =>
    /^milestones\.\d+\.(milestone|at|lotId)$/.test(field) || field === 'scheduledReleaseAt';
  const unmatched = errors.filter((error) => !known(error.field));

  const liveIssues = timetableIssues({
    timeZone: zone,
    holidays: timetable.holidays,
    calendarId: timetable.calendar?.id ?? null,
    releaseAt: release,
    milestones: body.milestones.map((row) => ({
      id: null,
      milestone: row.milestone,
      lotId: row.lotId,
      at: row.at,
    })),
    policy: timetable.policy,
    openingMode: timetable.openingMode,
    envelopeCount: timetable.envelopes.length,
  });

  // One milestone per scope: what the other rows already use.
  const usedBy = (row: Row, milestone: string, lot: string): boolean =>
    rows.some(
      (other) => other.key !== row.key && other.milestone === milestone && other.lot === lot,
    );
  const milestoneOptions = (row: Row) =>
    MILESTONE_SEQUENCE.filter(
      (value) => value === row.milestone || !usedBy(row, value, row.lot),
    ).map((value) => ({ value, label: tEnum('tender_milestones.milestone', value) }));
  const lotOptions = (row: Row) =>
    lots
      .filter((lot) => String(lot.id) === row.lot || !usedBy(row, row.milestone, String(lot.id)))
      .map((lot) => ({ value: String(lot.id), label: lotLabel(lot) }));
  const duplicateError = (row: Row): string | undefined => {
    if (row.milestone === '' || !usedBy(row, row.milestone, row.lot)) return undefined;
    const lot = lots.find((candidate) => String(candidate.id) === row.lot);
    return t('tender-authoring.timetable.duplicate', {
      scope: lot === undefined ? t('tender-authoring.timetable.wholeTenderScope') : lotLabel(lot),
    });
  };
  const allUsed =
    rows.filter((row) => row.milestone !== '').length >=
    MILESTONE_SEQUENCE.length * (lots.length + 1);

  const update = (key: string, patch: Partial<Row>): void =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const save = async (): Promise<void> => {
    setSubmitted(true);
    if (incomplete || localErrors.length > 0) return;
    try {
      const result = await mutation.mutate({ params: { tenderId }, body });
      onSaved(result);
    } catch {
      // Field errors and the business error show in the editor.
    }
  };

  return (
    <Card
      title={t('tender-authoring.timetable.editTitle')}
      subtitle={t('tender-authoring.timetable.zoneNote', { zone })}
      data-testid="timetable-editor"
    >
      <UnsavedChangesGuard when={dirty && !mutation.pending} />
      <div className="tiq-stack">
        <DateTimeInput
          label={t('tender-authoring.timetable.release')}
          hint={t('tender-authoring.timetable.releaseHint')}
          value={release}
          timeZone={zone}
          onChange={setRelease}
          error={errors.find((error) => error.field === 'scheduledReleaseAt')?.message}
        />
        {rows.map((row, index) => (
          <fieldset key={row.key} className="tiq-fieldset">
            <legend>
              {row.milestone === ''
                ? t('tender-authoring.timetable.milestoneN', { n: index + 1 })
                : tEnum('tender_milestones.milestone', row.milestone)}
            </legend>
            <div className="tiq-form-grid">
              <Select
                label={t('tender-authoring.timetable.milestone')}
                required
                placeholder={t('tender-authoring.common.select')}
                value={row.milestone}
                options={milestoneOptions(row)}
                onChange={(milestone) => update(row.key, { milestone })}
                error={
                  duplicateError(row) ??
                  rowError(row, 'milestone') ??
                  (submitted && row.milestone === ''
                    ? t('tender-authoring.create.required')
                    : undefined)
                }
              />
              <Select
                label={t('tender-authoring.requirements.col.lot')}
                placeholder={t('tender-authoring.common.wholeTender')}
                value={row.lot}
                options={lotOptions(row)}
                onChange={(lot) => update(row.key, { lot })}
                error={rowError(row, 'lotId')}
              />
            </div>
            <DateTimeInput
              label={t('tender-authoring.timetable.when')}
              required
              value={row.at}
              timeZone={zone}
              onChange={(at) => update(row.key, { at })}
              error={
                rowError(row, 'at') ??
                (submitted && row.at === null ? t('tender-authoring.create.required') : undefined)
              }
            />
            <span className="tiq-inline">
              {row.at !== null && (
                <WorkingDayChip at={row.at} timeZone={zone} holidays={timetable.holidays} />
              )}
              <Checkbox
                label={t('tender-authoring.timetable.disclosed')}
                checked={row.isDisclosed}
                onChange={(isDisclosed) => update(row.key, { isDisclosed })}
              />
              <IconButton
                icon="trash"
                label={t('tender-authoring.timetable.removeMilestone', { n: index + 1 })}
                onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
              />
            </span>
            <TextField
              label={t('tender-authoring.timetable.note')}
              value={row.note}
              onChange={(note) => update(row.key, { note })}
            />
          </fieldset>
        ))}
        <p className="tiq-field-hint">{t('tender-authoring.timetable.orderHint')}</p>
        <span className="tiq-inline">
          <Button
            size="sm"
            icon="plus"
            disabled={allUsed}
            onClick={() =>
              setRows((current) => [
                ...current,
                { key: rowKey('m'), milestone: '', lot: '', at: null, isDisclosed: true, note: '' },
              ])
            }
          >
            {t('tender-authoring.timetable.addMilestone')}
          </Button>
          {allUsed && (
            <span className="tiq-text-muted">
              {t('tender-authoring.timetable.allMilestonesUsed')}
            </span>
          )}
        </span>
        <IssueList issues={liveIssues} label={t('tender-authoring.timetable.liveIssues')} />
        {unmatched.length > 0 && (
          <FormErrorSummary title={t('tender-authoring.plan.fixErrors')} errors={unmatched} />
        )}
        {mutation.error !== null && mutation.error.fieldErrors.length === 0 && (
          <Banner tone="error" title={mutation.error.title}>
            <p>{tenderErrorMessage(mutation.error)}</p>
          </Banner>
        )}
        <span className="tiq-inline">
          <Button
            variant="primary"
            icon="check"
            loading={mutation.pending}
            onClick={() => void save()}
          >
            {t('tender-authoring.common.saveDraft')}
          </Button>
          <Button onClick={onCancel} disabled={mutation.pending}>
            {t('ui.action.cancel')}
          </Button>
        </span>
      </div>
    </Card>
  );
}
