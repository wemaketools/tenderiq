/**
 * OPS-04 request temporary access: the operator states the business need, the scope (metadata only or named
 * records) and the duration (at most MAX_SUPPORT_GRANT_DAYS). The customer's administrator authorizes it; until then
 * support has no access. Sealed or scored records (bids, evaluation) can never be named.
 */
import { useState } from 'react';

import {
  MAX_SUPPORT_GRANT_DAYS,
  RequestSupportGrantBody,
  isSealedRecordRef,
  operationsEndpoints,
} from '@contracts/operations';
import type { SupportCaseDetail } from '@contracts/operations';
import { enumLabel } from '@contracts/enums';

import { invalidateApiQueries, useApiMutation } from '../../../api/hooks';
import {
  Banner,
  ConfirmActionDialog,
  NumberInput,
  RadioGroup,
  TextArea,
  TextField,
  useToast,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { fieldErrorOnly } from '../lib/errors';
import { localErrors } from '../lib/forms';
import { ActionError } from '../components/ActionError';

export function RequestGrantDialog({
  supportCase,
  onClose,
}: {
  readonly supportCase: SupportCaseDetail;
  readonly onClose: () => void;
}) {
  const toast = useToast();
  const [need, setNeed] = useState('');
  const [scope, setScope] = useState<'metadata_only' | 'specific_records'>('metadata_only');
  const [records, setRecords] = useState('');
  const [days, setDays] = useState('3');
  const [tried, setTried] = useState(false);
  const request = useApiMutation(operationsEndpoints.requestSupportGrant);
  const recordRefs =
    scope === 'specific_records'
      ? records
          .split(/[\s,]+/)
          .map((value) => value.trim())
          .filter((value) => value !== '')
      : [];
  const body = {
    businessNeed: need,
    scope,
    recordRefs,
    requestedDays: days === '' ? undefined : Number(days),
  };
  const local = tried ? localErrors(RequestSupportGrantBody, body) : {};
  const sealed = recordRefs.filter(isSealedRecordRef);
  const tooLong = days !== '' && Number(days) > MAX_SUPPORT_GRANT_DAYS;
  const serverField = (field: string): string | undefined =>
    request.error?.fieldErrors.find((item) => item.field.startsWith(field))?.message;

  return (
    <ConfirmActionDialog
      open
      title={t('ops.grantRequest.title')}
      scope={`${supportCase.reference} · ${supportCase.customer.name}`}
      consequence={t('ops.grantRequest.consequence', { customer: supportCase.customer.name })}
      confirmLabel={t('ops.grantRequest.confirm')}
      pending={request.pending}
      error={fieldErrorOnly(request.error)}
      onCancel={onClose}
      onConfirm={async () => {
        setTried(true);
        const parsed = RequestSupportGrantBody.safeParse(body);
        if (!parsed.success || sealed.length > 0 || tooLong) return;
        try {
          await request.mutate({ params: { caseId: supportCase.id }, body: parsed.data });
          toast.show(t('ops.grantRequest.done'), 'success');
          invalidateApiQueries('ops.operations.');
          onClose();
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <Banner tone="info" title={t('ops.grantRequest.limitsTitle')}>
        <p>{t('ops.grantRequest.limits', { days: MAX_SUPPORT_GRANT_DAYS })}</p>
      </Banner>
      <TextArea
        label={t('ops.grants.col.need')}
        required
        rows={3}
        value={need}
        onChange={setNeed}
        error={serverField('businessNeed') ?? local.businessNeed}
      />
      <RadioGroup
        label={t('ops.grants.col.scope')}
        required
        value={scope}
        onChange={(value) =>
          setScope(value === 'specific_records' ? 'specific_records' : 'metadata_only')
        }
        options={[
          {
            value: 'metadata_only',
            label: enumLabel('support_access_grants.scope', 'metadata_only'),
            hint: t('ops.grantRequest.metadataHint'),
          },
          {
            value: 'specific_records',
            label: enumLabel('support_access_grants.scope', 'specific_records'),
            hint: t('ops.grantRequest.recordsHint'),
          },
        ]}
      />
      {scope === 'specific_records' && (
        <TextField
          label={t('ops.grantRequest.records')}
          hint={t('ops.grantRequest.recordsFormat')}
          required
          value={records}
          onChange={setRecords}
          error={
            sealed.length > 0
              ? t('ops.grantRequest.sealed', { records: sealed.join(', ') })
              : (serverField('recordRefs') ??
                Object.entries(local).find(([key]) => key.startsWith('recordRefs'))?.[1])
          }
        />
      )}
      <NumberInput
        label={t('ops.grantRequest.days')}
        hint={t('ops.grantRequest.daysHint', { days: MAX_SUPPORT_GRANT_DAYS })}
        required
        value={days}
        onChange={setDays}
        suffix={t('ops.grantRequest.daysUnit')}
        error={
          tooLong
            ? t('ops.errors.GRANT_DURATION_TOO_LONG')
            : (serverField('requestedDays') ?? local.requestedDays)
        }
      />
      <ActionError error={request.error} />
    </ConfirmActionDialog>
  );
}
