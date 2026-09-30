/**
 * BUY-34 "Recommend within the reviewer's authority": the assessor proposes the outcome, scope and conditions with
 * a rationale. The application moves to decision_pending and, where the program requires it, independent approval
 * is requested. The proposal is confirmed with the acting organization and capacity (COM-02).
 */
import { useState } from 'react';

import { RecommendBody, qualificationEndpoints as api } from '@contracts/qualification';
import type {
  BuyerApplicationDetail,
  QualificationOptions,
  RecommendationResult,
} from '@contracts/qualification';
import type { QualificationDecisionsOutcome } from '@contracts/enums';

import { useApiMutation } from '../../../api/hooks';
import {
  Button,
  ConfirmActionDialog,
  Dialog,
  FormErrorSummary,
  RadioGroup,
  TextArea,
  UnsavedChangesGuard,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { summaryTitle, withQualificationMessage } from '../lib/errors';
import { runCommand, useDefaultCurrency } from '../lib/hooks';
import { errorLookup, moneyOrNull, textOrNull, validateWith } from '../lib/validation';
import { ConditionFields, ScopeFields } from './TermFields';
import type { ConditionValue, ScopeValue } from './TermFields';
import { gateText, scopeText } from '../lib/text';

type Proposed = Extract<
  QualificationDecisionsOutcome,
  'qualified' | 'qualified_with_conditions' | 'not_qualified'
>;
const PROPOSED: readonly Proposed[] = ['qualified', 'qualified_with_conditions', 'not_qualified'];

const FIELDS = [
  'proposedOutcome',
  'scopeCategoryId',
  'scopeMaxValue',
  'scopeGeography',
  'conditions',
  'allowedActivities',
  'blockedGate',
  'rationale',
];

export interface RecommendDialogProps {
  readonly application: BuyerApplicationDetail;
  readonly options: QualificationOptions | undefined;
  readonly onClose: () => void;
  readonly onRecommended: (result: RecommendationResult) => void;
}

export function RecommendDialog({
  application,
  options,
  onClose,
  onRecommended,
}: RecommendDialogProps) {
  const recommend = useApiMutation(api.recommendOutcome);
  const defaultCurrency = useDefaultCurrency();
  const currencies = options?.currencies ?? [
    application.scopeMaxValue?.currency ?? defaultCurrency,
  ];
  const [outcome, setOutcome] = useState<Proposed | ''>('');
  const [scope, setScope] = useState<ScopeValue>({
    categoryId: String(application.scopeCategory.categoryId),
    maxValue: {
      amount: application.scopeMaxValue?.amount ?? '',
      currency: application.scopeMaxValue?.currency ?? currencies[0] ?? defaultCurrency,
    },
    geography: application.scopeGeography ?? '',
  });
  const [terms, setTerms] = useState<ConditionValue>({
    conditions: '',
    allowedActivities: '',
    blockedGate: 'none',
  });
  const [rationale, setRationale] = useState('');
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const body = {
    proposedOutcome: outcome === '' ? undefined : outcome,
    scopeCategoryId: scope.categoryId === '' ? undefined : Number(scope.categoryId),
    scopeMaxValue: moneyOrNull(scope.maxValue),
    scopeGeography: textOrNull(scope.geography),
    conditions: textOrNull(terms.conditions),
    allowedActivities: textOrNull(terms.allowedActivities),
    blockedGate: terms.blockedGate,
    rationale,
  };
  const errors = errorLookup(
    tried ? validateWith(RecommendBody, body) : [],
    confirming ? null : recommend.error,
    FIELDS,
  );
  const category = application.programCoveredCategories.find(
    (item) => String(item.categoryId) === scope.categoryId,
  );

  const review = (): void => {
    setTried(true);
    if (!RecommendBody.safeParse(body).success) return;
    recommend.reset();
    setConfirming(true);
  };

  const confirm = async (): Promise<void> => {
    const parsed = RecommendBody.safeParse(body);
    if (!parsed.success) return;
    await runCommand(
      () => recommend.mutate({ params: { applicationId: application.id }, body: parsed.data }),
      onRecommended,
    );
  };

  if (confirming) {
    return (
      <ConfirmActionDialog
        open
        title={t('qualification.recommend.confirmTitle')}
        scope={t('qualification.recommend.scope', {
          reference: application.reference,
          supplier: application.supplier.name,
          outcome: outcome === '' ? '' : tEnum('qualification_decisions.outcome', outcome),
          terms: scopeText(
            category ?? application.scopeCategory,
            body.scopeMaxValue,
            body.scopeGeography,
          ),
        })}
        consequence={
          application.requiresIndependentApproval
            ? t('qualification.recommend.consequenceApproval', {
                gate: gateText(terms.blockedGate),
              })
            : t('qualification.recommend.consequence', { gate: gateText(terms.blockedGate) })
        }
        confirmLabel={t('qualification.recommend.confirm')}
        pending={recommend.pending}
        error={withQualificationMessage(recommend.error)}
        onConfirm={confirm}
        onCancel={() => setConfirming(false)}
      />
    );
  }

  return (
    <Dialog
      open
      size="lg"
      title={t('qualification.recommend.title', { reference: application.reference })}
      description={t('qualification.recommend.description')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('qualification.common.cancel')}</Button>
          <Button variant="primary" onClick={review}>
            {t('qualification.recommend.review')}
          </Button>
        </>
      }
    >
      <UnsavedChangesGuard when={outcome !== '' || rationale !== ''} />
      <FormErrorSummary title={summaryTitle(recommend.error)} errors={errors.other} />
      <div className="tiq-form-grid">
        <div className="tiq-form-full">
          <RadioGroup
            label={t('qualification.recommend.outcome')}
            required
            inline
            value={outcome}
            onChange={(value) => setOutcome(value as Proposed)}
            error={errors.forField('proposedOutcome')}
            options={PROPOSED.map((value) => ({
              value,
              label: tEnum('qualification_decisions.outcome', value),
            }))}
          />
        </div>
        <ScopeFields
          value={scope}
          onChange={setScope}
          categories={application.programCoveredCategories}
          currencies={currencies}
          errors={errors}
        />
        <ConditionFields
          value={terms}
          onChange={setTerms}
          required={outcome === 'qualified_with_conditions'}
          errors={errors}
        />
        <TextArea
          label={t('qualification.recommend.rationale')}
          hint={t('qualification.recommend.rationaleHint')}
          required
          rows={4}
          value={rationale}
          onChange={setRationale}
          error={errors.forField('rationale')}
          fieldClassName="tiq-form-full"
        />
      </div>
    </Dialog>
  );
}
