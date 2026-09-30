/**
 * Submit obligation or milestone evidence (CON-05, CON-06, SUP-23): the file is uploaded through the shared document
 * widget (related to the obligation), then submitted with a note. Submission never means acceptance: the buyer
 * decides the evidence separately, and payment readiness is never implied (AC-30).
 */
import { useState } from 'react';

import type { ConfirmedUpload } from '@contracts/documents';

import type { ApiError } from '../../../api/client';
import { Banner, ConfirmActionDialog, TextArea } from '../../../components/ui';
import { DocumentUploader } from '../../../components/documents';
import { t } from '../../../lib/i18n';
import { splitCommandError } from '../lib/errors';

export interface EvidenceDialogProps {
  readonly open: boolean;
  readonly audience: 'buyer' | 'supplier';
  readonly obligation: { readonly id: number; readonly title: string };
  readonly contractReference: string;
  readonly onSubmit: (input: { documentVersionId: number; note?: string }) => Promise<boolean>;
  readonly onClose: () => void;
  readonly pending: boolean;
  readonly error: ApiError | null;
}

export function EvidenceDialog({
  open,
  audience,
  obligation,
  contractReference,
  onSubmit,
  onClose,
  pending,
  error,
}: EvidenceDialogProps) {
  const [uploaded, setUploaded] = useState<ConfirmedUpload | null>(null);
  const [note, setNote] = useState('');
  const [missing, setMissing] = useState(false);
  const { dialogError, fieldErrors } = splitCommandError(error, ['documentVersionId', 'note']);

  const close = (): void => {
    setUploaded(null);
    setNote('');
    setMissing(false);
    onClose();
  };

  const confirm = async (): Promise<void> => {
    if (uploaded === null) {
      setMissing(true);
      return;
    }
    const trimmed = note.trim();
    const done = await onSubmit(
      trimmed === ''
        ? { documentVersionId: uploaded.version.id }
        : { documentVersionId: uploaded.version.id, note: trimmed },
    );
    if (done) close();
  };

  return (
    <ConfirmActionDialog
      open={open}
      title={t('contracts.evidence.title')}
      scope={`${contractReference} · ${obligation.title}`}
      consequence={t('contracts.evidence.consequence')}
      confirmLabel={t('contracts.evidence.submit')}
      onConfirm={confirm}
      onCancel={close}
      pending={pending}
      error={dialogError}
    >
      {uploaded === null ? (
        <DocumentUploader
          audience={audience}
          relatedType="obligation"
          relatedId={obligation.id}
          defaultTitle={t('contracts.evidence.defaultTitle', { title: obligation.title })}
          defaultClassification={
            audience === 'buyer' ? 'buyer_internal' : 'commercially_confidential'
          }
          classifications={
            audience === 'buyer'
              ? ['buyer_internal', 'participating_suppliers']
              : ['commercially_confidential', 'supplier_private']
          }
          onUploaded={(result) => {
            setUploaded(result);
            setMissing(false);
          }}
        />
      ) : (
        <Banner tone="success" title={t('contracts.evidence.uploaded')}>
          {t('contracts.evidence.uploadedDetail', {
            file: uploaded.version.fileName,
            version: uploaded.version.versionNo,
          })}
        </Banner>
      )}
      {(missing || fieldErrors.forField('documentVersionId') !== undefined) && (
        <p className="tiq-field-error" role="alert">
          {fieldErrors.forField('documentVersionId') ?? t('contracts.evidence.missing')}
        </p>
      )}
      <TextArea
        label={t('contracts.evidence.note')}
        value={note}
        onChange={setNote}
        rows={3}
        error={fieldErrors.forField('note')}
      />
    </ConfirmActionDialog>
  );
}
