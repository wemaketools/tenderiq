/**
 * The draft recommendation editor (BUY-26): the assembled rationale (compliant offers, affordability, conflicts,
 * exceptions, negotiation, unresolved conditions) and one explicit outcome per lot. "No award" and "cancelled" are
 * lot outcomes with a reason (FR-17). Saving keeps the recommendation a DRAFT; submitting is a separate step.
 */
import { useState } from 'react';

import { UpdateRecommendationBody, updateRecommendation } from '@contracts/awards';
import type {
  LotOutcomeInput,
  RecommendationDetail,
  UpdateRecommendationBody as UpdateBody,
} from '@contracts/awards';
import type { FieldError } from '@contracts/common';
import { LOT_OUTCOMES_OUTCOME } from '@contracts/enums';
import type { LotOutcomesOutcome } from '@contracts/enums';

import { useApiMutation } from '../../../api/hooks';
import {
  Button,
  Card,
  FormErrorSummary,
  MoneyInput,
  Select,
  TextArea,
  UnsavedChangesGuard,
} from '../../../components/ui';
import { formatMoney } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { awardErrorMessage } from '../lib/errors';
import { lotLabel } from '../lib/labels';
import { errorLookup, validateWith } from '../lib/validation';

const AWARDING: readonly LotOutcomesOutcome[] = ['award', 'partial_award', 'conditional_award'];

const TEXT_FIELDS = [
  'summary',
  'compliantOffersSummary',
  'affordabilitySummary',
  'conflictsSummary',
  'exceptionsSummary',
  'negotiationSummary',
  'unresolvedConditions',
] as const;
type TextField = (typeof TEXT_FIELDS)[number];

interface LotDraft {
  readonly lotId: number;
  readonly outcome: LotOutcomesOutcome;
  readonly bidId: string;
  readonly amount: string;
  readonly conditions: string;
  readonly reason: string;
}

interface Draft {
  readonly texts: Readonly<Record<TextField, string>>;
  readonly lots: readonly LotDraft[];
}

function draftOf(detail: RecommendationDetail): Draft {
  return {
    texts: {
      summary: detail.summary,
      compliantOffersSummary: detail.compliantOffersSummary,
      affordabilitySummary: detail.affordabilitySummary,
      conflictsSummary: detail.conflictsSummary,
      exceptionsSummary: detail.exceptionsSummary,
      negotiationSummary: detail.negotiationSummary,
      unresolvedConditions: detail.unresolvedConditions,
    },
    lots: detail.lotOutcomes.map((outcome) => ({
      lotId: outcome.lot.lotId,
      outcome: outcome.outcome,
      bidId: outcome.bidId === null ? '' : String(outcome.bidId),
      amount: outcome.awardedValue?.amount ?? '',
      conditions: outcome.conditions ?? '',
      reason: outcome.reason ?? '',
    })),
  };
}

function bodyOf(draft: Draft, currency: string): UpdateBody {
  const lotOutcomes: LotOutcomeInput[] = draft.lots.map((lot) => {
    const awarding = AWARDING.includes(lot.outcome);
    return {
      lotId: lot.lotId,
      outcome: lot.outcome,
      bidId: awarding && lot.bidId !== '' ? Number(lot.bidId) : null,
      awardedValue: awarding && lot.amount !== '' ? { amount: lot.amount, currency } : null,
      conditions: lot.conditions.trim() === '' ? null : lot.conditions.trim(),
      reason: lot.reason.trim() === '' ? null : lot.reason.trim(),
    };
  });
  return { ...draft.texts, lotOutcomes };
}

