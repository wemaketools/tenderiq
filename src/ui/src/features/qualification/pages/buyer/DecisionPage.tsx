/**
 * BUY-35 — One qualification decision (FR-06, BR-24, BR-25; AC-09): approved scope, limits, dates, conditions with
 * the allowed activities and blocked gate, reasons, expiry, the decision history (superseded rows kept, never
 * edited), reassessment triggers, the active bids and contracts a status change affects and evidence that expires.
 * Deciders suspend, reinstate, withdraw or reassess with a new decision, ask the supplier to renew, and initiate a
 * reassessment. The supplier's reconsideration request and updated evidence (SUP-24) arrive here and are answered
 * with a new decision or a reassessment.
 */
import { useState } from 'react';

import {
  CreateTriggerBody,
  RenewalRequestBody,
  qualificationEndpoints as api,
} from '@contracts/qualification';
import type { DecisionDetail, RenewalRequestResult, Trigger } from '@contracts/qualification';
import { REASSESSMENT_TRIGGERS_TRIGGER_TYPE } from '@contracts/enums';
import type { ReassessmentTriggersTriggerType } from '@contracts/enums';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../../api/hooks';
import { usePermission } from '../../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  ConfirmActionDialog,
  DataTable,
  DateTimeInput,
  DetailList,
  EmptyState,
  FormErrorSummary,
  OfficialDeadline,
  PageHeader,
  QueryView,
  Reference,
  RestrictedState,
  Select,
  StatusChip,
  TextArea,
  Timeline,
  useToast,
} from '../../../../components/ui';
import type { DataTableColumn } from '../../../../components/ui';
import { formatDateTime } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import { useNow } from '../../../../lib/useNow';
import { DecisionTerms } from '../../components/DecisionTerms';
import {
  EffectiveStatusChip,
  EvidenceTable,
  ExpiryChip,
  ImpactTables,
} from '../../components/shared';
import { SupersedeDialog } from '../../components/SupersedeDialog';
import { calendarDateIn } from '../../lib/dates';
import { summaryTitle, withQualificationMessage } from '../../lib/errors';
import { runCommand, useIdParam, useOfficialTimeZone } from '../../lib/hooks';
import { buyerQualificationPaths } from '../../lib/paths';
import { dateOrDash } from '../../lib/text';
import { errorLookup, validateWith } from '../../lib/validation';

export default function DecisionPage() {
  const decisionId = useIdParam('decisionId');
  const query = useApiQuery(
    api.getDecision,
    decisionId === null ? null : { params: { decisionId } },
  );
  const notFound = decisionId === null || query.error?.kind === 'not_found';
  return (
    <div className="tiq-page">
      {query.data === undefined && (
        <PageHeader
          title={
            notFound
              ? t('qualification.decision.notFound')
              : t('qualification.decision.loadingTitle')
          }
          back={{ to: buyerQualificationPaths.monitoring, label: t('qualification.decision.back') }}
        />
      )}
      {notFound ? (
        <EmptyState title={t('qualification.decision.notFound')} />
      ) : query.error?.kind === 'forbidden' ? (
        <RestrictedState description={t('qualification.decision.restricted')} />
      ) : (
        <QueryView query={query}>
          {(data) => <DecisionView key={data.id} fetched={data} />}
        </QueryView>
      )}
    </div>
  );
}

type DialogKind = 'supersede' | 'renewal' | 'trigger';

