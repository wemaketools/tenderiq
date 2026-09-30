/**
 * ADM-06 — new procurement policy profile. Saving creates the profile with DRAFT version 1; the draft is then
 * submitted for review and approved before any tender can adopt it (saved ≠ submitted ≠ approved).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { CreatePolicyProfileBody, createPolicyProfile } from '@contracts/policy';
import type { FieldError } from '@contracts/common';
import type { PolicyProfileDetail } from '@contracts/policy';

import { useApiMutation } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import {
  Banner,
  Button,
  Card,
  FormErrorSummary,
  PageHeader,
  TextArea,
  TextField,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { PolicyLayout } from '../components/PolicyLayout';
import { PolicyRulesForm } from '../components/PolicyRules';
import { policyErrorMessage } from '../lib/errors';
import { policyPaths } from '../lib/paths';
import { draftToRules, emptyRulesDraft } from '../lib/rulesDraft';
import type { RulesDraft } from '../lib/rulesDraft';
import { errorLookup, validateWith } from '../lib/validation';

const KNOWN_FIELDS = [
  'name',
  'description',
  'rules.permittedProcedures',
  'rules.bafoPermitted',
  'rules.thresholds',
  'rules.approvalRouteNote',
  'rules.lateSubmissionPolicy',
  'rules.openingQuorum',
  'rules.minResponseDays',
  'rules.questionDeadlineDaysBeforeClose',
  'rules.standstillLength',
  'rules.standstillDayType',
  'rules.complaintWindowDays',
];

export default function PolicyProfileNewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const tenant = useActiveTenant();
  const currency = tenant?.defaultCurrency ?? 'BWP';
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState<RulesDraft>(() => emptyRulesDraft(currency));
  const [dirty, setDirty] = useState(false);
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const [created, setCreated] = useState<PolicyProfileDetail | null>(null);
  const create = useApiMutation(createPolicyProfile);

  useEffect(() => {
    if (created !== null) {
      void navigate(policyPaths.profile(created.id), { state: { record: created } });
    }
  }, [created, navigate]);

  const errors = errorLookup(clientErrors, create.error, KNOWN_FIELDS);

  const save = async (): Promise<void> => {
    const body = { name, description, rules: draftToRules(rules) };
    const problems = validateWith(CreatePolicyProfileBody, body);
    setClientErrors(problems);
    if (problems.length > 0) return;
    try {
      const profile = await create.mutate({ body });
      toast.show(t('admin-policy.profileNew.saved', { name: profile.name }), 'success');
      setCreated(profile);
    } catch {
      // The error is shown by the form (field errors and the summary banner).
    }
  };

  return (
    <PolicyLayout>
      <UnsavedChangesGuard when={dirty && created === null} />
      <PageHeader
        title={t('admin-policy.profileNew.title')}
        subtitle={t('admin-policy.profileNew.intro')}
        back={{ to: policyPaths.profiles, label: t('admin-policy.profiles.back') }}
        primaryAction={
          <Button
            variant="primary"
            icon="check"
            loading={create.pending}
            onClick={() => void save()}
          >
            {t('admin-policy.profileNew.save')}
          </Button>
        }
      />
      <Banner tone="info" title={t('admin-policy.profileNew.lifecycleTitle')}>
        <p>{t('admin-policy.profileNew.lifecycle')}</p>
      </Banner>
      {(errors.other.length > 0 || (create.error !== null && errors.count === 0)) && (
        <FormErrorSummary
          title={create.error === null ? null : policyErrorMessage(create.error)}
          errors={errors.other}
        />
      )}
      <Card title={t('admin-policy.profileNew.identity')}>
        <div className="tiq-form-grid">
          <TextField
            label={t('admin-policy.profileNew.name')}
            required
            value={name}
            onChange={(value) => {
              setName(value);
              setDirty(true);
            }}
            error={errors.forField('name')}
          />
          <TextArea
            label={t('admin-policy.profileNew.description')}
            value={description}
            rows={2}
            onChange={(value) => {
              setDescription(value);
              setDirty(true);
            }}
            error={errors.forField('description')}
          />
        </div>
      </Card>
      <Card title={t('admin-policy.profileNew.rules')}>
        <PolicyRulesForm
          value={rules}
          defaultCurrency={currency}
          onChange={(value) => {
            setRules(value);
            setDirty(true);
          }}
          errors={errors}
        />
      </Card>
    </PolicyLayout>
  );
}
