/**
 * CON-10 — Renewal, extension and termination: options, notice windows, performance, budget, business justification,
 * approvals and transition needs. Decide each option explicitly and notify the supplier once the decision is
 * approved. An elapsed date never renews, extends or records supplier consent (BR-37, AC-32).
 */
import { useState } from 'react';

import { contractsEndpoints } from '@contracts/contracts';
import type { ContractDetail, ContractRenewals, RenewalOptionView } from '@contracts/contracts';
import type { RenewalOptionsDecision } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  MoneyText,
  OfficialDeadline,
  OrDash,
  QueryView,
  RadioGroup,
  StatusChip,
  TextArea,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { ContractWorkspace } from '../components/ContractWorkspace';
import { ApprovalSummary, DateText, InstantText } from '../components/shared';
import { proposedRatingText } from '../lib/ratings';
import { splitCommandError } from '../lib/errors';
import { useContractCommand, useDialog } from '../lib/hooks';
import { optionalText } from '../lib/lists';
import { CONTRACT_RENEWAL_DECIDE } from '../lib/permissions';

/** Decisions that fit an option type (mirrors RENEWAL_OPTION_NOT_APPLICABLE). */
function decisionsFor(option: RenewalOptionView): RenewalOptionsDecision[] {
  switch (option.optionType) {
    case 'renewal':
      return ['renew', 'recompete', 'terminate', 'let_expire'];
    case 'extension':
      return ['extend', 'recompete', 'terminate', 'let_expire'];
    case 'termination_notice':
      return ['terminate', 'let_expire'];
  }
}

const UNDECIDED: readonly string[] = ['available', 'under_review'];

function DecideDialog({
  contract,
  option,
  renewals,
  onClose,
}: {
  readonly contract: ContractDetail;
  readonly option: RenewalOptionView;
  readonly renewals: ContractRenewals;
  readonly onClose: () => void;
}) {
  const choices = decisionsFor(option);
  const [decision, setDecision] = useState<RenewalOptionsDecision>(choices[0] ?? 'let_expire');
  const [justification, setJustification] = useState('');
  const [performanceBasis, setPerformanceBasis] = useState('');
  const [funding, setFunding] = useState(false);
  const [transition, setTransition] = useState(renewals.transitionNeeds ?? '');
  const [local, setLocal] = useState<Record<string, string>>({});
  const command = useContractCommand(contractsEndpoints.decideRenewal, (result) => result.message);
  const { dialogError, fieldErrors } = splitCommandError(command.error, [
    'decision',
    'justification',
    'performanceBasis',
    'fundingConfirmed',
    'transitionNotes',
  ]);
  const errorFor = (field: string): string | undefined =>
    local[field] ?? fieldErrors.forField(field);
  const exercises = decision === 'renew' || decision === 'extend';

  const confirm = async (): Promise<void> => {
    const errors: Record<string, string> = {};
    if (justification.trim() === '')
      errors.justification = t('contracts.renewals.justificationRequired');
    if (performanceBasis.trim() === '')
      errors.performanceBasis = t('contracts.renewals.performanceRequired');
    if (exercises && !funding) errors.fundingConfirmed = t('contracts.renewals.fundingRequired');
    setLocal(errors);
    if (Object.keys(errors).length > 0) return;
    const notes = optionalText(transition);
    const result = await command.run({
      params: { contractId: contract.id, optionId: option.id },
      body: {
        decision,
        justification: justification.trim(),
        performanceBasis: performanceBasis.trim(),
        fundingConfirmed: funding,
        ...(notes === undefined ? {} : { transitionNotes: notes }),
      },
    });
    if (result !== null) onClose();
  };

  return (
    <ConfirmActionDialog
      open
      title={t('contracts.renewals.decideTitle')}
      scope={`${contract.reference} · ${tEnum('renewal_options.option_type', option.optionType)}`}
      consequence={t('contracts.renewals.decideConsequence')}
      confirmLabel={t('contracts.renewals.record')}
      onConfirm={confirm}
      onCancel={onClose}
      pending={command.pending}
      error={dialogError}
    >
      <RadioGroup
        label={t('contracts.renewals.decision')}
        required
        value={decision}
        onChange={(value) => {
          const next = choices.find((choice) => choice === value);
          if (next !== undefined) setDecision(next);
        }}
        options={choices.map((value) => ({
          value,
          label: tEnum('renewal_options.decision', value),
        }))}
        error={errorFor('decision')}
      />
      <TextArea
        label={t('contracts.renewals.justification')}
        required
        value={justification}
        onChange={setJustification}
        rows={3}
        error={errorFor('justification')}
      />
      <TextArea
        label={t('contracts.renewals.performanceBasis')}
        hint={
          renewals.performance.latestRating === null &&
          renewals.performance.latestProposedRating !== null
            ? t('contracts.renewals.performanceHintProposed', {
                proposed: proposedRatingText(renewals.performance.latestProposedRating),
                disputed: renewals.performance.reviewsDisputed,
              })
            : t('contracts.renewals.performanceHint', {
                rating:
                  renewals.performance.latestRating === null
                    ? t('contracts.common.none')
                    : tEnum(
                        'performance_reviews.overall_rating',
                        renewals.performance.latestRating,
                      ),
                disputed: renewals.performance.reviewsDisputed,
              })
        }
        required
        value={performanceBasis}
        onChange={setPerformanceBasis}
        rows={3}
        error={errorFor('performanceBasis')}
      />
      <Checkbox
        label={t('contracts.renewals.funding')}
        hint={renewals.fundingNote ?? undefined}
        checked={funding}
        onChange={setFunding}
        error={errorFor('fundingConfirmed')}
      />
      <TextArea
        label={t('contracts.renewals.transition')}
        value={transition}
        onChange={setTransition}
        rows={2}
        error={errorFor('transitionNotes')}
      />
      <Banner tone="info" title={t('contracts.renewals.noAuto')}>
        {t('contracts.renewals.decisionNotConsent')}
      </Banner>
    </ConfirmActionDialog>
  );
}

