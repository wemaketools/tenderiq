/**
 * BUY-24 — Recommend a conditional preferred bidder: the comparison of candidates, the proposed supplier and lot,
 * value, rationale, risks and remaining checks (the diligence plan), authorized negotiation topics, the decision
 * owner, the contingency and the fallback candidate. The recommendation is saved as proposed and then goes for
 * approval; preferred status stays conditional (FR-16, BR-31).
 */
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router';

import { selectionEndpoints } from '@contracts/selection';

import { useApiMutation, useApiQuery } from '../../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  FormErrorSummary,
  PageHeader,
  Select,
  TextArea,
  UnsavedChangesGuard,
  formErrors,
} from '../../../../components/ui';
import { t } from '../../../../lib/i18n';
import { CandidateTable } from '../../components/CandidateTable';
import { SelectionPage } from '../../components/SelectionPage';
import { TenderMoneyInput } from '../../components/TenderMoneyInput';
import { TenderSelect } from '../../components/TenderSelect';
import { selectionErrorMessage } from '../../lib/errors';
import { useDefaultCurrency, useTenderSearchParam } from '../../lib/hooks';
import { bidLabel } from '../../lib/labels';
import { attempt, idOf, linesOf } from '../../lib/lists';
import { hasCurrency, resolveMoney, tenderCurrencies } from '../../lib/money';
import { selectionPaths } from '../../lib/paths';

const FIELDS = [
  'tenderId',
  'lotId',
  'bidId',
  'scope',
  'proposedValue',
  'rationale',
  'remainingChecks',
  'negotiationTopics',
  'decisionOwnerUserId',
  'contingencyPlan',
  'fallbackBidId',
];

interface Draft {
  readonly tender: string;
  readonly lot: string;
  readonly bid: string;
  readonly scope: string;
  readonly value: { readonly amount: string; readonly currency: string };
  readonly rationale: string;
  readonly checks: string;
  readonly topics: string;
  readonly owner: string;
  readonly contingency: string;
  readonly fallback: string;
}

