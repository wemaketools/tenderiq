/**
 * SUP-24 — One qualification decision as the supplier sees it (FR-06, BR-25; AC-09): the deciding buyer, scope,
 * effective dates, conditions with allowed activities and the blocked gate, the explanation and appeal route (never
 * internal reasons), evidence that expires (the submitted edition stays unchanged), renewal deadline, the decision
 * history and updates already supplied. The supplier supplies updated evidence, renews, and requests
 * reconsideration.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import {
  ReconsiderationBody,
  SupplyEvidenceBody,
  qualificationEndpoints as api,
} from '@contracts/qualification';
import type {
  EvidenceUpdate,
  ReconsiderationRequest,
  SupplierDecisionDetail,
} from '@contracts/qualification';

import { useApiMutation, useApiQuery } from '../../../../api/hooks';
import { usePermission } from '../../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  ConfirmActionDialog,
  DetailList,
  EmptyState,
  FormErrorSummary,
  MultiSelect,
  PageHeader,
  QueryView,
  Reference,
  RestrictedState,
  Select,
  TextArea,
  Timeline,
  useToast,
} from '../../../../components/ui';
import { formatDateTime } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import { ApplyDialog } from '../../components/ApplyDialog';
import { EffectiveStatusChip, EvidenceTable, OutcomeChip } from '../../components/shared';
import { withQualificationMessage } from '../../lib/errors';
import { runCommand, useDefaultCurrency, useIdParam, useOfficialTimeZone } from '../../lib/hooks';
import { supplierQualificationPaths } from '../../lib/paths';
import { categoryLabel, dateOrDash, gateText, scopeText } from '../../lib/text';
import { errorLookup, textOrNull, validateWith } from '../../lib/validation';

export default function SupplierDecisionPage() {
  const decisionId = useIdParam('decisionId');
  const query = useApiQuery(
    api.getSupplierDecision,
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
          back={{
            to: supplierQualificationPaths.decisions,
            label: t('qualification.supplierDecision.back'),
          }}
        />
      )}
      {notFound ? (
        <EmptyState title={t('qualification.decision.notFound')} />
      ) : query.error?.kind === 'forbidden' ? (
        <RestrictedState description={t('qualification.supplierDecisions.restricted')} />
      ) : (
        <QueryView query={query}>
          {(data) => <DecisionView key={data.id} decision={data} />}
        </QueryView>
      )}
    </div>
  );
}

type DialogKind = 'evidence' | 'reconsider' | 'renew';

function DecisionView({ decision }: { readonly decision: SupplierDecisionDetail }) {
  const navigate = useNavigate();
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const canApply = usePermission('supplier.qualification.apply');
  const defaultCurrency = useDefaultCurrency();
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [updates, setUpdates] = useState<readonly EvidenceUpdate[]>(decision.evidenceUpdates);
  const [reconsideration, setReconsideration] = useState<ReconsiderationRequest | null>(
    decision.reconsideration,
  );
  const candidates = useApiQuery(
    api.listEvidenceCandidates,
    canApply && (decision.canSupplyEvidence || decision.canRequestReconsideration)
      ? { params: { applicationId: decision.applicationId } }
      : null,
  );
  const candidateOptions = (candidates.data?.items ?? []).map((candidate) => ({
    value: String(candidate.evidenceItemId),
    label: [
      candidate.title,
      tEnum('evidence_items.evidence_type', candidate.evidenceType),
      candidate.expiresAt === null
        ? null
        : t('qualification.evidence.expiresOn', { date: dateOrDash(candidate.expiresAt) ?? '' }),
    ]
      .filter((part): part is string => part !== null)
      .join(' · '),
  }));

  const next = !decision.current
    ? t('qualification.supplierDecision.next.superseded')
    : decision.expiringEvidence.length > 0 && decision.canSupplyEvidence
      ? t('qualification.supplierDecision.next.supply')
      : decision.canRenew
        ? t('qualification.supplierDecision.next.renew')
        : decision.blockedGate !== 'none'
          ? t('qualification.supplierDecision.next.conditions')
          : t('qualification.supplierDecision.next.none');

  return (
    <>
      <PageHeader
        title={t('qualification.supplierDecision.title', {
          program: decision.program.programName,
          buyer: decision.buyer.name,
        })}
        subtitle={t('qualification.supplierDecision.subtitle', {
          buyer: decision.buyer.name,
          reference: decision.applicationReference,
        })}
        back={{
          to: supplierQualificationPaths.decisions,
          label: t('qualification.supplierDecision.back'),
        }}
        meta={
          <>
            <OutcomeChip outcome={decision.outcome} />
            {decision.effectiveStatus !== decision.outcome && (
              <EffectiveStatusChip status={decision.effectiveStatus} />
            )}
            <span>{t('qualification.common.nextAction', { action: next })}</span>
          </>
        }
        primaryAction={
          canApply && decision.canSupplyEvidence ? (
            <Button variant="primary" icon="upload" onClick={() => setDialog('evidence')}>
              {t('qualification.supplierDecision.supply')}
            </Button>
          ) : undefined
        }
        actions={
          canApply ? (
            <>
              {decision.canRenew && (
                <Button icon="repeat" onClick={() => setDialog('renew')}>
                  {t('qualification.supplierDecision.renew')}
                </Button>
              )}
              {decision.canRequestReconsideration && reconsideration === null && (
                <Button icon="scale" onClick={() => setDialog('reconsider')}>
                  {t('qualification.supplierDecision.reconsider')}
                </Button>
              )}
            </>
          ) : undefined
        }
      />
      <Banner
        tone="info"
        title={t('qualification.supplierDecision.buyerSpecificTitle', {
          buyer: decision.buyer.name,
        })}
      >
        {t('qualification.supplierDecision.buyerSpecific', { buyer: decision.buyer.name })}
      </Banner>
      {decision.blockedGate !== 'none' && decision.current && (
        <Banner tone="warning" title={gateText(decision.blockedGate)}>
          {decision.conditions}
        </Banner>
      )}
      {decision.expiringEvidence.length > 0 && (
        <Banner
          tone="warning"
          title={t('qualification.supplierDecision.expiringTitle', {
            count: decision.expiringEvidence.length,
          })}
        >
          {t('qualification.supplierDecision.expiring')}
        </Banner>
      )}
      <div className="tiq-grid tiq-grid--sidebar">
        <Card title={t('qualification.decision.termsTitle')}>
          <DetailList
            items={[
              { label: t('qualification.supplier.col.buyer'), value: decision.buyer.name },
              {
                label: t('qualification.terms.category'),
                value: categoryLabel(decision.scopeCategory),
              },
              {
                label: t('qualification.terms.scope'),
                value: scopeText(
                  decision.scopeCategory,
                  decision.scopeMaxValue,
                  decision.scopeGeography,
                ),
              },
              {
                label: t('qualification.terms.effectiveFrom'),
                value: dateOrDash(decision.effectiveFrom),
              },
              {
                label: t('qualification.terms.effectiveTo'),
                value:
                  decision.effectiveTo === null
                    ? t('qualification.terms.openEnded')
                    : dateOrDash(decision.effectiveTo),
              },
              {
                label: t('qualification.terms.reassessmentDate'),
                value: dateOrDash(decision.reassessmentDate),
              },
              {
                label: t('qualification.supplierDecision.renewalDueFrom'),
                value: dateOrDash(decision.renewalDueFrom),
              },
              { label: t('qualification.terms.conditions'), value: decision.conditions },
              {
                label: t('qualification.terms.allowedActivities'),
                value: decision.allowedActivities,
              },
              {
                label: t('qualification.terms.blockedGate'),
                value: gateText(decision.blockedGate),
              },
              {
                label: t('qualification.supplierDecision.explanation'),
                value: decision.supplierExplanation,
              },
              { label: t('qualification.terms.appealRoute'), value: decision.appealRoute },
              {
                label: t('qualification.decision.decidedAt'),
                value: formatDateTime(decision.decidedAt, timeZone),
              },
              {
                label: t('qualification.decision.application'),
                value: (
                  <Reference
                    value={decision.applicationReference}
                    to={supplierQualificationPaths.application(decision.applicationId)}
                  />
                ),
              },
              {
                label: t('qualification.supplierDecision.renewalApplication'),
                value:
                  decision.renewalApplicationId === null ? null : (
                    <Reference
                      value={t('qualification.supplierDecision.openRenewal')}
                      to={supplierQualificationPaths.application(decision.renewalApplicationId)}
                    />
                  ),
              },
              {
                label: t('qualification.supplierDecision.renewalRequested'),
                value:
                  decision.renewalRequestedAt === null
                    ? null
                    : formatDateTime(decision.renewalRequestedAt, timeZone),
              },
            ]}
          />
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
                  : t('qualification.supplierDecision.supersededBy', { id: item.supersededById }),
              tone: item.supersededById === null ? 'accent' : 'neutral',
            }))}
          />
        </Card>
      </div>
      <Card
        flush
        title={t('qualification.decision.expiringTitle')}
        subtitle={t('qualification.supplierDecision.expiringHint')}
      >
        <EvidenceTable
          evidence={decision.expiringEvidence}
          timeZone={timeZone}
          caption={t('qualification.decision.expiringTitle')}
        />
      </Card>
      <div className="tiq-grid tiq-grid--2">
        <Card title={t('qualification.supplierDecision.updatesTitle')}>
          {updates.length === 0 ? (
            <EmptyState compact title={t('qualification.supplierDecision.noUpdates')} />
          ) : (
            <Timeline
              label={t('qualification.supplierDecision.updatesTitle')}
              items={updates.map((update) => ({
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
                tone: 'success',
                icon: 'uploadCloud',
              }))}
            />
          )}
        </Card>
        <Card title={t('qualification.supplierDecision.reconsiderationTitle')}>
          {reconsideration === null ? (
            <EmptyState compact title={t('qualification.supplierDecision.noReconsideration')} />
          ) : (
            <DetailList
              stacked
              items={[
                {
                  label: t('qualification.supplierDecision.grounds'),
                  value: reconsideration.grounds,
                },
                {
                  label: t('qualification.supplierDecision.requestedBy'),
                  value: `${reconsideration.requestedBy.fullName} · ${formatDateTime(reconsideration.requestedAt, timeZone)}`,
                },
                { label: t('qualification.terms.appealRoute'), value: reconsideration.appealRoute },
              ]}
            />
          )}
        </Card>
      </div>

      {dialog === 'evidence' && (
        <SupplyEvidenceDialog
          decision={decision}
          options={candidateOptions}
          onClose={() => setDialog(null)}
          onSupplied={(update) => {
            setUpdates((previous) => [update, ...previous]);
            setDialog(null);
            toast.show(
              t('qualification.supplierDecision.supplied', { title: update.title }),
              'success',
            );
          }}
        />
      )}
      {dialog === 'reconsider' && (
        <ReconsiderDialog
          decision={decision}
          options={candidateOptions}
          onClose={() => setDialog(null)}
          onRequested={(request) => {
            setReconsideration(request);
            setDialog(null);
            toast.show(t('qualification.supplierDecision.reconsiderationSent'), 'success');
          }}
        />
      )}
      {dialog === 'renew' && (
        <ApplyDialog
          programId={decision.program.programId}
          programName={decision.program.programName}
          buyerName={decision.buyer.name}
          categories={[decision.scopeCategory]}
          defaultCategoryId={decision.scopeCategory.categoryId}
          defaultMaxValue={decision.scopeMaxValue}
          defaultGeography={decision.scopeGeography}
          currency={decision.scopeMaxValue?.currency ?? defaultCurrency}
          renewalOfDecisionId={decision.id}
          onClose={() => setDialog(null)}
          onCreated={(application) => {
            setDialog(null);
            toast.show(t('qualification.apply.renewalCreated'), 'success');
            void navigate(supplierQualificationPaths.application(application.id), {
              state: { created: application },
            });
          }}
        />
      )}
    </>
  );
}

function SupplyEvidenceDialog({
  decision,
  options,
  onClose,
  onSupplied,
}: {
  readonly decision: SupplierDecisionDetail;
  readonly options: readonly { value: string; label: string }[];
  readonly onClose: () => void;
  readonly onSupplied: (update: EvidenceUpdate) => void;
}) {
  const supply = useApiMutation(api.supplyDecisionEvidence);
  const [item, setItem] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const body = { evidenceItemId: item === '' ? undefined : Number(item), note: textOrNull(note) };
  const errors = errorLookup(tried ? validateWith(SupplyEvidenceBody, body) : [], supply.error, [
    'evidenceItemId',
    'note',
  ]);
  return (
    <ConfirmActionDialog
      open
      title={t('qualification.supplierDecision.supplyTitle')}
      scope={t('qualification.supplierDecision.scope', {
        id: decision.id,
        program: decision.program.programName,
        buyer: decision.buyer.name,
      })}
      consequence={t('qualification.supplierDecision.supplyConsequence', {
        buyer: decision.buyer.name,
      })}
      confirmLabel={t('qualification.supplierDecision.supply')}
      pending={supply.pending}
      error={withQualificationMessage(supply.error)}
      onCancel={onClose}
      onConfirm={() => {
        setTried(true);
        const parsed = SupplyEvidenceBody.safeParse(body);
        if (!parsed.success) return;
        return runCommand(
          () => supply.mutate({ params: { decisionId: decision.id }, body: parsed.data }),
          onSupplied,
        );
      }}
    >
      <FormErrorSummary title={null} errors={errors.other} />
      <Select
        label={t('qualification.supplierDecision.evidenceItem')}
        hint={options.length === 0 ? t('qualification.application.noCandidates') : undefined}
        required
        placeholder={t('qualification.common.select')}
        value={item}
        onChange={setItem}
        error={errors.forField('evidenceItemId')}
        options={options}
      />
      <TextArea
        label={t('qualification.supplierDecision.note')}
        rows={2}
        value={note}
        onChange={setNote}
        error={errors.forField('note')}
      />
    </ConfirmActionDialog>
  );
}

function ReconsiderDialog({
  decision,
  options,
  onClose,
  onRequested,
}: {
  readonly decision: SupplierDecisionDetail;
  readonly options: readonly { value: string; label: string }[];
  readonly onClose: () => void;
  readonly onRequested: (request: ReconsiderationRequest) => void;
}) {
  const request = useApiMutation(api.requestReconsideration);
  const [grounds, setGrounds] = useState('');
  const [evidence, setEvidence] = useState<readonly string[]>([]);
  const [tried, setTried] = useState(false);
  const body = { grounds, evidenceItemIds: evidence.map(Number) };
  const errors = errorLookup(tried ? validateWith(ReconsiderationBody, body) : [], request.error, [
    'grounds',
    'evidenceItemIds',
  ]);
  return (
    <ConfirmActionDialog
      open
      title={t('qualification.supplierDecision.reconsiderTitle')}
      scope={t('qualification.supplierDecision.scope', {
        id: decision.id,
        program: decision.program.programName,
        buyer: decision.buyer.name,
      })}
      consequence={t('qualification.supplierDecision.reconsiderConsequence', {
        route: decision.appealRoute ?? t('qualification.supplierDecision.noAppealRoute'),
      })}
      confirmLabel={t('qualification.supplierDecision.reconsider')}
      pending={request.pending}
      error={withQualificationMessage(request.error)}
      onCancel={onClose}
      onConfirm={() => {
        setTried(true);
        const parsed = ReconsiderationBody.safeParse(body);
        if (!parsed.success) return;
        return runCommand(
          () => request.mutate({ params: { decisionId: decision.id }, body: parsed.data }),
          onRequested,
        );
      }}
    >
      <FormErrorSummary title={null} errors={errors.other} />
      <TextArea
        label={t('qualification.supplierDecision.grounds')}
        required
        rows={4}
        value={grounds}
        onChange={setGrounds}
        error={errors.forField('grounds')}
      />
      <MultiSelect
        label={t('qualification.supplierDecision.supportingEvidence')}
        value={evidence}
        onChange={setEvidence}
        error={errors.forField('evidenceItemIds')}
        options={options}
      />
    </ConfirmActionDialog>
  );
}
