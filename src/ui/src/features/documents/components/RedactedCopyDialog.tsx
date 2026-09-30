/**
 * Releases an audience-specific disclosure copy of a controlled original (PRD §14.1, COM-07): register the copy with
 * a wider classification and a reason, transfer the redacted file and confirm it. The original keeps its
 * classification and stays distinguishable. The prototype skips the byte transfer (see `uploadTransfer.ts`).
 */
import { useState } from 'react';

import {
  ALLOWED_CONTENT_TYPES,
  AllowedContentType,
  MAX_UPLOAD_BYTES,
  confirmBuyerUpload,
  createRedactedCopy,
} from '@contracts/documents';
import type { DocumentDetail, DocumentRef } from '@contracts/documents';
import type { DocumentsClassification } from '@contracts/enums';

import { ApiError, call } from '../../../api/client';
import { useAppSelector } from '../../../app/hooks';
import { transferBytes } from '../../../components/documents/uploadTransfer';
import {
  Banner,
  Button,
  ConfirmActionDialog,
  Dialog,
  FileUpload,
  Select,
  TextArea,
  TextField,
  formErrors,
  useToast,
} from '../../../components/ui';
import { formatBytes } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { localizeError } from '../../tasks/lib/shared';
import { widerClassifications } from '../lib/documents';

interface ChosenFile {
  readonly file: File;
  readonly sha256: string;
}

export interface RedactedCopyDialogProps {
  readonly original: DocumentDetail;
  readonly onClose: () => void;
  readonly onCreated: (copy: DocumentRef) => void;
}

export function RedactedCopyDialog({ original, onClose, onCreated }: RedactedCopyDialogProps) {
  const prototype = useAppSelector((state) => state.session.environment?.mode !== 'live');
  const toast = useToast();
  const options = widerClassifications(original.classification);
  const [title, setTitle] = useState(original.title);
  const [classification, setClassification] = useState<string>(options[options.length - 1] ?? '');
  const [reason, setReason] = useState('');
  const [chosen, setChosen] = useState<ChosenFile | null>(null);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const errors = formErrors(error, [
    'title',
    'classification',
    'reason',
    'fileName',
    'contentType',
    'sizeBytes',
  ]);

  const check = (): void => {
    const found: Record<string, string> = {};
    if (title.trim() === '') found.title = t('documents.redact.titleRequired');
    if (reason.trim() === '') found.reason = t('documents.redact.reasonRequired');
    if (chosen === null) found.file = t('documents.redact.fileRequired');
    setProblems(found);
    if (Object.keys(found).length === 0) setConfirming(true);
  };

  const submit = async (): Promise<void> => {
    if (chosen === null) return;
    const contentType = AllowedContentType.safeParse(chosen.file.type);
    if (!contentType.success) {
      setConfirming(false);
      setProblems({ file: t('ui.upload.typeNotAllowed') });
      return;
    }
    setPending(true);
    setError(null);
    try {
      const envelope = await call(createRedactedCopy, {
        params: { documentId: original.id },
        body: {
          title: title.trim(),
          classification: classification as DocumentsClassification,
          reason: reason.trim(),
          fileName: chosen.file.name,
          contentType: contentType.data,
          sizeBytes: chosen.file.size,
          sha256: chosen.sha256,
        },
      });
      if (!prototype) {
        await transferBytes(envelope.upload, chosen.file, () => undefined);
      }
      const confirmed = await call(confirmBuyerUpload, {
        params: { versionId: envelope.version.id },
        body: { sha256: chosen.sha256, sizeBytes: chosen.file.size },
      });
      toast.show(t('documents.redact.done'), 'success');
      onCreated({
        documentId: confirmed.document.id,
        title: confirmed.document.title,
        classification: confirmed.document.classification,
        status: confirmed.document.status,
      });
    } catch (caught) {
      setConfirming(false);
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError({
              kind: 'network',
              status: 0,
              title: caught instanceof Error ? caught.message : t('tasks.errors.unexpected'),
              endpointId: createRedactedCopy.id,
            }),
      );
    } finally {
      setPending(false);
    }
  };

  const localized = localizeError(error, 'documents');
  return (
    <>
      <Dialog
        open={!confirming}
        size="lg"
        title={t('documents.redact.title')}
        description={t('documents.redact.intro')}
        onClose={onClose}
        footer={
          <>
            <Button onClick={onClose}>{t('ui.action.cancel')}</Button>
            <Button variant="primary" icon="eyeOff" onClick={check}>
              {t('documents.redact.submit')}
            </Button>
          </>
        }
      >
        <div className="tiq-form-stack">
          {localized !== null && localized.fieldErrors.length === 0 && (
            <Banner tone="error" title={localized.title}>
              {localized.detail}
            </Banner>
          )}
          <TextField
            label={t('documents.redact.copyTitle')}
            required
            value={title}
            onChange={setTitle}
            error={problems.title ?? errors.forField('title')}
          />
          <Select
            label={t('documents.redact.classification')}
            hint={t('documents.redact.classificationHint')}
            required
            value={classification}
            options={options.map((value) => ({
              value,
              label: tEnum('documents.classification', value),
            }))}
            onChange={setClassification}
            error={errors.forField('classification')}
          />
          <TextArea
            label={t('documents.redact.reason')}
            required
            rows={3}
            value={reason}
            onChange={setReason}
            error={problems.reason ?? errors.forField('reason')}
          />
          <FileUpload
            label={t('documents.redact.file')}
            accept={ALLOWED_CONTENT_TYPES}
            maxBytes={MAX_UPLOAD_BYTES}
            onUpload={(file, context) => {
              setChosen({ file, sha256: context.sha256 });
              context.onProgress(1);
              return Promise.resolve();
            }}
          />
          {chosen !== null && (
            <p className="tiq-text-muted">
              {t('documents.redact.fileChosen', {
                name: chosen.file.name,
                size: formatBytes(chosen.file.size),
              })}
            </p>
          )}
          {(problems.file ?? errors.forField('fileName') ?? errors.forField('sizeBytes')) !==
            undefined && (
            <p className="tiq-field-error">
              {problems.file ?? errors.forField('fileName') ?? errors.forField('sizeBytes')}
            </p>
          )}
        </div>
      </Dialog>
      <ConfirmActionDialog
        open={confirming}
        title={t('documents.redact.confirmTitle')}
        scope={t('documents.redact.confirmScope', {
          title: title.trim(),
          original: original.title,
        })}
        consequence={t('documents.redact.confirmConsequence')}
        confirmLabel={t('documents.redact.submit')}
        pending={pending}
        error={localized}
        onCancel={() => setConfirming(false)}
        onConfirm={submit}
      />
    </>
  );
}
