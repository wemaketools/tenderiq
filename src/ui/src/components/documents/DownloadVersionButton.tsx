/**
 * Download of one confirmed document version: asks the API for a short-lived signed URL (the access is recorded
 * server-side) and hands it to the browser. A link the API itself serves (the Stage A prototype copy, which the
 * in-browser mock API answers, DD-50) is fetched through the API transport and saved. Errors surface as a toast with
 * the sanitized message.
 */
import { getDocumentDownloadLink } from '@contracts/documents';

import { fetchApiFile, isApiError, isApiUrl } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import { downloadBlob, downloadFromUrl } from '../../lib/download';
import { t } from '../../lib/i18n';
import { Button } from '../ui/Button';
import { describeError } from '../ui/errors';
import { useToast } from '../ui/toastContext';

export interface DownloadVersionButtonProps {
  readonly documentId: number;
  readonly versionId: number;
  readonly fileName: string;
  readonly label?: string;
}

export function DownloadVersionButton({
  documentId,
  versionId,
  fileName,
  label,
}: DownloadVersionButtonProps) {
  const link = useApiMutation(getDocumentDownloadLink);
  const toast = useToast();
  const download = async (): Promise<void> => {
    try {
      const result = await link.mutate({ params: { documentId, versionId } });
      if (isApiUrl(result.url)) {
        downloadBlob(await fetchApiFile(result.url, getDocumentDownloadLink.id), result.fileName);
      } else {
        downloadFromUrl(result.url, result.fileName);
      }
    } catch (error) {
      toast.show(
        isApiError(error) ? describeError(error) : t('documentWidget.downloadFailed'),
        'error',
      );
    }
  };
  return (
    <Button
      size="sm"
      variant="ghost"
      icon="download"
      loading={link.pending}
      aria-label={
        label === undefined
          ? t('documentWidget.downloadFile', { name: fileName })
          : t('documentWidget.downloadLabelled', { label, name: fileName })
      }
      onClick={() => void download()}
    >
      {label ?? t('documentWidget.download')}
    </Button>
  );
}
