/**
 * Authorize an evidence pack (ADM-14, PRD §18.2, DD-16): a controlled export of one record with its decision
 * history. Sealed content before its opening is never included (the manifest lists the omission); restricted audit
 * rows are included as metadata only and only by auditors (DD-31); the option is not offered to anyone else (DD-49).
 */
import { useState } from 'react';

import { EXPORTS_FORMAT } from '@contracts/enums';
import { EVIDENCE_PACK_SUBJECT_TYPES, recordsEndpoints } from '@contracts/records';
import type { RecordSubject, RecordSubjectType } from '@contracts/records';
import type { ExportRecord } from '@contracts/reporting';

import { invalidateApiQueries, useApiMutation } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Checkbox,
  ConfirmActionDialog,
  RadioGroup,
  formErrors,
  useToast,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { SubjectPicker } from './SubjectPicker';

const PACKABLE: readonly RecordSubjectType[] = EVIDENCE_PACK_SUBJECT_TYPES;

export interface EvidencePackDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCreated: (pack: ExportRecord) => void;
}

export function EvidencePackDialog(props: EvidencePackDialogProps) {
  return props.open ? <EvidencePackForm {...props} /> : null;
}

function EvidencePackForm({ onClose, onCreated }: Omit<EvidencePackDialogProps, 'open'>) {
  const toast = useToast();
  const canAudit = usePermission('audit.view');
  const create = useApiMutation(recordsEndpoints.createEvidencePack);
  const [subject, setSubject] = useState<RecordSubject | null>(null);
  const [includeAuditTrail, setIncludeAuditTrail] = useState(true);
  const [includeRestricted, setIncludeRestricted] = useState(false);
  const [format, setFormat] = useState<(typeof EXPORTS_FORMAT)[number]>('html');
  const [touched, setTouched] = useState(false);
  const errors = formErrors(create.error, [
    'subjectType',
    'subjectId',
    'purpose',
    'includeRestrictedMetadata',
    'format',
  ]);

  return (
    <ConfirmActionDialog
      open
      title={t('records.packs.createTitle')}
      scope={
        subject === null
          ? t('records.packs.noSubject')
          : `${subject.reference === null ? '' : `${subject.reference} · `}${subject.label}`
      }
      consequence={t('records.packs.createConsequence')}
      confirmLabel={t('records.packs.createConfirm')}
      reason={{
        label: t('records.packs.purpose'),
        required: true,
        hint: t('records.packs.purposeHint'),
      }}
      pending={create.pending}
      error={create.error}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        setTouched(true);
        if (subject === null) return;
        const subjectType = EVIDENCE_PACK_SUBJECT_TYPES.find(
          (item) => item === subject.subjectType,
        );
        if (subjectType === undefined) return;
        try {
          const pack = await create.mutate({
            body: {
              subjectType,
              subjectId: subject.subjectId,
              purpose: reason,
              includeAuditTrail,
              includeRestrictedMetadata: canAudit && includeAuditTrail && includeRestricted,
              format,
            },
          });
          invalidateApiQueries('buyer.records.');
          invalidateApiQueries('buyer.exports.');
          toast.show(t('records.packs.created', { subject: subject.label }), 'success');
          onCreated(pack);
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <div className="tiq-form-stack">
        <SubjectPicker
          label={t('records.packs.subject')}
          types={PACKABLE}
          value={subject}
          onChange={setSubject}
          error={
            (touched && subject === null ? t('records.packs.subjectRequired') : undefined) ??
            (create.error?.code === 'EVIDENCE_SUBJECT_NOT_FOUND'
              ? t('reports.errors.EVIDENCE_SUBJECT_NOT_FOUND')
              : errors.forField('subjectId'))
          }
        />
        <Checkbox
          label={t('records.packs.includeAudit')}
          hint={t('records.packs.includeAuditHint')}
          checked={includeAuditTrail}
          onChange={setIncludeAuditTrail}
        />
        {canAudit && (
          <Checkbox
            label={t('records.packs.includeRestricted')}
            hint={t('records.packs.includeRestrictedHint')}
            checked={includeRestricted && includeAuditTrail}
            disabled={!includeAuditTrail}
            onChange={setIncludeRestricted}
            error={
              create.error?.code === 'RESTRICTED_METADATA_REQUIRES_AUDIT_VIEW'
                ? t('reports.errors.RESTRICTED_METADATA_REQUIRES_AUDIT_VIEW')
                : errors.forField('includeRestrictedMetadata')
            }
          />
        )}
        <RadioGroup
          label={t('reports.export.format')}
          inline
          value={format}
          onChange={(value) => {
            const next = EXPORTS_FORMAT.find((item) => item === value);
            if (next !== undefined) setFormat(next);
          }}
          options={EXPORTS_FORMAT.map((value) => ({
            value,
            label: t(`reports.export.formats.${value}`),
          }))}
        />
        <p className="tiq-text-muted">{t('records.packs.sealedNote')}</p>
      </div>
    </ConfirmActionDialog>
  );
}
