/**
 * BUY-25 — One due-diligence case: every area (financial, capacity, ownership, insurance, restrictions, references,
 * contract exceptions and more) with its worst disposition, the findings with owners and due dates, evidence
 * requests, the readiness and award gates, and the fallback decision after a failure. Actions: request evidence,
 * record and update findings, and approve or reject readiness (FR-16, AC-24).
 */
import { useState } from 'react';

import { selectionEndpoints } from '@contracts/selection';
import type {
  DueDiligenceCaseDetail,
  DueDiligenceEvidenceRequest,
  DueDiligenceFinding,
} from '@contracts/selection';

import { useApiQuery } from '../../../../api/hooks';
import { usePermission } from '../../../../auth/permissions';
import { DocumentList } from '../../../../components/documents';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chip,
  DataTable,
  DetailList,
  EmptyState,
  OfficialDeadline,
  OrDash,
  PageHeader,
  QueryView,
  Reference,
  StatusChip,
} from '../../../../components/ui';
import type { DataTableColumn } from '../../../../components/ui';
import { formatDateTime } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import {
  DecideDiligenceDialog,
  DiligenceFindingDialog,
  RequestEvidenceDialog,
} from '../../components/DiligenceDialogs';
import { GatePanel } from '../../components/GatePanel';
import { ProcessDecisionTable } from '../../components/ProcessDecisionTable';
import { SelectionPage } from '../../components/SelectionPage';
import { useCommandResult, useIdParam } from '../../lib/hooks';
import { bidLabel } from '../../lib/labels';
import { selectionPaths } from '../../lib/paths';
import { DILIGENCE_DECIDE, DILIGENCE_MANAGE } from '../../lib/permissions';

type Dialog = 'finding' | 'evidence' | 'decide' | { readonly edit: DueDiligenceFinding } | null;

type AreaRow = DueDiligenceCaseDetail['areas'][number];

function nextAction(detail: DueDiligenceCaseDetail): string {
  if (detail.status === 'failed') {
    if (detail.fallbackDecision === null) return t('selection.diligenceCase.next.fallback');
    return detail.fallbackDecision.status === 'approved'
      ? t('selection.diligenceCase.next.fallbackApproved')
      : t('selection.diligenceCase.next.fallbackRecorded');
  }
  if (detail.status === 'passed') return t('selection.diligenceCase.next.passed');
  if (detail.passGate.allowed) return t('selection.diligenceCase.next.decide');
  return t('selection.diligenceCase.next.resolve');
}

const DISPOSITION_TONE = {
  satisfied: 'success',
  condition: 'info',
  unresolved: 'warning',
  failed: 'danger',
} as const;

