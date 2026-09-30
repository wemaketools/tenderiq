/**
 * Controlled report export (REP-01, ADM-13, DD-16): the user states the purpose and the format, confirms the acting
 * organization, capacity and scope (COM-02), and the API produces an export with a manifest (contents, versions,
 * omissions, redactions) over the records the user may read. A ready text export is handed to the browser at once;
 * otherwise it stays in the export history until it is ready.
 */
import { useState } from 'react';

import { EXPORTS_FORMAT } from '@contracts/enums';
import type { CreateReportExportBody } from '@contracts/reporting';
import { reportingEndpoints } from '@contracts/reporting';

import { invalidateApiQueries, useApiMutation } from '../../../api/hooks';
import { call } from '../../../api/client';
import { saveExportDownload } from '../../../api/reporting';
import { ConfirmActionDialog, RadioGroup, useToast } from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { asApiError, businessErrorMessage } from '../lib/errors';

export type ExportFormat = (typeof EXPORTS_FORMAT)[number];

export interface ExportDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly source: CreateReportExportBody['source'];
  /** What is exported, for example "Competition and participation, 1 Jan – 30 Sep 2026". */
  readonly scopeLabel: string;
  readonly defaultFormat?: ExportFormat;
  /** Called with the new export id after it was created. */
  readonly onCreated?: (exportId: number) => void;
}

export function ExportDialog(props: ExportDialogProps) {
  return props.open ? <ExportForm {...props} /> : null;
}

function ExportForm({
  onClose,
  source,
  scopeLabel,
  defaultFormat = 'csv',
  onCreated,
}: Omit<ExportDialogProps, 'open'>) {
  const toast = useToast();
  const create = useApiMutation(reportingEndpoints.createReportExport);
  const [format, setFormat] = useState<ExportFormat>(defaultFormat);
  const [downloading, setDownloading] = useState(false);

  const confirm = async ({ reason }: { readonly reason: string }): Promise<void> => {
    try {
      const record = await create.mutate({ body: { source, format, purpose: reason } });
      invalidateApiQueries('buyer.exports.');
      onCreated?.(record.id);
      if (record.status === 'ready') {
        setDownloading(true);
        try {
          const download = await call(reportingEndpoints.downloadExport, {
            params: { exportId: record.id },
          });
          saveExportDownload(download);
          toast.show(t('reports.export.downloaded', { file: download.fileName }), 'success');
        } catch (error) {
          const apiError = asApiError(error);
          toast.show(
            apiError === null ? t('reports.export.downloadFailed') : businessErrorMessage(apiError),
            'error',
          );
        } finally {
          setDownloading(false);
        }
      } else {
        toast.show(
          t('reports.export.queued', { status: tEnum('exports.status', record.status) }),
          'info',
        );
      }
      onClose();
    } catch {
      // The failure is shown in the dialog.
    }
  };

  return (
    <ConfirmActionDialog
      open
      title={t('reports.export.title')}
      scope={scopeLabel}
      consequence={t('reports.export.consequence')}
      confirmLabel={t('reports.export.confirm')}
      reason={{
        label: t('reports.export.purpose'),
        required: true,
        hint: t('reports.export.purposeHint'),
      }}
      pending={create.pending || downloading}
      error={create.error}
      onCancel={() => {
        create.reset();
        onClose();
      }}
      onConfirm={confirm}
    >
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
    </ConfirmActionDialog>
  );
}