function sameDraft(a: Draft, b: Draft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface RecommendationEditorProps {
  readonly detail: RecommendationDetail;
  readonly onSaved: (detail: RecommendationDetail) => void;
  readonly onCancel: () => void;
}

export function RecommendationEditor({ detail, onSaved, onCancel }: RecommendationEditorProps) {
  const [initial] = useState(() => draftOf(detail));
  const [draft, setDraft] = useState<Draft>(initial);
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const save = useApiMutation(updateRecommendation);
  const currency = detail.tender.currency;
  const dirty = !sameDraft(draft, initial);

  const known = [
    ...TEXT_FIELDS,
    ...draft.lots.flatMap((_, index) =>
      ['outcome', 'bidId', 'awardedValue', 'conditions', 'reason'].map(
        (field) => `lotOutcomes.${index}.${field}`,
      ),
    ),
  ];
  const errors = errorLookup(clientErrors, save.error, known);

  const setText = (field: TextField, value: string): void =>
    setDraft((current) => ({ ...current, texts: { ...current.texts, [field]: value } }));
  const setLot = (index: number, change: Partial<LotDraft>): void =>
    setDraft((current) => ({
      ...current,
      lots: current.lots.map((lot, i) => (i === index ? { ...lot, ...change } : lot)),
    }));

  const submit = async (): Promise<void> => {
    const body = bodyOf(draft, currency);
    const found = validateWith(UpdateRecommendationBody, body);
    setClientErrors(found);
    if (found.length > 0) return;
    try {
      const saved = await save.mutate({
        params: { recommendationId: detail.recommendationId },
        body,
      });
      onSaved(saved);
    } catch {
      // The summary shows the error.
    }
  };

  return (
    <form
      className="tiq-stack tiq-stack--spaced"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <UnsavedChangesGuard when={dirty && !save.pending} />
      <FormErrorSummary
        title={save.error === null ? null : awardErrorMessage(save.error)}
        errors={errors.other}
      />
      <Card title={t('awards.editor.rationaleTitle')} subtitle={t('awards.editor.rationaleHint')}>
        <div className="tiq-form-grid">
          {TEXT_FIELDS.map((field) => (
            <TextArea
              key={field}
              fieldClassName="tiq-form-full"
              label={t(`awards.recommendation.text.${field}`)}
              value={draft.texts[field]}
              error={errors.forField(field)}
              onChange={(value) => setText(field, value)}
              rows={3}
            />
          ))}
        </div>
      </Card>
      <Card title={t('awards.editor.outcomesTitle')} subtitle={t('awards.editor.outcomesHint')}>
        <div className="tiq-stack tiq-stack--spaced">
          {draft.lots.map((lot, index) => {
            const source = detail.lotOutcomes.find((row) => row.lot.lotId === lot.lotId);
            const awarding = AWARDING.includes(lot.outcome);
            const offers = detail.offers.filter(
              (offer) => source !== undefined && offer.lotNos.includes(source.lot.lotNo),
            );
            const path = `lotOutcomes.${index}`;
            return (
              <fieldset key={lot.lotId} className="tiq-fieldset">
                <legend className="tiq-form-section-title">
                  {source === undefined ? String(lot.lotId) : lotLabel(source.lot)}
                </legend>
                <div className="tiq-form-grid">
                  <Select
                    label={t('awards.editor.outcome')}
                    required
                    value={lot.outcome}
                    error={errors.forField(`${path}.outcome`)}
                    options={LOT_OUTCOMES_OUTCOME.map((value) => ({
                      value,
                      label: tEnum('lot_outcomes.outcome', value),
                    }))}
                    onChange={(value) => {
                      const outcome = LOT_OUTCOMES_OUTCOME.find((item) => item === value);
                      if (outcome !== undefined) setLot(index, { outcome });
                    }}
                  />
                  {awarding && (
                    <Select
                      label={t('awards.editor.offer')}
                      required
                      placeholder={t('awards.editor.chooseOffer')}
                      value={lot.bidId}
                      error={errors.forField(`${path}.bidId`)}
                      options={offers.map((offer) => ({
                        value: String(offer.bidId),
                        label:
                          offer.evaluatedPrice === null
                            ? offer.supplier.name
                            : `${offer.supplier.name} · ${formatMoney(offer.evaluatedPrice)}`,
                      }))}
                      onChange={(bidId) => setLot(index, { bidId })}
                    />
                  )}
                  {awarding && (
                    <MoneyInput
                      label={t('awards.editor.value')}
                      required
                      value={{ amount: lot.amount, currency }}
                      currencies={[currency]}
                      error={errors.forField(`${path}.awardedValue`)}
                      onChange={(value) => setLot(index, { amount: value.amount })}
                    />
                  )}
                  <TextArea
                    label={t('awards.editor.conditions')}
                    required={lot.outcome === 'conditional_award'}
                    value={lot.conditions}
                    error={errors.forField(`${path}.conditions`)}
                    onChange={(conditions) => setLot(index, { conditions })}
                    rows={2}
                  />
                  <TextArea
                    label={t('awards.editor.reason')}
                    hint={awarding ? undefined : t('awards.editor.reasonHint')}
                    required={!awarding}
                    value={lot.reason}
                    error={errors.forField(`${path}.reason`)}
                    onChange={(reason) => setLot(index, { reason })}
                    rows={2}
                  />
                </div>
              </fieldset>
            );
          })}
        </div>
      </Card>
      <div className="tiq-inline">
        <Button type="submit" variant="primary" icon="check" loading={save.pending}>
          {t('awards.editor.save')}
        </Button>
        <Button type="button" onClick={onCancel} disabled={save.pending}>
          {t('awards.common.cancel')}
        </Button>
        <span className="tiq-text-muted">{t('awards.editor.saveHint')}</span>
      </div>
    </form>
  );
}
