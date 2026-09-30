/**
 * SUP-23 — One of the supplier's own contracts: scope, signatures, obligations and milestones, change requests,
 * performance reviews, incidents and improvement actions, the shared financial status and disputes. The supplier
 * signs or refuses in the app, submits evidence, responds to or disputes reviews, requests and agrees changes, and
 * raises claims. Buyer-internal records (renewal options, handover, allocations, approvals, other bids) never appear.
 */
import { useState } from 'react';

import { SUPPLIER_DISPUTE_TYPES, contractsEndpoints } from '@contracts/contracts';
import type {
  SupplierChangeRequestRow,
  SupplierContractDetail,
  SupplierObligationRow,
  SupplierReviewView,
  SupplierSignatoryView,
} from '@contracts/contracts';
import { isDecimal } from '@contracts/decimal';

import { useApiQuery } from '../../../../api/hooks';
import { usePermission } from '../../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  Dialog,
  EmptyState,
  ErrorState,
  MoneyInput,
  MoneyText,
  NumberInput,
  OfficialDeadline,
  OrDash,
  OverdueChip,
  PageHeader,
  QueryView,
  Reference,
  Select,
  SkeletonBlock,
  StatusChip,
  Tabs,
  TextArea,
  TextField,
  Timeline,
} from '../../../../components/ui';
import type { DataTableColumn } from '../../../../components/ui';
import { formatCalendarDate, formatDateTime } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import { EvidenceDialog } from '../../components/EvidenceDialog';
import { FormDialog } from '../../components/FormDialog';
import { DateText, DeadlineText, InstantText } from '../../components/shared';
import { splitCommandError } from '../../lib/errors';
import { useContractCommand, useDialog, useIdParam } from '../../lib/hooks';
import { optionalMoney, optionalText, pick } from '../../lib/lists';
import { contractPaths } from '../../lib/paths';
import { SUPPLIER_CONTRACT_PARTICIPATE } from '../../lib/permissions';

const OPEN_FOR_EVIDENCE: readonly string[] = ['planned', 'due', 'overdue', 'rejected'];
const AGREEABLE: readonly string[] = ['submitted', 'impact_assessment', 'approval_pending'];

const TAB_IDS = [
  'overview',
  'signature',
  'obligations',
  'changes',
  'performance',
  'financial',
  'disputes',
] as const;
type TabId = (typeof TAB_IDS)[number];

function Overview({ contract }: { readonly contract: SupplierContractDetail }) {
  const tz = contract.timeZone;
  return (
    <div className="tiq-stack">
      <div className="tiq-grid tiq-grid--sidebar">
        <Card title={t('contracts.overview.agreement')}>
          <div className="tiq-stack">
            <p>{contract.scope === '' ? t('contracts.overview.noScope') : contract.scope}</p>
            <DetailList
              items={[
                { label: t('contracts.supplier.col.buyer'), value: contract.buyer.name },
                { label: t('contracts.overview.legalEntity'), value: contract.legalEntity.name },
                {
                  label: t('contracts.overview.tender'),
                  value:
                    contract.tender === null ? null : (
                      <Reference value={contract.tender.reference} />
                    ),
                },
                {
                  label: t('contracts.overview.value'),
                  value: <MoneyText value={contract.value} />,
                },
                {
                  label: t('contracts.overview.currentValue'),
                  value: <MoneyText value={contract.currentValue} />,
                },
                {
                  label: t('contracts.overview.term'),
                  value:
                    contract.termStart === null && contract.termEnd === null
                      ? null
                      : `${contract.termStart === null ? '…' : formatCalendarDate(contract.termStart)} – ${
                          contract.termEnd === null ? '…' : formatCalendarDate(contract.termEnd)
                        }`,
                },
                { label: t('contracts.overview.paymentTerms'), value: contract.paymentTerms },
                { label: t('contracts.overview.locations'), value: contract.serviceLocations },
              ]}
            />
          </div>
        </Card>
        <Card title={t('contracts.milestone.label')} subtitle={t('contracts.signature.separate')}>
          <DetailList
            stacked
            items={[
              {
                label: t('contracts.milestone.signed'),
                value: <InstantText at={contract.signedAt} timeZone={tz} />,
              },
              {
                label: t('contracts.milestone.effective'),
                value: <DateText date={contract.effectiveDate} />,
              },
              {
                label: t('contracts.milestone.notice_to_proceed'),
                value: <InstantText at={contract.noticeToProceedAt} timeZone={tz} />,
              },
              {
                label: t('contracts.milestone.delivery_start'),
                value: <InstantText at={contract.deliveryStartAt} timeZone={tz} />,
              },
            ]}
          />
        </Card>
      </div>
      <div className="tiq-grid tiq-grid--2">
        <Card title={t('contracts.overview.contacts')}>
          {contract.contacts.length === 0 ? (
            <EmptyState compact title={t('contracts.overview.noContacts')} />
          ) : (
            <DetailList
              stacked
              items={contract.contacts.map((contact, index) => ({
                key: `${contact.party}-${index}`,
                label: `${tEnum('obligations.party', contact.party)} · ${contact.role}`,
                value: [contact.name, contact.email, contact.phone]
                  .filter((part) => part !== null)
                  .join(' · '),
              }))}
            />
          )}
        </Card>
        <Card flush title={t('contracts.securities.title')}>
          <DataTable
            caption={t('contracts.securities.title')}
            columns={[
              {
                id: 'type',
                header: t('contracts.securities.col.type'),
                cell: (row) => tEnum('contract_securities.security_type', row.securityType),
              },
              {
                id: 'amount',
                header: t('contracts.securities.col.amount'),
                numeric: true,
                cell: (row) => <MoneyText value={row.amount} />,
              },
              {
                id: 'expires',
                header: t('contracts.securities.col.expires'),
                cell: (row) => <InstantText at={row.expiresAt} timeZone={tz} />,
              },
              {
                id: 'status',
                header: t('contracts.securities.col.status'),
                cell: (row) => (
                  <StatusChip enum="contract_securities.status" value={row.status} size="sm" />
                ),
              },
            ]}
            rows={contract.securities}
            rowKey={(row) => String(row.id)}
            empty={<EmptyState compact title={t('contracts.securities.empty')} />}
          />
        </Card>
      </div>
    </div>
  );
}

