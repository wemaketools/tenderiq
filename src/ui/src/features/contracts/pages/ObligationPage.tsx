/**
 * CON-06 — One milestone, deliverable or obligation: acceptance criteria, due date, inspection evidence, acceptance
 * decisions and rejected work with remediation owner and due date. Submit completion, start the inspection, accept
 * or reject with reasons. Acceptance and payment are stated separately: accepting never implies payment readiness,
 * and a rejection never implies anything was paid (AC-30).
 */
import { useState } from 'react';

import { contractsEndpoints } from '@contracts/contracts';
import type {
  ContractDetail,
  ObligationDecisionBody,
  ObligationDetail,
} from '@contracts/contracts';

import { useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  ConfirmActionDialog,
  DateTimeInput,
  DetailList,
  EmptyState,
  MoneyText,
  OfficialDeadline,
  OverdueChip,
  QueryView,
  RadioGroup,
  Select,
  StatusChip,
  TextArea,
  Timeline,
} from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useAssigneeOptions } from '../lib/assignees';
import { ContractWorkspace } from '../components/ContractWorkspace';
import { EvidenceDialog } from '../components/EvidenceDialog';
import { ApprovalSummary, DeadlineText, InstantText, PersonName } from '../components/shared';
import { splitCommandError } from '../lib/errors';
import { useContractCommand, useIdParam } from '../lib/hooks';
import { idOf } from '../lib/lists';
import { contractPaths } from '../lib/paths';
import { CONTRACT_MANAGE } from '../lib/permissions';

const OPEN_FOR_EVIDENCE: readonly string[] = ['planned', 'due', 'overdue', 'rejected'];

function DecisionDialog({
  contract,
  obligation,
  onClose,
}: {
  readonly contract: ContractDetail;
  readonly obligation: ObligationDetail;
  readonly onClose: () => void;
}) {
  const owners = useAssigneeOptions('obligation_owner');
  const [decision, setDecision] = useState<'accepted' | 'rejected'>('accepted');
  const [reasons, setReasons] = useState('');
  const [remediation, setRemediation] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, string>>({});
  const command = useContractCommand(contractsEndpoints.decideObligation, (r) => r.message);
  const { dialogError, fieldErrors } = splitCommandError(command.error, [
    'decision',
    'reasons',
    'remediationRequired',
    'remediationOwnerUserId',
    'remediationDueAt',
  ]);
  const errorFor = (field: string): string | undefined =>
    local[field] ?? fieldErrors.forField(field);

  const confirm = async (): Promise<void> => {
    const errors: Record<string, string> = {};
    if (reasons.trim() === '') errors.reasons = t('contracts.decide.reasonsRequired');
    const owner = idOf(ownerId);
    if (decision === 'rejected') {
      if (remediation.trim() === '')
        errors.remediationRequired = t('contracts.decide.remediationRequired');
      if (owner === undefined) errors.remediationOwnerUserId = t('contracts.decide.ownerRequired');
      if (dueAt === null) errors.remediationDueAt = t('contracts.decide.dueRequired');
    }
    setLocal(errors);
    if (Object.keys(errors).length > 0) return;
    const body: ObligationDecisionBody =
      decision === 'rejected' && owner !== undefined && dueAt !== null
        ? {
            decision,
            reasons: reasons.trim(),
            remediationRequired: remediation.trim(),
            remediationOwnerUserId: owner,
            remediationDueAt: dueAt,
          }
        : { decision, reasons: reasons.trim() };
    const result = await command.run({
      params: { contractId: contract.id, obligationId: obligation.id },
      body,
    });
    if (result !== null) onClose();
  };

  return (
    <ConfirmActionDialog
      open
      tone={decision === 'rejected' ? 'danger' : 'primary'}
      title={t('contracts.decide.title')}
      scope={`${contract.reference} · ${obligation.title}`}
      consequence={
        decision === 'rejected'
          ? t('contracts.decide.rejectConsequence')
          : t('contracts.decide.acceptConsequence')
      }
      confirmLabel={
        decision === 'rejected' ? t('contracts.decide.reject') : t('contracts.decide.accept')
      }
      onConfirm={confirm}
      onCancel={onClose}
      pending={command.pending}
      error={dialogError}
    >
      <RadioGroup
        label={t('contracts.decide.decision')}
        required
        inline
        value={decision}
        onChange={(value) => setDecision(value === 'rejected' ? 'rejected' : 'accepted')}
        options={[
          { value: 'accepted', label: tEnum('acceptance_decisions.decision', 'accepted') },
          { value: 'rejected', label: tEnum('acceptance_decisions.decision', 'rejected') },
        ]}
        error={errorFor('decision')}
      />
      <TextArea
        label={t('contracts.decide.reasons')}
        hint={t('contracts.decide.reasonsHint')}
        required
        value={reasons}
        onChange={setReasons}
        rows={3}
        error={errorFor('reasons')}
      />
      {decision === 'rejected' && (
        <>
          <TextArea
            label={t('contracts.decide.remediation')}
            required
            value={remediation}
            onChange={setRemediation}
            rows={3}
            error={errorFor('remediationRequired')}
          />
          <Select
            label={t('contracts.decide.remediationOwner')}
            required
            placeholder={t('contracts.common.select')}
            value={ownerId}
            options={owners.options}
            onChange={setOwnerId}
            error={errorFor('remediationOwnerUserId')}
          />
          <DateTimeInput
            label={t('contracts.decide.remediationDue')}
            required
            value={dueAt}
            onChange={setDueAt}
            timeZone={contract.timeZone}
            error={errorFor('remediationDueAt')}
          />
        </>
      )}
      {obligation.isPaymentMilestone && (
        <Banner tone="info" title={t('contracts.milestones.paymentRule')}>
          {t('contracts.decide.paymentUnchanged')}
        </Banner>
      )}
    </ConfirmActionDialog>
  );
}

