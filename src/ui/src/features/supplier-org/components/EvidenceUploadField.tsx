/**
 * The document behind an evidence edition or an identity change: uploads through the shared DocumentUploader
 * (create → transfer → confirm) and reports the confirmed document. Once uploaded, the file can be replaced by
 * uploading another one before the form is sent.
 */
import type { ConfirmedUpload } from '@contracts/documents';

import { DocumentUploader } from '../../../components/documents';
import { Banner, Button } from '../../../components/ui';
import { t } from '../../../lib/i18n';

export interface UploadedDocument {
  readonly documentId: number;
  readonly fileName: string;
}

export interface EvidenceUploadFieldProps {
  readonly relatedType: 'supplier_profile' | 'evidence_item';
  readonly relatedId: number;
  readonly title: string;
  readonly value: UploadedDocument | null;
  readonly onChange: (value: UploadedDocument | null) => void;
  readonly error?: string;
}

export function EvidenceUploadField({
  relatedType,
  relatedId,
  title,
  value,
  onChange,
  error,
}: EvidenceUploadFieldProps) {
  if (value !== null) {
    return (
      <Banner
        tone="success"
        title={t('supplier-org.upload.attached')}
        actions={
          <Button size="sm" onClick={() => onChange(null)}>
            {t('supplier-org.upload.replaceFile')}
          </Button>
        }
      >
        <p>{value.fileName}</p>
      </Banner>
    );
  }
  return (
    <div className="tiq-stack">
      <DocumentUploader
        audience="supplier"
        relatedType={relatedType}
        relatedId={relatedId}
        defaultTitle={title}
        defaultClassification="supplier_private"
        classifications={['supplier_private', 'commercially_confidential']}
        onUploaded={(result: ConfirmedUpload) =>
          onChange({ documentId: result.document.id, fileName: result.version.fileName })
        }
      />
      {error !== undefined && (
        <p className="tiq-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
