/**
 * COM-09 / PRD §19 accessibility accommodation request: the kind of assistance, the need, the event or document it
 * concerns, when it is needed by and how to be contacted. It opens an accessibility case for the chosen organization.
 */
import { useState } from 'react';

import {
  ACCOMMODATION_FORMATS,
  RequestAccommodationBody,
  operationsEndpoints,
} from '@contracts/operations';
import type { MySupportCaseDetail } from '@contracts/operations';

import { useApiMutation } from '../../../api/hooks';
import {
  Button,
  DateInput,
  Dialog,
  RadioGroup,
  Select,
  TextArea,
  TextField,
  UnsavedChangesGuard,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { useValidatedForm } from '../../ops/lib/forms';
import { opsOptions } from '../../ops/lib/labels';
import { OrganizationSelect } from './OrganizationSelect';
import { ActionError } from '../../ops/components/ActionError';
import { useDefaultOrganization } from '../lib/organizations';

const FIELDS = ['format', 'need', 'relatedReference', 'neededBy', 'contactPreference'] as const;

export function AccommodationDialog({
  onClose,
  onRequested,
}: {
  readonly onClose: () => void;
  readonly onRequested: (created: MySupportCaseDetail) => void;
}) {
  const defaultOrganization = useDefaultOrganization();
  const [organization, setOrganization] = useState(defaultOrganization);
  const [format, setFormat] = useState('');
  const [need, setNeed] = useState('');
  const [related, setRelated] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [contact, setContact] = useState('email');
  const [tried, setTried] = useState(false);
  const request = useApiMutation(operationsEndpoints.requestAccommodation);
  const body = {
    format: format === '' ? undefined : format,
    need,
    contactPreference: contact,
    ...(related.trim() === '' ? {} : { relatedReference: related.trim() }),
    ...(neededBy === '' ? {} : { neededBy }),
  };
  const form = useValidatedForm(RequestAccommodationBody, body, request.error, FIELDS);
  const dirty = format !== '' || need !== '' || related !== '' || neededBy !== '';

  const submit = async (): Promise<void> => {
    setTried(true);
    const parsed = form.check();
    if (parsed === null || organization === '') return;
    try {
      onRequested(await request.mutate({ body: parsed }, { tenantId: Number(organization) }));
    } catch {
      // Shown by ActionError.
    }
  };

  return (
    <Dialog
      open
      size="lg"
      title={t('help.accommodation.title')}
      description={t('help.accommodation.description')}
      onClose={onClose}
      dismissible={!request.pending}
      footer={
        <>
          <Button onClick={onClose} disabled={request.pending}>
            {t('ops.common.cancel')}
          </Button>
          <Button variant="primary" loading={request.pending} onClick={() => void submit()}>
            {t('help.accommodation.submit')}
          </Button>
        </>
      }
    >
      <UnsavedChangesGuard when={dirty && !request.pending} />
      <div className="tiq-form-grid">
        <OrganizationSelect
          value={organization}
          onChange={setOrganization}
          error={tried && organization === '' ? t('ops.common.required') : undefined}
        />
        <Select
          label={t('help.accommodation.format')}
          required
          placeholder={t('ops.common.choose')}
          value={format}
          onChange={setFormat}
          options={opsOptions('accommodation', ACCOMMODATION_FORMATS)}
          error={form.errorFor('format')}
        />
        <TextArea
          fieldClassName="tiq-form-full"
          label={t('help.accommodation.need')}
          hint={t('help.accommodation.needHint')}
          required
          rows={4}
          value={need}
          onChange={setNeed}
          error={form.errorFor('need')}
        />
        <TextField
          label={t('help.accommodation.related')}
          hint={t('help.accommodation.relatedHint')}
          value={related}
          onChange={setRelated}
          error={form.errorFor('relatedReference')}
        />
        <DateInput
          label={t('help.accommodation.neededBy')}
          value={neededBy}
          onChange={setNeededBy}
          error={form.errorFor('neededBy')}
        />
        <RadioGroup
          fieldClassName="tiq-form-full"
          label={t('help.accommodation.contact')}
          inline
          required
          value={contact}
          onChange={setContact}
          options={[
            { value: 'email', label: t('help.accommodation.contactEmail') },
            { value: 'phone', label: t('help.accommodation.contactPhone') },
            { value: 'in_app', label: t('help.accommodation.contactInApp') },
          ]}
          error={form.errorFor('contactPreference')}
        />
      </div>
      <ActionError error={request.error} fields={FIELDS} />
    </Dialog>
  );
}