function PaymentCard({
  obligation,
  timeZone,
}: {
  readonly obligation: ObligationDetail;
  readonly timeZone: string;
}) {
  if (!obligation.isPaymentMilestone) return null;
  const payment = obligation.payment;
  return (
    <Card
      title={t('contracts.obligation.paymentTitle')}
      subtitle={t('contracts.obligation.paymentHint')}
    >
      {payment === null ? (
        <EmptyState compact title={t('contracts.obligation.noInvoice')} />
      ) : (
        <DetailList
          items={[
            { label: t('contracts.obligation.invoice'), value: payment.invoiceRef },
            {
              label: t('contracts.obligation.invoiceAcceptance'),
              value: (
                <StatusChip
                  enum="contract_invoices.acceptance_status"
                  value={payment.acceptanceStatus}
                  size="sm"
                />
              ),
            },
            {
              label: t('contracts.obligation.paymentStatus'),
              value: (
                <StatusChip
                  enum="contract_invoices.payment_status"
                  value={payment.paymentStatus}
                  size="sm"
                />
              ),
            },
            {
              label: t('contracts.common.source'),
              value:
                payment.source === null ? null : tEnum('contract_invoices.source', payment.source),
            },
            {
              label: t('contracts.obligation.asOf'),
              value: <InstantText at={payment.asOf} timeZone={timeZone} />,
            },
          ]}
        />
      )}
    </Card>
  );
}

type DialogKind = 'evidence' | 'review' | 'decide' | null;

