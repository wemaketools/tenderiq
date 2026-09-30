/**
 * EVA-04 — Commercial comparison: on the issued basis (taxes, currency, quantities, options, whole-life cost), each
 * offer's original price in the supplier's currency, the authorized arithmetic correction, the FX basis with the
 * original amount still visible, the evaluated cost, the reference set, abnormally-low flags for documented review,
 * the price points and — separately from rank — affordability (PRD §9.2, §9.3, BR-29). Commercial reviewers approve
 * corrections and the comparison and explain assumptions; private sensitivity scenarios never alter official scores.
 * Before the price gate is released no price is shown (AC-16).
 */
import { useState } from 'react';

import {
  approveComparison,
  approveCorrection,
  getCommercialComparison,
  proposeCorrection,
  reviewAbnormallyLow,
  runScenario,
  setReferenceSet,
} from '@contracts/evaluation';
import type { CommercialComparison, CommercialRow, ScenarioResult } from '@contracts/evaluation';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useAppSelector } from '../../../app/hooks';
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
  Dialog,
  EmptyState,
  ErrorState,
  IconButton,
  KpiCard,
  KpiGrid,
  Menu,
  MoneyInput,
  MoneyText,
  NumberInput,
  OrDash,
  RadioGroup,
  SkeletonBlock,
  StatusChip,
  TextField,
  formErrors,
  useToast,
} from '../../../components/ui';
import {
  formatCalendarDate,
  formatCount,
  formatDateTime,
  formatDecimalString,
  formatMoney,
} from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { CommercialStateChip } from '../components/chips';
import { EvaluationWorkspace } from '../components/EvaluationWorkspace';
import { PriceGateCard } from '../components/PriceGateCard';
import { Readiness } from '../components/Readiness';
import { evaluationErrorMessage, withEvaluationMessage } from '../lib/errors';
import { useIdParam, useLotId } from '../lib/hooks';
import { bidLabel } from '../lib/labels';
import { priceGateState } from '../lib/scores';

type RowDialog = 'propose' | 'approve' | 'abnormal' | 'reference';

export default function CommercialPage() {
  const tenderId = useIdParam('tenderId');
  const lotId = useLotId();
  const query = useApiQuery(
    getCommercialComparison,
    tenderId === null ? null : { params: { tenderId }, query: lotId === null ? {} : { lotId } },
  );
  const [latest, setLatest] = useState<CommercialComparison | null>(null);

  if (tenderId === null) {
    return <EmptyState title={t('evaluation.overview.notFound')} />;
  }
  const comparison =
    latest !== null && latest.tender.tenderId === tenderId && (latest.lot?.lotId ?? null) === lotId
      ? latest
      : query.data;

  return (
    <EvaluationWorkspace
      tenderId={tenderId}
      lotId={lotId}
      title={t('evaluation.commercial.title')}
      tender={comparison?.tender}
      lot={comparison?.lot}
    >
      {comparison === undefined ? (
        query.error !== null ? (
          query.error.kind === 'not_found' ? (
            <EmptyState title={t('evaluation.commercial.notFound')} icon="search" />
          ) : query.error.code === 'LOT_REQUIRED' ? (
            <EmptyState
              title={t('evaluation.common.lotRequired')}
              description={evaluationErrorMessage(query.error)}
            />
          ) : (
            <ErrorState error={query.error} onRetry={query.reload} />
          )
        ) : (
          <SkeletonBlock lines={8} />
        )
      ) : (
        <CommercialView comparison={comparison} lotId={lotId} onUpdated={setLatest} />
      )}
    </EvaluationWorkspace>
  );
}

