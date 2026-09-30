/**
 * BUY-27 — Open a negotiation with its mandate: the preferred bid, authorized topics, authorized negotiators and the
 * commercial authority. Where the issued conditions do not permit negotiation, the form explains every blocking
 * reason and offers a process decision instead (BR-30, AC-23). The mandate then goes for approval.
 */
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router';

import { selectionEndpoints } from '@contracts/selection';

import { useApiMutation, useApiQuery } from '../../../../api/hooks';
import { usePermission } from '../../../../auth/permissions';
import {
  Button,
  Card,
  FormErrorSummary,
  MultiSelect,
  PageHeader,
  Select,
  TextArea,
  UnsavedChangesGuard,
  formErrors,
} from '../../../../components/ui';
import { t } from '../../../../lib/i18n';
import { GatePanel } from '../../components/GatePanel';
import { ProcessDecisionDialog } from '../../components/ProcessDecisionDialog';
import { SelectionPage } from '../../components/SelectionPage';
import { TenderMoneyInput } from '../../components/TenderMoneyInput';
import { TenderSelect } from '../../components/TenderSelect';
import { selectionErrorMessage } from '../../lib/errors';
import { useDefaultCurrency, useTenderSearchParam } from '../../lib/hooks';
import { bidLabel } from '../../lib/labels';
import { attempt, idOf, linesOf } from '../../lib/lists';
import { hasCurrency, resolveMoney, tenderCurrencies } from '../../lib/money';
import { selectionPaths } from '../../lib/paths';
import { PROCESS_DECISION_PROPOSE } from '../../lib/permissions';

const FIELDS = [
  'tenderId',
  'lotId',
  'bidId',
  'allowedTopics',
  'authorizedNegotiatorIds',
  'commercialAuthority',
];