function ObligationBody({ contract }: { readonly contract: ContractDetail }) {
  const obligationId = useIdParam('obligationId');
  const canManage = usePermission(CONTRACT_MANAGE);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const query = useApiQuery(
    contractsEndpoints.obligation,
    obligationId === null ? null : { params: { contractId: contract.id, obligationId } },
  );
  const evidence = useContractCommand(
    contractsEndpoints.submitObligationEvidence,
    (r) => r.message,
  );
  const startReview = useContractCommand(contractsEndpoints.startObligationReview, (row) =>
    t('contracts.obligation.reviewStarted', { title: row.title }),
  );

  if (obligationId === null) {
    return <Banner tone="error" title={t('contracts.obligation.invalid')} />;
  }

  return (
    <QueryView query={query}>
      {(obligation) => {
        const active = canManage && contract.status !== 'closed';
        return (
          <div className="tiq-stack">
            <div className="tiq-inline">
              <ButtonLink
                to={contractPaths.milestones(contract.id)}
                variant="link"
                icon="arrowLeft"
              >
                {t('contracts.obligation.back')}
              </ButtonLink>
            </div>
            {obligation.status === 'rejected' && (
              <Banner tone="error" title={t('contracts.obligation.rejectedTitle')}>
                {t('contracts.obligation.rejectedDetail')}
              </Banner>
            )}
            <Card
              title={obligation.title}
              subtitle={`${tEnum('obligations.kind', obligation.kind)} · ${tEnum('obligations.party', obligation.party)}`}
              actions={
                active ? (
                  <span className="tiq-inline">
                    {obligation.party === 'buyer' &&
                      OPEN_FOR_EVIDENCE.includes(obligation.status) && (
                        <Button
                          icon="upload"
                          onClick={() => {
                            evidence.reset();
                            setDialog('evidence');
                          }}
                        >
                          {t('contracts.obligation.submitCompletion')}
                        </Button>
                      )}
                    {obligation.status === 'evidence_submitted' && (
                      <Button
                        icon="search"
                        onClick={() => {
                          startReview.reset();
                          setDialog('review');
                        }}
                      >
                        {t('contracts.obligation.startReview')}
                      </Button>
                    )}
                    {obligation.status === 'under_review' && (
                      <Button
                        variant="primary"
                        icon="clipboardCheck"
                        onClick={() => setDialog('decide')}
                      >
                        {t('contracts.obligation.decide')}
                      </Button>
                    )}
                  </span>
                ) : undefined
              }
            >
              <DetailList
                items={[
                  {
                    label: t('contracts.obligation.status'),
                    value: (
                      <span className="tiq-inline">
                        <StatusChip enum="obligations.status" value={obligation.status} />
                        {obligation.isOverdue && <OverdueChip />}
                      </span>
                    ),
                  },
                  {
                    label: t('contracts.obligation.due'),
                    value:
                      obligation.dueAt === null ? null : (
                        <OfficialDeadline deadline={obligation.dueAt} variant="block" />
                      ),
                  },
                  {
                    label: t('contracts.obligation.owner'),
                    value: <PersonName person={obligation.owner} />,
                  },
                  {
                    label: t('contracts.obligation.supplierContact'),
                    value: obligation.supplierContact,
                  },
                  {
                    label: t('contracts.obligation.escalation'),
                    value: <PersonName person={obligation.escalationUser} />,
                  },
                  { label: t('contracts.obligation.recurrence'), value: obligation.recurrence },
                  {
                    label: t('contracts.obligation.amount'),
                    value: obligation.isPaymentMilestone ? (
                      <MoneyText value={obligation.amount} />
                    ) : null,
                  },
                  {
                    label: t('contracts.obligation.dependsOn'),
                    value: obligation.dependsOn?.title,
                  },
                  {
                    label: t('contracts.obligation.survives'),
                    value: obligation.survivesCloseout
                      ? t('contracts.common.yes')
                      : t('contracts.common.no'),
                  },
                  {
                    label: t('contracts.obligation.waiver'),
                    value:
                      obligation.waiverApproval === null ? null : (
                        <ApprovalSummary
                          approval={obligation.waiverApproval}
                          timeZone={contract.timeZone}
                        />
                      ),
                  },
                ]}
              />
            </Card>
            <div className="tiq-grid tiq-grid--2">
              <Card title={t('contracts.obligation.criteriaTitle')}>
                <DetailList
                  stacked
                  items={[
                    { label: t('contracts.obligation.description'), value: obligation.description },
                    {
                      label: t('contracts.obligation.criteria'),
                      value: obligation.acceptanceCriteria,
                    },
                    {
                      label: t('contracts.obligation.evidenceRequired'),
                      value: obligation.evidenceRequired,
                    },
                    { label: t('contracts.obligation.consequence'), value: obligation.consequence },
                  ]}
                />
              </Card>
              <PaymentCard obligation={obligation} timeZone={contract.timeZone} />
            </div>
            <div className="tiq-grid tiq-grid--2">
              <Card title={t('contracts.obligation.evidence')}>
                {obligation.evidence.length === 0 ? (
                  <EmptyState compact title={t('contracts.obligation.noEvidence')} />
                ) : (
                  <Timeline
                    label={t('contracts.obligation.evidence')}
                    items={obligation.evidence.map((item) => ({
                      id: item.id,
                      icon: 'file',
                      tone: 'info',
                      title: item.document.fileName ?? item.document.title,
                      meta: `${item.submittedBy.fullName} (${item.organizationName}) · ${formatDateTime(item.submittedAt, contract.timeZone)}`,
                      detail: item.note ?? undefined,
                    }))}
                  />
                )}
              </Card>
              <Card title={t('contracts.obligation.decisions')}>
                {obligation.decisions.length === 0 ? (
                  <EmptyState compact title={t('contracts.obligation.noDecisions')} />
                ) : (
                  <Timeline
                    label={t('contracts.obligation.decisions')}
                    items={obligation.decisions.map((item) => ({
                      id: item.id,
                      icon: item.decision === 'accepted' ? 'checkCircle' : 'xCircle',
                      tone: item.decision === 'accepted' ? 'success' : 'danger',
                      title: `${tEnum('acceptance_decisions.decision', item.decision)} · ${item.decidedBy.fullName}`,
                      meta: formatDateTime(item.decidedAt, contract.timeZone),
                      detail: (
                        <span className="tiq-stack">
                          <span>{item.reasons}</span>
                          {item.remediationRequired !== null && (
                            <span>
                              {t('contracts.obligation.remediation', {
                                text: item.remediationRequired,
                              })}
                            </span>
                          )}
                          {item.remediationOwner !== null && (
                            <span>
                              {t('contracts.obligation.remediationOwner', {
                                name: item.remediationOwner.fullName,
                              })}
                            </span>
                          )}
                          {item.remediationDueAt !== null && (
                            <span className="tiq-inline">
                              {t('contracts.obligation.remediationDue')}
                              <DeadlineText deadline={item.remediationDueAt} />
                            </span>
                          )}
                        </span>
                      ),
                    }))}
                  />
                )}
              </Card>
            </div>
            {dialog === 'evidence' && (
              <EvidenceDialog
                open
                audience="buyer"
                obligation={obligation}
                contractReference={contract.reference}
                pending={evidence.pending}
                error={evidence.error}
                onClose={() => setDialog(null)}
                onSubmit={async (body) => {
                  const result = await evidence.run({
                    params: { contractId: contract.id, obligationId: obligation.id },
                    body,
                  });
                  return result !== null;
                }}
              />
            )}
            <ConfirmActionDialog
              open={dialog === 'review'}
              title={t('contracts.obligation.startReviewTitle')}
              scope={`${contract.reference} · ${obligation.title}`}
              consequence={t('contracts.obligation.startReviewConsequence')}
              confirmLabel={t('contracts.obligation.startReview')}
              onConfirm={async () => {
                const result = await startReview.run({
                  params: { contractId: contract.id, obligationId: obligation.id },
                });
                if (result !== null) setDialog(null);
              }}
              onCancel={() => setDialog(null)}
              pending={startReview.pending}
              error={startReview.error}
            />
            {dialog === 'decide' && (
              <DecisionDialog
                contract={contract}
                obligation={obligation}
                onClose={() => setDialog(null)}
              />
            )}
          </div>
        );
      }}
    </QueryView>
  );
}

export default function ObligationPage() {
  return (
    <ContractWorkspace screen="CON-06">
      {(contract) => <ObligationBody contract={contract} />}
    </ContractWorkspace>
  );
}