export default function PreferredBidderFormPage() {
  const navigate = useNavigate();
  const linkedTender = useTenderSearchParam();
  const organizationCurrency = useDefaultCurrency();
  const [draft, setDraft] = useState<Draft>({
    tender: linkedTender === null ? '' : String(linkedTender),
    lot: '',
    bid: '',
    scope: '',
    value: { amount: '', currency: '' },
    rationale: '',
    checks: '',
    topics: '',
    owner: '',
    contingency: '',
    fallback: '',
  });
  const [touched, setTouched] = useState(false);
  const [dirty, setDirty] = useState(false);
  const recommend = useApiMutation(selectionEndpoints.recommendPreferredBidder);
  const tenderId = idOf(draft.tender);
  const summary = useApiQuery(
    selectionEndpoints.getTender,
    tenderId === undefined ? null : { params: { tenderId } },
  );
  const server = formErrors(recommend.error, FIELDS);
  const required = t('selection.form.required');
  const lotId = idOf(draft.lot);
  const candidates = (summary.data?.candidates ?? []).filter(
    (candidate) => lotId === undefined || candidate.lot === null || candidate.lot.lotId === lotId,
  );
  const eligible = candidates.filter((candidate) => candidate.passesGates);
  const currencies = tenderCurrencies(
    candidates.map((candidate) => candidate.evaluatedValue),
    organizationCurrency,
  );
  const proposedValue = resolveMoney(draft.value, currencies);

  const update = (values: Partial<Draft>): void => {
    setDraft((current) => ({ ...current, ...values }));
    setDirty(true);
  };
  const missing = {
    tender: tenderId === undefined,
    bid: idOf(draft.bid) === undefined,
    scope: draft.scope.trim() === '',
    value: draft.value.amount === '',
    currency: !hasCurrency(proposedValue),
    rationale: draft.rationale.trim() === '',
    checks: draft.checks.trim() === '',
    owner: idOf(draft.owner) === undefined,
    contingency: draft.contingency.trim() === '',
  };
  const fallbackSame = draft.fallback !== '' && draft.fallback === draft.bid;
  const err = (key: keyof typeof missing, field: string): string | undefined =>
    (touched && missing[key] ? required : undefined) ?? server.forField(field);

  const submit = async (): Promise<void> => {
    setTouched(true);
    const bidId = idOf(draft.bid);
    const owner = idOf(draft.owner);
    if (Object.values(missing).some(Boolean) || fallbackSame) return;
    if (tenderId === undefined || bidId === undefined || owner === undefined) return;
    const created = await attempt(
      recommend.mutate({
        body: {
          tenderId,
          lotId: lotId ?? null,
          bidId,
          scope: draft.scope.trim(),
          proposedValue,
          rationale: draft.rationale.trim(),
          remainingChecks: draft.checks.trim(),
          negotiationTopics: linesOf(draft.topics),
          decisionOwnerUserId: owner,
          contingencyPlan: draft.contingency.trim(),
          fallbackBidId: idOf(draft.fallback) ?? null,
        },
      }),
    );
    if (created === undefined) return;
    flushSync(() => setDirty(false));
    void navigate(selectionPaths.preferredBidder(created.preferredBidderId), {
      state: { record: created },
    });
  };

  return (
    <SelectionPage
      header={
        <PageHeader
          title={t('selection.preferredForm.title')}
          subtitle={t('selection.preferredForm.intro')}
          back={{ to: selectionPaths.preferredBidders, label: t('selection.preferred.title') }}
        />
      }
    >
      <UnsavedChangesGuard when={dirty && !recommend.pending} />
      <Banner tone="info" title={t('selection.preferredForm.conditionalTitle')}>
        <p>{t('selection.preferredForm.conditionalBody')}</p>
      </Banner>
      <form
        className="tiq-stack"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {recommend.error !== null && (
          <FormErrorSummary title={selectionErrorMessage(recommend.error)} errors={server.other} />
        )}
        <Card title={t('selection.preferredForm.proposal')}>
          <div className="tiq-form-grid">
            <TenderSelect
              mode="form"
              value={draft.tender}
              onChange={(tender) => update({ tender, lot: '', bid: '', fallback: '', owner: '' })}
              error={touched && missing.tender ? required : server.forField('tenderId')}
            />
            <Select
              label={t('selection.common.lot')}
              placeholder={t('selection.common.wholeTender')}
              value={draft.lot}
              options={(summary.data?.lots ?? []).map((lot) => ({
                value: String(lot.lotId),
                label: t('selection.common.lotLabel', { lotNo: lot.lotNo, title: lot.title }),
              }))}
              onChange={(lot) => update({ lot, bid: '', fallback: '' })}
              error={server.forField('lotId')}
            />
            <Select
              label={t('selection.preferredForm.bid')}
              placeholder={t('selection.form.select')}
              required
              value={draft.bid}
              options={eligible.map((candidate) => ({
                value: String(candidate.bid.bidId),
                label: bidLabel(candidate.bid),
              }))}
              onChange={(bid) => update({ bid })}
              error={err('bid', 'bidId')}
            />
            <TenderMoneyInput
              label={t('selection.preferredForm.value')}
              required
              currencies={currencies}
              currencyError={
                touched && missing.currency ? t('selection.form.currencyRequired') : undefined
              }
              value={draft.value}
              onChange={(value) => update({ value })}
              error={err('value', 'proposedValue')}
            />
            <TextArea
              label={t('selection.preferredForm.scope')}
              hint={t('selection.preferredForm.scopeHint')}
              required
              rows={2}
              fieldClassName="tiq-form-full"
              value={draft.scope}
              onChange={(scope) => update({ scope })}
              error={err('scope', 'scope')}
            />
            <TextArea
              label={t('selection.preferredForm.rationale')}
              required
              rows={4}
              fieldClassName="tiq-form-full"
              value={draft.rationale}
              onChange={(rationale) => update({ rationale })}
              error={err('rationale', 'rationale')}
            />
          </div>
        </Card>
        {summary.data !== undefined && (
          <Card
            title={t('selection.preferredForm.comparison')}
            subtitle={t('selection.preferredForm.comparisonHint')}
            flush
          >
            <CandidateTable
              candidates={candidates}
              caption={t('selection.preferredForm.comparison')}
              preferredBidId={idOf(draft.bid)}
              fallbackBidId={idOf(draft.fallback) ?? null}
            />
          </Card>
        )}
        <Card title={t('selection.preferredForm.conditions')}>
          <div className="tiq-form-grid">
            <TextArea
              label={t('selection.preferredForm.remainingChecks')}
              hint={t('selection.preferredForm.remainingChecksHint')}
              required
              rows={3}
              fieldClassName="tiq-form-full"
              value={draft.checks}
              onChange={(checks) => update({ checks })}
              error={err('checks', 'remainingChecks')}
            />
            <TextArea
              label={t('selection.preferredForm.topics')}
              hint={t('selection.preferredForm.topicsHint')}
              rows={3}
              value={draft.topics}
              onChange={(topics) => update({ topics })}
              error={server.forField('negotiationTopics')}
            />
            <Select
              label={t('selection.preferredForm.owner')}
              placeholder={t('selection.form.select')}
              required
              value={draft.owner}
              options={(summary.data?.eligible.decisionOwners ?? []).map((person) => ({
                value: String(person.userId),
                label: person.fullName,
              }))}
              onChange={(owner) => update({ owner })}
              error={err('owner', 'decisionOwnerUserId')}
            />
            <TextArea
              label={t('selection.preferredForm.contingency')}
              hint={t('selection.preferredForm.contingencyHint')}
              required
              rows={3}
              fieldClassName="tiq-form-full"
              value={draft.contingency}
              onChange={(contingency) => update({ contingency })}
              error={err('contingency', 'contingencyPlan')}
            />
            <Select
              label={t('selection.preferredForm.fallback')}
              placeholder={t('selection.preferredForm.noFallback')}
              value={draft.fallback}
              options={eligible
                .filter((candidate) => String(candidate.bid.bidId) !== draft.bid)
                .map((candidate) => ({
                  value: String(candidate.bid.bidId),
                  label: bidLabel(candidate.bid),
                }))}
              onChange={(fallback) => update({ fallback })}
              error={
                fallbackSame
                  ? t('selection.preferredForm.fallbackSame')
                  : server.forField('fallbackBidId')
              }
            />
          </div>
        </Card>
        <div className="tiq-inline">
          <Button type="submit" variant="primary" icon="check" loading={recommend.pending}>
            {t('selection.preferredForm.submit')}
          </Button>
          <Button type="button" onClick={() => void navigate(selectionPaths.preferredBidders)}>
            {t('selection.form.cancel')}
          </Button>
          <span className="tiq-text-muted">{t('selection.preferredForm.savedAsProposed')}</span>
        </div>
      </form>
    </SelectionPage>
  );
}
