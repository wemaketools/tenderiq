/**
 * ADM-07 — new business field. A new field appears on NEW forms only; records already issued keep their form.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import type { FieldError } from '@contracts/common';
import type { CustomFieldsEntityType } from '@contracts/enums';
import { CreateCustomFieldBody, createCustomField } from '@contracts/policy';
import type { CustomFieldDetail } from '@contracts/policy';

import { useApiMutation } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  FormErrorSummary,
  PageHeader,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { FieldDefinitionForm } from '../components/FieldDefinitionForm';
import { PolicyLayout } from '../components/PolicyLayout';
import { policyErrorMessage } from '../lib/errors';
import { EMPTY_FIELD_DRAFT, FIELD_FORM_FIELDS, draftToRule } from '../lib/fieldDraft';
import type { FieldDraft } from '../lib/fieldDraft';
import { policyPaths } from '../lib/paths';
import { errorLookup, validateWith } from '../lib/validation';

export default function CustomFieldNewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [draft, setDraft] = useState<FieldDraft>(EMPTY_FIELD_DRAFT);
  const [dirty, setDirty] = useState(false);
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const [created, setCreated] = useState<CustomFieldDetail | null>(null);
  const create = useApiMutation(createCustomField);
  const errors = errorLookup(clientErrors, create.error, FIELD_FORM_FIELDS);

  useEffect(() => {
    if (created !== null) {
      void navigate(policyPaths.field(created.id), { state: { record: created } });
    }
  }, [created, navigate]);

  const save = async (): Promise<void> => {
    const body = {
      ...draftToRule(draft),
      entityType: draft.entityType as CustomFieldsEntityType,
      key: draft.key,
    };
    const problems = validateWith(CreateCustomFieldBody, body);
    setClientErrors(problems);
    if (problems.length > 0) return;
    try {
      const field = await create.mutate({ body });
      toast.show(t('admin-policy.fieldNew.saved', { label: field.label }), 'success');
      setCreated(field);
    } catch {
      // Shown in the form.
    }
  };

  return (
    <PolicyLayout>
      <UnsavedChangesGuard when={dirty && created === null} />
      <PageHeader
        title={t('admin-policy.fieldNew.title')}
        subtitle={t('admin-policy.fieldNew.intro')}
        back={{ to: policyPaths.fields, label: t('admin-policy.fields.back') }}
        primaryAction={
          <Button
            variant="primary"
            icon="check"
            loading={create.pending}
            onClick={() => void save()}
          >
            {t('admin-policy.fieldNew.save')}
          </Button>
        }
      />
      <Banner tone="info" title={t('admin-policy.fieldNew.rulesTitle')}>
        <p>{t('admin-policy.fieldNew.rules')}</p>
      </Banner>
      {(errors.other.length > 0 || (create.error !== null && errors.count === 0)) && (
        <FormErrorSummary
          title={create.error === null ? null : policyErrorMessage(create.error)}
          errors={errors.other}
        />
      )}
      <Card>
        <FieldDefinitionForm
          mode="create"
          value={draft}
          onChange={(value) => {
            setDraft(value);
            setDirty(true);
          }}
          errors={errors}
        />
      </Card>
    </PolicyLayout>
  );
}
