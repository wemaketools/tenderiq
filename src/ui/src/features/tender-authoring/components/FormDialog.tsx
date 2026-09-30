/**
 * A data-entry dialog (add a lot, edit a requirement, add a pricing item…): a form with Cancel / Save, the business
 * failure as a banner and unmatched field errors in the summary. Saving records a DRAFT change; it never submits or
 * approves anything. Consequential decisions use ConfirmActionDialog instead (COM-02).
 */
import { useId } from 'react';
import type { FormEvent, ReactNode } from 'react';

import type { FieldError } from '@contracts/common';

import type { ApiError } from '../../../api/client';
import { Banner, Button, Dialog, FormErrorSummary } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { tenderErrorMessage } from '../lib/errors';

export interface FormDialogProps {
  readonly open: boolean;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly submitLabel: string;
  readonly onSubmit: () => void;
  readonly onClose: () => void;
  readonly pending: boolean;
  /** The failed request (field errors are bound by the caller; the rest shows here). */
  readonly error: ApiError | null;
  /** Field errors that match no input. */
  readonly otherErrors?: readonly FieldError[];
  readonly size?: 'sm' | 'md' | 'lg';
  readonly children: ReactNode;
}

export function FormDialog({
  open,
  title,
  description,
  submitLabel,
  onSubmit,
  onClose,
  pending,
  error,
  otherErrors = [],
  size = 'md',
  children,
}: FormDialogProps) {
  const formId = useId();
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onSubmit();
  };
  const showBanner = error !== null && error.fieldErrors.length === 0;
  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      dismissible={!pending}
      size={size}
      footer={
        <>
          <Button onClick={onClose} disabled={pending}>
            {t('ui.action.cancel')}
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={pending}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} className="tiq-form-stack" onSubmit={submit} noValidate>
        {children}
      </form>
      {otherErrors.length > 0 && (
        <FormErrorSummary title={error?.title ?? null} errors={otherErrors} />
      )}
      {showBanner && (
        <Banner tone="error" title={error.title}>
          <p>{tenderErrorMessage(error)}</p>
        </Banner>
      )}
    </Dialog>
  );
}
