/**
 * BUY-13 editors: record a release check for the CURRENT draft revision (a failed or not-applicable check needs a
 * note), and request a correction from a team member for a section (and lot) of the package.
 */
import { useState } from 'react';

import { RELEASE_CHECKS_STATUS } from '@contracts/enums';
import type { ReleaseChecksCheckArea, ReleaseChecksStatus } from '@contracts/enums';
import {
  TENDER_SECTIONS,
  getTenderTeam,
  recordReleaseCheck,
  requestCorrection,
} from '@contracts/tenders';
import type {
  CorrectionRequest,
  LotSummary,
  ReleaseCheckResult,
  TenderSection,
} from '@contracts/tenders';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { RadioGroup, Select, TextArea, formErrors } from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { lotLabel, sectionLabel } from '../lib/labels';
import { FormDialog } from './FormDialog';

export interface CheckDialogProps {
  readonly open: boolean;
  readonly tenderId: number;
  readonly draftRevision: number;
  readonly area: ReleaseChecksCheckArea | null;
  readonly onClose: () => void;
  readonly onSaved: (result: ReleaseCheckResult) => void;
}

export function CheckDialog({
  open,
  tenderId,
  draftRevision,
  area,
  onClose,
  onSaved,
}: CheckDialogProps) {
  const mutation = useApiMutation(recordReleaseCheck);
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const errors = formErrors(mutation.error, ['status', 'note', 'draftRevision']);
  const local = {
    status: status === '' ? t('tender-authoring.create.required') : undefined,
    note:
      status !== '' && status !== 'passed' && note.trim() === ''
        ? t('tender-authoring.release.checkNoteRequired')
        : undefined,
  };
  const close = (): void => {
    mutation.reset();
    setStatus('');
    setNote('');
    setTouched(false);
    onClose();
  };
  const submit = async (): Promise<void> => {
    setTouched(true);
    if (area === null || local.status !== undefined || local.note !== undefined) return;
    try {
      const result = await mutation.mutate({
        params: { tenderId, checkArea: area },
        body: {
          draftRevision,
          status: status as Exclude<ReleaseChecksStatus, 'pending'>,
          ...(note.trim() === '' ? {} : { note: note.trim() }),
        },
      });
      onSaved(result);
      close();
    } catch {
      // Shown in the dialog.
    }
  };
  return (
    <FormDialog
      open={open}
      title={
        area === null
          ? ''
          : t('tender-authoring.release.checkTitle', {
              area: tEnum('release_checks.check_area', area),
            })
      }
      description={t('tender-authoring.release.checkDescription', { revision: draftRevision })}
      submitLabel={t('tender-authoring.release.recordCheck')}
      onSubmit={() => void submit()}
      onClose={close}
      pending={mutation.pending}
      error={mutation.error}
      otherErrors={errors.other}
    >
      <RadioGroup
        label={t('tender-authoring.release.checkResult')}
        required
        value={status}
        onChange={setStatus}
        options={RELEASE_CHECKS_STATUS.filter((value) => value !== 'pending').map((value) => ({
          value,
          label: tEnum('release_checks.status', value),
        }))}
        error={errors.forField('status') ?? (touched ? local.status : undefined)}
      />
      <TextArea
        label={t('tender-authoring.release.checkNote')}
        required={status !== '' && status !== 'passed'}
        value={note}
        onChange={setNote}
        rows={3}
        error={errors.forField('note') ?? (touched ? local.note : undefined)}
      />
    </FormDialog>
  );
}

export interface CorrectionDialogProps {
  readonly open: boolean;
  readonly tenderId: number;
  readonly lots: readonly LotSummary[];
  readonly onClose: () => void;
  readonly onSaved: (result: CorrectionRequest) => void;
}

export function CorrectionDialog({
  open,
  tenderId,
  lots,
  onClose,
  onSaved,
}: CorrectionDialogProps) {
  const mutation = useApiMutation(requestCorrection);
  const team = useApiQuery(getTenderTeam, open ? { params: { tenderId } } : null);
  const [section, setSection] = useState('');
  const [lot, setLot] = useState('');
  const [note, setNote] = useState('');
  const [assignee, setAssignee] = useState('');
  const [touched, setTouched] = useState(false);
  const errors = formErrors(mutation.error, ['section', 'lotId', 'note', 'assigneeUserId']);
  const required = t('tender-authoring.create.required');
  const local = {
    section: section === '' ? required : undefined,
    note: note.trim() === '' ? required : undefined,
    assignee: assignee === '' ? required : undefined,
  };
  const assignees = new Map<number, string>();
  for (const member of team.data?.members ?? []) {
    if (!assignees.has(member.user.userId)) {
      assignees.set(
        member.user.userId,
        `${member.user.fullName} · ${tEnum('tender_team_members.team_role', member.teamRole)}`,
      );
    }
  }
  const close = (): void => {
    mutation.reset();
    setSection('');
    setLot('');
    setNote('');
    setAssignee('');
    setTouched(false);
    onClose();
  };
  const submit = async (): Promise<void> => {
    setTouched(true);
    if (Object.values(local).some((value) => value !== undefined)) return;
    try {
      const result = await mutation.mutate({
        params: { tenderId },
        body: {
          section: section as TenderSection,
          lotId: lot === '' ? null : Number(lot),
          note: note.trim(),
          assigneeUserId: Number(assignee),
        },
      });
      onSaved(result);
      close();
    } catch {
      // Shown in the dialog.
    }
  };
  return (
    <FormDialog
      open={open}
      title={t('tender-authoring.release.correctionTitle')}
      description={t('tender-authoring.release.correctionDescription')}
      submitLabel={t('tender-authoring.release.requestCorrection')}
      onSubmit={() => void submit()}
      onClose={close}
      pending={mutation.pending}
      error={mutation.error}
      otherErrors={errors.other}
    >
      <Select
        label={t('tender-authoring.release.correctionSection')}
        required
        placeholder={t('tender-authoring.common.select')}
        value={section}
        options={TENDER_SECTIONS.map((value) => ({ value, label: sectionLabel(value) }))}
        onChange={setSection}
        error={errors.forField('section') ?? (touched ? local.section : undefined)}
      />
      <Select
        label={t('tender-authoring.requirements.col.lot')}
        placeholder={t('tender-authoring.common.wholeTender')}
        value={lot}
        options={lots.map((row) => ({ value: String(row.id), label: lotLabel(row) }))}
        onChange={setLot}
        error={errors.forField('lotId')}
      />
      <Select
        label={t('tender-authoring.release.assignee')}
        required
        placeholder={
          team.data === undefined
            ? t('tender-authoring.common.loading')
            : t('tender-authoring.common.select')
        }
        value={assignee}
        options={[...assignees.entries()].map(([value, label]) => ({
          value: String(value),
          label,
        }))}
        onChange={setAssignee}
        hint={t('tender-authoring.release.assigneeHint')}
        error={errors.forField('assigneeUserId') ?? (touched ? local.assignee : undefined)}
      />
      <TextArea
        label={t('tender-authoring.release.correctionNote')}
        required
        value={note}
        onChange={setNote}
        rows={3}
        error={errors.forField('note') ?? (touched ? local.note : undefined)}
      />
    </FormDialog>
  );
}
