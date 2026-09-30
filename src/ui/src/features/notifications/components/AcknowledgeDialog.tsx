/**
 * Acknowledging a notice (COM-06, BR-41): a separate, recorded act from reading it. When the notice carries terms,
 * accepting them is offered as an additional, explicit choice. Runs in the notice's organization (DD-21); a formal
 * supplier notice needs `supplier.notices.acknowledge` there (DD-23), which the service enforces.
 */
import { useState } from 'react';

import { acknowledgeNotification } from '@contracts/notifications';
import type { NotificationItem } from '@contracts/notifications';

import { useApiMutation } from '../../../api/hooks';
import { Checkbox, ConfirmActionDialog, useToast } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { localizeError, useRowOrganization } from '../../tasks/lib/shared';

export interface AcknowledgeDialogProps {
  readonly notification: NotificationItem;
  readonly onClose: () => void;
  readonly onDone: (result: NotificationItem) => void;
}

export function AcknowledgeDialog({ notification, onClose, onDone }: AcknowledgeDialogProps) {
  const rowOrganization = useRowOrganization();
  const acknowledge = useApiMutation(acknowledgeNotification);
  const toast = useToast();
  const hasTerms = notification.hasTerms === true;
  const [acceptTerms, setAcceptTerms] = useState(false);

  return (
    <ConfirmActionDialog
      open
      title={t('notifications.ack.title')}
      scope={t('notifications.ack.scope', { title: notification.title })}
      consequence={
        hasTerms && acceptTerms
          ? t('notifications.ack.consequenceTerms')
          : t('notifications.ack.consequence')
      }
      confirmLabel={t('notifications.ack.confirm')}
      organization={rowOrganization(notification.organization)}
      pending={acknowledge.pending}
      error={localizeError(acknowledge.error, 'notifications')}
      onCancel={onClose}
      onConfirm={async () => {
        const result = await acknowledge
          .mutate(
            {
              params: { notificationId: notification.id },
              body: { acceptTerms: hasTerms && acceptTerms },
            },
            { tenantId: notification.organization.tenantId },
          )
          .catch(() => null);
        if (result !== null) {
          toast.show(
            hasTerms && acceptTerms
              ? t('notifications.ack.doneTerms')
              : t('notifications.ack.done'),
            'success',
          );
          onDone(result);
        }
      }}
    >
      {hasTerms && (
        <Checkbox
          label={t('notifications.ack.acceptTerms')}
          hint={t('notifications.ack.acceptTermsHint')}
          checked={acceptTerms}
          onChange={setAcceptTerms}
        />
      )}
    </ConfirmActionDialog>
  );
}
