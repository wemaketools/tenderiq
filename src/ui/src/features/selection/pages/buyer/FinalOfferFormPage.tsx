/**
 * BUY-27 — Request final offers: instructions, permitted changes, the deadline in the tender's official time zone,
 * opening rules, evaluation treatment, the procedural authority and the invitees. Where the issued conditions do not
 * permit final offers the form shows every blocking reason and offers the required process decision instead; an
 * ordinary clarification never replaces a final-offer round (AC-23, BR-30).
 */
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router';

import { selectionEndpoints } from '@contracts/selection';

import { useApiMutation, useApiQuery } from '../../../../api/hooks';
import { usePermission } from '../../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  DateTimeInput,
  FormErrorSummary,
  MultiSelect,
  PageHeader,
  TextArea,
  TextField,
  UnsavedChangesGuard,
  formErrors,
} from '../../../../components/ui';
import { t } from '../../../../lib/i18n';
import { GatePanel } from '../../components/GatePanel';
import { ProcessDecisionDialog } from '../../components/ProcessDecisionDialog';
import { SelectionPage } from '../../components/SelectionPage';
import { TenderSelect } from '../../components/TenderSelect';
import { selectionErrorMessage } from '../../lib/errors';
import { useTenderSearchParam } from '../../lib/hooks';
import { bidLabel } from '../../lib/labels';
import { attempt, idOf } from '../../lib/lists';
import { selectionPaths } from '../../lib/paths';
import { PROCESS_DECISION_PROPOSE } from '../../lib/permissions';

const FIELDS = [
  'tenderId',
  'lotId',
  'instructions',
  'permittedChanges',
  'deadline',
  'openingRules',
  'evaluationTreatment',
  'proceduralAuthorityRef',
  'inviteeBidIds',
];

interface Draft {
  readonly instructions: string;
  readonly permittedChanges: string;
  readonly openingRules: string;
  readonly evaluationTreatment: string;
  readonly authority: string;
}