export default function DiligenceCasePage() {
  const caseId = useIdParam('caseId');
  const canManage = usePermission(DILIGENCE_MANAGE);
  const canDecide = usePermission(DILIGENCE_DECIDE);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [latest, setLatest] = useCommandResult<DueDiligenceCaseDetail>(
    caseId,
    (record) => record.caseId,
  );
  const [savedFindings, setSavedFindings] = useState<Readonly<Record<number, DueDiligenceFinding>>>(
    {},
  );
  const [requests, setRequests] = useState<readonly DueDiligenceEvidenceRequest[]>([]);
  const query = useApiQuery(
    selectionEndpoints.getDiligenceCase,
    caseId === null ? null : { params: { caseId } },
  );
  const loaded = latest ?? query.data;
  const summary = useApiQuery(
    selectionEndpoints.getTender,
    loaded === undefined ? null : { params: { tenderId: loaded.tender.tenderId } },
  );
  const view =
    loaded === undefined
      ? undefined
      : {
          ...loaded,
          findings: [
            ...loaded.findings.map((item) => savedFindings[item.findingId] ?? item),
            ...Object.values(savedFindings).filter(
              (item) => !loaded.findings.some((f) => f.findingId === item.findingId),
            ),
          ],
          evidenceRequests: [...requests, ...loaded.evidenceRequests],
        };
  const decided = view !== undefined && (view.status === 'passed' || view.status === 'failed');
  const close = (): void => setDialog(null);
  const zone = view?.tender.officialTimeZone ?? 'UTC';

  const areaColumns: DataTableColumn<AreaRow>[] = [
    {
      id: 'area',
      header: t('selection.diligenceFinding.area'),
      cell: (row) => tEnum('due_diligence_findings.area', row.area),
    },
    {
      id: 'count',
      header: t('selection.diligenceCase.col.count'),
      numeric: true,
      cell: (row) => row.findingCount,
    },
    {
      id: 'worst',
      header: t('selection.diligenceCase.col.worst'),
      cell: (row) =>
        row.worstDisposition === null ? (
          <span className="tiq-text-muted">{t('selection.diligenceCase.notReviewed')}</span>
        ) : (
          <Chip tone={DISPOSITION_TONE[row.worstDisposition]} size="sm">
            {tEnum('due_diligence_findings.disposition', row.worstDisposition)}
          </Chip>
        ),
    },
  ];

  const findingColumns: DataTableColumn<DueDiligenceFinding>[] = [
    {
      id: 'area',
      header: t('selection.diligenceFinding.area'),
      cell: (row) => tEnum('due_diligence_findings.area', row.area),
    },
    {
      id: 'finding',
      header: t('selection.diligenceFinding.finding'),
      cell: (row) => (
        <>
          <span>{row.finding}</span>
          {row.evidenceTitle !== null && (
            <span className="tiq-cell-sub">
              {t('selection.diligenceCase.evidence', { title: row.evidenceTitle })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'disposition',
      header: t('selection.diligenceFinding.disposition'),
      cell: (row) => (
        <span className="tiq-inline">
          <Chip tone={DISPOSITION_TONE[row.disposition]} size="sm">
            {tEnum('due_diligence_findings.disposition', row.disposition)}
          </Chip>
          {row.isAwardBlocking && (
            <Chip tone="danger" size="sm" icon="ban" outlined>
              {t('selection.diligenceCase.blocksAward')}
            </Chip>
          )}
        </span>
      ),
    },
    {
      id: 'owner',
      header: t('selection.diligenceFinding.owner'),
      cell: (row) => <OrDash>{row.owner?.fullName}</OrDash>,
    },
    {
      id: 'dueAt',
      header: t('selection.diligenceFinding.dueAt'),
      cell: (row) =>
        row.dueAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <OfficialDeadline deadline={{ at: row.dueAt, timeZone: zone }} showLocal={false} />
        ),
    },
  ];
  if (canManage && !decided) {
    findingColumns.push({
      id: 'actions',
      header: t('selection.common.actions'),
      cell: (row) => (
        <Button size="sm" icon="edit" onClick={() => setDialog({ edit: row })}>
          {t('selection.diligenceFinding.update')}
        </Button>
      ),
    });
  }

  const requestColumns: DataTableColumn<DueDiligenceEvidenceRequest>[] = [
    {
      id: 'question',
      header: t('selection.evidenceRequest.question'),
      cell: (row) => (
        <>
          <span>{row.question}</span>
          <span className="tiq-cell-sub">
            {t('selection.evidenceRequest.scopeLine', { scope: row.permittedScope })}
          </span>
        </>
      ),
    },
    {
      id: 'dueAt',
      header: t('selection.evidenceRequest.dueAt'),
      cell: (row) => (
        <OfficialDeadline deadline={{ at: row.dueAt, timeZone: zone }} showLocal={false} />
      ),
    },
    {
      id: 'status',
      header: t('selection.common.status'),
      cell: (row) => <StatusChip enum="bid_clarifications.status" value={row.status} size="sm" />,
    },
    {
      id: 'respondedAt',
      header: t('selection.evidenceRequest.responded'),
      cell: (row) => (
        <OrDash>{row.respondedAt === null ? null : formatDateTime(row.respondedAt, zone)}</OrDash>
      ),
    },
  ];

  return (
    <SelectionPage
      header={
        <PageHeader
          title={
            view === undefined
              ? t('selection.diligenceCase.title')
              : t('selection.diligenceCase.heading', {
                  supplier: bidLabel(view.bid),
                  reference: view.tender.reference,
                })
          }
          back={{ to: selectionPaths.diligence, label: t('selection.diligence.title') }}
          meta={
            view === undefined ? undefined : (
              <>
                <Reference
                  value={view.tender.reference}
                  to={selectionPaths.tender(view.tender.tenderId)}
                />
                <StatusChip enum="due_diligence_cases.status" value={view.status} />
                <span>{t('selection.common.ownerName', { name: view.owner.fullName })}</span>
                {view.nextDueAt !== null && (
                  <OfficialDeadline
                    deadline={{ at: view.nextDueAt, timeZone: zone }}
                    label={t('selection.diligence.col.nextDue')}
                  />
                )}
                <span>{t('selection.common.nextAction', { action: nextAction(view) })}</span>
              </>
            )
          }
          primaryAction={
            view !== undefined && canDecide && !decided ? (
              <Button variant="primary" icon="gavel" onClick={() => setDialog('decide')}>
                {t('selection.decideDiligence.action')}
              </Button>
            ) : undefined
          }
          actions={
            view !== undefined && canManage && !decided ? (
              <>
                <Button icon="send" onClick={() => setDialog('evidence')}>
                  {t('selection.evidenceRequest.action')}
                </Button>
                <Button icon="plus" onClick={() => setDialog('finding')}>
                  {t('selection.diligenceFinding.record')}
                </Button>
              </>
            ) : undefined
          }
        />
      }
    >
      <QueryView query={query}>
        {() =>
          view === undefined ? null : (
            <>
              <GatePanel
                gate={view.awardGate}
                blockedTitle={t('selection.tender.gate.awardBlocked')}
                allowedTitle={t('selection.tender.gate.awardOpen')}
              />
              {!decided && (
                <GatePanel
                  gate={view.passGate}
                  blockedTitle={t('selection.diligenceCase.passBlocked')}
                  allowedTitle={t('selection.diligenceCase.passOpen')}
                />
              )}
              {view.status === 'failed' && view.fallbackDecision === null && (
                <Banner
                  tone="error"
                  title={t('selection.diligenceCase.fallbackRequired')}
                  actions={
                    <ButtonLink
                      to={selectionPaths.preferredBidder(view.preferredBidder.preferredBidderId)}
                      size="sm"
                    >
                      {t('selection.fallback.action')}
                    </ButtonLink>
                  }
                >
                  <p>{t('selection.diligenceCase.fallbackRequiredBody')}</p>
                </Banner>
              )}
              <div className="tiq-grid tiq-grid--sidebar">
                <Card
                  title={t('selection.diligenceCase.findings')}
                  subtitle={t('selection.diligenceCase.findingsHint')}
                  flush
                >
                  <DataTable
                    caption={t('selection.diligenceCase.findings')}
                    columns={findingColumns}
                    rows={view.findings}
                    rowKey={(row) => String(row.findingId)}
                    empty={<EmptyState compact title={t('selection.diligenceCase.noFindings')} />}
                  />
                </Card>
                <Card title={t('selection.diligenceCase.areas')} flush>
                  <DataTable
                    caption={t('selection.diligenceCase.areas')}
                    columns={areaColumns}
                    rows={view.areas}
                    rowKey={(row) => row.area}
                  />
                </Card>
              </div>
              <div className="tiq-stack">
                <Card title={t('selection.diligenceCase.decision')}>
                  <DetailList
                    stacked
                    items={[
                      {
                        label: t('selection.diligence.col.supplier'),
                        value: (
                          <ButtonLink
                            to={selectionPaths.preferredBidder(
                              view.preferredBidder.preferredBidderId,
                            )}
                            size="sm"
                            variant="link"
                          >
                            {`${bidLabel(view.bid)} · ${tEnum('preferred_bidders.status', view.preferredBidder.status)}`}
                          </ButtonLink>
                        ),
                      },
                      { label: t('selection.common.owner'), value: view.owner.fullName },
                      {
                        label: t('selection.diligenceCase.decidedBy'),
                        value:
                          view.decidedBy === null || view.decidedAt === null
                            ? null
                            : t('selection.diligenceCase.decidedLine', {
                                name: view.decidedBy.fullName,
                                at: formatDateTime(view.decidedAt, zone),
                              }),
                      },
                      { label: t('selection.decideDiligence.note'), value: view.decisionNote },
                    ]}
                  />
                </Card>
                <Card title={t('selection.diligenceCase.fallbackDecision')} flush>
                  {view.fallbackDecision === null ? (
                    <EmptyState
                      compact
                      title={
                        view.status === 'failed'
                          ? t('selection.diligenceCase.fallbackRequired')
                          : t('selection.diligenceCase.noFallback')
                      }
                    />
                  ) : (
                    <ProcessDecisionTable decisions={[view.fallbackDecision]} timeZone={zone} />
                  )}
                </Card>
              </div>
              <Card
                title={t('selection.diligenceCase.evidenceRequests')}
                subtitle={t('selection.diligenceCase.evidenceRequestsHint')}
                flush
              >
                <DataTable
                  caption={t('selection.diligenceCase.evidenceRequests')}
                  columns={requestColumns}
                  rows={view.evidenceRequests}
                  rowKey={(row) => String(row.clarificationId)}
                  empty={<EmptyState compact title={t('selection.diligenceCase.noRequests')} />}
                />
              </Card>
              <DocumentList
                audience="buyer"
                relatedType="due_diligence_case"
                relatedId={view.caseId}
                title={t('selection.diligenceCase.documents')}
                canUpload={canManage}
              />
              {(dialog === 'finding' || (dialog !== null && typeof dialog === 'object')) && (
                <DiligenceFindingDialog
                  detail={view}
                  owners={summary.data?.eligible.findingOwners ?? []}
                  finding={typeof dialog === 'object' && dialog !== null ? dialog.edit : undefined}
                  onClose={close}
                  onSaved={(finding) => {
                    setSavedFindings((current) => ({ ...current, [finding.findingId]: finding }));
                    close();
                  }}
                />
              )}
              {dialog === 'evidence' && (
                <RequestEvidenceDialog
                  detail={view}
                  onClose={close}
                  onRequested={(request) => {
                    setRequests((list) => [request, ...list]);
                    close();
                  }}
                />
              )}
              {dialog === 'decide' && (
                <DecideDiligenceDialog
                  detail={view}
                  onClose={close}
                  onDecided={(result) => {
                    setLatest(result);
                    close();
                  }}
                />
              )}
            </>
          )
        }
      </QueryView>
    </SelectionPage>
  );
}
