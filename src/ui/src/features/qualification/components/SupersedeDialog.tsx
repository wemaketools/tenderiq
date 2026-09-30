/**
 * BUY-35 "Suspend, reinstate, withdraw, confirm conditions or reassess": always a NEW decision that supersedes the
 * current one; the earlier decision is kept unchanged (DD-20). It may answer an open reassessment trigger (AC-09).
 * The form is reviewed, then confirmed with the acting organization and capacity (COM-02).
 */
import { useState } from 'react';

import { SupersedeDecisionBody, qualificationEndpoints as api } from '@contracts/qualification';
import type { DecisionDetail, QualificationOptions } from '@contracts/qualification';
import { QUALIFICATION_DECISIONS_OUTCOME } from '@contracts/enums';
import type { QualificationDecisionsOutcome } from '@contracts/enums';

import { useApiMutation } from '../../../api/hooks';
import {
  Button,
  ConfirmActionDialog,
  Dialog,
  FormErrorSummary,
  Select,
  TextArea,
} from '../../../components/ui';
import { formatCalendarDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { DECISION_FIELDS, decisionFields, seedDraft, useDecisionDraft } from '../lib/decisionDraft';
import { summaryTitle, withQualificationMessage } from '../lib/errors';
import { runCommand, useDefaultCurrency } from '../lib/hooks';
import { gateText, scopeText } from '../lib/text';
import { errorLookup, validateWith } from '../lib/validation';
import { DecisionFormFields } from './DecisionForm';

const OUTCOMES: readonly QualificationDecisionsOutcome[] = QUALIFICATION_DECISIONS_OUTCOME.filter(
  (value) => value !== 'expired',
);

export interface SupersedeDialogProps {
  readonly decision: DecisionDetail;
  readonly options: QualificationOptions | undefined;
  readonly today: string;
  /** Preselects the trigger this decision answers. */
  readonly triggerId?: number | null;
  readonly onClose: () => void;
  readonly onSuperseded: (next: DecisionDetail) => void;
}

export function SupersedeDialog({
  decision,
  options,
  today,
  triggerId = null,
  onClose,
  onSuperseded,
}: SupersedeDialogProps) {
  const supersede = useApiMutation(api.supersedeDecision);
  const defaultCurrency = useDefaultCurrency();
  const { draft, setDraft, dirty } = useDecisionDraft(() =>
    seedDraft({
      outcome: '',
      categoryId: decision.scopeCategory.categoryId,
      maxValue: decision.scopeMaxValue,
      geography: decision.scopeGeography,
      conditions: decision.conditions,
      allowedActivities: decision.allowedActivities,
      blockedGate: decision.blockedGate,
      effectiveFrom: today,
      effectiveTo: decision.effectiveTo,
      reassessmentDate: decision.reassessmentDate,
      appealRoute: decision.appealRoute,
      currency: decision.scopeMaxValue?.currency ?? options?.currencies[0] ?? defaultCurrency,
    }),
  );
  const [supersedeReason, setSupersedeReason] = useState('');
  const openTriggers = decision.triggers.filter((trigger) => trigger.status === 'open');
  const [trigger, setTrigger] = useState(triggerId === null ? '' : String(triggerId));
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const body = {
    ...decisionFields(draft),
    supersedeReason,
    triggerId: trigger === '' ? null : Number(trigger),
  };
  const errors = errorLookup(
    tried ? validateWith(SupersedeDecisionBody, body) : [],
    confirming ? null : supersede.error,
    DECISION_FIELDS,
  );
  const category = decision.programCoveredCategories.find(
    (item) => String(item.categoryId) === draft.scope.categoryId,
  );

  const review = (): void => {
    setTried(true);
    if (!SupersedeDecisionBody.safeParse(body).success) return;
    supersede.reset();
    setConfirming(true);
  };

  if (confirming) {
    return (
      <ConfirmActionDialog
        open
        title={t('qualification.supersede.confirmTitle')}
        scope={t('qualification.supersede.scope', {
          id: decision.id,
          supplier: decision.supplier.name,
          program: decision.program.programName,
          outcome:
            draft.outcome === '' ? '' : tEnum('qualification_decisions.outcome', draft.outcome),
          terms: scopeText(
            category ?? decision.scopeCategory,
            body.scopeMaxValue,
            body.scopeGeography,
          ),
        })}
        consequence={t('qualification.supersede.consequence', {
          from: formatCalendarDate(draft.effectiveFrom),
          gate: gateText(draft.terms.blockedGate),
          notice: draft.notifySupplier
            ? t('qualification.decide.notified')
            : t('qualification.decide.notNotified'),
        })}
        tone={
          draft.outcome === 'suspended' ||
          draft.outcome === 'withdrawn' ||
          draft.outcome === 'not_qualified'
            ? 'danger'
            : 'primary'
        }
        confirmLabel={t('qualification.supersede.confirm')}
        pending={supersede.pending}
        error={withQualificationMessage(supersede.error)}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          const parsed = SupersedeDecisionBody.safeParse(body);
          if (!parsed.success) return;
          return runCommand(
            () => supersede.mutate({ params: { decisionId: decision.id }, body: parsed.data }),
            onSuperseded,
          );
        }}
      />
    );
  }

  return (
    <Dialog
      open
      size="lg"
      title={t('qualification.supersede.title', { id: decision.id })}
      description={t('qualification.supersede.description')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('qualification.common.cancel')}</Button>
          <Button variant="primary" onClick={review}>
            {t('qualification.supersede.review')}
          </Button>
        </>
      }
    >
      <FormErrorSummary title={summaryTitle(supersede.error)} errors={errors.other} />
      <div className="tiq-form-stack">
        <TextArea
          label={t('qualification.supersede.reason')}
          hint={t('qualification.supersede.reasonHint')}
          required
          rows={2}
          value={supersedeReason}
          onChange={setSupersedeReason}
          error={errors.forField('supersedeReason')}
        />
        {openTriggers.length > 0 && (
          <Select
            label={t('qualification.supersede.trigger')}
            placeholder={t('qualification.supersede.noTrigger')}
            value={trigger}
            onChange={setTrigger}
            error={errors.forField('triggerId')}
            options={openTriggers.map((item) => ({
              value: String(item.id),
              label: `${t('qualification.trigger.triggerNo', { id: item.id })} — ${item.summary}`,
            }))}
          />
        )}
        <DecisionFormFields
          draft={draft}
          onChange={setDraft}
          outcomes={OUTCOMES}
          categories={decision.programCoveredCategories}
          currencies={options?.currencies ?? [draft.scope.maxValue.currency]}
          errors={errors}
          dirty={dirty || supersedeReason !== ''}
        />
      </div>
    </Dialog>
  );
}
