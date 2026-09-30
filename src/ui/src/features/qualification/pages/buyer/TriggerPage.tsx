/**
 * BUY-35 — One reassessment trigger (BR-25; AC-09): what happened (for example Chobe's insurance expiring on
 * 2026-10-08), the decision it concerns, the active bids and contracts it affects, and the explicit disposition. A
 * decider reviews every impacted bid and contract and records "no change", "action taken" (with the superseding
 * decision) or "dismissed". Historical evidence is never relabelled.
 */
import { useState } from 'react';

import { AssessTriggerBody, qualificationEndpoints as api } from '@contracts/qualification';
import type { Trigger } from '@contracts/qualification';
import type { ReassessmentTriggersStatus } from '@contracts/enums';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../../api/hooks';
import { usePermission } from '../../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  ConfirmActionDialog,
  DetailList,
  EmptyState,
  FormErrorSummary,
  PageHeader,
  QueryView,
  RadioGroup,
  Reference,
  RestrictedState,
  StatusChip,
  TextArea,
  UnsavedChangesGuard,
  useToast,
} from '../../../../components/ui';
import { formatDateTime } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import { useNow } from '../../../../lib/useNow';
import { EffectiveStatusChip, ImpactTables } from '../../components/shared';
import { SupersedeDialog } from '../../components/SupersedeDialog';
import { calendarDateIn } from '../../lib/dates';
import { summaryTitle, withQualificationMessage } from '../../lib/errors';
import { runCommand, useIdParam, useOfficialTimeZone } from '../../lib/hooks';
import { buyerQualificationPaths } from '../../lib/paths';
import { dateOrDash } from '../../lib/text';
import { errorLookup, validateWith } from '../../lib/validation';

type Resulting = Exclude<ReassessmentTriggersStatus, 'open'>;
const RESULTING: readonly Resulting[] = ['assessed', 'action_taken', 'dismissed'];
const FIELDS = [
  'resultingStatus',
  'disposition',
  'activeBidsReviewed',
  'activeContractsReviewed',
  'resultingDecisionId',
];

export default function TriggerPage() {
  const triggerId = useIdParam('triggerId');
  const query = useApiQuery(api.getTrigger, triggerId === null ? null : { params: { triggerId } });
  const notFound = triggerId === null || query.error?.kind === 'not_found';
  return (
    <div className="tiq-page">
      {query.data === undefined && (
        <PageHeader
          title={
            notFound ? t('qualification.trigger.notFound') : t('qualification.trigger.loadingTitle')
          }
          back={{ to: buyerQualificationPaths.monitoring, label: t('qualification.decision.back') }}
        />
      )}
      {notFound ? (
        <EmptyState title={t('qualification.trigger.notFound')} />
      ) : query.error?.kind === 'forbidden' ? (
        <RestrictedState description={t('qualification.trigger.restricted')} />
      ) : (
        <QueryView query={query}>
          {(data) => <TriggerView key={data.id} fetched={data} />}
        </QueryView>
      )}
    </div>
  );
}

