/** Export helpers (ADM-13): the export detail path and the audited download of a ready export. */
import { useState } from 'react';

import { reportingEndpoints } from '@contracts/reporting';

import { call } from '../../../api/client';
import { saveExportDownload } from '../../../api/reporting';
import { useToast } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { asApiError, businessErrorMessage } from './errors';

/** Downloads a ready export and hands it to the browser, reporting failures in a toast. */
export function useExportDownload(): {
  readonly download: (exportId: number) => Promise<void>;
  readonly pendingId: number | null;
} {
  const toast = useToast();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const download = async (exportId: number): Promise<void> => {
    setPendingId(exportId);
    try {
      const result = await call(reportingEndpoints.downloadExport, {
        params: { exportId },
      });
      saveExportDownload(result);
      toast.show(t('reports.export.downloaded', { file: result.fileName }), 'success');
    } catch (error) {
      const apiError = asApiError(error);
      toast.show(
        apiError === null ? t('reports.export.downloadFailed') : businessErrorMessage(apiError),
        'error',
      );
    } finally {
      setPendingId(null);
    }
  };
  return { download, pendingId };
}

export function exportPath(id: number): string {
  return `/buyer/admin/reports/exports/${id}`;
}
