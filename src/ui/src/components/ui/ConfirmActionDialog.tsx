/**
 * ConfirmActionDialog (COM-02, architecture-plan §7): every consequential action (submit, approve, publish, sign,
 * open, award…) is confirmed in a dialog that states the ACTING ORGANIZATION, the CAPACITY, the SCOPE and the RESULT.
 * The organization and capacity default to the active membership; a `/me` row action passes the row's organization.
 *
 * The confirm button is disabled while the request runs (DD-39). A failure is shown inside the dialog, with field
 * errors bound to the reason input.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';

import { useAppSelector } from '../../app/hooks';
import type { ApiError } from '../../api/client';
import { t } from '../../lib/i18n';
import { Banner } from './Banner';
import { Button } from './Button';
import { DetailList } from './DetailList';
import { Dialog } from './Dialog';
import { describeError } from './errors';
import { formErrors } from './formErrors';
import { Checkbox, FormErrorSummary, TextArea } from './FormFields';

export interface ConfirmActionDialogProps {
  readonly open: boolean;
  readonly title: ReactNode;
  /** What the action covers, for example "T-2026-0003 SCADA telemetry upgrade, all lots". */
  readonly scope: ReactNode;
  /** What happens, for example "The response is submitted and an official receipt is issued." */
  readonly consequence: ReactNode;
  readonly confirmLabel: string;
  readonly onConfirm: (input: { readonly reason: string }) => void | Promise<void>;
  readonly onCancel: () => void;
  /** Destructive actions use the danger button. */
  readonly tone?: 'primary' | 'danger';
  /** Overrides the acting organization (for `/me` row actions, DD-21). */
  readonly organization?: { readonly name: string; readonly capacity: string | null };
  /** Asks for a reason (required when `reasonRequired`). The contract field name is `reason`. */
  readonly reason?: { readonly label: string; readonly required: boolean; readonly hint?: string };
  /** A statement the user must tick before confirming (for example an irrevocable action). */
  readonly acknowledgement?: string;
  readonly pending?: boolean;
  readonly error?: ApiError | null;
  /** Extra content, such as a readiness summary. */
  readonly children?: ReactNode;
}

export function ConfirmActionDialog({
  open,
  title,
  scope,
  consequence,
  confirmLabel,
  onConfirm,
  onCancel,
  tone = 'primary',
  organization,
  reason,
  acknowledgement,
  pending = false,
  error = null,
  children,
}: ConfirmActionDialogProps) {
  const activeTenant = useAppSelector((state) => state.session.activeTenant);
  const [reasonText, setReasonText] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  const orgName = organization?.name ?? activeTenant?.name ?? t('ui.confirm.noOrganization');
  const capacity =
    organization !== undefined ? organization.capacity : (activeTenant?.capacity ?? null);
  const errors = formErrors(error, ['reason']);
  const reasonMissing = reason?.required === true && reasonText.trim() === '';
  const blocked = reasonMissing || (acknowledgement !== undefined && !acknowledged);

  const close = (): void => {
    setReasonText('');
    setAcknowledged(false);
    onCancel();
  };

  return (
    <Dialog
      open={open}
      title={title}
      onClose={close}
      dismissible={!pending}
      footer={
        <>
          <Button onClick={close} disabled={pending}>
            {t('ui.action.cancel')}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            loading={pending}
            disabled={blocked}
            onClick={() => {
              void onConfirm({ reason: reasonText.trim() });
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="tiq-consequence" data-testid="confirm-context">
        <DetailList
          items={[
            { key: 'org', label: t('ui.confirm.organization'), value: orgName },
            { key: 'capacity', label: t('ui.confirm.capacity'), value: capacity },
            { key: 'scope', label: t('ui.confirm.scope'), value: scope },
            { key: 'result', label: t('ui.confirm.result'), value: consequence },
          ]}
          stacked
        />
      </div>
      {children}
      {reason !== undefined && (
        <TextArea
          label={reason.label}
          hint={reason.hint}
          required={reason.required}
          value={reasonText}
          onChange={setReasonText}
          error={errors.forField('reason')}
          rows={3}
        />
      )}
      {acknowledgement !== undefined && (
        <Checkbox label={acknowledgement} checked={acknowledged} onChange={setAcknowledged} />
      )}
      {error !== null && error.fieldErrors.length === 0 && (
        <Banner tone="error" title={error.title}>
          <p>{describeError(error)}</p>
          {error.correlationId !== null && (
            <p className="tiq-mono">{t('ui.error.correlation', { id: error.correlationId })}</p>
          )}
        </Banner>
      )}
      {error !== null && error.fieldErrors.length > 0 && (
        <FormErrorSummary title={error.title} errors={errors.other} />
      )}
    </Dialog>
  );
}