export default function FinalOfferFormPage() {
  const navigate = useNavigate();
  const linkedTender = useTenderSearchParam();
  const canPropose = usePermission(PROCESS_DECISION_PROPOSE);
  const [tender, setTender] = useState(linkedTender === null ? '' : String(linkedTender));
  const [draft, setDraft] = useState<Draft>({
    instructions: '',
    permittedChanges: '',
    openingRules: '',
    evaluationTreatment: '',
    authority: '',
  });
  const [deadline, setDeadline] = useState<string | null>(null);
  const [invitees, setInvitees] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [proposing, setProposing] = useState(false);
  const create = useApiMutation(selectionEndpoints.createFinalOfferRound);
  const tenderId = idOf(tender);
  const summary = useApiQuery(
    selectionEndpoints.getTender,
    tenderId === undefined ? null : { params: { tenderId } },
  );
  const server = formErrors(create.error, FIELDS);
  const required = t('selection.form.required');
  const gate = summary.data?.gates.finalOffer;
  const blocked = gate !== undefined && !gate.allowed;
  const zone = summary.data?.tender.officialTimeZone ?? 'UTC';
  const update = (values: Partial<Draft>): void => {
    setDraft((current) => ({ ...current, ...values }));
    setDirty(true);
  };
  const textError = (key: keyof Draft, field: string): string | undefined =>
    (touched && draft[key].trim() === '' ? required : undefined) ?? server.forField(field);

  const submit = async (): Promise<void> => {
    setTouched(true);
    if (tenderId === undefined || deadline === null || invitees.length === 0 || blocked) return;
    if (Object.values(draft).some((value) => value.trim() === '')) return;
    const created = await attempt(
      create.mutate({
        body: {
          tenderId,
          lotId: null,
          instructions: draft.instructions.trim(),
          permittedChanges: draft.permittedChanges.trim(),
          deadline,
          openingRules: draft.openingRules.trim(),
          evaluationTreatment: draft.evaluationTreatment.trim(),
          proceduralAuthorityRef: draft.authority.trim(),
          inviteeBidIds: invitees.map(Number),
        },
      }),
    );
    if (created === undefined) return;
    flushSync(() => setDirty(false));
    void navigate(selectionPaths.finalOffer(created.roundId), { state: { record: created } });
  };

  return (
    <SelectionPage
      header={
        <PageHeader
          title={t('selection.finalOfferForm.title')}
          subtitle={t('selection.finalOfferForm.intro')}
          back={{ to: selectionPaths.finalOffers, label: t('selection.finalOffers.title') }}
        />
      }
    >
      <UnsavedChangesGuard when={dirty && !create.pending} />
      <Banner tone="info" title={t('selection.finalOfferForm.noClarification')} />
      {gate !== undefined && summary.data !== undefined && (
        <GatePanel
          gate={gate}
          blockedTitle={t('selection.tender.gate.finalOfferBlocked')}
          allowedTitle={t('selection.finalOfferForm.permitted')}
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
        {create.error !== null && (
          <FormErrorSummary title={selectionErrorMessage(create.error)} errors={server.other} />
        )}
        <Card title={t('selection.finalOfferForm.round')}>
          <div className="tiq-form-grid">
            <TenderSelect
              mode="form"
              value={tender}
              onChange={(value) => {
                setTender(value);
                setInvitees([]);
                setDirty(true);
              }}
              error={
                (touched && tenderId === undefined ? required : undefined) ??
                server.forField('tenderId')
              }
            />
            <DateTimeInput
              label={t('selection.finalOfferForm.deadline')}
              hint={t('selection.finalOfferForm.deadlineHint', { zone })}
              required
              timeZone={zone}
              value={deadline}
              onChange={(value) => {
                setDeadline(value);
                setDirty(true);
              }}
              error={
                (touched && deadline === null ? required : undefined) ?? server.forField('deadline')
              }
            />
            <MultiSelect
              label={t('selection.finalOfferForm.invitees')}
              required
              fieldClassName="tiq-form-full"
              value={invitees}
              options={(summary.data?.candidates ?? [])
                .filter((candidate) => candidate.passesGates)
                .map((candidate) => ({
                  value: String(candidate.bid.bidId),
                  label: bidLabel(candidate.bid),
                }))}
              onChange={(value) => {
                setInvitees(value);
                setDirty(true);
              }}
              error={
                (touched && invitees.length === 0
                  ? t('selection.finalOfferForm.inviteesRequired')
                  : undefined) ?? server.forField('inviteeBidIds')
              }
            />
            <TextField
              label={t('selection.finalOfferForm.authority')}
              hint={t('selection.finalOfferForm.authorityHint')}
              required
              fieldClassName="tiq-form-full"
              value={draft.authority}
              onChange={(authority) => update({ authority })}
              error={textError('authority', 'proceduralAuthorityRef')}
            />
            <TextArea
              label={t('selection.finalOfferForm.instructions')}
              required
              rows={4}
              fieldClassName="tiq-form-full"
              value={draft.instructions}
              onChange={(instructions) => update({ instructions })}
              error={textError('instructions', 'instructions')}
            />
            <TextArea
              label={t('selection.finalOfferForm.permittedChanges')}
              required
              rows={3}
              value={draft.permittedChanges}
              onChange={(permittedChanges) => update({ permittedChanges })}
              error={textError('permittedChanges', 'permittedChanges')}
            />
            <TextArea
              label={t('selection.finalOfferForm.openingRules')}
              required
              rows={3}
              value={draft.openingRules}
              onChange={(openingRules) => update({ openingRules })}
              error={textError('openingRules', 'openingRules')}
            />
            <TextArea
              label={t('selection.finalOfferForm.evaluationTreatment')}
              required
              rows={3}
              fieldClassName="tiq-form-full"
              value={draft.evaluationTreatment}
              onChange={(evaluationTreatment) => update({ evaluationTreatment })}
              error={textError('evaluationTreatment', 'evaluationTreatment')}
            />
          </div>
        </Card>
        <div className="tiq-inline">
          <Button
            type="submit"
            variant="primary"
            icon="check"
            loading={create.pending}
            disabled={blocked}
          >
            {t('selection.finalOfferForm.submit')}
          </Button>
          <Button type="button" onClick={() => void navigate(selectionPaths.finalOffers)}>
            {t('selection.form.cancel')}
          </Button>
          <span className="tiq-text-muted">{t('selection.finalOfferForm.savedAsDraft')}</span>
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
          defaultType="reopen_round"
          context={t('selection.finalOfferForm.decisionContext')}
        />
      )}
    </SelectionPage>
  );
}
