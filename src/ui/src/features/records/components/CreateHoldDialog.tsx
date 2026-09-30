/**
 * Impose a legal or investigation hold (ADM-14, PRD §18.3, BR-40). The hold names its record, scope, authority,
 * reason and review date, and always blocks disposal: from then on no record in scope can be disposed of, even
 * after its ordinary retention period ends. Confirmed with the acting organization and capacity (COM-02).
 */
import { useState } from 'react';

import { HOLDS_BLOCKED_ACTIONS, HOLDS_SUBJECT_TYPE } from '@contracts/enums';
import type { HoldsBlockedActions, HoldsSubjectType } from '@contracts/enums';
import { RECORDS_HOLD_TYPES, recordsEndpoints } from '@contracts/records';
import type {
  HoldDetail,
  RecordSubject,
  RecordSubjectType,
  RecordsHoldType,
} from '@contracts/records';

import { invalidateApiQueries, useApiMutation } from '../../../api/hooks';
import {
  ConfirmActionDialog,
  DateInput,
  MultiSelect,
  RadioGroup,
  TextArea,
  formErrors,
  useToast,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { SubjectPicker } from './SubjectPicker';

const HOLDABLE: readonly RecordSubjectType[] = [
  'tender',
  'lot',
  'contract',
  'qualification_application',
  'record_class',
];

function holdSubjectType(value: RecordSubjectType): HoldsSubjectType | undefined {
  return HOLDS_SUBJECT_TYPE.find((item) => item === value);
}

export interface CreateHoldDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCreated: (hold: HoldDetail) => void;
  /** Tomorrow (YYYY-MM-DD): the earliest review date. */
  readonly minReviewDate: string;
}

export function CreateHoldDialog(props: CreateHoldDialogProps) {
  return props.open ? <CreateHoldForm {...props} /> : null;
}

function CreateHoldForm({
  onClose,
  onCreated,
  minReviewDate,
}: Omit<CreateHoldDialogProps, 'open'>) {
  const toast = useToast();
  const create = useApiMutation(recordsEndpoints.createHold);
  const [subject, setSubject] = useState<RecordSubject | null>(null);
  const [holdType, setHoldType] = useState<RecordsHoldType>('legal_hold');
  const [authorityNote, setAuthorityNote] = useState('');
  const [scopeDescription, setScopeDescription] = useState('');
  const [reviewDate, setReviewDate] = useState('');
  const [blocked, setBlocked] = useState<HoldsBlockedActions[]>(['disposal']);
  const [touched, setTouched] = useState(false);
  const errors = formErrors(create.error, [
    'subjectType',
    'subjectId',
    'holdType',
    'reason',
    'authorityNote',
    'scopeDescription',
    'reviewDate',
    'blockedActions',
  ]);

  const local = {
    subject: subject === null ? t('records.hold.errors.subject') : undefined,
    authority: authorityNote.trim().length < 3 ? t('records.hold.errors.authority') : undefined,
    scope: scopeDescription.trim().length < 3 ? t('records.hold.errors.scope') : undefined,
    reviewDate:
      reviewDate === ''
        ? t('records.hold.errors.reviewDate')
        : reviewDate < minReviewDate
          ? t('records.hold.errors.reviewPast')
          : undefined,
  };
  const valid = Object.values(local).every((value) => value === undefined);
  const codeError =
    create.error?.code === 'REVIEW_DATE_IN_PAST'
      ? t('reports.errors.REVIEW_DATE_IN_PAST')
      : undefined;
  const subjectError =
    create.error?.code === 'HOLD_ALREADY_ACTIVE' || create.error?.code === 'HOLD_SUBJECT_NOT_FOUND'
      ? t(`reports.errors.${create.error.code}`)
      : undefined;

  return (
    <ConfirmActionDialog
      open
      title={t('records.hold.createTitle')}
      scope={
        subject === null
          ? t('records.hold.noSubject')
          : `${subject.reference === null ? '' : `${subject.reference} · `}${subject.label}`
      }
      consequence={t('records.hold.createConsequence')}
      confirmLabel={t('records.hold.createConfirm')}
      tone="danger"
      reason={{
        label: t('records.hold.reason'),
        required: true,
        hint: t('records.hold.reasonHint'),
      }}
      pending={create.pending}
      error={create.error}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        setTouched(true);
        if (!valid || subject === null) return;
        const subjectType = holdSubjectType(subject.subjectType);
        if (subjectType === undefined) return;
        try {
          const hold = await create.mutate({
            body: {
              subjectType,
              subjectId: subject.subjectId,
              holdType,
              reason,
              authorityNote: authorityNote.trim(),
              scopeDescription: scopeDescription.trim(),
              reviewDate,
              blockedActions: blocked,
            },
          });
          invalidateApiQueries('buyer.records.');
          toast.show(t('records.hold.created', { subject: hold.subjectLabel }), 'success');
          onCreated(hold);
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <div className="tiq-form-stack">
        <SubjectPicker
          label={t('records.hold.subject')}
          types={HOLDABLE}
          value={subject}
          onChange={setSubject}
          error={
            (touched ? local.subject : undefined) ?? subjectError ?? errors.forField('subjectId')
          }
        />
        <RadioGroup
          label={t('records.hold.type')}
          required
          inline
          value={holdType}
          onChange={(value) => {
            const next = RECORDS_HOLD_TYPES.find((item) => item === value);
            if (next !== undefined) setHoldType(next);
          }}
          options={RECORDS_HOLD_TYPES.map((value) => ({
            value,
            label: tEnum('holds.hold_type', value),
          }))}
        />
        <TextArea
          label={t('records.hold.authority')}
          hint={t('records.hold.authorityHint')}
          required
          rows={2}
          value={authorityNote}
          onChange={setAuthorityNote}
          error={(touched ? local.authority : undefined) ?? errors.forField('authorityNote')}
        />
        <TextArea
          label={t('records.hold.scope')}
          hint={t('records.hold.scopeHint')}
          required
          rows={2}
          value={scopeDescription}
          onChange={setScopeDescription}
          error={(touched ? local.scope : undefined) ?? errors.forField('scopeDescription')}
        />
        <DateInput
          label={t('records.hold.reviewDate')}
          hint={t('records.hold.reviewDateHint')}
          required
          min={minReviewDate}
          value={reviewDate}
          onChange={setReviewDate}
          error={
            (touched ? local.reviewDate : undefined) ?? codeError ?? errors.forField('reviewDate')
          }
        />
        <MultiSelect
          label={t('records.hold.blocked')}
          hint={t('records.hold.blockedHint')}
          required
          value={blocked}
          options={HOLDS_BLOCKED_ACTIONS.map((value) => ({
            value,
            label: tEnum('holds.blocked_actions', value),
            disabled: value === 'disposal',
          }))}
          onChange={(values) =>
            setBlocked(
              HOLDS_BLOCKED_ACTIONS.filter(
                (value) => value === 'disposal' || values.includes(value),
              ),
            )
          }
          error={errors.forField('blockedActions')}
        />
      </div>
    </ConfirmActionDialog>
  );
}
