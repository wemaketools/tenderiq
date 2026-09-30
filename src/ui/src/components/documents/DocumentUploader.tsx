/**
 * DocumentUploader: adds a document (or a new version of one) to a record with the two-step envelope of the
 * documents contract: create the pending version (title, classification, file name, type, size, SHA-256) → transfer
 * the bytes → confirm with the SHA-256 and size. Buyer and supplier sides use their own endpoints. Field errors from
 * the API bind to the inputs; the prototype skips the byte transfer (see `uploadTransfer.ts`).
 */
import { useState } from 'react';

import {
  ALLOWED_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
  confirmBuyerUpload,
  confirmSupplierUpload,
  createBuyerUpload,
  createSupplierUpload,
} from '@contracts/documents';
import type { ConfirmedUpload } from '@contracts/documents';
import { enumOptions } from '@contracts/enums';
import type { DocumentsClassification, DocumentsRelatedType } from '@contracts/enums';

import { call } from '../../api/client';
import { useAppSelector } from '../../app/hooks';
import { t, tEnum } from '../../lib/i18n';
import { FileUpload } from '../ui/FileUpload';
import { formErrors } from '../ui/formErrors';
import { FormErrorSummary, Select, TextField } from '../ui/FormFields';
import { transferBytes } from './uploadTransfer';

export interface DocumentUploaderProps {
  readonly audience: 'buyer' | 'supplier';
  readonly relatedType: DocumentsRelatedType;
  readonly relatedId: number;
  /** Adds a new version of this document instead of a new document. */
  readonly documentId?: number;
  readonly defaultTitle?: string;
  readonly defaultClassification: DocumentsClassification;
  /** Classifications the user may choose (defaults to all). */
  readonly classifications?: readonly DocumentsClassification[];
  readonly onUploaded?: (result: ConfirmedUpload) => void;
}

const FIELDS = [
  'title',
  'purpose',
  'classification',
  'changeNote',
  'fileName',
  'contentType',
  'sizeBytes',
] as const;

export function DocumentUploader({
  audience,
  relatedType,
  relatedId,
  documentId,
  defaultTitle = '',
  defaultClassification,
  classifications,
  onUploaded,
}: DocumentUploaderProps) {
  const prototype = useAppSelector((state) => state.session.environment?.mode !== 'live');
  const [title, setTitle] = useState(defaultTitle);
  const [purpose, setPurpose] = useState('');
  const [classification, setClassification] =
    useState<DocumentsClassification>(defaultClassification);
  const [changeNote, setChangeNote] = useState('');
  const [error, setError] = useState<unknown>(null);

  const options = enumOptions('documents.classification')
    .filter((option) => classifications === undefined || classifications.includes(option.value))
    .map((option) => ({
      value: option.value,
      label: tEnum('documents.classification', option.value),
    }));
  const errors = formErrors(error, FIELDS);

  const upload = async (
    file: File,
    context: { sha256: string; onProgress: (f: number) => void },
  ): Promise<void> => {
    setError(null);
    const contentType = file.type as (typeof ALLOWED_CONTENT_TYPES)[number];
    const body = {
      relatedType,
      relatedId,
      title: title.trim() === '' ? file.name : title.trim(),
      classification,
      fileName: file.name,
      contentType,
      sizeBytes: file.size,
      sha256: context.sha256,
      ...(documentId === undefined ? {} : { documentId }),
      ...(purpose.trim() === '' ? {} : { purpose: purpose.trim() }),
      ...(changeNote.trim() === '' ? {} : { changeNote: changeNote.trim() }),
    };
    try {
      const envelope =
        audience === 'buyer'
          ? await call(createBuyerUpload, { body })
          : await call(createSupplierUpload, { body });
      if (!prototype) {
        await transferBytes(envelope.upload, file, context.onProgress);
      } else {
        context.onProgress(1);
      }
      const confirmRequest = {
        params: { versionId: envelope.version.id },
        body: { sha256: context.sha256, sizeBytes: file.size },
      };
      const confirmed =
        audience === 'buyer'
          ? await call(confirmBuyerUpload, confirmRequest)
          : await call(confirmSupplierUpload, confirmRequest);
      onUploaded?.(confirmed);
    } catch (caught) {
      setError(caught);
      throw caught;
    }
  };

  return (
    <div className="tiq-form-stack">
      <FormErrorSummary
        title={error !== null && errors.other.length > 0 ? t('documentWidget.upload.failed') : null}
        errors={errors.other}
      />
      <div className="tiq-form-grid">
        {documentId === undefined && (
          <TextField
            label={t('documentWidget.field.title')}
            hint={t('documentWidget.field.titleHint')}
            value={title}
            onChange={setTitle}
            maxLength={300}
            error={errors.forField('title')}
          />
        )}
        <Select
          label={t('documentWidget.field.classification')}
          value={classification}
          onChange={(value) => setClassification(value as DocumentsClassification)}
          options={options}
          required
          error={errors.forField('classification')}
        />
        {documentId === undefined ? (
          <TextField
            label={t('documentWidget.field.purpose')}
            value={purpose}
            onChange={setPurpose}
            maxLength={1000}
            error={errors.forField('purpose')}
            fieldClassName="tiq-form-full"
          />
        ) : (
          <TextField
            label={t('documentWidget.field.changeNote')}
            value={changeNote}
            onChange={setChangeNote}
            maxLength={1000}
            error={errors.forField('changeNote')}
          />
        )}
      </div>
      <FileUpload
        label={
          documentId === undefined
            ? t('documentWidget.upload.file')
            : t('documentWidget.upload.newVersion')
        }
        hint={t('documentWidget.upload.hint')}
        accept={ALLOWED_CONTENT_TYPES}
        maxBytes={MAX_UPLOAD_BYTES}
        onUpload={upload}
      />
    </div>
  );
}
