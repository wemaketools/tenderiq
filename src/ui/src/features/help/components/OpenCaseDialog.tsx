/**
 * COM-09 open a service case for one of the person's organizations. The person states what it concerns and confirms
 * that support cannot receive bids or decide deadlines and awards; text that looks like a bid is flagged before
 * sending (the API refuses it as well).
 */
import { useState } from 'react';

import {
  BID_SUBMISSION_IN_TEXT,
  MY_CASE_CATEGORIES,
  OpenMySupportCaseBody,
  operationsEndpoints,
} from '@contracts/operations';
import type { MySupportCaseDetail } from '@contracts/operations';
import { enumLabel } from '@contracts/enums';

import { useApiMutation } from '../../../api/hooks';
import {
  Banner,
  Button,
  Checkbox,
  Dialog,
  Select,
  TextArea,
  TextField,
  UnsavedChangesGuard,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { useValidatedForm } from '../../ops/lib/forms';
import { OrganizationSelect } from './OrganizationSelect';
import { ActionError } from '../../ops/components/ActionError';
import { useDefaultOrganization } from '../lib/organizations';

const FIELDS = ['category', 'subject', 'description', 'acknowledgesNotSubmissionChannel'] as const;

export function OpenCaseDialog({
  onClose,
  onOpened,
}: {
  readonly onClose: () => void;
  readonly onOpened: (created: MySupportCaseDetail) => void;
}) {
  const defaultOrganization = useDefaultOrganization();
  const [organization, setOrganization] = useState(defaultOrganization);
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [tried, setTried] = useState(false);
  const open = useApiMutation(operationsEndpoints.openMySupportCase);
  const body = {
    category: category === '' ? undefined : category,
    subject,
    description,
    acknowledgesNotSubmissionChannel: acknowledged ? true : undefined,
  };
  const form = useValidatedForm(OpenMySupportCaseBody, body, open.error, FIELDS);
  const looksLikeBid = BID_SUBMISSION_IN_TEXT.test(`${subject} ${description}`);
  const dirty = category !== '' || subject !== '' || description !== '';

  const submit = async (): Promise<void> => {
    setTried(true);
    const parsed = form.check();
    if (parsed === null || organization === '') return;
    try {
      onOpened(await open.mutate({ body: parsed }, { tenantId: Number(organization) }));
    } catch {
      // Shown by ActionError.
    }
  };

  return (
    <Dialog
      open
      size="lg"
      title={t('help.cases.open.title')}
      description={t('help.cases.open.description')}
      onClose={onClose}
      dismissible={!open.pending}
      footer={
        <>
          <Button onClick={onClose} disabled={open.pending}>
            {t('ops.common.cancel')}
          </Button>
          <Button variant="primary" loading={open.pending} onClick={() => void submit()}>
            {t('help.cases.open.submit')}
          </Button>
        </>
      }
    >
      <UnsavedChangesGuard when={dirty && !open.pending} />
      <Banner tone="warning" title={t('help.notChannelTitle')}>
        <p>{t('help.notChannel')}</p>
      </Banner>
      <div className="tiq-form-grid">
        <OrganizationSelect
          value={organization}
          onChange={setOrganization}
          error={tried && organization === '' ? t('ops.common.required') : undefined}
        />
        <Select
          label={t('help.cases.col.category')}
          hint={t('help.cases.open.categoryHint')}
          required
          placeholder={t('ops.common.choose')}
          value={category}
          onChange={setCategory}
          options={MY_CASE_CATEGORIES.map((value) => ({
            value,
            label: enumLabel('support_cases.category', value),
          }))}
          error={form.errorFor('category')}
        />
        <TextField
          fieldClassName="tiq-form-full"
          label={t('help.cases.col.subject')}
          required
          value={subject}
          onChange={setSubject}
          error={form.errorFor('subject')}
        />
        <TextArea
          fieldClassName="tiq-form-full"
          label={t('help.cases.open.descriptionField')}
          required
          rows={5}
          value={description}
          onChange={setDescription}
          error={form.errorFor('description')}
        />
      </div>
      {category === 'procurement_merits' && (
        <Banner tone="info" title={t('ops.support.meritsTitle')}>
          <p>{t('help.cases.open.merits')}</p>
        </Banner>
      )}
      {looksLikeBid && (
        <Banner tone="error" title={t('ops.support.notSubmissionTitle')}>
          <p>{t('ops.errors.SUPPORT_NOT_SUBMISSION_CHANNEL')}</p>
        </Banner>
      )}
      <Checkbox
        label={t('help.cases.open.acknowledge')}
        checked={acknowledged}
        onChange={setAcknowledged}
        error={form.errorFor('acknowledgesNotSubmissionChannel')}
      />
      <ActionError error={open.error} fields={FIELDS} />
    </Dialog>
  );
}