function DecisionView({ fetched }: { readonly fetched: DecisionDetail }) {
  const toast = useToast();
  const now = useNow();
  const timeZone = useOfficialTimeZone();
  const canDecide = usePermission('qualification.decide');
  const canRaise = usePermission(['qualification.review', 'qualification.decide']);
  const options = useApiQuery(api.getQualificationOptions, {});
  const [decision, setDecision] = useState<DecisionDetail>(fetched);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [renewal, setRenewal] = useState<RenewalRequestResult | null>(null);
  const [raised, setRaised] = useState<readonly Trigger[]>([]);
  const current = decision.supersededById === null;
  const triggers = [...raised, ...decision.triggers];
  const openTriggers = triggers.filter((trigger) => trigger.status === 'open');
  const reconsideration = decision.reconsideration;
  const reconsiderationOpen =
    current && reconsideration !== null && reconsideration.resolvedByDecisionId === null;
  const answeringTrigger =
    openTriggers.find((trigger) => trigger.sourceType === 'reconsideration_request') ??
    openTriggers[0];
  const expiresInDays =
    decision.effectiveTo === null
      ? null
      : Math.round(
          (Date.parse(`${decision.effectiveTo}T00:00:00Z`) -
            Date.parse(`${calendarDateIn(now, timeZone)}T00:00:00Z`)) /
            86_400_000,
        );

  const next = !current
    ? t('qualification.decision.next.superseded')
    : reconsiderationOpen
      ? t('qualification.decision.next.reconsideration')
      : openTriggers.length > 0
        ? t('qualification.decision.next.trigger', { count: openTriggers.length })
        : decision.effectiveStatus === 'expired'
          ? t('qualification.decision.next.expired')
          : decision.renewalApplicationId !== null
            ? t('qualification.decision.next.renewalInQueue')
            : t('qualification.decision.next.monitor');

  const triggerColumns: DataTableColumn<Trigger>[] = [
    {
      id: 'id',
      header: t('qualification.monitoring.col.trigger'),
      cell: (row) => (
        <>
          <Reference
            value={t('qualification.trigger.triggerNo', { id: row.id })}
            to={buyerQualificationPaths.trigger(row.id)}
          />
          <span className="tiq-cell-sub">
            {tEnum('reassessment_triggers.trigger_type', row.triggerType)}
          </span>
        </>
      ),
    },
    {
      id: 'summary',
      header: t('qualification.monitoring.col.summary'),
      cell: (row) => row.summary,
    },
    {
      id: 'lapsesOn',
      header: t('qualification.monitoring.col.lapses'),
      cell: (row) => dateOrDash(row.lapsesOn) ?? t('qualification.common.none'),
    },
    {
      id: 'status',
      header: t('qualification.monitoring.col.triggerStatus'),
      cell: (row) => (
        <StatusChip enum="reassessment_triggers.status" value={row.status} size="sm" />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('qualification.decision.title', {
          id: decision.id,
          supplier: decision.supplier.name,
        })}
        subtitle={t('qualification.common.programVersion', {
          name: decision.program.programName,
          no: decision.program.versionNo,
        })}
        back={{ to: buyerQualificationPaths.monitoring, label: t('qualification.decision.back') }}
        meta={
          <>
            <StatusChip enum="qualification_decisions.outcome" value={decision.outcome} />
            {decision.effectiveStatus !== decision.outcome && (
              <EffectiveStatusChip status={decision.effectiveStatus} />
            )}
            <ExpiryChip days={expiresInDays} />
            <span>{t('qualification.common.nextAction', { action: next })}</span>
          </>
        }
        primaryAction={
          canDecide && current && decision.canSupersede ? (
            <Button variant="primary" icon="gavel" onClick={() => setDialog('supersede')}>
              {t('qualification.decision.supersede')}
            </Button>
          ) : undefined
        }
        actions={
          <>
            {canDecide && current && decision.renewalApplicationId === null && renewal === null && (
              <Button icon="repeat" onClick={() => setDialog('renewal')}>
                {t('qualification.decision.requestRenewal')}
              </Button>
            )}
            {canRaise && current && (
              <Button icon="activity" onClick={() => setDialog('trigger')}>
                {t('qualification.decision.initiate')}
              </Button>
            )}
          </>
        }
      />
      {!current && (
        <Banner tone="info" title={t('qualification.decision.supersededTitle')}>
          {t('qualification.decision.supersededDetail', { id: decision.supersededById ?? 0 })}
        </Banner>
      )}
      {reconsiderationOpen && (
        <Banner
          tone="warning"
          title={t('qualification.decision.reconsiderationBannerTitle')}
          actions={
            <>
              {canDecide && decision.canSupersede && (
                <Button size="sm" variant="primary" onClick={() => setDialog('supersede')}>
                  {t('qualification.decision.supersede')}
                </Button>
              )}
              {canRaise && (
                <Button size="sm" onClick={() => setDialog('trigger')}>
                  {t('qualification.decision.initiate')}
                </Button>
              )}
            </>
          }
        >
          {t('qualification.decision.reconsiderationBanner', {
            person: reconsideration.requestedBy.fullName,
            at: formatDateTime(reconsideration.requestedAt, timeZone),
            count: decision.evidenceUpdates.length,
          })}
        </Banner>
      )}
      {openTriggers.length > 0 && current && (
        <Banner
          tone="warning"
          title={t('qualification.decision.triggerBannerTitle', { count: openTriggers.length })}
        >
          {t('qualification.decision.triggerBanner')}
        </Banner>
      )}
      {renewal !== null && (
        <Banner tone="success" title={t('qualification.decision.renewalRequested')}>
          <OfficialDeadline
            deadline={renewal.dueAt}
            label={t('qualification.decision.renewalDue')}
          />
        </Banner>
      )}
      {decision.renewalApplicationId !== null && (
        <Banner tone="info" title={t('qualification.decision.renewalInQueue')}>
          <Reference
            value={t('qualification.decision.openRenewal')}
            to={buyerQualificationPaths.application(decision.renewalApplicationId)}
          />
          {decision.renewalRequestedAt !== null &&
            ` · ${t('qualification.decision.renewalRequestedAt', {
              at: formatDateTime(decision.renewalRequestedAt, timeZone),
            })}`}
        </Banner>
      )}
      <div className="tiq-grid tiq-grid--sidebar">
        <Card title={t('qualification.decision.termsTitle')}>
          <DecisionTerms decision={decision} timeZone={timeZone} />
        </Card>
        <Card title={t('qualification.decision.historyTitle')}>
          <Timeline
            label={t('qualification.decision.historyTitle')}
            items={decision.history.map((item) => ({
              id: item.id,
              title: `${t('qualification.decision.decisionNo', { id: item.id })} · ${tEnum('qualification_decisions.outcome', item.outcome)}`,
              meta: `${formatDateTime(item.decidedAt, timeZone)} · ${t(
                'qualification.common.dateRange',
                {
                  from: dateOrDash(item.effectiveFrom) ?? '',
                  to: dateOrDash(item.effectiveTo) ?? t('qualification.terms.openEnded'),
                },
              )}`,
              detail:
                item.supersededById === null
                  ? tEnum('v_qualification_status.effective_status', item.effectiveStatus)
                  : t('qualification.decision.supersededBecause', {
                      id: item.supersededById,
                      reason: item.supersedeReason ?? '',
                    }),
              tone: item.supersededById === null ? 'accent' : 'neutral',
              icon: item.supersededById === null ? 'checkCircle' : 'history',
            }))}
          />
        </Card>
      </div>
      <div className="tiq-grid tiq-grid--2">
        <Card title={t('qualification.decision.reconsiderationTitle')}>
          {reconsideration === null ? (
            <EmptyState compact title={t('qualification.decision.noReconsideration')} />
          ) : (
            <DetailList
              stacked
              items={[
                {
                  label: t('qualification.decision.reconsiderationStatus'),
                  value:
                    reconsideration.resolvedByDecisionId !== null ? (
                      <Reference
                        value={t('qualification.decision.reconsiderationAnswered', {
                          id: reconsideration.resolvedByDecisionId,
                        })}
                        to={buyerQualificationPaths.decision(reconsideration.resolvedByDecisionId)}
                      />
                    ) : current ? (
                      t('qualification.decision.reconsiderationOpen')
                    ) : (
                      t('qualification.decision.reconsiderationClosed')
                    ),
                },
                { label: t('qualification.decision.grounds'), value: reconsideration.grounds },
                {
                  label: t('qualification.decision.requestedBy'),
                  value: `${reconsideration.requestedBy.fullName} · ${formatDateTime(reconsideration.requestedAt, timeZone)}`,
                },
                {
                  label: t('qualification.decision.citedEvidence'),
                  value:
                    reconsideration.evidenceItemIds.length === 0
                      ? t('qualification.common.none')
                      : reconsideration.evidenceItemIds
                          .map(
                            (id) =>
                              decision.evidenceUpdates.find(
                                (update) => update.evidenceItemId === id,
                              )?.title ?? t('qualification.decision.evidenceItemNo', { id }),
                          )
                          .join(' · '),
                },
                { label: t('qualification.terms.appealRoute'), value: reconsideration.appealRoute },
              ]}
            />
          )}
        </Card>
        <Card title={t('qualification.decision.updatesTitle')}>
          {decision.evidenceUpdates.length === 0 ? (
            <EmptyState compact title={t('qualification.decision.noUpdates')} />
          ) : (
            <Timeline
              label={t('qualification.decision.updatesTitle')}
              items={decision.evidenceUpdates.map((update) => ({
                id: update.id,
                title: update.title,
                meta: `${update.submittedBy.fullName} · ${formatDateTime(update.submittedAt, timeZone)}`,
                detail: [
                  update.expiresAt === null
                    ? null
                    : t('qualification.evidence.expiresOn', {
                        date: dateOrDash(update.expiresAt) ?? '',
                      }),
                  update.note,
                ]
                  .filter((part): part is string => part !== null)
                  .join(' · '),
                tone: 'accent',
                icon: 'uploadCloud',
              }))}
            />
          )}
        </Card>
      </div>
      <Card flush title={t('qualification.decision.triggersTitle')}>
        <DataTable
          caption={t('qualification.decision.triggersTitle')}
          columns={triggerColumns}
          rows={triggers}
          rowKey={(row) => String(row.id)}
          empty={<EmptyState compact title={t('qualification.decision.noTriggers')} />}
        />
      </Card>
      <Card
        title={t('qualification.decision.impactsTitle')}
        subtitle={t('qualification.decision.impactsHint')}
      >
        <ImpactTables bids={decision.impactedBids} contracts={decision.impactedContracts} />
      </Card>
      <Card
        flush
        title={t('qualification.decision.expiringTitle')}
        subtitle={t('qualification.decision.expiringHint')}
      >
        <EvidenceTable
          evidence={decision.expiringEvidence}
          timeZone={timeZone}
          caption={t('qualification.decision.expiringTitle')}
        />
      </Card>

      {dialog === 'supersede' && (
        <SupersedeDialog
          decision={decision}
          options={options.data}
          today={calendarDateIn(now, timeZone)}
          triggerId={answeringTrigger?.id ?? null}
          onClose={() => setDialog(null)}
          onSuperseded={(nextDecision) => {
            setDecision({
              ...decision,
              supersededById: nextDecision.id,
              supersedeReason: nextDecision.supersedeReason,
              openReconsideration: false,
              reconsideration:
                decision.reconsideration === null
                  ? null
                  : { ...decision.reconsideration, resolvedByDecisionId: nextDecision.id },
            });
            setDialog(null);
            invalidateApiQueries('buyer.qualification.');
            toast.show(
              t('qualification.supersede.done', {
                id: nextDecision.id,
                outcome: tEnum('qualification_decisions.outcome', nextDecision.outcome),
              }),
              'success',
            );
          }}
        />
      )}
      {dialog === 'renewal' && (
        <RenewalDialog
          decision={decision}
          timeZone={options.data?.officialTimeZone ?? timeZone}
          onClose={() => setDialog(null)}
          onRequested={(result) => {
            setRenewal(result);
            setDialog(null);
            toast.show(t('qualification.decision.renewalRequested'), 'success');
          }}
        />
      )}
      {dialog === 'trigger' && (
        <CreateTriggerDialog
          decision={decision}
          onClose={() => setDialog(null)}
          onCreated={(trigger) => {
            setRaised((previous) => [trigger, ...previous]);
            setDialog(null);
            toast.show(t('qualification.decision.triggerRaised', { id: trigger.id }), 'success');
          }}
        />
      )}
    </>
  );
}

function RenewalDialog({
  decision,
  timeZone,
  onClose,
  onRequested,
}: {
  readonly decision: DecisionDetail;
  readonly timeZone: string;
  readonly onClose: () => void;
  readonly onRequested: (result: RenewalRequestResult) => void;
}) {
  const request = useApiMutation(api.requestRenewal);
  const [message, setMessage] = useState('');
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const body = { message, dueAt: dueAt ?? undefined };
  const errors = errorLookup(tried ? validateWith(RenewalRequestBody, body) : [], request.error, [
    'message',
    'dueAt',
  ]);
  return (
    <ConfirmActionDialog
      open
      title={t('qualification.decision.renewalTitle')}
      scope={t('qualification.decision.renewalScope', {
        id: decision.id,
        supplier: decision.supplier.name,
        program: decision.program.programName,
      })}
      consequence={t('qualification.decision.renewalConsequence')}
      confirmLabel={t('qualification.decision.requestRenewal')}
      pending={request.pending}
      error={withQualificationMessage(request.error)}
      onCancel={onClose}
      onConfirm={() => {
        setTried(true);
        const parsed = RenewalRequestBody.safeParse(body);
        if (!parsed.success) return;
        return runCommand(
          () => request.mutate({ params: { decisionId: decision.id }, body: parsed.data }),
          onRequested,
        );
      }}
    >
      <FormErrorSummary title={null} errors={errors.other} />
      <TextArea
        label={t('qualification.decision.renewalMessage')}
        required
        rows={3}
        value={message}
        onChange={setMessage}
        error={errors.forField('message')}
      />
      <DateTimeInput
        label={t('qualification.decision.renewalDue')}
        required
        value={dueAt}
        onChange={setDueAt}
        timeZone={timeZone}
        error={errors.forField('dueAt')}
      />
    </ConfirmActionDialog>
  );
}

function CreateTriggerDialog({
  decision,
  onClose,
  onCreated,
}: {
  readonly decision: DecisionDetail;
  readonly onClose: () => void;
  readonly onCreated: (trigger: Trigger) => void;
}) {
  const create = useApiMutation(api.createTrigger);
  const [triggerType, setTriggerType] = useState<ReassessmentTriggersTriggerType>('manual');
  const [summary, setSummary] = useState('');
  const [tried, setTried] = useState(false);
  const body = {
    supplierTenantId: decision.supplier.supplierTenantId,
    decisionId: decision.id,
    triggerType,
    summary,
  };
  const errors = errorLookup(tried ? validateWith(CreateTriggerBody, body) : [], create.error, [
    'triggerType',
    'summary',
  ]);
  return (
    <ConfirmActionDialog
      open
      title={t('qualification.decision.initiateTitle')}
      scope={t('qualification.decision.renewalScope', {
        id: decision.id,
        supplier: decision.supplier.name,
        program: decision.program.programName,
      })}
      consequence={t('qualification.decision.initiateConsequence')}
      confirmLabel={t('qualification.decision.initiate')}
      pending={create.pending}
      error={withQualificationMessage(create.error)}
      onCancel={onClose}
      onConfirm={() => {
        setTried(true);
        const parsed = CreateTriggerBody.safeParse(body);
        if (!parsed.success) return;
        return runCommand(() => create.mutate({ body: parsed.data }), onCreated);
      }}
    >
      <FormErrorSummary title={summaryTitle(null)} errors={errors.other} />
      <Select
        label={t('qualification.decision.triggerType')}
        required
        value={triggerType}
        onChange={(value) => setTriggerType(value as ReassessmentTriggersTriggerType)}
        error={errors.forField('triggerType')}
        options={REASSESSMENT_TRIGGERS_TRIGGER_TYPE.map((value) => ({
          value,
          label: tEnum('reassessment_triggers.trigger_type', value),
        }))}
      />
      <TextArea
        label={t('qualification.decision.triggerSummary')}
        required
        rows={3}
        value={summary}
        onChange={setSummary}
        error={errors.forField('summary')}
      />
    </ConfirmActionDialog>
  );
}
