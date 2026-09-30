/**
 * Downloads the printable official receipt (`supplier.receipts.download`) as a text file.
 */
import { useState } from 'react';

import { downloadReceipt } from '../../../api/bids';
import { isApiError } from '../../../api/client';
import { Button, useToast } from '../../../components/ui';
import { downloadBlob } from '../../../lib/download';
import { t } from '../../../lib/i18n';
import { responseErrorMessage } from '../lib/errors';

export interface ReceiptDownloadButtonProps {
  readonly receiptId: number;
  readonly receiptNo: string;
  readonly size?: 'md' | 'sm';
  readonly variant?: 'secondary' | 'primary' | 'ghost';
}

export function ReceiptDownloadButton({
  receiptId,
  receiptNo,
  size = 'sm',
  variant = 'secondary',
}: ReceiptDownloadButtonProps) {
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const download = async (): Promise<void> => {
    setPending(true);
    try {
      const file = await downloadReceipt({ params: { receiptId } });
      downloadBlob(new Blob([file.content], { type: file.contentType }), file.fileName);
    } catch (caught) {
      toast.show(
        isApiError(caught) ? responseErrorMessage(caught) : t('responses.receipt.downloadFailed'),
        'error',
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      size={size}
      variant={variant}
      icon="download"
      loading={pending}
      onClick={() => void download()}
      aria-label={t('responses.receipt.downloadLabel', { receiptNo })}
    >
      {t('responses.receipt.download')}
    </Button>
  );
}