export default function NegotiationFormPage() {
  const navigate = useNavigate();
  const linkedTender = useTenderSearchParam();
  const organizationCurrency = useDefaultCurrency();
  const canPropose = usePermission(PROCESS_DECISION_PROPOSE);
  const [tender, setTender] = useState(linkedTender === null ? '' : String(linkedTender));
  const [lot, setLot] = useState('');
  const [bid, setBid] = useState('');
  const [topics, setTopics] = useState('');
  const [negotiators, setNegotiators] = useState<string[]>([]);
  const [authority, setAuthority] = useState({ amount: '', currency: '' });
  const [touched, setTouched] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [proposing, setProposing] = useState(false);
  const open = useApiMutation(selectionEndpoints.openNegotiation);
  const tenderId = idOf(tender);
  const summary = useApiQuery(
    selectionEndpoints.getTender,
    tenderId === undefined ? null : { params: { tenderId } },
  );
  const server = formErrors(open.error, FIELDS);
  const required = t('selection.form.required');
  const lotId = idOf(lot);
  const currencies = tenderCurrencies(
    (summary.data?.candidates ?? []).map((candidate) => candidate.evaluatedValue),
    organizationCurrency,
  );
  const commercialAuthority = resolveMoney(authority, currencies);
  const gate = summary.data?.gates.negotiation;
  const blocked = gate !== undefined && !gate.allowed;
  const touch = (): void => setDirty(true);
  const errors = {
    tender: touched && tenderId === undefined ? required : undefined,
    bid: touched && bid === '' ? required : undefined,
    topics:
      touched && linesOf(topics).length === 0
        ? t('selection.negotiationForm.topicsRequired')
        : undefined,
    negotiators:
      touched && negotiators.length === 0
        ? t('selection.negotiationForm.negotiatorsRequired')
        : undefined,
    authority: touched && authority.amount === '' ? required : undefined,
    currency:
      touched && !hasCurrency(commercialAuthority)
        ? t('selection.form.currencyRequired')
        : undefined,
  };

  const submit = async (): Promise<void> => {
    setTouched(true);
    const bidId = idOf(bid);
    if (tenderId === undefined || bidId === undefined || blocked) return;
    if (linesOf(topics).length === 0 || negotiators.length === 0 || authority.amount === '') return;
    if (!hasCurrency(commercialAuthority)) return;
    const created = await attempt(
      open.mutate({
        body: {
          tenderId,
          lotId: lotId ?? null,
          bidId,
          allowedTopics: linesOf(topics),
          authorizedNegotiatorIds: negotiators.map(Number),
          commercialAuthority,
        },
      }),
    );
    if (created === undefined) return;
    flushSync(() => setDirty(false));
    void navigate(selectionPaths.negotiation(created.negotiationId), {
      state: { record: created },
    });
  };

  return (
    <SelectionPage
      header={
        <PageHeader
          title={t('selection.negotiationForm.title')}
          subtitle={t('selection.negotiationForm.intro')}
          back={{ to: selectionPaths.negotiations, label: t('selection.negotiations.title') }}
        />
      }
    >
      <UnsavedChangesGuard when={dirty && !open.pending} />
      {gate !== undefined && summary.data !== undefined && (
        <GatePanel
          gate={gate}
          blockedTitle={t('selection.tender.gate.negotiationBlocked')}
          allowedTitle={t('selection.negotiationForm.permitted')}
          actions={
            blocked && canPropose ? (
              <Button size="sm" icon="gavel" onClick={() => setProposing(true)}>
                {t('selection.processDecision.propose')}
              </Button>
            ) : undefined
          }
        />
      )}
      <form
        className="tiq-stack"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {open.error !== null && (
          <FormErrorSummary title={selectionErrorMessage(open.error)} errors={server.other} />
        )}
        <Card title={t('selection.negotiationForm.mandate')}>
          <div className="tiq-form-grid">
            <TenderSelect
              mode="form"
              value={tender}
              onChange={(value) => {
                setTender(value);
                setLot('');
                setBid('');
                setNegotiators([]);
                touch();
              }}
              error={errors.tender ?? server.forField('tenderId')}
            />
            <Select
              label={t('selection.common.lot')}
              placeholder={t('selection.common.wholeTender')}
              value={lot}
              options={(summary.data?.lots ?? []).map((item) => ({
                value: String(item.lotId),
                label: t('selection.common.lotLabel', { lotNo: item.lotNo, title: item.title }),
              }))}
              onChange={(value) => {
                setLot(value);
                touch();
              }}
              error={server.forField('lotId')}
            />
            <Select
              label={t('selection.negotiationForm.bid')}
              hint={t('selection.negotiationForm.bidHint')}
              placeholder={t('selection.form.select')}
              required
              value={bid}
              options={(summary.data?.candidates ?? [])
                .filter((candidate) => lotId === undefined || candidate.lot?.lotId === lotId)
                .map((candidate) => ({
                  value: String(candidate.bid.bidId),
                  label: bidLabel(candidate.bid),
                }))}
              onChange={(value) => {
                setBid(value);
                touch();
              }}
              error={errors.bid ?? server.forField('bidId')}
            />
            <TenderMoneyInput
              label={t('selection.negotiationForm.authority')}
              hint={t('selection.negotiationForm.authorityHint')}
              required
              currencies={currencies}
              currencyError={errors.currency}
              value={authority}
              onChange={(value) => {
                setAuthority(value);
                touch();
              }}
              error={errors.authority ?? server.forField('commercialAuthority')}
            />
            <TextArea
              label={t('selection.negotiationForm.topics')}
              hint={t('selection.negotiationForm.topicsHint')}
              required
              rows={4}
              value={topics}
              onChange={(value) => {
                setTopics(value);
                touch();
              }}
              error={errors.topics ?? server.forField('allowedTopics')}
            />
            <MultiSelect
              label={t('selection.negotiationForm.negotiators')}
              required
              value={negotiators}
              options={(summary.data?.eligible.negotiators ?? []).map((person) => ({
                value: String(person.userId),
                label: person.fullName,
              }))}
              onChange={(value) => {
                setNegotiators(value);
                touch();
              }}
              error={errors.negotiators ?? server.forField('authorizedNegotiatorIds')}
            />
          </div>
        </Card>
        <div className="tiq-inline">
          <Button
            type="submit"
            variant="primary"
            icon="check"
            loading={open.pending}
            disabled={blocked}
          >
            {t('selection.negotiationForm.submit')}
          </Button>
          <Button type="button" onClick={() => void navigate(selectionPaths.negotiations)}>
            {t('selection.form.cancel')}
          </Button>
          <span className="tiq-text-muted">{t('selection.negotiationForm.savedAsPlanned')}</span>
        </div>
      </form>
      {summary.data !== undefined && (
        <ProcessDecisionDialog
          open={proposing}
          onClose={() => setProposing(false)}
          tender={{
            tenderId: summary.data.tender.tenderId,
            reference: summary.data.tender.reference,
            title: summary.data.tender.title,
            officialTimeZone: summary.data.tender.officialTimeZone,
          }}
          defaultType="new_competition_required"
          context={t('selection.negotiationForm.decisionContext')}
        />
      )}
    </SelectionPage>
  );
}
