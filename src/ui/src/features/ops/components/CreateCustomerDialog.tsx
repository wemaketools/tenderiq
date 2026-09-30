/**
 * OPS-01 "Establish a customer relationship": a buyer organization with its plan, service owner and designated
 * administrator. Supplier organizations register themselves; the operator never creates them here.
 */
import { useState } from 'react';

import { CreateCustomerBody, PLAN_CODES, operationsEndpoints } from '@contracts/operations';
import type { CustomerDetail } from '@contracts/operations';

import { useApiMutation } from '../../../api/hooks';
import { Button, Dialog, Select, TextField, UnsavedChangesGuard } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { useValidatedForm, withoutEmpty } from '../lib/forms';
import { opsOptions } from '../lib/labels';
import { ActionError } from '../components/ActionError';
import { useOperatorStaffOptions } from '../lib/staff';

const FIELDS = [
  'legalName',
  'tradingName',
  'slug',
  'country',
  'registrationNumber',
  'officialTimeZone',
  'defaultCurrency',
  'planCode',
  'serviceOwnerUserId',
  'administratorName',
  'administratorEmail',
] as const;

const EMPTY = {
  legalName: '',
  tradingName: '',
  slug: '',
  country: 'BW',
  registrationNumber: '',
  officialTimeZone: 'Africa/Gaborone',
  defaultCurrency: 'BWP',
  planCode: '',
  serviceOwnerUserId: '',
  administratorName: '',
  administratorEmail: '',
};

export interface CreateCustomerDialogProps {
  readonly onClose: () => void;
  readonly onCreated: (customer: CustomerDetail) => void;
}

export function CreateCustomerDialog({ onClose, onCreated }: CreateCustomerDialogProps) {
  const [draft, setDraft] = useState(EMPTY);
  const create = useApiMutation(operationsEndpoints.createCustomer);
  const staff = useOperatorStaffOptions();
  const body = {
    ...withoutEmpty(draft),
    serviceOwnerUserId:
      draft.serviceOwnerUserId === '' ? undefined : Number(draft.serviceOwnerUserId),
  };
  const form = useValidatedForm(CreateCustomerBody, body, create.error, FIELDS);
  const dirty = JSON.stringify(draft) !== JSON.stringify(EMPTY);
  const set = (field: keyof typeof EMPTY) => (value: string) =>
    setDraft((previous) => ({ ...previous, [field]: value }));

  const submit = async (): Promise<void> => {
    const parsed = form.check();
    if (parsed === null) return;
    try {
      const created = await create.mutate({ body: parsed });
      onCreated(created);
    } catch {
      // The failure is shown by ActionError and the bound field errors.
    }
  };

  return (
    <Dialog
      open
      size="lg"
      title={t('ops.customers.create.title')}
      description={t('ops.customers.create.description')}
      onClose={onClose}
      dismissible={!create.pending}
      footer={
        <>
          <Button onClick={onClose} disabled={create.pending}>
            {t('ops.common.cancel')}
          </Button>
          <Button variant="primary" loading={create.pending} onClick={() => void submit()}>
            {t('ops.customers.create.submit')}
          </Button>
        </>
      }
    >
      <UnsavedChangesGuard when={dirty && !create.pending} />
      <div className="tiq-form-grid">
        <TextField
          label={t('ops.customers.field.legalName')}
          required
          value={draft.legalName}
          onChange={set('legalName')}
          error={form.errorFor('legalName')}
        />
        <TextField
          label={t('ops.customers.field.tradingName')}
          value={draft.tradingName}
          onChange={set('tradingName')}
          error={form.errorFor('tradingName')}
        />
        <TextField
          label={t('ops.customers.field.slug')}
          hint={t('ops.customers.field.slugHint')}
          required
          value={draft.slug}
          onChange={set('slug')}
          error={form.errorFor('slug')}
        />
        <TextField
          label={t('ops.customers.field.country')}
          hint={t('ops.customers.field.countryHint')}
          required
          value={draft.country}
          onChange={(value) => set('country')(value.toUpperCase())}
          error={form.errorFor('country')}
        />
        <TextField
          label={t('ops.customers.field.registrationNumber')}
          value={draft.registrationNumber}
          onChange={set('registrationNumber')}
          error={form.errorFor('registrationNumber')}
        />
        <TextField
          label={t('ops.customers.field.timeZone')}
          hint={t('ops.customers.field.timeZoneHint')}
          required
          value={draft.officialTimeZone}
          onChange={set('officialTimeZone')}
          error={form.errorFor('officialTimeZone')}
        />
        <TextField
          label={t('ops.customers.field.currency')}
          required
          value={draft.defaultCurrency}
          onChange={(value) => set('defaultCurrency')(value.toUpperCase())}
          error={form.errorFor('defaultCurrency')}
        />
        <Select
          label={t('ops.customers.field.plan')}
          required
          placeholder={t('ops.common.choose')}
          value={draft.planCode}
          onChange={set('planCode')}
          options={opsOptions('plan', PLAN_CODES)}
          error={form.errorFor('planCode')}
        />
        <Select
          label={t('ops.customers.field.serviceOwner')}
          required
          placeholder={t('ops.common.choose')}
          value={draft.serviceOwnerUserId}
          onChange={set('serviceOwnerUserId')}
          options={staff}
          error={form.errorFor('serviceOwnerUserId')}
        />
        <TextField
          label={t('ops.customers.field.administratorName')}
          hint={t('ops.customers.field.administratorHint')}
          required
          value={draft.administratorName}
          onChange={set('administratorName')}
          error={form.errorFor('administratorName')}
        />
        <TextField
          label={t('ops.customers.field.administratorEmail')}
          type="email"
          required
          value={draft.administratorEmail}
          onChange={set('administratorEmail')}
          error={form.errorFor('administratorEmail')}
        />
      </div>
      <p className="tiq-text-muted">{t('ops.customers.create.noContent')}</p>
      <ActionError error={create.error} fields={FIELDS} />
    </Dialog>
  );
}
