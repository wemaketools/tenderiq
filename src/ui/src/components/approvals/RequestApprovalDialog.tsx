/**
 * RequestApprovalDialog (COM-05 mechanics, BR-06, BR-10, AC-05, AC-06): requests approval of ONE exact version of a
 * subject (`subjectVersion` + `contentHash`). It shows the acting organization, capacity, scope and result
 * (COM-02), and, when an amount is given, the authority hint: who can approve it and whether the usual first level
 * is skipped for lack of authority (AC-05). The request is idempotent (DD-39); the submit button is disabled while
 * it runs, and field errors from the 422 bind to the inputs.
 */
import { useState } from 'react';

import { checkAuthority, requestApproval } from '@contracts/approvals';
import type { ApprovalDetail } from '@contracts/approvals';
import type { ApprovalRequestsSubjectType } from '@contracts/enums';
import { compare, isDecimal } from '@contracts/decimal';

import { useApiMutation, useApiQuery } from '../../api/hooks';
import { useActiveTenant } from '../../app/hooks';
import { formatMoney } from '../../lib/format';
import { t, tEnum } from '../../lib/i18n';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { DetailList } from '../ui/DetailList';
import { Dialog } from '../ui/Dialog';
import { formErrors } from '../ui/formErrors';
import { DateTimeInput, FormErrorSummary, MoneyInput, TextArea, TextField } from '../ui/FormFields';

export interface RequestApprovalDefaults {
  readonly title: string;
  readonly summary?: string;
  /** The amount under approval (decimal string + currency). */
  readonly amount?: { readonly amount: string; readonly currency: string };
  readonly legalEntityId?: number;
  readonly categoryId?: number;
}

export interface RequestApprovalDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly subjectType: ApprovalRequestsSubjectType;
  readonly subjectId: number;
  readonly subjectVersion: number;
  readonly contentHash: string;
  /** Human scope of the subject, for example "T-2026-0005 Water treatment chemicals framework, version 3". */
  readonly subjectLabel: string;
  readonly defaults: RequestApprovalDefaults;
  readonly onRequested?: (approval: ApprovalDetail) => void;
}

const FIELDS = ['title', 'summary', 'justification', 'amount', 'dueAt'] as const;