function Signatures({
  contract,
  canAct,
}: {
  readonly contract: SupplierContractDetail;
  readonly canAct: boolean;
}) {
  const dialog = useDialog<'sign' | 'refuse', SupplierSignatoryView>();
  const sign = useContractCommand(contractsEndpoints.supplierSign, (r) => r.message);
  const refuse = useContractCommand(contractsEndpoints.supplierRefuseSignature, (r) => r.message);
  const awaiting = contract.status === 'awaiting_signature';
  const scope = `${contract.reference} · ${contract.title}`;
  const columns: DataTableColumn<SupplierSignatoryView>[] = [
    {
      id: 'name',
      header: t('contracts.signature.col.signatory'),
      cell: (row) => (
        <>
          <span>
            {row.name}
            {row.isMe ? ` ${t('contracts.supplier.you')}` : ''}
          </span>
          <span className="tiq-cell-sub">
            {tEnum('contract_signatories.party', row.party)} · {row.organizationName}
          </span>
        </>
      ),
    },
    {
      id: 'status',
      header: t('contracts.signature.col.status'),
      cell: (row) => <StatusChip enum="contract_signatories.status" value={row.status} size="sm" />,
    },
    {
      id: 'method',
      header: t('contracts.signature.col.method'),
      cell: (row) => (
        <OrDash>
          {row.method === null ? null : tEnum('contract_signatories.method', row.method)}
        </OrDash>
      ),
    },
    {
      id: 'signedAt',
      header: t('contracts.signature.col.signedAt'),
      cell: (row) => <InstantText at={row.signedAt} timeZone={contract.timeZone} />,
    },
    {
      id: 'actions',
      header: t('contracts.register.col.actions'),
      cell: (row) =>
        canAct && awaiting && row.isMe && row.status === 'pending' ? (
          <span className="tiq-inline">
            <Button
              size="sm"
              variant="primary"
              icon="fileSignature"
              disabled={contract.signatureBlockedReason !== null}
              onClick={() => {
                sign.reset();
                dialog.show('sign', row);
              }}
            >
              {t('contracts.signature.sign')}
            </Button>
            <Button
              size="sm"
              variant="danger-soft"
              onClick={() => {
                refuse.reset();
                dialog.show('refuse', row);
              }}
            >
              {t('contracts.supplier.refuse')}
            </Button>
          </span>
        ) : null,
    },
  ];
  return (
    <div className="tiq-stack">
      {contract.signatureBlockedReason !== null && (
        <Banner tone="warning" title={t('contracts.supplier.signatureBlocked')}>
          {contract.signatureBlockedReason}
        </Banner>
      )}
      {contract.signedOutsideApp && (
        <Banner tone="info" title={t('contracts.signature.outsideAppYes')} />
      )}
      <Card flush title={t('contracts.signature.signatories')}>
        <DataTable
          caption={t('contracts.signature.signatories')}
          columns={columns}
          rows={contract.signatories}
          rowKey={(row) => String(row.id)}
          empty={<EmptyState compact title={t('contracts.signature.noSignatories')} />}
        />
      </Card>
      <ConfirmActionDialog
        open={dialog.open === 'sign'}
        title={t('contracts.signature.signTitle')}
        scope={scope}
        consequence={t('contracts.supplier.signConsequence')}
        confirmLabel={t('contracts.signature.sign')}
        acknowledgement={t('contracts.signature.signAck')}
        onConfirm={async () => {
          const target = dialog.target;
          if (target === null) return;
          const result = await sign.run({
            params: { contractId: contract.id, signatoryId: target.id },
            body: { confirm: true },
          });
          if (result !== null) dialog.close();
        }}
        onCancel={dialog.close}
        pending={sign.pending}
        error={sign.error}
      />
      <ConfirmActionDialog
        open={dialog.open === 'refuse'}
        tone="danger"
        title={t('contracts.supplier.refuseTitle')}
        scope={scope}
        consequence={t('contracts.supplier.refuseConsequence')}
        confirmLabel={t('contracts.supplier.refuse')}
        reason={{ label: t('contracts.common.reason'), required: true }}
        onConfirm={async ({ reason }) => {
          const target = dialog.target;
          if (target === null) return;
          const result = await refuse.run({
            params: { contractId: contract.id, signatoryId: target.id },
            body: { reason },
          });
          if (result !== null) dialog.close();
        }}
        onCancel={dialog.close}
        pending={refuse.pending}
        error={refuse.error}
      />
    </div>
  );
}