function CommercialView({
  comparison,
  lotId,
  onUpdated,
}: {
  readonly comparison: CommercialComparison;
  readonly lotId: number | null;
  readonly onUpdated: (comparison: CommercialComparison) => void;
}) {
  const toast = useToast();
  const canReview = usePermission('evaluation.commercial');
  const timeZone = comparison.tender.officialTimeZone;
  const userId = useAppSelector((state) => state.session.user?.id ?? null);
  const proposedByMe = (row: CommercialRow): boolean =>
    row.correctionProposedBy !== null && row.correctionProposedBy.userId === userId;
  const plan = comparison.plan;
  const scope = `${comparison.tender.reference} ${comparison.tender.title}`;
  const gateState = priceGateState(comparison.priceGate);
  const pricesVisible = gateState !== 'closed';
  const approved = comparison.status === 'approved';

  const [rowOverrides, setRowOverrides] = useState<Readonly<Record<number, CommercialRow>>>({});
  const rows = comparison.rows.map((row) => rowOverrides[row.commercialEvaluationId] ?? row);
  const [selectedId, setSelectedId] = useState<number | null>(
    rows[0]?.commercialEvaluationId ?? null,
  );
  const selected = rows.find((row) => row.commercialEvaluationId === selectedId) ?? null;
  const [dialog, setDialog] = useState<{
    readonly kind: RowDialog;
    readonly row: CommercialRow;
  } | null>(null);
  const [correctedAmount, setCorrectedAmount] = useState({ amount: '', currency: '' });
  const [requiresAck, setRequiresAck] = useState(true);
  const [abnormalOutcome, setAbnormalOutcome] = useState<
    'explanation_accepted' | 'referred_for_decision'
  >('explanation_accepted');
  const [approveOpen, setApproveOpen] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);

  const propose = useApiMutation(proposeCorrection);
  const approveFix = useApiMutation(approveCorrection);
  const abnormal = useApiMutation(reviewAbnormallyLow);
  const reference = useApiMutation(setReferenceSet);
  const approve = useApiMutation(approveComparison);

  const storeRow = (row: CommercialRow): void => {
    setRowOverrides({ ...rowOverrides, [row.commercialEvaluationId]: row });
  };
  const openRow = (kind: RowDialog, row: CommercialRow): void => {
    propose.reset();
    approveFix.reset();
    abnormal.reset();
    reference.reset();
    if (kind === 'propose') {
      setCorrectedAmount({
        amount: row.correctedTotal.amount,
        currency: row.submittedTotal.currency,
      });
      setRequiresAck(true);
    }
    setDialog({ kind, row });
  };
  const closeRow = (): void => setDialog(null);
  const rowScope = (row: CommercialRow): string => `${scope} · ${bidLabel(row.bid)}`;
  const overBudget = rows.filter((row) => row.affordability === 'exceeds_budget').length;
  const proposeErrors = formErrors(propose.error, ['correctedTotal']);

  return (
    <>
      {gateState === 'closed' && (
        <Banner tone="warning" title={t('evaluation.commercial.gateClosedTitle')}>
          <p>{t('evaluation.commercial.gateClosed')}</p>
        </Banner>
      )}
      {pricesVisible && (
        <KpiGrid>
          <KpiCard
            label={t('evaluation.commercial.kpi.offers')}
            icon="receipt"
            value={formatCount(rows.length)}
            hint={t('evaluation.commercial.kpi.offersHint', {
              count: comparison.sealedBids.length,
            })}
          />
          <KpiCard
            label={t('evaluation.commercial.kpi.lowest')}
            icon="coins"
            tone="success"
            value={formatMoney(comparison.lowestEvaluatedCost)}
            hint={t('evaluation.commercial.kpi.lowestHint')}
          />
          <KpiCard
            label={t('evaluation.commercial.kpi.budget')}
            icon="wallet"
            tone="info"
            value={formatMoney(comparison.budget)}
            hint={t('evaluation.commercial.kpi.budgetHint')}
          />
          <KpiCard
            label={t('evaluation.commercial.kpi.overBudget')}
            icon="alertTriangle"
            tone="warning"
            value={formatCount(overBudget)}
            hint={t('evaluation.commercial.kpi.overBudgetHint')}
          />
        </KpiGrid>
      )}

      {pricesVisible && (
        <Card
          title={t('evaluation.commercial.tableTitle')}
          subtitle={t('evaluation.commercial.tableIntro', {
            currency: plan.comparisonCurrency,
          })}
          actions={
            <span className="tiq-inline">
              <CommercialStateChip state={comparison.status} />
              {canReview && (
                <Button
                  icon="sliders"
                  onClick={() => setScenarioOpen(true)}
                  disabled={rows.length === 0}
                >
                  {t('evaluation.commercial.scenario')}
                </Button>
              )}
              {canReview && !approved && (
                <Button
                  variant="primary"
                  icon="checkCircle"
                  onClick={() => {
                    approve.reset();
                    setApproveOpen(true);
                  }}
                >
                  {t('evaluation.commercial.approve')}
                </Button>
              )}
            </span>
          }
          flush
        >
          <DataTable<CommercialRow>
            caption={t('evaluation.commercial.tableTitle')}
            columns={[
              {
                id: 'bid',
                header: t('evaluation.common.bid'),
                cell: (row) => (
                  <>
                    <span>{bidLabel(row.bid)}</span>
                    <span className="tiq-cell-sub tiq-mono">{row.bid.receiptNo}</span>
                  </>
                ),
              },
              {
                id: 'submitted',
                header: t('evaluation.commercial.col.submitted'),
                numeric: true,
                cell: (row) => <MoneyText value={row.submittedTotal} places={2} />,
              },
              {
                id: 'correction',
                header: t('evaluation.commercial.col.correction'),
                cell: (row) => (
                  <>
                    {row.arithmeticCorrection === null && row.correctionStatus === 'none' ? (
                      <OrDash>{null}</OrDash>
                    ) : (
                      <>
                        <MoneyText value={row.arithmeticCorrection} places={2} />
                        <span className="tiq-cell-sub">
                          <Chip
                            tone={row.correctionStatus === 'approved' ? 'success' : 'warning'}
                            size="sm"
                          >
                            {t(`evaluation.commercial.correction.${row.correctionStatus}`)}
                          </Chip>
                        </span>
                      </>
                    )}
                    <span className="tiq-cell-sub">
                      {t('evaluation.commercial.correctedLine', {
                        amount: formatMoney(row.correctedTotal, { places: 2 }),
                      })}
                    </span>
                  </>
                ),
              },
              {
                id: 'fx',
                header: t('evaluation.commercial.col.fx'),
                cell: (row) =>
                  row.fx === null ? (
                    <span className="tiq-text-muted">{t('evaluation.commercial.noFx')}</span>
                  ) : (
                    <>
                      <span>
                        {t('evaluation.commercial.fxRate', {
                          from: row.fx.fromCurrency,
                          to: row.fx.toCurrency,
                          rate: row.fx.rate,
                        })}
                      </span>
                      <span className="tiq-cell-sub">
                        {row.fx.source} · {formatCalendarDate(row.fx.rateDate)}
                      </span>
                    </>
                  ),
              },
              {
                id: 'evaluated',
                header: t('evaluation.commercial.col.evaluated'),
                numeric: true,
                cell: (row) => <MoneyText value={row.evaluatedCost} places={2} />,
              },
              {
                id: 'flags',
                header: t('evaluation.commercial.col.flags'),
                cell: (row) => (
                  <span className="tiq-stack">
                    {row.inReferenceSet ? (
                      <Chip tone="success" size="sm">
                        {t('evaluation.commercial.inReference')}
                      </Chip>
                    ) : (
                      <Chip tone="neutral" size="sm">
                        {t('evaluation.commercial.outOfReference')}
                      </Chip>
                    )}
                    {row.abnormallyLowFlag && (
                      <Chip
                        tone={row.abnormallyLowOutcome === 'pending' ? 'danger' : 'warning'}
                        size="sm"
                        icon="flag"
                      >
                        {t(
                          `evaluation.commercial.abnormal.${row.abnormallyLowOutcome ?? 'pending'}`,
                        )}
                      </Chip>
                    )}
                  </span>
                ),
              },
              {
                id: 'price',
                header: t('evaluation.commercial.col.priceScore'),
                numeric: true,
                cell: (row) =>
                  row.priceScoreDisplay === null ? (
                    <OrDash>{null}</OrDash>
                  ) : (
                    <span title={row.priceScore ?? undefined}>{row.priceScoreDisplay}</span>
                  ),
              },
              {
                id: 'affordability',
                header: t('evaluation.commercial.col.affordability'),
                cell: (row) => (
                  <StatusChip
                    enum="commercial_evaluations.affordability"
                    value={row.affordability}
                    size="sm"
                  />
                ),
              },
              {
                id: 'actions',
                header: (
                  <span className="tiq-visually-hidden">{t('evaluation.common.actions')}</span>
                ),
                cell: (row) =>
                  canReview && !approved ? (
                    <Menu
                      label={t('evaluation.commercial.rowActions', { bid: row.bid.label })}
                      entries={[
                        {
                          id: 'propose',
                          label: t('evaluation.commercial.propose'),
                          icon: 'edit',
                          onSelect: () => openRow('propose', row),
                          disabled: row.correctionStatus === 'pending_approval',
                        },
                        {
                          id: 'approve',
                          label: t('evaluation.commercial.approveCorrection'),
                          icon: 'check',
                          onSelect: () => openRow('approve', row),
                          disabled:
                            row.correctionStatus !== 'pending_approval' || proposedByMe(row),
                        },
                        ...(row.correctionStatus === 'pending_approval' && proposedByMe(row)
                          ? [
                              {
                                kind: 'text' as const,
                                id: 'self-approval',
                                label: t('evaluation.commercial.selfApproval'),
                              },
                            ]
                          : []),
                        {
                          id: 'abnormal',
                          label: t('evaluation.commercial.reviewAbnormal'),
                          icon: 'flag',
                          onSelect: () => openRow('abnormal', row),
                          disabled: !row.abnormallyLowFlag,
                        },
                        {
                          id: 'reference',
                          label: row.inReferenceSet
                            ? t('evaluation.commercial.excludeReference')
                            : t('evaluation.commercial.includeReference'),
                          icon: 'filter',
                          onSelect: () => openRow('reference', row),
                        },
                      ]}
                      trigger={(props) => (
                        <IconButton
                          icon="moreHorizontal"
                          variant="ghost"
                          size="sm"
                          label={t('evaluation.commercial.rowActions', { bid: row.bid.label })}
                          {...props}
                        />
                      )}
                    />
                  ) : null,
              },
            ]}
            rows={rows}
            rowKey={(row) => String(row.commercialEvaluationId)}
            rowLabel={(row) => bidLabel(row.bid)}
            onRowClick={(row) => setSelectedId(row.commercialEvaluationId)}
            empty={<EmptyState compact title={t('evaluation.commercial.noOffers')} />}
          />
        </Card>
      )}

      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack">
          {pricesVisible && selected !== null && (
            <Card
              title={t('evaluation.commercial.detailTitle', { bid: bidLabel(selected.bid) })}
              subtitle={t('evaluation.commercial.detailIntro')}
              actions={<StatusChip enum="commercial_evaluations.status" value={selected.status} />}
            >
              <div className="tiq-stack">
                <DetailList
                  items={[
                    {
                      key: 'submitted',
                      label: t('evaluation.commercial.col.submitted'),
                      value: formatMoney(selected.submittedTotal, { places: 2 }),
                    },
                    {
                      key: 'rule',
                      label: t('evaluation.commercial.correctionRule'),
                      value: selected.correctionRule,
                    },
                    {
                      key: 'proposedBy',
                      label: t('evaluation.commercial.correctionProposedBy'),
                      value:
                        selected.correctionProposedBy === null
                          ? null
                          : selected.correctionProposedAt === null
                            ? selected.correctionProposedBy.fullName
                            : `${selected.correctionProposedBy.fullName} · ${formatDateTime(selected.correctionProposedAt, timeZone)}`,
                    },
                    {
                      key: 'approvedBy',
                      label: t('evaluation.commercial.correctionApprovedBy'),
                      value: selected.correctionApprovedBy?.fullName ?? null,
                    },
                    {
                      key: 'ack',
                      label: t('evaluation.commercial.supplierAck'),
                      value:
                        selected.supplierAckAt === null
                          ? null
                          : formatDateTime(selected.supplierAckAt, timeZone),
                    },
                    {
                      key: 'fx',
                      label: t('evaluation.commercial.col.fx'),
                      value:
                        selected.fx === null
                          ? t('evaluation.commercial.noFx')
                          : t('evaluation.commercial.fxFull', {
                              original: formatMoney(selected.correctedTotal, { places: 2 }),
                              rate: selected.fx.rate,
                              source: selected.fx.source,
                              date: formatCalendarDate(selected.fx.rateDate),
                              converted: formatMoney(selected.evaluatedCost, { places: 2 }),
                            }),
                    },
                    {
                      key: 'evaluated',
                      label: t('evaluation.commercial.col.evaluated'),
                      value: formatMoney(selected.evaluatedCost, { places: 2 }),
                    },
                    {
                      key: 'reference',
                      label: t('evaluation.commercial.referenceSet'),
                      value: selected.inReferenceSet
                        ? t('evaluation.commercial.inReference')
                        : `${t('evaluation.commercial.outOfReference')}: ${selected.referenceExclusionReason ?? ''}`,
                    },
                    {
                      key: 'abnormal',
                      label: t('evaluation.commercial.abnormalReview'),
                      value: selected.abnormallyLowFlag
                        ? [
                            t(
                              `evaluation.commercial.abnormal.${selected.abnormallyLowOutcome ?? 'pending'}`,
                            ),
                            selected.abnormallyLowReview,
                          ]
                            .filter((part) => part !== null)
                            .join(': ')
                        : t('evaluation.commercial.notFlagged'),
                    },
                    {
                      key: 'excluded',
                      label: t('evaluation.commercial.excludedItems'),
                      value: selected.excludedItemsNote,
                    },
                    {
                      key: 'assumptions',
                      label: t('evaluation.commercial.assumptions'),
                      value: selected.assumptions,
                    },
                    {
                      key: 'affordability',
                      label: t('evaluation.commercial.col.affordability'),
                      value: (
                        <StatusChip
                          enum="commercial_evaluations.affordability"
                          value={selected.affordability}
                        />
                      ),
                    },
                  ]}
                />
                <DataTable
                  caption={t('evaluation.commercial.componentsCaption')}
                  columns={[
                    {
                      id: 'label',
                      header: t('evaluation.commercial.component'),
                      cell: (item) => item.label,
                    },
                    {
                      id: 'amount',
                      header: t('evaluation.commercial.amount'),
                      numeric: true,
                      cell: (item) => <MoneyText value={item.amount} places={2} />,
                    },
                    {
                      id: 'included',
                      header: t('evaluation.commercial.included'),
                      cell: (item) =>
                        item.includedInEvaluation ? (
                          <Chip tone="success" size="sm">
                            {t('evaluation.commercial.evaluatedYes')}
                          </Chip>
                        ) : (
                          <Chip tone="neutral" size="sm">
                            {t('evaluation.commercial.evaluatedNo')}
                          </Chip>
                        ),
                    },
                    {
                      id: 'note',
                      header: t('evaluation.commercial.note'),
                      cell: (item) => item.note ?? <OrDash>{null}</OrDash>,
                    },
                  ]}
                  rows={selected.costComponents}
                  rowKey={(item) => item.label}
                  empty={<EmptyState compact title={t('evaluation.commercial.noComponents')} />}
                />
              </div>
            </Card>
          )}

          {comparison.sealedBids.length > 0 && (
            <Card
              title={t('evaluation.commercial.sealedTitle')}
              subtitle={t('evaluation.commercial.sealedIntro')}
              flush
            >
              <DataTable
                caption={t('evaluation.commercial.sealedTitle')}
                columns={[
                  {
                    id: 'bid',
                    header: t('evaluation.common.bid'),
                    cell: (item) => bidLabel(item.bid),
                  },
                  {
                    id: 'compliance',
                    header: t('evaluation.common.compliance'),
                    cell: (item) => (
                      <StatusChip
                        enum="bids.compliance_status"
                        value={item.bid.complianceStatus}
                        size="sm"
                      />
                    ),
                  },
                  {
                    id: 'reason',
                    header: t('evaluation.common.reason'),
                    cell: (item) => item.reason,
                  },
                ]}
                rows={comparison.sealedBids}
                rowKey={(item) => String(item.bid.bidId)}
              />
            </Card>
          )}
        </div>

        <div className="tiq-stack">
          <PriceGateCard
            tenderId={comparison.tender.tenderId}
            lotId={lotId}
            gate={comparison.priceGate}
            timeZone={timeZone}
            scope={scope}
          />
          <Card title={t('evaluation.commercial.basisTitle')}>
            <DetailList
              stacked
              items={[
                {
                  key: 'state',
                  label: t('evaluation.common.status'),
                  value: <CommercialStateChip state={comparison.status} />,
                },
                {
                  key: 'reviewer',
                  label: t('evaluation.commercial.reviewer'),
                  value: comparison.reviewer?.fullName ?? null,
                },
                {
                  key: 'basis',
                  label: t('evaluation.commercial.basis'),
                  value: comparison.basisNote,
                },
                {
                  key: 'tax',
                  label: t('evaluation.commercial.tax'),
                  value: comparison.taxTreatment,
                },
                {
                  key: 'currency',
                  label: t('evaluation.overview.currency'),
                  value: [
                    plan.comparisonCurrency,
                    plan.fxSource,
                    plan.fxDate === null ? null : formatCalendarDate(plan.fxDate),
                  ]
                    .filter((part) => part !== null)
                    .join(' · '),
                },
                {
                  key: 'method',
                  label: t('evaluation.overview.priceMethod'),
                  value: `${tEnum('evaluation_plans.price_method', plan.priceMethod)} · ${t('evaluation.overview.pointsValue', { points: formatDecimalString(plan.priceWeight, plan.decimalPlacesDisplay) })}`,
                },
                {
                  key: 'formula',
                  label: t('evaluation.overview.priceFormula'),
                  value: plan.priceFormulaNote,
                },
                {
                  key: 'zero',
                  label: t('evaluation.overview.zeroPrice'),
                  value: plan.zeroPriceTreatment,
                },
                {
                  key: 'missing',
                  label: t('evaluation.overview.missingPrice'),
                  value: plan.missingPriceTreatment,
                },
                {
                  key: 'budget',
                  label: t('evaluation.commercial.kpi.budget'),
                  value: formatMoney(comparison.budget),
                },
                {
                  key: 'approved',
                  label: t('evaluation.commercial.approvedAt'),
                  value:
                    comparison.approvedAt === null
                      ? null
                      : `${formatDateTime(comparison.approvedAt, timeZone)}${comparison.approvedBy === null ? '' : ` · ${comparison.approvedBy.fullName}`}`,
                },
              ]}
            />
          </Card>
          <Card title={t('evaluation.commercial.readinessTitle')}>
            {comparison.readiness.length === 0 ? (
              <EmptyState compact title={t('evaluation.commercial.noReadiness')} />
            ) : (
              <Readiness
                items={comparison.readiness}
                label={t('evaluation.commercial.readinessTitle')}
              />
            )}
          </Card>
        </div>
      </div>

      <ConfirmActionDialog
        open={dialog?.kind === 'propose'}
        title={t('evaluation.commercial.proposeTitle')}
        scope={dialog === null ? scope : rowScope(dialog.row)}
        consequence={t('evaluation.commercial.proposeConsequence')}
        confirmLabel={t('evaluation.commercial.propose')}
        reason={{ label: t('evaluation.commercial.correctionRule'), required: true }}
        pending={propose.pending}
        error={withEvaluationMessage(propose.error, { correctionRule: 'reason' })}
        onCancel={closeRow}
        onConfirm={async ({ reason }) => {
          if (dialog === null) return;
          try {
            const row = await propose.mutate({
              params: { commercialEvaluationId: dialog.row.commercialEvaluationId },
              body: {
                correctedTotal: {
                  amount: correctedAmount.amount,
                  currency: dialog.row.submittedTotal.currency,
                },
                correctionRule: reason,
                requiresSupplierAck: requiresAck,
              },
            });
            storeRow(row);
            closeRow();
            toast.show(t('evaluation.commercial.proposedToast'), 'success');
          } catch {
            // The dialog shows the error.
          }
        }}
      >
        {dialog !== null && (
          <p>
            {t('evaluation.commercial.proposeSubmitted', {
              amount: formatMoney(dialog.row.submittedTotal, { places: 2 }),
            })}
          </p>
        )}
        <MoneyInput
          label={t('evaluation.commercial.correctedTotal')}
          required
          value={correctedAmount}
          currencies={dialog === null ? [] : [dialog.row.submittedTotal.currency]}
          onChange={setCorrectedAmount}
          error={proposeErrors.forField('correctedTotal')}
        />
        <Checkbox
          label={t('evaluation.commercial.requiresAck')}
          checked={requiresAck}
          onChange={setRequiresAck}
        />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog?.kind === 'approve'}
        title={t('evaluation.commercial.approveCorrectionTitle')}
        scope={dialog === null ? scope : rowScope(dialog.row)}
        consequence={t('evaluation.commercial.approveCorrectionConsequence')}
        confirmLabel={t('evaluation.commercial.approveCorrection')}
        reason={{ label: t('evaluation.commercial.note'), required: false }}
        pending={approveFix.pending}
        error={withEvaluationMessage(approveFix.error, { note: 'reason' })}
        onCancel={closeRow}
        onConfirm={async ({ reason }) => {
          if (dialog === null) return;
          try {
            const row = await approveFix.mutate({
              params: { commercialEvaluationId: dialog.row.commercialEvaluationId },
              body: reason === '' ? {} : { note: reason },
            });
            storeRow(row);
            closeRow();
            toast.show(t('evaluation.commercial.correctionApprovedToast'), 'success');
          } catch {
            // The dialog shows the error (CORRECTION_SELF_APPROVAL…).
          }
        }}
      >
        {dialog !== null && (
          <DetailList
            items={[
              {
                key: 'delta',
                label: t('evaluation.commercial.col.correction'),
                value: formatMoney(dialog.row.arithmeticCorrection, { places: 2 }),
              },
              {
                key: 'rule',
                label: t('evaluation.commercial.correctionRule'),
                value: dialog.row.correctionRule,
              },
            ]}
          />
        )}
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog?.kind === 'abnormal'}
        title={t('evaluation.commercial.abnormalTitle')}
        scope={dialog === null ? scope : rowScope(dialog.row)}
        consequence={t('evaluation.commercial.abnormalConsequence')}
        confirmLabel={t('evaluation.commercial.reviewAbnormal')}
        reason={{ label: t('evaluation.commercial.abnormalReview'), required: true }}
        pending={abnormal.pending}
        error={withEvaluationMessage(abnormal.error, { review: 'reason' })}
        onCancel={closeRow}
        onConfirm={async ({ reason }) => {
          if (dialog === null) return;
          try {
            const row = await abnormal.mutate({
              params: { commercialEvaluationId: dialog.row.commercialEvaluationId },
              body: { outcome: abnormalOutcome, review: reason },
            });
            storeRow(row);
            closeRow();
            toast.show(t('evaluation.commercial.abnormalToast'), 'success');
          } catch {
            // The dialog shows the error.
          }
        }}
      >
        <RadioGroup
          label={t('evaluation.commercial.abnormalOutcome')}
          value={abnormalOutcome}
          options={[
            {
              value: 'explanation_accepted',
              label: t('evaluation.commercial.abnormal.explanation_accepted'),
            },
            {
              value: 'referred_for_decision',
              label: t('evaluation.commercial.abnormal.referred_for_decision'),
            },
          ]}
          onChange={(value) =>
            setAbnormalOutcome(
              value === 'referred_for_decision' ? 'referred_for_decision' : 'explanation_accepted',
            )
          }
        />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog?.kind === 'reference'}
        title={
          dialog?.row.inReferenceSet === true
            ? t('evaluation.commercial.excludeReference')
            : t('evaluation.commercial.includeReference')
        }
        scope={dialog === null ? scope : rowScope(dialog.row)}
        consequence={t('evaluation.commercial.referenceConsequence')}
        confirmLabel={t('evaluation.common.confirm')}
        reason={{
          label: t('evaluation.commercial.referenceReason'),
          required: dialog?.row.inReferenceSet === true,
        }}
        pending={reference.pending}
        error={withEvaluationMessage(reference.error)}
        onCancel={closeRow}
        onConfirm={async ({ reason }) => {
          if (dialog === null) return;
          try {
            const include = !dialog.row.inReferenceSet;
            const row = await reference.mutate({
              params: { commercialEvaluationId: dialog.row.commercialEvaluationId },
              body: include
                ? { inReferenceSet: true, ...(reason === '' ? {} : { reason }) }
                : { inReferenceSet: false, reason },
            });
            storeRow(row);
            closeRow();
            toast.show(t('evaluation.commercial.referenceToast'), 'success');
          } catch {
            // The dialog shows the error.
          }
        }}
      />

      <ConfirmActionDialog
        open={approveOpen}
        title={t('evaluation.commercial.approveTitle')}
        scope={scope}
        consequence={t('evaluation.commercial.approveConsequence')}
        confirmLabel={t('evaluation.commercial.approve')}
        acknowledgement={t('evaluation.commercial.approveAck')}
        pending={approve.pending}
        error={withEvaluationMessage(approve.error)}
        onCancel={() => setApproveOpen(false)}
        onConfirm={async () => {
          try {
            const next = await approve.mutate({
              params: { tenderId: comparison.tender.tenderId },
              body: { ...(lotId === null ? {} : { lotId }), assumptionsConfirmed: true },
            });
            setRowOverrides({});
            onUpdated(next);
            setApproveOpen(false);
            toast.show(t('evaluation.commercial.approvedToast'), 'success');
          } catch {
            // The dialog shows the error (CORRECTION_PENDING, ABNORMALLY_LOW_REVIEW_PENDING…).
          }
        }}
      >
        <Readiness items={comparison.readiness} label={t('evaluation.commercial.readinessTitle')} />
      </ConfirmActionDialog>

      <ScenarioDialog
        open={scenarioOpen}
        onClose={() => setScenarioOpen(false)}
        comparison={comparison}
        rows={rows}
        lotId={lotId}
      />
    </>
  );
}