function TriggerView({ fetched }: { readonly fetched: Trigger }) {
  const toast = useToast();
  const now = useNow();
  const timeZone = useOfficialTimeZone();
  const canDecide = usePermission('qualification.decide');
  const options = useApiQuery(api.getQualificationOptions, {});
  const decision = useApiQuery(
    api.getDecision,
    fetched.decisionId === null ? null : { params: { decisionId: fetched.decisionId } },
  );
  const assess = useApiMutation(api.assessTrigger);
  const [trigger, setTrigger] = useState<Trigger>(fetched);
  const [resulting, setResulting] = useState<Resulting | ''>('');
  const [disposition, setDisposition] = useState('');
  const [bidsReviewed, setBidsReviewed] = useState(false);
  const [contractsReviewed, setContractsReviewed] = useState(false);
  const [resultingDecisionId, setResultingDecisionId] = useState<number | null>(null);
  const [tried, setTried] = useState(false);
  const [dialog, setDialog] = useState<'supersede' | 'confirm' | null>(null);

  const open = trigger.status === 'open';
  const body = {
    resultingStatus: resulting === '' ? undefined : resulting,
    disposition,
    activeBidsReviewed: bidsReviewed,
    activeContractsReviewed: contractsReviewed,
    resultingDecisionId,
  };
  const impactsUnreviewed =
    (trigger.impactedBids.length > 0 && !bidsReviewed) ||
    (trigger.impactedContracts.length > 0 && !contractsReviewed);
  const decisionMissing = resulting === 'action_taken' && resultingDecisionId === null;
  const clientErrors = tried
    ? [
        ...validateWith(AssessTriggerBody, body),
        ...(impactsUnreviewed
          ? [
              {
                field: 'activeBidsReviewed',
                code: 'IMPACT_REVIEW_REQUIRED',
                message: t('qualification.errors.IMPACT_REVIEW_REQUIRED'),
              },
            ]
          : []),
        ...(decisionMissing
          ? [
              {
                field: 'resultingDecisionId',
                code: 'RESULTING_DECISION_REQUIRED',
                message: t('qualification.errors.RESULTING_DECISION_REQUIRED'),
              },
            ]
          : []),
      ]
    : [];
  const errors = errorLookup(clientErrors, dialog === 'confirm' ? null : assess.error, FIELDS);
  const dirty = resulting !== '' || disposition !== '' || bidsReviewed || contractsReviewed;

  const review = (): void => {
    setTried(true);
    if (!AssessTriggerBody.safeParse(body).success || impactsUnreviewed || decisionMissing) return;
    assess.reset();
    setDialog('confirm');
  };

  return (
    <>
      <PageHeader
        title={t('qualification.trigger.title', {
          id: trigger.id,
          supplier: trigger.supplier.name,
        })}
        subtitle={tEnum('reassessment_triggers.trigger_type', trigger.triggerType)}
        back={{ to: buyerQualificationPaths.monitoring, label: t('qualification.decision.back') }}
        meta={
          <>
            <StatusChip enum="reassessment_triggers.status" value={trigger.status} />
            {trigger.decisionEffectiveStatus !== null && (
              <EffectiveStatusChip status={trigger.decisionEffectiveStatus} />
            )}
            <span>
              {t('qualification.common.nextAction', {
                action: open
                  ? canDecide
                    ? t('qualification.trigger.next.assess')
                    : t('qualification.trigger.next.awaitDecider')
                  : t('qualification.trigger.next.closed'),
              })}
            </span>
          </>
        }
        primaryAction={
          open && canDecide ? (
            <Button variant="primary" icon="checkCircle" onClick={review}>
              {t('qualification.trigger.record')}
            </Button>
          ) : undefined
        }
      />
      <Banner tone="info" title={t('qualification.trigger.historyTitle')}>
        {t('qualification.trigger.history')}
      </Banner>
      <div className="tiq-grid tiq-grid--sidebar">
        <Card title={t('qualification.trigger.detailsTitle')}>
          <DetailList
            items={[
              { label: t('qualification.trigger.summary'), value: trigger.summary },
              {
                label: t('qualification.monitoring.col.supplier'),
                value: trigger.supplier.legalName,
              },
              {
                label: t('qualification.monitoring.col.program'),
                value:
                  trigger.program === null
                    ? null
                    : t('qualification.common.programVersion', {
                        name: trigger.program.programName,
                        no: trigger.program.versionNo,
                      }),
              },
              { label: t('qualification.trigger.source'), value: trigger.sourceLabel },
              {
                label: t('qualification.monitoring.col.lapses'),
                value: dateOrDash(trigger.lapsesOn),
              },
              {
                label: t('qualification.monitoring.col.detected'),
                value: formatDateTime(trigger.detectedAt, timeZone),
              },
              {
                label: t('qualification.trigger.decision'),
                value:
                  trigger.decisionId === null ? null : (
                    <Reference
                      value={t('qualification.decision.decisionNo', { id: trigger.decisionId })}
                      to={buyerQualificationPaths.decision(trigger.decisionId)}
                    />
                  ),
              },
            ]}
          />
        </Card>
        <Card title={t('qualification.trigger.dispositionTitle')}>
          {!open ? (
            <DetailList
              stacked
              items={[
                {
                  label: t('qualification.trigger.result'),
                  value: tEnum('reassessment_triggers.status', trigger.status),
                },
                { label: t('qualification.trigger.disposition'), value: trigger.disposition },
                {
                  label: t('qualification.trigger.assessedBy'),
                  value:
                    trigger.assessedBy === null
                      ? null
                      : `${trigger.assessedBy.fullName} · ${formatDateTime(trigger.assessedAt, timeZone)}`,
                },
                {
                  label: t('qualification.trigger.impactReview'),
                  value: t('qualification.trigger.impactReviewValue', {
                    bids: trigger.activeBidsReviewed
                      ? t('qualification.common.yes')
                      : t('qualification.common.no'),
                    contracts: trigger.activeContractsReviewed
                      ? t('qualification.common.yes')
                      : t('qualification.common.no'),
                  }),
                },
                {
                  label: t('qualification.trigger.resultingDecision'),
                  value:
                    trigger.resultingDecisionId === null ? null : (
                      <Reference
                        value={t('qualification.decision.decisionNo', {
                          id: trigger.resultingDecisionId,
                        })}
                        to={buyerQualificationPaths.decision(trigger.resultingDecisionId)}
                      />
                    ),
                },
              ]}
            />
          ) : !canDecide ? (
            <RestrictedState compact description={t('qualification.trigger.decidersOnly')} />
          ) : (
            <div className="tiq-form-stack">
              <UnsavedChangesGuard when={dirty && !assess.pending} />
              <FormErrorSummary
                title={dialog === 'confirm' ? null : summaryTitle(assess.error)}
                errors={errors.other}
              />
              <RadioGroup
                label={t('qualification.trigger.result')}
                required
                value={resulting}
                onChange={(value) => setResulting(value as Resulting)}
                error={errors.forField('resultingStatus')}
                options={RESULTING.map((value) => ({
                  value,
                  label: tEnum('reassessment_triggers.status', value),
                  hint: t(`qualification.trigger.resultHint.${value}`),
                }))}
              />
              <Checkbox
                label={t('qualification.trigger.bidsReviewed', {
                  count: trigger.impactedBids.length,
                })}
                checked={bidsReviewed}
                onChange={setBidsReviewed}
                error={errors.forField('activeBidsReviewed')}
              />
              <Checkbox
                label={t('qualification.trigger.contractsReviewed', {
                  count: trigger.impactedContracts.length,
                })}
                checked={contractsReviewed}
                onChange={setContractsReviewed}
                error={errors.forField('activeContractsReviewed')}
              />
              {resulting === 'action_taken' && (
                <div className="tiq-stack">
                  {resultingDecisionId === null ? (
                    <Button
                      icon="gavel"
                      onClick={() => setDialog('supersede')}
                      disabled={decision.data === undefined}
                    >
                      {t('qualification.trigger.recordDecision')}
                    </Button>
                  ) : (
                    <Banner tone="success">
                      {t('qualification.trigger.decisionRecorded', { id: resultingDecisionId })}
                    </Banner>
                  )}
                  {errors.forField('resultingDecisionId') !== undefined && (
                    <p className="tiq-text-danger">{errors.forField('resultingDecisionId')}</p>
                  )}
                </div>
              )}
              <TextArea
                label={t('qualification.trigger.disposition')}
                hint={t('qualification.trigger.dispositionHint')}
                required
                rows={4}
                value={disposition}
                onChange={setDisposition}
                error={errors.forField('disposition')}
              />
              <div className="tiq-inline">
                <Button variant="primary" icon="checkCircle" onClick={review}>
                  {t('qualification.trigger.record')}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
      <Card
        title={t('qualification.decision.impactsTitle')}
        subtitle={t('qualification.trigger.impactsHint')}
      >
        <ImpactTables bids={trigger.impactedBids} contracts={trigger.impactedContracts} />
      </Card>

      {dialog === 'supersede' && decision.data !== undefined && (
        <SupersedeDialog
          decision={decision.data}
          triggerId={trigger.id}
          today={calendarDateIn(now, timeZone)}
          options={options.data}
          onClose={() => setDialog(null)}
          onSuperseded={(next) => {
            setResultingDecisionId(next.id);
            setDialog(null);
            toast.show(
              t('qualification.supersede.done', {
                id: next.id,
                outcome: tEnum('qualification_decisions.outcome', next.outcome),
              }),
              'success',
            );
          }}
        />
      )}
      {dialog === 'confirm' && (
        <ConfirmActionDialog
          open
          title={t('qualification.trigger.confirmTitle')}
          scope={t('qualification.trigger.scope', {
            id: trigger.id,
            supplier: trigger.supplier.name,
            summary: trigger.summary,
          })}
          consequence={t('qualification.trigger.consequence', {
            result: resulting === '' ? '' : tEnum('reassessment_triggers.status', resulting),
            bids: trigger.impactedBids.length,
            contracts: trigger.impactedContracts.length,
          })}
          confirmLabel={t('qualification.trigger.record')}
          pending={assess.pending}
          error={withQualificationMessage(assess.error)}
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            const parsed = AssessTriggerBody.safeParse(body);
            if (!parsed.success) return;
            return runCommand(
              () => assess.mutate({ params: { triggerId: trigger.id }, body: parsed.data }),
              (next) => {
                setTrigger(next);
                setDialog(null);
                invalidateApiQueries('buyer.qualification.summary');
                toast.show(
                  t('qualification.trigger.done', {
                    result: tEnum('reassessment_triggers.status', next.status),
                  }),
                  'success',
                );
              },
            );
          }}
        />
      )}
    </>
  );
}
