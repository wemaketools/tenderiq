/**
 * BUY-20 — Opening plan of one tender: the opening authority and mode, the staged envelopes (qualification →
 * technical → commercial, or a single stage), the price gate (AC-16), the sessions and the receipt metadata of
 * every submission. Before opening only receipt metadata is shown, never sealed content (BR-17).
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import { COMPLIANCE_VIEW_PERMISSIONS, openingEndpoints } from '@contracts/opening';
import type {
  OpeningBidRow,
  OpeningSessionDetail,
  OpeningSessionRow,
  OpeningStage,
  PriceGateState,
  TenderOpeningOverview,
} from '@contracts/opening';

import { useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chip,
  DataTable,
  DetailList,
  EmptyState,
  KpiCard,
  KpiGrid,
  OfficialDeadline,
  OrDash,
  PageHeader,
  Reference,
  StatusChip,
  Stepper,
} from '../../../components/ui';
import type { DataTableColumn, StepState } from '../../../components/ui';
import { formatCount, formatOfficialTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { EnvelopeChips } from '../components/EnvelopeChips';
import { LoadingFrame } from '../components/LoadingFrame';
import { RecordNotFound } from '../components/RecordNotFound';
import { ScheduleSessionDialog } from '../components/ScheduleSessionDialog';
import { tenderNextAction } from '../lib/nextAction';
import { PROGRESS_TONE, STAGE_STATE_TONE, progressLabel, stageStateLabel } from '../lib/options';
import { idParam, openingPaths } from '../lib/paths';

const STEP_STATE: Readonly<Record<OpeningStage['state'], StepState>> = {
  opened: 'complete',
  scheduled: 'current',
  awaiting_quorum: 'current',
  blocked_by_price_gate: 'blocked',
  sealed: 'upcoming',
  cancelled: 'blocked',
};

function lotLabel(lot: OpeningStage['lot']): string {
  return lot === null
    ? t('opening.lot.whole')
    : t('opening.lot.label', { number: lot.lotNo, title: lot.title });
}

function PriceGateCard({
  gates,
  timeZone,
  lots,
}: {
  readonly gates: readonly PriceGateState[];
  readonly timeZone: string;
  readonly lots: TenderOpeningOverview['lots'];
}) {
  const applicable = gates.filter((gate) => gate.applies);
  return (
    <Card title={t('opening.gate.title')} subtitle={t('opening.gate.subtitle')}>
      {applicable.length === 0 ? (
        <EmptyState compact icon="unlock" title={t('opening.gate.notApplicable')} />
      ) : (
        <div className="tiq-stack">
          {applicable.map((gate) => {
            const lot = lots.find((item) => item.lotId === gate.lotId) ?? null;
            return (
              <div key={gate.lotId ?? 'tender'} className="tiq-stack">
                <div className="tiq-inline">
                  <strong>{lotLabel(lot)}</strong>
                  <Chip
                    tone={gate.released ? 'success' : 'danger'}
                    icon={gate.released ? 'unlock' : 'lock'}
                  >
                    {gate.released ? t('opening.gate.released') : t('opening.gate.pending')}
                  </Chip>
                </div>
                {!gate.released && (
                  <Banner tone="warning" title={t('opening.gate.blockedTitle')}>
                    {t('opening.gate.blocked')}
                  </Banner>
                )}
                <DetailList
                  items={[
                    {
                      key: 'nonPrice',
                      label: t('opening.gate.nonPrice'),
                      value: gate.nonPriceCompleteConfirmed
                        ? t('opening.common.yes')
                        : t('opening.common.no'),
                    },
                    {
                      key: 'releasedAt',
                      label: t('opening.gate.releasedAt'),
                      value:
                        gate.releasedAt === null
                          ? null
                          : formatOfficialTime(gate.releasedAt, timeZone),
                    },
                    {
                      key: 'releasedBy',
                      label: t('opening.gate.releasedBy'),
                      value: gate.releasedBy?.fullName ?? null,
                    },
                    { key: 'note', label: t('opening.gate.note'), value: gate.note },
                  ]}
                />
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ScheduledBanner({
  session,
  onDismiss,
}: {
  readonly session: OpeningSessionDetail;
  readonly onDismiss: () => void;
}) {
  return (
    <Banner
      tone="success"
      title={t('opening.schedule.doneTitle')}
      actions={
        <Button size="sm" onClick={onDismiss}>
          {t('ui.action.dismiss')}
        </Button>
      }
    >
      <p>
        {t('opening.schedule.done', {
          envelope: tEnum('opening_sessions.envelope', session.envelope),
          status: tEnum('opening_sessions.status', session.status),
          participants: session.participants.length,
          quorum: session.quorumRequired,
        })}
      </p>
      <OfficialDeadline deadline={session.scheduledAt} label={t('opening.columns.scheduledAt')} />
    </Banner>
  );
}

function TenderOpeningView({ tenderId }: { readonly tenderId: number }) {
  const query = useApiQuery(openingEndpoints.getTender, { params: { tenderId } });
  const canSchedule = usePermission('bid.open');
  const canReviewCompliance = usePermission(COMPLIANCE_VIEW_PERMISSIONS);
  const [scheduling, setScheduling] = useState(false);
  const [scheduled, setScheduled] = useState<OpeningSessionDetail | null>(null);
  const back = { to: openingPaths.hub, label: t('opening.hub.back') };

  return (
    <LoadingFrame title={t('opening.tender.loadingTitle')} back={back} query={query}>
      {(overview) => {
        const tender = overview.tender;
        const timeZone = tender.officialTimeZone;
        const stages = [...overview.stages].sort((a, b) => a.openOrder - b.openOrder);
        const opened = stages.filter((stage) => stage.state === 'opened').length;
        const anyOpened = opened > 0;
        const gatePending = overview.priceGates.some((gate) => gate.applies && !gate.released);

        const stageColumns: DataTableColumn<OpeningStage>[] = [
          {
            id: 'order',
            header: t('opening.columns.order'),
            numeric: true,
            cell: (row) => formatCount(row.openOrder),
          },
          {
            id: 'envelope',
            header: t('opening.columns.envelope'),
            cell: (row) => tEnum('opening_sessions.envelope', row.envelope),
          },
          { id: 'lot', header: t('opening.columns.lot'), cell: (row) => lotLabel(row.lot) },
          {
            id: 'state',
            header: t('opening.columns.state'),
            cell: (row) => (
              <Chip tone={STAGE_STATE_TONE[row.state]}>{stageStateLabel(row.state)}</Chip>
            ),
          },
          {
            id: 'session',
            header: t('opening.columns.session'),
            cell: (row) =>
              row.sessionId === null ? (
                <OrDash>{null}</OrDash>
              ) : (
                <Reference
                  value={t('opening.session.number', { id: row.sessionId })}
                  to={openingPaths.session(row.sessionId)}
                />
              ),
          },
          {
            id: 'openedAt',
            header: t('opening.columns.openedAt'),
            cell: (row) => (
              <OrDash>
                {row.openedAt === null ? null : formatOfficialTime(row.openedAt, timeZone)}
              </OrDash>
            ),
          },
        ];

        const sessionColumns: DataTableColumn<OpeningSessionRow>[] = [
          {
            id: 'session',
            header: t('opening.columns.session'),
            cell: (row) => (
              <Reference
                value={t('opening.session.number', { id: row.id })}
                to={openingPaths.session(row.id)}
              />
            ),
          },
          {
            id: 'envelope',
            header: t('opening.columns.envelope'),
            cell: (row) => (
              <>
                {tEnum('opening_sessions.envelope', row.envelope)}
                <span className="tiq-cell-sub">{lotLabel(row.lot)}</span>
              </>
            ),
          },
          {
            id: 'status',
            header: t('opening.columns.status'),
            cell: (row) => <StatusChip enum="opening_sessions.status" value={row.status} />,
          },
          {
            id: 'scheduledAt',
            header: t('opening.columns.scheduledAt'),
            cell: (row) => <OfficialDeadline deadline={row.scheduledAt} showLocal={false} />,
          },
          {
            id: 'officer',
            header: t('opening.columns.officer'),
            cell: (row) => row.openingOfficer.fullName,
          },
          {
            id: 'quorum',
            header: t('opening.columns.quorum'),
            cell: (row) => (
              <Chip tone={row.quorum.met ? 'success' : 'warning'} size="sm">
                {t('opening.quorum.short', {
                  confirmed: row.quorum.confirmed,
                  required: row.quorum.required,
                })}
              </Chip>
            ),
          },
          {
            id: 'openedAt',
            header: t('opening.columns.openedAt'),
            cell: (row) => (
              <OrDash>
                {row.openedAt === null ? null : formatOfficialTime(row.openedAt, timeZone)}
              </OrDash>
            ),
          },
        ];

        const bidColumns: DataTableColumn<OpeningBidRow>[] = [
          {
            id: 'supplier',
            header: t('opening.columns.supplier'),
            cell: (row) => (
              <>
                {row.supplier.name}
                <span className="tiq-cell-sub">
                  {row.lots.length === 0
                    ? t('opening.lot.whole')
                    : row.lots
                        .map((lot) => t('opening.lot.short', { number: lot.lotNo }))
                        .join(', ')}
                </span>
              </>
            ),
          },
          {
            id: 'receivedAt',
            header: t('opening.columns.receivedAt'),
            cell: (row) => (
              <>
                {formatOfficialTime(row.receivedAt, timeZone)}
                <span className="tiq-cell-sub tiq-mono">{row.receiptNo}</span>
              </>
            ),
          },
          {
            id: 'submissionState',
            header: t('opening.columns.submissionState'),
            cell: (row) => <StatusChip enum="bids.submission_state" value={row.submissionState} />,
          },
          {
            id: 'receiptStatus',
            header: t('opening.columns.receiptStatus'),
            cell: (row) => (
              <StatusChip enum="submission_receipts.status" value={row.receiptStatus} />
            ),
          },
          {
            id: 'documents',
            header: t('opening.columns.documents'),
            numeric: true,
            cell: (row) => formatCount(row.documentCount),
          },
          {
            id: 'envelopes',
            header: t('opening.columns.envelopes'),
            cell: (row) => <EnvelopeChips envelopes={row.envelopes} />,
          },
        ];

        return (
          <div className="tiq-page">
            <PageHeader
              title={t('opening.tender.title', { reference: tender.reference })}
              subtitle={tender.title}
              back={back}
              primaryAction={
                canSchedule &&
                stages.some(
                  (stage) => stage.state === 'sealed' || stage.state === 'blocked_by_price_gate',
                ) ? (
                  <Button variant="primary" icon="calendar" onClick={() => setScheduling(true)}>
                    {t('opening.schedule.action')}
                  </Button>
                ) : undefined
              }
              actions={
                canReviewCompliance && anyOpened ? (
                  <ButtonLink to={openingPaths.register(tender.tenderId)} icon="clipboardCheck">
                    {t('opening.tender.toCompliance')}
                  </ButtonLink>
                ) : undefined
              }
              meta={
                <>
                  <StatusChip enum="tenders.status" value={tender.status} />
                  <Chip tone={PROGRESS_TONE[tender.progress]}>
                    {progressLabel(tender.progress)}
                  </Chip>
                  <span>{tEnum('tenders.opening_mode', tender.openingMode)}</span>
                  {tender.submissionDeadline !== null && (
                    <OfficialDeadline
                      deadline={tender.submissionDeadline}
                      label={t('opening.tender.deadline')}
                    />
                  )}
                  <span>
                    <strong>{t('opening.common.nextAction')}</strong> {tenderNextAction(overview)}
                  </span>
                </>
              }
            />
            {scheduled !== null && (
              <ScheduledBanner session={scheduled} onDismiss={() => setScheduled(null)} />
            )}
            <KpiGrid>
              <KpiCard
                label={t('opening.kpi.submissions')}
                value={
                  tender.effectiveSubmissionCount === null
                    ? t('opening.kpi.notClosed')
                    : formatCount(tender.effectiveSubmissionCount)
                }
                icon="inbox"
                hint={t('opening.kpi.submissionsHint')}
              />
              <KpiCard
                label={t('opening.kpi.stagesOpened')}
                value={t('opening.kpi.ofTotal', { done: opened, total: stages.length })}
                icon="unlock"
                tone="success"
              />
              <KpiCard
                label={t('opening.kpi.sessions')}
                value={formatCount(overview.sessions.length)}
                icon="calendar"
                tone="info"
              />
              <KpiCard
                label={t('opening.kpi.priceGate')}
                value={
                  gatePending
                    ? t('opening.gate.pending')
                    : overview.priceGates.some((gate) => gate.applies)
                      ? t('opening.gate.released')
                      : t('opening.gate.notApplicableShort')
                }
                icon={gatePending ? 'lock' : 'unlock'}
                tone={gatePending ? 'danger' : 'success'}
              />
            </KpiGrid>
            <div className="tiq-grid tiq-grid--sidebar">
              <Card title={t('opening.stages.title')} subtitle={t('opening.stages.subtitle')}>
                <div className="tiq-stack">
                  <Stepper
                    label={t('opening.stages.title')}
                    steps={stages.map((stage) => ({
                      id: `${stage.envelope}-${stage.lot?.lotId ?? 'all'}`,
                      label: tEnum('opening_sessions.envelope', stage.envelope),
                      description: `${lotLabel(stage.lot)} · ${stageStateLabel(stage.state)}`,
                      state: STEP_STATE[stage.state],
                    }))}
                  />
                  <DataTable
                    caption={t('opening.stages.title')}
                    columns={stageColumns}
                    rows={stages}
                    rowKey={(row) => `${row.envelope}-${row.lot?.lotId ?? 'all'}`}
                  />
                </div>
              </Card>
              <div className="tiq-stack">
                <Card title={t('opening.tender.authority')}>
                  <DetailList
                    stacked
                    items={[
                      {
                        key: 'owner',
                        label: t('opening.columns.owner'),
                        value: tender.owner.fullName,
                      },
                      {
                        key: 'procedure',
                        label: t('opening.tender.procedure'),
                        value: tEnum('tenders.procedure', tender.procedure),
                      },
                      {
                        key: 'mode',
                        label: t('opening.filters.openingMode'),
                        value: tEnum('tenders.opening_mode', tender.openingMode),
                      },
                      {
                        key: 'public',
                        label: t('opening.tender.publicOpening'),
                        value: tender.publicOpeningRequired
                          ? t('opening.common.yes')
                          : t('opening.common.no'),
                      },
                      {
                        key: 'closed',
                        label: t('opening.columns.closedAt'),
                        value:
                          tender.closedAt === null
                            ? null
                            : formatOfficialTime(tender.closedAt, timeZone),
                      },
                      { key: 'zone', label: t('opening.tender.timeZone'), value: timeZone },
                    ]}
                  />
                </Card>
                <PriceGateCard
                  gates={overview.priceGates}
                  timeZone={timeZone}
                  lots={overview.lots}
                />
              </div>
            </div>
            <Card title={t('opening.sessions.title')} flush>
              <DataTable
                caption={t('opening.sessions.title')}
                columns={sessionColumns}
                rows={overview.sessions}
                rowKey={(row) => String(row.id)}
                empty={<EmptyState compact icon="calendar" title={t('opening.sessions.none')} />}
              />
            </Card>
            <Card title={t('opening.bids.title')} subtitle={t('opening.bids.subtitle')} flush>
              <DataTable
                caption={t('opening.bids.title')}
                columns={bidColumns}
                rows={overview.bids}
                rowKey={(row) => String(row.bidId)}
                empty={<EmptyState compact icon="inbox" title={t('opening.bids.none')} />}
              />
            </Card>
            {canSchedule && (
              <ScheduleSessionDialog
                open={scheduling}
                onClose={() => setScheduling(false)}
                overview={overview}
                onScheduled={setScheduled}
              />
            )}
          </div>
        );
      }}
    </LoadingFrame>
  );
}

export default function TenderOpeningPage() {
  const params = useParams();
  const tenderId = idParam(params.tenderId);
  if (tenderId === null) {
    return (
      <RecordNotFound
        title={t('opening.tender.loadingTitle')}
        back={{ to: openingPaths.hub, label: t('opening.hub.back') }}
      />
    );
  }
  return <TenderOpeningView key={tenderId} tenderId={tenderId} />;
}
