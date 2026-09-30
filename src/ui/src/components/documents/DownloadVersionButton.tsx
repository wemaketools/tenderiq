/**
 * Download of one confirmed document version: asks the API for a short-lived signed URL (the access is recorded
 * server-side) and hands it to the browser. Errors surface as a toast with the sanitized message.
 */
import { getDocumentDownloadLink } from '@contracts/documents';

import { isApiError } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import { downloadFromUrl } from '../../lib/download';
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
      downloadFromUrl(result.url, result.fileName);
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
      aria-label={t('documentWidget.downloadFile', { name: fileName })}
      onClick={() => void download()}
    >
      {label ?? t('documentWidget.download')}
    </Button>
  );
}