function ObligationDetailDialog({
  contract,
  obligation,
  onClose,
}: {
  readonly contract: SupplierContractDetail;
  readonly obligation: SupplierObligationRow;
  readonly onClose: () => void;
}) {
  const query = useApiQuery(contractsEndpoints.supplierObligation, {
    params: { contractId: contract.id, obligationId: obligation.id },
  });
  return (
    <Dialog open size="lg" title={obligation.title} onClose={onClose}>
      <QueryView query={query}>
        {(detail) => (
          <div className="tiq-stack">
            <DetailList
              items={[
                {
                  label: t('contracts.obligation.status'),
                  value: <StatusChip enum="obligations.status" value={detail.status} />,
                },
                {
                  label: t('contracts.obligation.due'),
                  value: <DeadlineText deadline={detail.dueAt} />,
                },
                { label: t('contracts.obligation.description'), value: detail.description },
                { label: t('contracts.obligation.criteria'), value: detail.acceptanceCriteria },
                {
                  label: t('contracts.obligation.evidenceRequired'),
                  value: detail.evidenceRequired,
                },
              ]}
            />
            {detail.isPaymentMilestone && (
              <Banner tone="info" title={t('contracts.milestones.paymentRule')}>
                {t('contracts.supplier.paymentRule')}
              </Banner>
            )}
            <Card title={t('contracts.obligation.evidence')}>
              {detail.evidence.length === 0 ? (
                <EmptyState compact title={t('contracts.obligation.noEvidence')} />
              ) : (
                <Timeline
                  label={t('contracts.obligation.evidence')}
                  items={detail.evidence.map((item) => ({
                    id: item.id,
                    icon: 'file',
                    tone: 'info',
                    title: item.document.fileName ?? item.document.title,
                    meta: `${item.submittedBy.fullName} · ${formatDateTime(item.submittedAt, contract.timeZone)}`,
                    detail: item.note ?? undefined,
                  }))}
                />
              )}
            </Card>
            <Card title={t('contracts.obligation.decisions')}>
              {detail.decisions.length === 0 ? (
                <EmptyState compact title={t('contracts.obligation.noDecisions')} />
              ) : (
                <Timeline
                  label={t('contracts.obligation.decisions')}
                  items={detail.decisions.map((item) => ({
                    id: item.id,
                    icon: item.decision === 'accepted' ? 'checkCircle' : 'xCircle',
                    tone: item.decision === 'accepted' ? 'success' : 'danger',
                    title: tEnum('acceptance_decisions.decision', item.decision),
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
        )}
      </QueryView>
    </Dialog>
  );
}

function Obligations({
  contract,
  canAct,
}: {
  readonly contract: SupplierContractDetail;
  readonly canAct: boolean;
}) {
  const dialog = useDialog<'view' | 'evidence', SupplierObligationRow>();
  const evidence = useContractCommand(contractsEndpoints.supplierSubmitEvidence, (r) => r.message);
  const columns: DataTableColumn<SupplierObligationRow>[] = [
    {
      id: 'title',
      header: t('contracts.obligations.col.title'),
      cell: (row) => (
        <>
          <span>{row.title}</span>
          <span className="tiq-cell-sub">
            {tEnum('obligations.kind', row.kind)} · {tEnum('obligations.party', row.party)}
          </span>
        </>
      ),
    },
    {
      id: 'due',
      header: t('contracts.obligations.col.due'),
      cell: (row) =>
        row.dueAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <span className="tiq-stack">
            <OfficialDeadline deadline={row.dueAt} />
            {row.isOverdue && <OverdueChip />}
          </span>
        ),
    },
    {
      id: 'status',
      header: t('contracts.obligations.col.status'),
      cell: (row) => (
        <>
          <StatusChip enum="obligations.status" value={row.status} size="sm" />
          {row.latestDecision !== null && (
            <span className="tiq-cell-sub">
              {t('contracts.obligations.latestDecision', {
                decision: tEnum('acceptance_decisions.decision', row.latestDecision.decision),
                date: formatDateTime(row.latestDecision.decidedAt, contract.timeZone),
              })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'amount',
      header: t('contracts.obligations.col.payment'),
      numeric: true,
      cell: (row) =>
        row.isPaymentMilestone ? <MoneyText value={row.amount} /> : <OrDash>{null}</OrDash>,
    },
    {
      id: 'actions',
      header: t('contracts.register.col.actions'),
      cell: (row) => (
        <span className="tiq-inline">
          <Button size="sm" onClick={() => dialog.show('view', row)}>
            {t('contracts.common.view')}
          </Button>
          {canAct && row.party === 'supplier' && OPEN_FOR_EVIDENCE.includes(row.status) && (
            <Button
              size="sm"
              icon="upload"
              onClick={() => {
                evidence.reset();
                dialog.show('evidence', row);
              }}
              aria-label={t('contracts.obligations.evidenceFor', { title: row.title })}
            >
              {t('contracts.obligations.submitEvidence')}
            </Button>
          )}
        </span>
      ),
    },
  ];
  return (
    <>
      <Card
        flush
        title={t('contracts.supplier.obligations')}
        subtitle={t('contracts.supplier.paymentRule')}
      >
        <DataTable
          caption={t('contracts.supplier.obligations')}
          columns={columns}
          rows={contract.obligations}
          rowKey={(row) => String(row.id)}
          empty={<EmptyState compact title={t('contracts.obligations.empty')} />}
        />
      </Card>
      {dialog.open === 'view' && dialog.target !== null && (
        <ObligationDetailDialog
          contract={contract}
          obligation={dialog.target}
          onClose={dialog.close}
        />
      )}
      {dialog.open === 'evidence' && dialog.target !== null && (
        <EvidenceDialog
          open
          audience="supplier"
          obligation={dialog.target}
          contractReference={contract.reference}
          pending={evidence.pending}
          error={evidence.error}
          onClose={dialog.close}
          onSubmit={async (body) => {
            const target = dialog.target;
            if (target === null) return false;
            const result = await evidence.run({
              params: { contractId: contract.id, obligationId: target.id },
              body,
            });
            return result !== null;
          }}
        />
      )}
    </>
  );
}

function RequestChangeDialog({
  contract,
  onClose,
}: {
  readonly contract: SupplierContractDetail;
  readonly onClose: () => void;
}) {
  const currency = contract.value.currency;
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [scopeChange, setScopeChange] = useState('');
  const [cost, setCost] = useState('');
  const [days, setDays] = useState('');
  const [local, setLocal] = useState<Record<string, string>>({});
  const command = useContractCommand(contractsEndpoints.supplierRequestChange, (row) =>
    t('contracts.changes.created', { number: row.displayNumber }),
  );
  const { dialogError, fieldErrors } = splitCommandError(command.error, [
    'title',
    'reason',
    'scopeChange',
    'costImpact',
    'scheduleImpactDays',
  ]);
  const errorFor = (field: string): string | undefined =>
    local[field] ?? fieldErrors.forField(field);
  const submit = async (): Promise<void> => {
    const errors: Record<string, string> = {};
    if (title.trim().length < 3) errors.title = t('contracts.create.errors.title');
    if (reason.trim() === '') errors.reason = t('contracts.changes.reasonRequired');
    if (cost !== '' && !isDecimal(cost)) errors.costImpact = t('contracts.changes.costInvalid');
    setLocal(errors);
    if (Object.keys(errors).length > 0) return;
    const costImpact = optionalMoney({ amount: cost, currency });
    const scope = optionalText(scopeChange);
    const result = await command.run({
      params: { contractId: contract.id },
      body: {
        title: title.trim(),
        reason: reason.trim(),
        submit: true,
        ...(costImpact === undefined ? {} : { costImpact }),
        ...(scope === undefined ? {} : { scopeChange: scope }),
        ...(days === '' ? {} : { scheduleImpactDays: Number(days) }),
      },
    });
    if (result !== null) onClose();
  };
  return (
    <FormDialog
      open
      title={t('contracts.supplier.requestChange')}
      description={t('contracts.supplier.requestChangeHint')}
      submitLabel={t('contracts.changes.submitChange')}
      onSubmit={() => void submit()}
      onClose={onClose}
      pending={command.pending}
      error={dialogError}
      otherErrors={fieldErrors.other}
    >
      <TextField
        label={t('contracts.changes.col.title')}
        required
        value={title}
        onChange={setTitle}
        error={errorFor('title')}
      />
      <TextArea
        label={t('contracts.changes.reason')}
        required
        value={reason}
        onChange={setReason}
        error={errorFor('reason')}
      />
      <TextArea
        label={t('contracts.changes.scope')}
        value={scopeChange}
        onChange={setScopeChange}
        error={errorFor('scopeChange')}
      />
      <MoneyInput
        label={t('contracts.changes.cost')}
        value={{ amount: cost, currency }}
        currencies={[currency]}
        onChange={(value) => setCost(value.amount)}
        error={errorFor('costImpact')}
      />
      <NumberInput
        label={t('contracts.changes.schedule')}
        allowNegative
        value={days}
        onChange={setDays}
        suffix={t('contracts.changes.daysSuffix')}
        error={errorFor('scheduleImpactDays')}
      />
    </FormDialog>
  );
}

function Changes({
  contract,
  canAct,
}: {
  readonly contract: SupplierContractDetail;
  readonly canAct: boolean;
}) {
  const dialog = useDialog<'request' | 'agree', SupplierChangeRequestRow>();
  const agree = useContractCommand(contractsEndpoints.supplierAgreeChange, (row) =>
    t('contracts.supplier.agreed', { number: row.displayNumber }),
  );
  const active = contract.status === 'active';
  const columns: DataTableColumn<SupplierChangeRequestRow>[] = [
    {
      id: 'number',
      header: t('contracts.changes.col.number'),
      cell: (row) => (
        <>
          <span className="tiq-ref">{row.displayNumber}</span>
          <span className="tiq-cell-sub">{row.title}</span>
        </>
      ),
    },
    { id: 'reason', header: t('contracts.changes.reason'), cell: (row) => row.reason },
    {
      id: 'raisedBy',
      header: t('contracts.changes.col.raisedBy'),
      cell: (row) => tEnum('change_requests.raised_by_party', row.raisedByParty),
    },
    {
      id: 'status',
      header: t('contracts.changes.col.status'),
      cell: (row) => <StatusChip enum="change_requests.status" value={row.status} size="sm" />,
    },
    {
      id: 'cost',
      header: t('contracts.changes.cost'),
      numeric: true,
      cell: (row) => <MoneyText value={row.costImpact} />,
    },
    {
      id: 'schedule',
      header: t('contracts.changes.schedule'),
      cell: (row) => (
        <OrDash>
          {row.scheduleImpactDays === null
            ? null
            : t('contracts.changes.scheduleDays', { count: row.scheduleImpactDays })}
        </OrDash>
      ),
    },
    {
      id: 'agreed',
      header: t('contracts.changes.col.agreed'),
      cell: (row) =>
        row.supplierAgreedAt !== null ? (
          <InstantText at={row.supplierAgreedAt} timeZone={contract.timeZone} />
        ) : canAct && AGREEABLE.includes(row.status) ? (
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              agree.reset();
              dialog.show('agree', row);
            }}
          >
            {t('contracts.supplier.agree')}
          </Button>
        ) : (
          <span className="tiq-text-muted">{t('contracts.changes.notAgreed')}</span>
        ),
    },
  ];
  return (
    <>
      <Card
        flush
        title={t('contracts.changes.title')}
        actions={
          canAct && active ? (
            <Button size="sm" icon="plus" onClick={() => dialog.show('request')}>
              {t('contracts.supplier.requestChange')}
            </Button>
          ) : undefined
        }
      >
        <DataTable
          caption={t('contracts.changes.title')}
          columns={columns}
          rows={contract.changeRequests}
          rowKey={(row) => String(row.id)}
          empty={<EmptyState compact title={t('contracts.changes.empty')} />}
        />
      </Card>
      {dialog.open === 'request' && (
        <RequestChangeDialog contract={contract} onClose={dialog.close} />
      )}
      <ConfirmActionDialog
        open={dialog.open === 'agree'}
        title={t('contracts.supplier.agreeTitle')}
        scope={
          dialog.target === null
            ? contract.reference
            : `${contract.reference} · ${dialog.target.displayNumber} ${dialog.target.title}`
        }
        consequence={t('contracts.supplier.agreeConsequence')}
        confirmLabel={t('contracts.supplier.agree')}
        onConfirm={async () => {
          const target = dialog.target;
          if (target === null) return;
          const result = await agree.run({
            params: { contractId: contract.id, changeId: target.id },
            body: { confirm: true },
          });
          if (result !== null) dialog.close();
        }}
        onCancel={dialog.close}
        pending={agree.pending}
        error={agree.error}
      />
    </>
  );
}

function RespondDialog({
  contract,
  review,
  onClose,
}: {
  readonly contract: SupplierContractDetail;
  readonly review: SupplierReviewView;
  readonly onClose: () => void;
}) {
  const [disputes, setDisputes] = useState(false);
  const command = useContractCommand(contractsEndpoints.supplierRespondReview, () =>
    t('contracts.supplier.responded'),
  );
  const { dialogError } = splitCommandError(command.error, ['response', 'disputes']);
  return (
    <ConfirmActionDialog
      open
      title={t('contracts.supplier.respondTitle')}
      scope={`${contract.reference} · ${formatCalendarDate(review.periodStart)} – ${formatCalendarDate(review.periodEnd)}`}
      consequence={
        disputes
          ? t('contracts.supplier.disputeConsequence')
          : t('contracts.supplier.respondConsequence')
      }
      confirmLabel={t('contracts.supplier.respond')}
      reason={{ label: t('contracts.supplier.response'), required: true }}
      onConfirm={async ({ reason }) => {
        const result = await command.run({
          params: { contractId: contract.id, reviewId: review.id },
          body: { response: reason, disputes },
        });
        if (result !== null) onClose();
      }}
      onCancel={onClose}
      pending={command.pending}
      error={dialogError}
    >
      {review.summary !== null && (
        <Banner tone="info" title={t('contracts.performance.summary')}>
          {review.summary}
        </Banner>
      )}
      <Checkbox
        label={t('contracts.supplier.disputeAssessment')}
        hint={t('contracts.supplier.disputeHint')}
        checked={disputes}
        onChange={setDisputes}
      />
    </ConfirmActionDialog>
  );
}

function Performance({
  contract,
  canAct,
}: {
  readonly contract: SupplierContractDetail;
  readonly canAct: boolean;
}) {
  const [responding, setResponding] = useState<SupplierReviewView | null>(null);
  const reviewColumns: DataTableColumn<SupplierReviewView>[] = [
    {
      id: 'period',
      header: t('contracts.performance.col.period'),
      cell: (row) =>
        `${formatCalendarDate(row.periodStart)} – ${formatCalendarDate(row.periodEnd)}`,
    },
    {
      id: 'status',
      header: t('contracts.performance.col.status'),
      cell: (row) => <StatusChip enum="performance_reviews.status" value={row.status} size="sm" />,
    },
    {
      id: 'rating',
      header: t('contracts.performance.col.rating'),
      cell: (row) => (
        <OrDash>
          {row.overallRating === null
            ? null
            : tEnum('performance_reviews.overall_rating', row.overallRating)}
        </OrDash>
      ),
    },
    {
      id: 'results',
      header: t('contracts.performance.results'),
      cell: (row) =>
        row.results.length === 0 ? (
          <OrDash>{null}</OrDash>
        ) : (
          row.results.map((result) => (
            <span key={result.id} className="tiq-cell-sub">
              {result.measureName}: {result.actual ?? t('contracts.common.notRecorded')} (
              {result.target})
            </span>
          ))
        ),
    },
    {
      id: 'response',
      header: t('contracts.performance.col.response'),
      cell: (row) => (
        <>
          {row.supplierDisputes && (
            <Chip tone="warning" size="sm">
              {t('contracts.performance.disputed')}
            </Chip>
          )}
          <span className="tiq-cell-sub">
            {row.supplierResponse ?? t('contracts.performance.noResponse')}
          </span>
        </>
      ),
    },
    {
      id: 'actions',
      header: t('contracts.register.col.actions'),
      cell: (row) =>
        canAct && (row.status === 'shared_with_supplier' || row.status === 'supplier_responded') ? (
          <Button size="sm" variant="primary" onClick={() => setResponding(row)}>
            {t('contracts.supplier.respond')}
          </Button>
        ) : null,
    },
  ];
  return (
    <div className="tiq-stack">
      <Card
        flush
        title={t('contracts.performance.reviews')}
        subtitle={t('contracts.supplier.reviewsHint')}
      >
        <DataTable
          caption={t('contracts.performance.reviews')}
          columns={reviewColumns}
          rows={contract.reviews}
          rowKey={(row) => String(row.id)}
          empty={<EmptyState compact title={t('contracts.performance.noReviews')} />}
        />
      </Card>
      <div className="tiq-grid tiq-grid--2">
        <Card flush title={t('contracts.performance.incidents')}>
          <DataTable
            caption={t('contracts.performance.incidents')}
            columns={[
              {
                id: 'type',
                header: t('contracts.performance.col.type'),
                cell: (row) => tEnum('contract_incidents.incident_type', row.incidentType),
              },
              {
                id: 'severity',
                header: t('contracts.performance.col.severity'),
                cell: (row) => (
                  <StatusChip enum="contract_incidents.severity" value={row.severity} size="sm" />
                ),
              },
              {
                id: 'description',
                header: t('contracts.performance.col.description'),
                cell: (row) => row.description,
              },
              {
                id: 'status',
                header: t('contracts.performance.col.status'),
                cell: (row) => (
                  <StatusChip enum="contract_incidents.status" value={row.status} size="sm" />
                ),
              },
            ]}
            rows={contract.incidents}
            rowKey={(row) => String(row.id)}
            empty={<EmptyState compact title={t('contracts.performance.noIncidents')} />}
          />
        </Card>
        <Card flush title={t('contracts.performance.actions')}>
          <DataTable
            caption={t('contracts.performance.actions')}
            columns={[
              {
                id: 'action',
                header: t('contracts.performance.col.action'),
                cell: (row) => row.action,
              },
              {
                id: 'owner',
                header: t('contracts.performance.col.owner'),
                cell: (row) => row.owner,
              },
              {
                id: 'due',
                header: t('contracts.performance.col.due'),
                cell: (row) => <DeadlineText deadline={row.dueAt} />,
              },
              {
                id: 'status',
                header: t('contracts.performance.col.status'),
                cell: (row) => (
                  <StatusChip enum="improvement_actions.status" value={row.status} size="sm" />
                ),
              },
            ]}
            rows={contract.improvementActions}
            rowKey={(row) => String(row.id)}
            empty={<EmptyState compact title={t('contracts.performance.noActions')} />}
          />
        </Card>
      </div>
      {responding !== null && (
        <RespondDialog
          contract={contract}
          review={responding}
          onClose={() => setResponding(null)}
        />
      )}
    </div>
  );
}

function Financial({ contract }: { readonly contract: SupplierContractDetail }) {
  return (
    <div className="tiq-stack">
      <Banner tone="info" title={t('contracts.financials.rule')}>
        {t('contracts.supplier.financialRule')}
      </Banner>
      <Card flush title={t('contracts.financials.invoices')}>
        <DataTable
          caption={t('contracts.financials.invoices')}
          columns={[
            {
              id: 'invoice',
              header: t('contracts.financials.col.invoice'),
              cell: (row) => (
                <>
                  <span className="tiq-mono">{row.invoiceRef}</span>
                  <span className="tiq-cell-sub">{formatCalendarDate(row.invoiceDate)}</span>
                </>
              ),
            },
            {
              id: 'milestone',
              header: t('contracts.financials.col.milestone'),
              cell: (row) => <OrDash>{row.obligationTitle}</OrDash>,
            },
            {
              id: 'amount',
              header: t('contracts.financials.col.amount'),
              numeric: true,
              cell: (row) => <MoneyText value={row.amount} />,
            },
            {
              id: 'acceptance',
              header: t('contracts.financials.col.acceptance'),
              cell: (row) => (
                <StatusChip
                  enum="contract_invoices.acceptance_status"
                  value={row.acceptanceStatus}
                  size="sm"
                />
              ),
            },
            {
              id: 'payment',
              header: t('contracts.financials.col.payment'),
              cell: (row) => (
                <>
                  <StatusChip
                    enum="contract_invoices.payment_status"
                    value={row.paymentStatus}
                    size="sm"
                  />
                  {row.disputeReason !== null && (
                    <span className="tiq-cell-sub">{row.disputeReason}</span>
                  )}
                </>
              ),
            },
            {
              id: 'source',
              header: t('contracts.financials.col.source'),
              cell: (row) => (
                <>
                  <span>{tEnum('contract_invoices.source', row.source)}</span>
                  <span className="tiq-cell-sub">
                    {t('contracts.common.asOf', {
                      at: formatDateTime(row.asOf, contract.timeZone),
                    })}
                  </span>
                </>
              ),
            },
          ]}
          rows={contract.invoices}
          rowKey={(row) => String(row.id)}
          empty={<EmptyState compact title={t('contracts.financials.noInvoices')} />}
        />
      </Card>
    </div>
  );
}

function RaiseDisputeDialog({
  contract,
  onClose,
}: {
  readonly contract: SupplierContractDetail;
  readonly onClose: () => void;
}) {
  const currency = contract.value.currency;
  const [type, setType] = useState<string>('claim');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [basis, setBasis] = useState('');
  const [local, setLocal] = useState<Record<string, string>>({});
  const command = useContractCommand(contractsEndpoints.supplierRaiseDispute, (row) =>
    t('contracts.disputes.recorded', {
      type: tEnum('contract_disputes.dispute_type', row.disputeType),
    }),
  );
  const { dialogError, fieldErrors } = splitCommandError(command.error, [
    'disputeType',
    'amount',
    'description',
    'contractBasis',
  ]);
  const errorFor = (field: string): string | undefined =>
    local[field] ?? fieldErrors.forField(field);
  const submit = async (): Promise<void> => {
    const errors: Record<string, string> = {};
    if (description.trim() === '') errors.description = t('contracts.disputes.descriptionRequired');
    if (amount !== '' && !isDecimal(amount)) errors.amount = t('contracts.changes.costInvalid');
    setLocal(errors);
    const disputeType = pick(type, SUPPLIER_DISPUTE_TYPES);
    if (Object.keys(errors).length > 0 || disputeType === undefined) return;
    const money = optionalMoney({ amount, currency });
    const contractBasis = optionalText(basis);
    const result = await command.run({
      params: { contractId: contract.id },
      body: {
        disputeType,
        description: description.trim(),
        ...(money === undefined ? {} : { amount: money }),
        ...(contractBasis === undefined ? {} : { contractBasis }),
      },
    });
    if (result !== null) onClose();
  };
  return (
    <FormDialog
      open
      title={t('contracts.supplier.raiseDispute')}
      description={t('contracts.supplier.raiseDisputeHint')}
      submitLabel={t('contracts.supplier.raise')}
      onSubmit={() => void submit()}
      onClose={onClose}
      pending={command.pending}
      error={dialogError}
      otherErrors={fieldErrors.other}
    >
      <Select
        label={t('contracts.disputes.col.type')}
        required
        value={type}
        options={SUPPLIER_DISPUTE_TYPES.map((value) => ({
          value,
          label: tEnum('contract_disputes.dispute_type', value),
        }))}
        onChange={setType}
        error={errorFor('disputeType')}
      />
      <MoneyInput
        label={t('contracts.disputes.col.amount')}
        value={{ amount, currency }}
        currencies={[currency]}
        onChange={(value) => setAmount(value.amount)}
        error={errorFor('amount')}
      />
      <TextArea
        label={t('contracts.disputes.col.description')}
        required
        value={description}
        onChange={setDescription}
        error={errorFor('description')}
      />
      <TextArea
        label={t('contracts.disputes.col.basis')}
        value={basis}
        onChange={setBasis}
        error={errorFor('contractBasis')}
      />
    </FormDialog>
  );
}

function Disputes({
  contract,
  canAct,
}: {
  readonly contract: SupplierContractDetail;
  readonly canAct: boolean;
}) {
  const [raising, setRaising] = useState(false);
  const started =
    contract.status === 'active' ||
    contract.status === 'suspended' ||
    contract.status === 'expired';
  return (
    <>
      <Card
        flush
        title={t('contracts.disputes.title')}
        actions={
          canAct && started ? (
            <Button size="sm" icon="plus" onClick={() => setRaising(true)}>
              {t('contracts.supplier.raiseDispute')}
            </Button>
          ) : undefined
        }
      >
        <DataTable
          caption={t('contracts.disputes.title')}
          columns={[
            {
              id: 'type',
              header: t('contracts.disputes.col.type'),
              cell: (row) => (
                <>
                  <span>{tEnum('contract_disputes.dispute_type', row.disputeType)}</span>
                  <span className="tiq-cell-sub">
                    {row.raisedByOrganization} · {formatDateTime(row.raisedAt, contract.timeZone)}
                  </span>
                </>
              ),
            },
            {
              id: 'description',
              header: t('contracts.disputes.col.description'),
              cell: (row) => row.description,
            },
            {
              id: 'amount',
              header: t('contracts.disputes.col.amount'),
              numeric: true,
              cell: (row) => <MoneyText value={row.amount} />,
            },
            {
              id: 'status',
              header: t('contracts.disputes.col.status'),
              cell: (row) => (
                <>
                  <StatusChip enum="contract_disputes.status" value={row.status} size="sm" />
                  {row.resolutionNote !== null && (
                    <span className="tiq-cell-sub">{row.resolutionNote}</span>
                  )}
                </>
              ),
            },
          ]}
          rows={contract.disputes}
          rowKey={(row) => String(row.id)}
          empty={<EmptyState compact title={t('contracts.disputes.empty')} />}
        />
      </Card>
      {raising && <RaiseDisputeDialog contract={contract} onClose={() => setRaising(false)} />}
    </>
  );
}

export default function SupplierContractPage() {
  const contractId = useIdParam('contractId');
  const canAct = usePermission(SUPPLIER_CONTRACT_PARTICIPATE);
  const [tab, setTab] = useState<TabId>('overview');
  const query = useApiQuery(
    contractsEndpoints.supplierGet,
    contractId === null ? null : { params: { contractId } },
  );
  const back = { to: contractPaths.supplierList, label: t('contracts.supplier.back') };

  if (contractId === null) {
    return (
      <>
        <PageHeader title={t('contracts.supplier.title')} back={back} />
        <Banner tone="error" title={t('contracts.workspace.invalidId')} />
      </>
    );
  }
  const contract = query.data;
  if (contract === undefined) {
    return (
      <>
        <PageHeader title={t('contracts.supplier.title')} back={back} />
        {query.error !== null ? (
          <ErrorState error={query.error} onRetry={query.reload} />
        ) : (
          <SkeletonBlock lines={6} />
        )}
      </>
    );
  }

  const mySignature = contract.signatories.find((item) => item.isMe && item.status === 'pending');
  const tabs = [
    { id: 'overview', label: t('contracts.supplier.tabs.overview') },
    {
      id: 'signature',
      label: t('contracts.supplier.tabs.signature'),
      count: mySignature === undefined ? undefined : 1,
    },
    {
      id: 'obligations',
      label: t('contracts.supplier.tabs.obligations'),
      count: contract.overdueObligations || undefined,
    },
    {
      id: 'changes',
      label: t('contracts.supplier.tabs.changes'),
      count: contract.pendingChangeRequests || undefined,
    },
    { id: 'performance', label: t('contracts.supplier.tabs.performance') },
    { id: 'financial', label: t('contracts.supplier.tabs.financial') },
    { id: 'disputes', label: t('contracts.supplier.tabs.disputes') },
  ];

  return (
    <>
      <PageHeader
        title={contract.title}
        back={back}
        subtitle={t('contracts.supplier.detailIntro', { buyer: contract.buyer.name })}
        meta={
          <span className="tiq-inline">
            <Reference value={contract.reference} />
            <StatusChip enum="contracts.status" value={contract.status} />
            <span>{contract.buyer.name}</span>
            {contract.nextDueAt !== null && (
              <span className="tiq-inline">
                <span className="tiq-text-muted">{t('contracts.supplier.nextDue')}</span>
                <OfficialDeadline deadline={contract.nextDueAt} showLocal={false} />
              </span>
            )}
          </span>
        }
      />
      {mySignature !== undefined && contract.status === 'awaiting_signature' && (
        <Banner
          tone="warning"
          title={t('contracts.supplier.yourSignature')}
          actions={
            <Button size="sm" onClick={() => setTab('signature')}>
              {t('contracts.supplier.goSign')}
            </Button>
          }
        >
          {contract.signatureBlockedReason ?? t('contracts.supplier.yourSignatureDetail')}
        </Banner>
      )}
      <Tabs
        label={t('contracts.supplier.tabs.label')}
        tabs={tabs}
        selected={tab}
        onSelect={(id) => setTab(pick(id, TAB_IDS) ?? 'overview')}
      >
        {tab === 'overview' && <Overview contract={contract} />}
        {tab === 'signature' && <Signatures contract={contract} canAct={canAct} />}
        {tab === 'obligations' && <Obligations contract={contract} canAct={canAct} />}
        {tab === 'changes' && <Changes contract={contract} canAct={canAct} />}
        {tab === 'performance' && <Performance contract={contract} canAct={canAct} />}
        {tab === 'financial' && <Financial contract={contract} />}
        {tab === 'disputes' && <Disputes contract={contract} canAct={canAct} />}
      </Tabs>
    </>
  );
}