function ScenarioDialog({
  open,
  onClose,
  comparison,
  rows,
  lotId,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly comparison: CommercialComparison;
  readonly rows: readonly CommercialRow[];
  readonly lotId: number | null;
}) {
  const scenario = useApiMutation(runScenario);
  const [label, setLabel] = useState('');
  const [rates, setRates] = useState<Readonly<Record<string, string>>>({});
  const [excluded, setExcluded] = useState<ReadonlySet<number>>(new Set());
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const currencies = [
    ...new Set(
      rows
        .map((row) => row.fx?.fromCurrency)
        .filter((currency): currency is string => currency !== undefined),
    ),
  ];
  const errors = formErrors(scenario.error, ['label']);
  const plan = comparison.plan;

  const run = async (): Promise<void> => {
    try {
      const next = await scenario.mutate({
        params: { tenderId: comparison.tender.tenderId },
        body: {
          ...(lotId === null ? {} : { lotId }),
          label: label.trim(),
          fxRateOverrides: Object.entries(rates)
            .filter(([, rate]) => rate !== '')
            .map(([fromCurrency, rate]) => ({ fromCurrency, rate })),
          excludeBidIds: [...excluded],
          adjustments: [],
        },
      });
      setResult(next);
    } catch {
      // The dialog shows the error.
    }
  };

  return (
    <Dialog
      open={open}
      title={t('evaluation.commercial.scenarioTitle')}
      description={t('evaluation.commercial.scenarioIntro')}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>{t('evaluation.common.close')}</Button>
          <Button
            variant="primary"
            icon="play"
            loading={scenario.pending}
            onClick={() => void run()}
            disabled={label.trim() === ''}
          >
            {t('evaluation.commercial.runScenario')}
          </Button>
        </>
      }
    >
      <div className="tiq-form-stack">
        <TextField
          label={t('evaluation.commercial.scenarioLabel')}
          required
          value={label}
          onChange={setLabel}
          error={errors.forField('label')}
        />
        {currencies.map((currency) => (
          <NumberInput
            key={currency}
            label={t('evaluation.commercial.scenarioRate', {
              from: currency,
              to: plan.comparisonCurrency,
            })}
            places={4}
            value={rates[currency] ?? ''}
            onChange={(rate) => setRates({ ...rates, [currency]: rate })}
          />
        ))}
        <fieldset className="tiq-fieldset">
          <legend>{t('evaluation.commercial.scenarioExclude')}</legend>
          {rows.map((row) => (
            <Checkbox
              key={row.bid.bidId}
              label={bidLabel(row.bid)}
              checked={excluded.has(row.bid.bidId)}
              onChange={(checked) => {
                const next = new Set(excluded);
                if (checked) next.add(row.bid.bidId);
                else next.delete(row.bid.bidId);
                setExcluded(next);
              }}
            />
          ))}
        </fieldset>
        {scenario.error !== null && errors.other.length === 0 && !errors.hasFieldErrors && (
          <Banner tone="error">
            <p>{evaluationErrorMessage(scenario.error)}</p>
          </Banner>
        )}
        {result !== null && (
          <>
            <Banner tone="info" title={t('evaluation.commercial.scenarioPrivate')}>
              <p>{result.basisNote}</p>
            </Banner>
            <DataTable
              caption={t('evaluation.commercial.scenarioResult', { label: result.label })}
              columns={[
                { id: 'bid', header: t('evaluation.common.bid'), cell: (row) => row.label },
                {
                  id: 'cost',
                  header: t('evaluation.commercial.col.evaluated'),
                  numeric: true,
                  cell: (row) => <MoneyText value={row.evaluatedCost} places={2} />,
                },
                {
                  id: 'price',
                  header: t('evaluation.commercial.col.priceScore'),
                  numeric: true,
                  cell: (row) => formatDecimalString(row.priceScore, plan.decimalPlacesDisplay),
                },
                {
                  id: 'total',
                  header: t('evaluation.results.col.total'),
                  numeric: true,
                  cell: (row) =>
                    row.totalScore === null ? (
                      <OrDash>{null}</OrDash>
                    ) : (
                      formatDecimalString(row.totalScore, plan.decimalPlacesDisplay)
                    ),
                },
                {
                  id: 'rank',
                  header: t('evaluation.commercial.scenarioRank'),
                  numeric: true,
                  cell: (row) => (row.rank === null ? <OrDash>{null}</OrDash> : row.rank),
                },
                {
                  id: 'official',
                  header: t('evaluation.commercial.officialRank'),
                  numeric: true,
                  cell: (row) =>
                    row.officialRank === null ? <OrDash>{null}</OrDash> : row.officialRank,
                },
              ]}
              rows={result.rows}
              rowKey={(row) => String(row.bidId)}
            />
          </>
        )}
      </div>
    </Dialog>
  );
}
