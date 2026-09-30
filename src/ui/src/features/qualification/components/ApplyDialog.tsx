/**
 * SUP-20 "Apply" and SUP-24 "Renew": starts a DRAFT application on the program's current criteria version, for a
 * category the program covers, an optional value limit and geography. A renewal cites the decision it renews. The
 * draft is saved only for the supplier; the buyer sees it once it is submitted.
 */
import { useState } from 'react';

import { CreateApplicationBody, qualificationEndpoints as api } from '@contracts/qualification';
import type { NonNegativeMoney } from '@contracts/common';
import type { CategoryRef, SupplierApplicationDetail } from '@contracts/qualification';

import { useApiMutation } from '../../../api/hooks';
import {
  Banner,
  Button,
  Dialog,
  FormErrorSummary,
  MoneyInput,
  Select,
  TextField,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { summaryTitle } from '../lib/errors';
import { runCommand } from '../lib/hooks';
import { categoryLabel } from '../lib/text';
import { errorLookup, moneyOrNull, textOrNull, validateWith } from '../lib/validation';

const FIELDS = [
  'programId',
  'scopeCategoryId',
  'scopeMaxValue',
  'scopeGeography',
  'renewalOfDecisionId',
];

export interface ApplyDialogProps {
  readonly programId: number;
  readonly programName: string;
  readonly buyerName: string;
  readonly categories: readonly CategoryRef[];
  readonly defaultCategoryId: number | null;
  readonly defaultMaxValue: NonNegativeMoney | null;
  readonly defaultGeography: string | null;
  readonly currency: string;
  readonly renewalOfDecisionId: number | null;
  readonly onClose: () => void;
  readonly onCreated: (application: SupplierApplicationDetail) => void;
}

export function ApplyDialog({
  programId,
  programName,
  buyerName,
  categories,
  defaultCategoryId,
  defaultMaxValue,
  defaultGeography,
  currency,
  renewalOfDecisionId,
  onClose,
  onCreated,
}: ApplyDialogProps) {
  const create = useApiMutation(api.createSupplierApplication);
  const [categoryId, setCategoryId] = useState(
    defaultCategoryId === null ? '' : String(defaultCategoryId),
  );
  const [maxValue, setMaxValue] = useState({
    amount: defaultMaxValue?.amount ?? '',
    currency: defaultMaxValue?.currency ?? currency,
  });
  const [geography, setGeography] = useState(defaultGeography ?? '');
  const [tried, setTried] = useState(false);
  const body = {
    programId,
    scopeCategoryId: categoryId === '' ? undefined : Number(categoryId),
    scopeMaxValue: moneyOrNull(maxValue),
    scopeGeography: textOrNull(geography),
    renewalOfDecisionId,
  };
  const errors = errorLookup(
    tried ? validateWith(CreateApplicationBody, body) : [],
    create.error,
    FIELDS,
  );

  const submit = (): void => {
    setTried(true);
    const parsed = CreateApplicationBody.safeParse(body);
    if (!parsed.success) return;
    void runCommand(() => create.mutate({ body: parsed.data }), onCreated);
  };

  return (
    <Dialog
      open
      title={
        renewalOfDecisionId === null
          ? t('qualification.apply.title', { program: programName })
          : t('qualification.apply.renewTitle', { program: programName })
      }
      description={t('qualification.apply.description', { buyer: buyerName })}
      onClose={onClose}
      dismissible={!create.pending}
      footer={
        <>
          <Button onClick={onClose} disabled={create.pending}>
            {t('qualification.common.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} loading={create.pending}>
            {renewalOfDecisionId === null
              ? t('qualification.apply.confirm')
              : t('qualification.apply.renewConfirm')}
          </Button>
        </>
      }
    >
      <Banner tone="info">{t('qualification.apply.draftNote')}</Banner>
      <FormErrorSummary title={summaryTitle(create.error)} errors={errors.other} />
      <div className="tiq-form-grid">
        <Select
          label={t('qualification.apply.category')}
          required
          placeholder={t('qualification.common.select')}
          value={categoryId}
          onChange={setCategoryId}
          error={errors.forField('scopeCategoryId')}
          options={categories.map((category) => ({
            value: String(category.categoryId),
            label: categoryLabel(category),
          }))}
        />
        <MoneyInput
          label={t('qualification.apply.maxValue')}
          hint={t('qualification.apply.maxValueHint')}
          value={maxValue}
          currencies={[maxValue.currency]}
          onChange={setMaxValue}
          error={errors.forField('scopeMaxValue')}
        />
        <TextField
          label={t('qualification.apply.geography')}
          value={geography}
          onChange={setGeography}
          error={errors.forField('scopeGeography')}
          fieldClassName="tiq-form-full"
        />
      </div>
    </Dialog>
  );
}
