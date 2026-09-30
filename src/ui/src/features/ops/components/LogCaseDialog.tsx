/**
 * OPS-04 "log a case" for a customer contact who reached support by phone or e-mail. The case records what it
 * concerns (usage, access, submission evidence, qualification, procurement merits, contract performance,
 * accessibility); support is never a bid-submission channel, and procurement-merits cases are routed to the buyer.
 */
import { useState } from 'react';

import { SUPPORT_CASES_CATEGORY, enumLabel } from '@contracts/enums';
import {
  BID_SUBMISSION_IN_TEXT,
  CreateSupportCaseBody,
  operationsEndpoints,
} from '@contracts/operations';
import type { SupportCaseDetail } from '@contracts/operations';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { Banner, Button, Dialog, Select, TextArea, TextField } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { useValidatedForm } from '../lib/forms';
import { ActionError } from '../components/ActionError';

const FIELDS = [
  'customerTenantId',
  'openedByUserId',
  'category',
  'subject',
  'description',
] as const;

export function LogCaseDialog({
  onClose,
  onCreated,
}: {
  readonly onClose: () => void;
  readonly onCreated: (created: SupportCaseDetail) => void;
}) {
  const [customerId, setCustomerId] = useState('');
  const [contactId, setContactId] = useState('');
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const create = useApiMutation(operationsEndpoints.createSupportCase);
  const customers = useApiQuery(operationsEndpoints.listCustomers, {
    query: { pageSize: 100, sort: 'name' },
  });
  const customer = useApiQuery(
    operationsEndpoints.getCustomer,
    customerId === '' ? null : { params: { customerTenantId: Number(customerId) } },
  );
  const body = {
    customerTenantId: customerId === '' ? undefined : Number(customerId),
    openedByUserId: contactId === '' ? undefined : Number(contactId),
    category: category === '' ? undefined : category,
    subject,
    description,
  };
  const form = useValidatedForm(CreateSupportCaseBody, body, create.error, FIELDS);
  const looksLikeBid = BID_SUBMISSION_IN_TEXT.test(`${subject} ${description}`);

  const submit = async (): Promise<void> => {
    const parsed = form.check();
    if (parsed === null) return;
    try {
      onCreated(await create.mutate({ body: parsed }));
    } catch {
      // Shown by ActionError.
    }
  };

  return (
    <Dialog
      open
      size="lg"
      title={t('ops.support.log.title')}
      description={t('ops.support.log.description')}
      onClose={onClose}
      dismissible={!create.pending}
      footer={
        <>
          <Button onClick={onClose} disabled={create.pending}>
            {t('ops.common.cancel')}
          </Button>
          <Button variant="primary" loading={create.pending} onClick={() => void submit()}>
            {t('ops.support.log.submit')}
          </Button>
        </>
      }
    >
      <div className="tiq-form-grid">
        <Select
          label={t('ops.support.col.customer')}
          required
          placeholder={t('ops.common.choose')}
          value={customerId}
          onChange={(value) => {
            setCustomerId(value);
            setContactId('');
          }}
          options={(customers.data?.items ?? []).map((row) => ({
            value: String(row.tenantId),
            label: row.name,
          }))}
          error={form.errorFor('customerTenantId')}
        />
        <Select
          label={t('ops.support.log.contact')}
          hint={t('ops.support.log.contactHint')}
          required
          placeholder={t('ops.common.choose')}
          value={contactId}
          onChange={setContactId}
          disabled={customer.data === undefined}
          options={(customer.data?.administrators ?? []).map((person) => ({
            value: String(person.userId),
            label: person.fullName,
          }))}
          error={form.errorFor('openedByUserId')}
        />
        <Select
          label={t('ops.support.col.category')}
          hint={t('ops.support.log.categoryHint')}
          required
          placeholder={t('ops.common.choose')}
          value={category}
          onChange={setCategory}
          options={SUPPORT_CASES_CATEGORY.map((value) => ({
            value,
            label: enumLabel('support_cases.category', value),
          }))}
          error={form.errorFor('category')}
        />
        <TextField
          label={t('ops.support.col.subject')}
          required
          value={subject}
          onChange={setSubject}
          error={form.errorFor('subject')}
        />
        <TextArea
          fieldClassName="tiq-form-full"
          label={t('ops.support.log.descriptionField')}
          required
          rows={5}
          value={description}
          onChange={setDescription}
          error={form.errorFor('description')}
        />
      </div>
      {looksLikeBid && (
        <Banner tone="warning" title={t('ops.support.notSubmissionTitle')}>
          <p>{t('ops.support.notSubmission')}</p>
        </Banner>
      )}
      {category === 'procurement_merits' && (
        <Banner tone="info" title={t('ops.support.meritsTitle')}>
          <p>{t('ops.support.merits')}</p>
        </Banner>
      )}
      <ActionError error={create.error} fields={FIELDS} />
    </Dialog>
  );
}
