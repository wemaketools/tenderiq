/**
 * ADM-15 connection form: system, name, business owner, purpose, information scope, record ownership and the
 * reviewed manual fallback. Used to add a connection (planned) and to edit one. Enabling is a separate, confirmed
 * status change that requires a documented fallback.
 */
import { useState } from 'react';

import { INTEGRATION_CONNECTIONS_SYSTEM_TYPE, enumLabel } from '@contracts/enums';
import {
  CreateIntegrationBody,
  UpdateIntegrationBody,
  operationsEndpoints,
} from '@contracts/operations';
import type { IntegrationDetail } from '@contracts/operations';

import { useApiMutation } from '../../../api/hooks';
import {
  Button,
  Dialog,
  Select,
  TextArea,
  TextField,
  UnsavedChangesGuard,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { useValidatedForm, withoutEmpty } from '../../ops/lib/forms';
import { usePeopleOptions } from './people';
import { ActionError } from '../../ops/components/ActionError';

const FIELDS = [
  'systemType',
  'name',
  'businessOwnerUserId',
  'purpose',
  'informationScope',
  'recordOwnership',
  'manualFallback',
] as const;

export interface IntegrationFormDialogProps {
  readonly existing: IntegrationDetail | null;
  readonly onClose: () => void;
  readonly onSaved: (saved: IntegrationDetail) => void;
}

export function IntegrationFormDialog({ existing, onClose, onSaved }: IntegrationFormDialogProps) {
  const initial = {
    systemType: existing?.systemType ?? '',
    name: existing?.name ?? '',
    businessOwnerUserId: existing === null ? '' : String(existing.businessOwner.userId),
    purpose: existing?.purpose ?? '',
    informationScope: existing?.informationScope ?? '',
    recordOwnership: existing?.recordOwnership ?? '',
    manualFallback: existing?.manualFallback ?? '',
  };
  const [draft, setDraft] = useState(initial);
  const create = useApiMutation(operationsEndpoints.createIntegration);
  const update = useApiMutation(operationsEndpoints.updateIntegration);
  const people = usePeopleOptions();
  const error = existing === null ? create.error : update.error;
  const pending = create.pending || update.pending;
  const common = {
    ...withoutEmpty({
      name: draft.name,
      purpose: draft.purpose,
      informationScope: draft.informationScope,
      recordOwnership: draft.recordOwnership,
    }),
    businessOwnerUserId:
      draft.businessOwnerUserId === '' ? undefined : Number(draft.businessOwnerUserId),
    ...(draft.manualFallback.trim() === '' ? {} : { manualFallback: draft.manualFallback }),
  };
  const createForm = useValidatedForm(
    CreateIntegrationBody,
    { ...common, systemType: draft.systemType === '' ? undefined : draft.systemType },
    create.error,
    FIELDS,
  );
  const updateForm = useValidatedForm(UpdateIntegrationBody, common, update.error, FIELDS);
  const form = existing === null ? createForm : updateForm;
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const set = (field: keyof typeof initial) => (value: string) =>
    setDraft((previous) => ({ ...previous, [field]: value }));

  const submit = async (): Promise<void> => {
    try {
      if (existing === null) {
        const parsed = createForm.check();
        if (parsed === null) return;
        onSaved(await create.mutate({ body: parsed }));
      } else {
        const parsed = updateForm.check();
        if (parsed === null) return;
        onSaved(await update.mutate({ params: { connectionId: existing.id }, body: parsed }));
      }
    } catch {
      // Shown by ActionError and the bound field errors.
    }
  };

  return (
    <Dialog
      open
      size="lg"
      title={
        existing === null
          ? t('admin-integrations.form.createTitle')
          : t('admin-integrations.form.editTitle')
      }
      description={t('admin-integrations.form.description')}
      onClose={onClose}
      dismissible={!pending}
      footer={
        <>
          <Button onClick={onClose} disabled={pending}>
            {t('ops.common.cancel')}
          </Button>
          <Button variant="primary" loading={pending} onClick={() => void submit()}>
            {existing === null
              ? t('admin-integrations.form.create')
              : t('admin-integrations.form.save')}
          </Button>
        </>
      }
    >
      <UnsavedChangesGuard when={dirty && !pending} />
      <div className="tiq-form-grid">
        <Select
          label={t('admin-integrations.col.system')}
          required
          placeholder={t('ops.common.choose')}
          value={draft.systemType}
          onChange={set('systemType')}
          disabled={existing !== null}
          options={INTEGRATION_CONNECTIONS_SYSTEM_TYPE.map((value) => ({
            value,
            label: enumLabel('integration_connections.system_type', value),
          }))}
          error={form.errorFor('systemType')}
        />
        <TextField
          label={t('admin-integrations.col.name')}
          required
          value={draft.name}
          onChange={set('name')}
          error={form.errorFor('name')}
        />
        <Select
          label={t('admin-integrations.col.owner')}
          required
          placeholder={t('ops.common.choose')}
          value={draft.businessOwnerUserId}
          onChange={set('businessOwnerUserId')}
          options={people}
          error={form.errorFor('businessOwnerUserId')}
        />
        <TextArea
          fieldClassName="tiq-form-full"
          label={t('admin-integrations.col.purpose')}
          required
          rows={2}
          value={draft.purpose}
          onChange={set('purpose')}
          error={form.errorFor('purpose')}
        />
        <TextArea
          fieldClassName="tiq-form-full"
          label={t('admin-integrations.detail.scope')}
          hint={t('admin-integrations.form.scopeHint')}
          required
          rows={3}
          value={draft.informationScope}
          onChange={set('informationScope')}
          error={form.errorFor('informationScope')}
        />
        <TextArea
          fieldClassName="tiq-form-full"
          label={t('admin-integrations.detail.ownership')}
          hint={t('admin-integrations.form.ownershipHint')}
          required
          rows={2}
          value={draft.recordOwnership}
          onChange={set('recordOwnership')}
          error={form.errorFor('recordOwnership')}
        />
        <TextArea
          fieldClassName="tiq-form-full"
          label={t('admin-integrations.detail.fallback')}
          hint={t('admin-integrations.form.fallbackHint')}
          rows={3}
          value={draft.manualFallback}
          onChange={set('manualFallback')}
          error={form.errorFor('manualFallback')}
        />
      </div>
      <ActionError error={error} fields={FIELDS} />
    </Dialog>
  );
}