export function RequestApprovalDialog({
  open,
  onClose,
  subjectType,
  subjectId,
  subjectVersion,
  contentHash,
  subjectLabel,
  defaults,
  onRequested,
}: RequestApprovalDialogProps) {
  const tenant = useActiveTenant();
  const currency = defaults.amount?.currency ?? tenant?.defaultCurrency ?? 'BWP';
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const [title, setTitle] = useState(defaults.title);
  const [summary, setSummary] = useState(defaults.summary ?? '');
  const [justification, setJustification] = useState('');
  const [amount, setAmount] = useState({ amount: defaults.amount?.amount ?? '', currency });
  const [dueAt, setDueAt] = useState<string | null>(null);
  const mutation = useApiMutation(requestApproval);

  const hasAmount =
    amount.amount !== '' && isDecimal(amount.amount) && compare(amount.amount, '0') > 0;
  const hint = useApiQuery(
    checkAuthority,
    open && hasAmount
      ? {
          query: {
            subjectType,
            amount: amount.amount,
            currency: amount.currency,
            ...(defaults.legalEntityId === undefined
              ? {}
              : { legalEntityId: defaults.legalEntityId }),
            ...(defaults.categoryId === undefined ? {} : { categoryId: defaults.categoryId }),
          },
        }
      : null,
  );

  const errors = formErrors(mutation.error, FIELDS);
  const canSubmit = title.trim() !== '' && justification.trim() !== '' && !mutation.pending;

  const close = (): void => {
    mutation.reset();
    onClose();
  };

  const submit = async (): Promise<void> => {
    try {
      const approval = await mutation.mutate({
        body: {
          subjectType,
          subjectId,
          subjectVersion,
          contentHash,
          title: title.trim(),
          justification: justification.trim(),
          ...(summary.trim() === '' ? {} : { summary: summary.trim() }),
          ...(hasAmount ? { amount: { amount: amount.amount, currency: amount.currency } } : {}),
          ...(defaults.legalEntityId === undefined
            ? {}
            : { legalEntityId: defaults.legalEntityId }),
          ...(defaults.categoryId === undefined ? {} : { categoryId: defaults.categoryId }),
          ...(dueAt === null ? {} : { dueAt }),
        },
      });
      onRequested?.(approval);
      close();
    } catch {
      // The error is kept in mutation.error and shown in the dialog.
    }
  };

  const approvers = hint.data?.eligibleApprovers ?? [];

  return (
    <Dialog
      open={open}
      onClose={close}
      dismissible={!mutation.pending}
      size="lg"
      title={t('approvalWidget.request.title')}
      description={tEnum('approval_requests.subject_type', subjectType)}
      footer={
        <>
          <Button onClick={close} disabled={mutation.pending}>
            {t('ui.action.cancel')}
          </Button>
          <Button
            variant="primary"
            loading={mutation.pending}
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            {t('approvalWidget.request.submit')}
          </Button>
        </>
      }
    >
      <div className="tiq-consequence">
        <DetailList
          stacked
          items={[
            { key: 'org', label: t('ui.confirm.organization'), value: tenant?.name },
            { key: 'capacity', label: t('ui.confirm.capacity'), value: tenant?.capacity },
            {
              key: 'scope',
              label: t('ui.confirm.scope'),
              value: t('approvalWidget.request.scope', {
                subject: subjectLabel,
                version: subjectVersion,
              }),
            },
            {
              key: 'result',
              label: t('ui.confirm.result'),
              value: t('approvalWidget.request.result'),
            },
          ]}
        />
      </div>
      <FormErrorSummary
        title={mutation.error === null ? null : mutation.error.title}
        errors={errors.other}
      />
      <div className="tiq-form-grid">
        <TextField
          label={t('approvalWidget.field.title')}
          value={title}
          onChange={setTitle}
          required
          maxLength={300}
          error={errors.forField('title')}
          fieldClassName="tiq-form-full"
        />
        <TextArea
          label={t('approvalWidget.field.justification')}
          hint={t('approvalWidget.field.justificationHint')}
          value={justification}
          onChange={setJustification}
          required
          error={errors.forField('justification')}
          fieldClassName="tiq-form-full"
        />
        <TextArea
          label={t('approvalWidget.field.summary')}
          value={summary}
          onChange={setSummary}
          rows={3}
          error={errors.forField('summary')}
          fieldClassName="tiq-form-full"
        />
        <MoneyInput
          label={t('approvalWidget.field.amount')}
          hint={t('approvalWidget.field.amountHint')}
          value={amount}
          onChange={setAmount}
          currencies={[currency]}
          error={errors.forField('amount')}
        />
        <DateTimeInput
          label={t('approvalWidget.field.dueAt')}
          value={dueAt}
          onChange={setDueAt}
          timeZone={timeZone}
          error={errors.forField('dueAt')}
        />
      </div>
      {hasAmount && hint.status === 'success' && hint.data !== undefined && (
        <Banner
          tone={hint.data.routedToNextLevel ? 'warning' : 'info'}
          title={
            hint.data.routedToNextLevel
              ? t('approvalWidget.authority.routedUp', {
                  level:
                    hint.data.skippedLevel?.fullName ?? t('approvalWidget.authority.firstLevel'),
                })
              : t('approvalWidget.authority.title', {
                  amount: formatMoney(hint.data.amount),
                })
          }
        >
          {approvers.length === 0 ? (
            <p>{t('approvalWidget.authority.none')}</p>
          ) : (
            <ul>
              {approvers.map((approver) => (
                <li key={approver.userId}>
                  {approver.fullName}
                  {approver.capacity !== null && ` — ${approver.capacity}`}
                  {approver.check.limit !== null &&
                    ` (${t('approvalWidget.authority.limit', { limit: formatMoney(approver.check.limit) })})`}
                </li>
              ))}
            </ul>
          )}
        </Banner>
      )}
      {hasAmount && hint.status === 'error' && hint.error !== null && (
        <Banner tone="warning" title={t('approvalWidget.authority.unavailable')}>
          {hint.error.code === 'NO_ELIGIBLE_APPROVER'
            ? t('approvalWidget.authority.none')
            : hint.error.title}
        </Banner>
      )}
    </Dialog>
  );
}