function RenewalsBody({ contract }: { readonly contract: ContractDetail }) {
  const canDecide = usePermission(CONTRACT_RENEWAL_DECIDE);
  const dialog = useDialog<'decide' | 'notify', RenewalOptionView>();
  const query = useApiQuery(contractsEndpoints.renewals, { params: { contractId: contract.id } });
  const notify = useContractCommand(contractsEndpoints.notifyRenewal, (result) => result.message);

  return (
    <QueryView query={query}>
      {(renewals) => {
        const columns: DataTableColumn<RenewalOptionView>[] = [
          {
            id: 'type',
            header: t('contracts.renewals.col.option'),
            cell: (row) => (
              <>
                <span>{tEnum('renewal_options.option_type', row.optionType)}</span>
                {row.periodMonths !== null && (
                  <span className="tiq-cell-sub">
                    {t('contracts.renewals.months', { count: row.periodMonths })}
                  </span>
                )}
              </>
            ),
          },
          {
            id: 'window',
            header: t('contracts.renewals.col.window'),
            cell: (row) => (
              <>
                <span className="tiq-inline">
                  <Chip
                    tone={
                      row.windowState === 'open'
                        ? 'warning'
                        : row.windowState === 'closed'
                          ? 'neutral'
                          : 'info'
                    }
                    size="sm"
                  >
                    {t(`contracts.renewals.window.${row.windowState}`)}
                  </Chip>
                </span>
                <span className="tiq-cell-sub">
                  {t('contracts.renewals.opens')} <DateText date={row.noticeWindowStart} />
                </span>
                {row.daysUntilWindowOpens !== null && row.daysUntilWindowOpens > 0 && (
                  <span className="tiq-cell-sub">
                    {t('contracts.renewals.inDays', { count: row.daysUntilWindowOpens })}
                  </span>
                )}
              </>
            ),
          },
          {
            id: 'deadline',
            header: t('contracts.renewals.col.deadline'),
            cell: (row) =>
              row.noticeDeadline === null ? (
                <OrDash>{null}</OrDash>
              ) : (
                <OfficialDeadline
                  deadline={row.noticeDeadline}
                  showRemaining={UNDECIDED.includes(row.status)}
                />
              ),
          },
          {
            id: 'status',
            header: t('contracts.renewals.col.status'),
            cell: (row) => (
              <>
                <StatusChip enum="renewal_options.status" value={row.status} size="sm" />
                {row.decision !== null && (
                  <span className="tiq-cell-sub">
                    {tEnum('renewal_options.decision', row.decision)}
                    {row.decidedBy === null ? '' : ` · ${row.decidedBy.fullName}`}
                  </span>
                )}
              </>
            ),
          },
          {
            id: 'justification',
            header: t('contracts.renewals.col.justification'),
            cell: (row) => (
              <>
                <OrDash>{row.justification}</OrDash>
                {row.performanceBasis !== null && (
                  <span className="tiq-cell-sub">{row.performanceBasis}</span>
                )}
                {row.fundingConfirmed !== null && (
                  <span className="tiq-cell-sub">
                    {row.fundingConfirmed
                      ? t('contracts.renewals.funded')
                      : t('contracts.renewals.notFunded')}
                  </span>
                )}
              </>
            ),
          },
          {
            id: 'approval',
            header: t('contracts.renewals.col.approval'),
            cell: (row) => <ApprovalSummary approval={row.approval} timeZone={contract.timeZone} />,
          },
          {
            id: 'supplier',
            header: t('contracts.renewals.col.supplier'),
            cell: (row) => (
              <>
                <span className="tiq-cell-sub">
                  {t('contracts.renewals.consent')}{' '}
                  <InstantText at={row.supplierConsentAt} timeZone={contract.timeZone} />
                </span>
                <span className="tiq-cell-sub">
                  {t('contracts.renewals.notified')}{' '}
                  <InstantText at={row.supplierNotifiedAt} timeZone={contract.timeZone} />
                </span>
              </>
            ),
          },
          ...(canDecide && contract.status !== 'closed'
            ? [
                {
                  id: 'actions',
                  header: t('contracts.register.col.actions'),
                  cell: (row: RenewalOptionView) => (
                    <span className="tiq-inline">
                      {UNDECIDED.includes(row.status) && row.windowState !== 'closed' && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => dialog.show('decide', row)}
                        >
                          {t('contracts.renewals.decide')}
                        </Button>
                      )}
                      {row.decision !== null && row.supplierNotifiedAt === null && (
                        <Button
                          size="sm"
                          icon="send"
                          onClick={() => {
                            notify.reset();
                            dialog.show('notify', row);
                          }}
                          disabled={row.approval?.status !== 'approved'}
                        >
                          {t('contracts.renewals.notify')}
                        </Button>
                      )}
                    </span>
                  ),
                },
              ]
            : []),
        ];
        const openUndecided = renewals.options.filter(
          (option) => option.windowState === 'open' && UNDECIDED.includes(option.status),
        );
        return (
          <div className="tiq-stack">
            <Banner tone="info" title={t('contracts.renewals.noAuto')}>
              {t('contracts.renewals.noAutoDetail')}
            </Banner>
            {openUndecided.length > 0 && (
              <Banner
                tone="warning"
                title={t('contracts.renewals.windowOpen', { count: openUndecided.length })}
              >
                {t('contracts.renewals.windowOpenDetail', {
                  names:
                    renewals.alertRecipients.map((person) => person.fullName).join(', ') ||
                    t('contracts.common.none'),
                })}
              </Banner>
            )}
            <div className="tiq-grid tiq-grid--2">
              <Card title={t('contracts.renewals.context')}>
                <DetailList
                  items={[
                    {
                      label: t('contracts.renewals.termEnd'),
                      value: <DateText date={renewals.termEnd} />,
                    },
                    {
                      label: t('contracts.overview.currentValue'),
                      value: <MoneyText value={renewals.currentValue} />,
                    },
                    {
                      label: t('contracts.overview.remaining'),
                      value: <MoneyText value={renewals.remainingCeiling} />,
                    },
                    { label: t('contracts.renewals.budget'), value: renewals.fundingNote },
                    { label: t('contracts.renewals.transition'), value: renewals.transitionNeeds },
                    {
                      label: t('contracts.renewals.alerts'),
                      value: renewals.alertRecipients.map((person) => person.fullName).join(', '),
                    },
                  ]}
                />
              </Card>
              <Card title={t('contracts.renewals.performance')}>
                <DetailList
                  items={[
                    {
                      label: t('contracts.performance.kpi.rating'),
                      value:
                        renewals.performance.latestRating === null
                          ? null
                          : tEnum(
                              'performance_reviews.overall_rating',
                              renewals.performance.latestRating,
                            ),
                    },
                    ...(renewals.performance.latestProposedRating === null
                      ? []
                      : [
                          {
                            label: t('contracts.performance.proposedLabel'),
                            value: proposedRatingText(renewals.performance.latestProposedRating),
                          },
                        ]),
                    {
                      label: t('contracts.performance.kpi.disputed'),
                      value: formatCount(renewals.performance.reviewsDisputed),
                    },
                    {
                      label: t('contracts.performance.kpi.incidents'),
                      value: formatCount(renewals.performance.openIncidents),
                    },
                    {
                      label: t('contracts.renewals.rejectedMilestones'),
                      value: formatCount(renewals.performance.rejectedMilestones),
                    },
                  ]}
                />
              </Card>
            </div>
            <Card flush title={t('contracts.renewals.options')}>
              <DataTable
                caption={t('contracts.renewals.options')}
                columns={columns}
                rows={renewals.options}
                rowKey={(row) => String(row.id)}
                empty={<EmptyState compact title={t('contracts.renewals.noOptions')} />}
              />
            </Card>
            {dialog.open === 'decide' && dialog.target !== null && (
              <DecideDialog
                contract={contract}
                option={dialog.target}
                renewals={renewals}
                onClose={dialog.close}
              />
            )}
            <ConfirmActionDialog
              open={dialog.open === 'notify'}
              title={t('contracts.renewals.notifyTitle')}
              scope={
                dialog.target === null
                  ? contract.reference
                  : `${contract.reference} · ${tEnum('renewal_options.option_type', dialog.target.optionType)}`
              }
              consequence={t('contracts.renewals.notifyConsequence')}
              confirmLabel={t('contracts.renewals.notify')}
              onConfirm={async () => {
                const target = dialog.target;
                if (target === null) return;
                const result = await notify.run({
                  params: { contractId: contract.id, optionId: target.id },
                });
                if (result !== null) dialog.close();
              }}
              onCancel={dialog.close}
              pending={notify.pending}
              error={notify.error}
            />
          </div>
        );
      }}
    </QueryView>
  );
}

export default function RenewalsPage() {
  return (
    <ContractWorkspace screen="CON-10">
      {(contract) => <RenewalsBody contract={contract} />}
    </ContractWorkspace>
  );
}
