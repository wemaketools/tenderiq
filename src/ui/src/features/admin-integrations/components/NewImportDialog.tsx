/**
 * ADM-16 new import: upload the source file (CSV or XLSX, through the documents contract), name its origin and the
 * kind of record it proposes, and describe its provenance. Nothing is created until a reviewer accepts each row.
 */
import { useState } from 'react';

import type { ConfirmedUpload } from '@contracts/documents';
import { IMPORT_BATCHES_RECORD_TYPE, enumLabel } from '@contracts/enums';
import { CreateImportBatchBody, operationsEndpoints } from '@contracts/operations';
import type { ImportBatchDetail } from '@contracts/operations';

import { useApiMutation } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { DocumentUploader } from '../../../components/documents';
import {
  Banner,
  Button,
  Dialog,
  Select,
  TextArea,
  TextField,
  UnsavedChangesGuard,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { useValidatedForm } from '../../ops/lib/forms';
import { ActionError } from '../../ops/components/ActionError';

const FIELDS = ['origin', 'recordType', 'documentId', 'sourceFileName', 'provenanceNote'] as const;

export function NewImportDialog({
  onClose,
  onCreated,
}: {
  readonly onClose: () => void;
  readonly onCreated: (batch: ImportBatchDetail) => void;
}) {
  const tenant = useActiveTenant();
  const [origin, setOrigin] = useState('');
  const [recordType, setRecordType] = useState('');
  const [provenance, setProvenance] = useState('');
  const [upload, setUpload] = useState<ConfirmedUpload | null>(null);
  const create = useApiMutation(operationsEndpoints.createImportBatch);
  const body = {
    origin,
    recordType: recordType === '' ? undefined : recordType,
    documentId: upload?.document.id,
    sourceFileName: upload?.version.fileName ?? '',
    provenanceNote: provenance,
  };
  const form = useValidatedForm(CreateImportBatchBody, body, create.error, FIELDS);
  const dirty = origin !== '' || recordType !== '' || provenance !== '' || upload !== null;

  const submit = async (): Promise<void> => {
    const parsed = form.check();
    if (parsed === null) return;
    try {
      onCreated(await create.mutate({ body: parsed }));
    } catch {
      // Shown by ActionError.
    }
  };

  return (
    <Dialog
      open
      size="lg"
      title={t('admin-integrations.imports.new.title')}
      description={t('admin-integrations.imports.new.description')}
      onClose={onClose}
      dismissible={!create.pending}
      footer={
        <>
          <Button onClick={onClose} disabled={create.pending}>
            {t('ops.common.cancel')}
          </Button>
          <Button variant="primary" loading={create.pending} onClick={() => void submit()}>
            {t('admin-integrations.imports.new.submit')}
          </Button>
        </>
      }
    >
      <UnsavedChangesGuard when={dirty && !create.pending} />
      <div className="tiq-form-grid">
        <TextField
          label={t('admin-integrations.imports.col.origin')}
          hint={t('admin-integrations.imports.new.originHint')}
          required
          value={origin}
          onChange={setOrigin}
          error={form.errorFor('origin')}
        />
        <Select
          label={t('admin-integrations.imports.col.recordType')}
          required
          placeholder={t('ops.common.choose')}
          value={recordType}
          onChange={setRecordType}
          options={IMPORT_BATCHES_RECORD_TYPE.map((value) => ({
            value,
            label: enumLabel('import_batches.record_type', value),
          }))}
          error={form.errorFor('recordType')}
        />
        <TextArea
          fieldClassName="tiq-form-full"
          label={t('admin-integrations.imports.new.provenance')}
          hint={t('admin-integrations.imports.new.provenanceHint')}
          required
          rows={3}
          value={provenance}
          onChange={setProvenance}
          error={form.errorFor('provenanceNote')}
        />
      </div>
      {upload === null ? (
        <>
          <DocumentUploader
            audience="buyer"
            relatedType="import_batch"
            relatedId={tenant?.tenantId ?? 0}
            defaultTitle={t('admin-integrations.imports.new.fileTitle')}
            defaultClassification="buyer_internal"
            classifications={['buyer_internal']}
            onUploaded={setUpload}
          />
          {(form.errorFor('documentId') !== undefined ||
            form.errorFor('sourceFileName') !== undefined) && (
            <p className="tiq-field-error">{t('admin-integrations.imports.new.fileRequired')}</p>
          )}
        </>
      ) : (
        <Banner
          tone="success"
          title={t('admin-integrations.imports.new.uploaded')}
          actions={
            <Button size="sm" onClick={() => setUpload(null)}>
              {t('admin-integrations.imports.new.replace')}
            </Button>
          }
        >
          <p className="tiq-mono">{upload.version.fileName}</p>
        </Banner>
      )}
      <ActionError error={create.error} fields={FIELDS} />
    </Dialog>
  );
}
