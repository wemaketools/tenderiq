/**
 * A data-entry dialog (record an incident, add an obligation, record an invoice…): a form with Cancel / Save, the
 * business failure as a banner and unmatched field errors in the summary. Consequential decisions use
 * ConfirmActionDialog instead (COM-02).
 */
import { useId } from 'react';
import type { FormEvent, ReactNode } from 'react';

import type { FieldError } from '@contracts/common';

import type { ApiError } from '../../../api/client';
import { Banner, Button, Dialog, FormErrorSummary } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { contractErrorMessage } from '../lib/errors';

export interface FormDialogProps {
  readonly open: boolean;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly submitLabel: string;
  readonly onSubmit: () => void;
  readonly onClose: () => void;
  readonly pending: boolean;
  /** A failure without field errors (business rule, permission, conflict). */
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
      {otherErrors.length > 0 && <FormErrorSummary errors={otherErrors} />}
      {error !== null && (
        <Banner tone="error" title={error.title}>
          <p>{contractErrorMessage(error)}</p>
        </Banner>
      )}
    </Dialog>
  );
}
