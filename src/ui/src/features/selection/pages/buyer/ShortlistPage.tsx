/**
 * BUY-23 — One shortlist: eligible candidates with scores and thresholds, include/exclude reasons and conditions,
 * the stage rule and rationale, the approval, outcome notices and the next-stage event. Actions: record decisions,
 * request approval, change after approval with a reason, issue outcome notices and next-stage invitations only to
 * included candidates, and create the next-stage event (FR-15, AC-22).
 */
import { useState } from 'react';

import { selectionEndpoints } from '@contracts/selection';
import type { ShortlistDetail, ShortlistEntry } from '@contracts/selection';

import { useApiMutation, useApiQuery } from '../../../../api/hooks';
import { usePermission } from '../../../../auth/permissions';
import { ApprovalStatusPanel } from '../../../../components/approvals';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  OrDash,
  PageHeader,
  QueryView,
  Reference,
  StatusChip,
  useToast,
} from '../../../../components/ui';
import type { DataTableColumn } from '../../../../components/ui';
import { formatDateTime, formatDecimalString } from '../../../../lib/format';
import { t } from '../../../../lib/i18n';
import { BidName } from '../../components/BidName';
import { GatePanel } from '../../components/GatePanel';
import { SelectionPage } from '../../components/SelectionPage';
import { ShortlistEditor } from '../../components/ShortlistEditor';
import { withSelectionMessage } from '../../lib/errors';
import { useCommandResult, useIdParam } from '../../lib/hooks';
import { lotLabel, tenderLabel } from '../../lib/labels';
import { attempt } from '../../lib/lists';
import { selectionPaths } from '../../lib/paths';
import { SELECTION_MANAGE } from '../../lib/permissions';

function nextAction(shortlist: ShortlistDetail): string {
  switch (shortlist.status) {
    case 'draft':
      return shortlist.entries.length === 0
        ? t('selection.shortlist.next.decisions')
        : t('selection.shortlist.next.approval');
    case 'awaiting_approval':
    case 'changed':
      return t('selection.shortlist.next.awaitApproval');
    case 'approved':
      return shortlist.notifiedAt === null
        ? t('selection.shortlist.next.notify')
        : shortlist.nextStage.tender === null
          ? t('selection.shortlist.next.nextStage')
          : t('selection.shortlist.next.done');
  }
}

export default function ShortlistPage() {
  const shortlistId = useIdParam('shortlistId');
  const toast = useToast();
  const canManage = usePermission(SELECTION_MANAGE);
  const [latest, setLatest] = useCommandResult<ShortlistDetail>(
    shortlistId,
    (record) => record.shortlistId,
  );
  const [editing, setEditing] = useState<'edit' | 'change' | null>(null);
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState<{ outcome: number; invitations: number } | null>(null);
  const query = useApiQuery(
    selectionEndpoints.getShortlist,
    shortlistId === null ? null : { params: { shortlistId } },
  );
  const view = latest ?? query.data;
  const summary = useApiQuery(
    selectionEndpoints.getTender,
    view === undefined ? null : { params: { tenderId: view.tender.tenderId } },
  );
  const notify = useApiMutation(selectionEndpoints.notifyShortlist);

  const columns: DataTableColumn<ShortlistEntry>[] = [
    {
      id: 'supplier',
      header: t('selection.candidates.col.supplier'),
      cell: (row) => <BidName bid={row.bid} />,
    },
    {
      id: 'decision',
      header: t('selection.shortlistEditor.decision'),
      cell: (row) =>
        row.included ? (
          <Chip tone="success" size="sm" icon="checkCircle">
            {t('selection.candidates.included')}
          </Chip>
        ) : (
          <Chip tone="neutral" size="sm" icon="xCircle">
            {t('selection.candidates.excluded')}
          </Chip>
        ),
    },
    {
      id: 'rank',
      header: t('selection.candidates.col.rank'),
      numeric: true,
      cell: (row) => <OrDash>{row.rank}</OrDash>,
    },
    {
      id: 'scores',
      header: t('selection.shortlist.col.scores'),
      numeric: true,
      cell: (row) => (
        <>
          <span>
            {row.nonPriceScore === null ? '—' : formatDecimalString(row.nonPriceScore, 2)}
          </span>
          <span className="tiq-cell-sub">
            {t('selection.shortlist.total', {
              total: row.totalScore === null ? '—' : formatDecimalString(row.totalScore, 2),
            })}
          </span>
        </>
      ),
    },
    {
      id: 'reason',
      header: t('selection.shortlist.col.reason'),
      cell: (row) => (
        <>
          <span>{row.reason}</span>
          {row.conditions !== null && (
            <span className="tiq-cell-sub">
              {t('selection.shortlist.conditions', { conditions: row.conditions })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'notice',
      header: t('selection.shortlist.col.notice'),
      cell: (row) =>
        row.notice === null ? (
          <span className="tiq-text-muted">{t('selection.shortlist.noNotice')}</span>
        ) : (
          <>
            <StatusChip enum="notices.status" value={row.notice.status} size="sm" />
            <span className="tiq-cell-sub">
              {row.notice.issuedAt === null || view === undefined
                ? row.notice.title
                : formatDateTime(row.notice.issuedAt, view.tender.officialTimeZone)}
            </span>
          </>
        ),
    },
  ];

  const requestable =
    view !== undefined &&
    (view.status === 'draft' || view.status === 'changed') &&
    view.entries.length > 0;

  return (
    <SelectionPage
      header={
        <PageHeader
          title={
            view === undefined
              ? t('selection.shortlist.title')
              : t('selection.shortlist.heading', {
                  reference: view.tender.reference,
                  stage: view.stageNo,
                })
          }
          back={{ to: selectionPaths.shortlists, label: t('selection.shortlists.title') }}
          meta={
            view === undefined ? undefined : (
              <>
                <Reference
                  value={view.tender.reference}
                  to={selectionPaths.tender(view.tender.tenderId)}
                />
                <StatusChip enum="shortlists.status" value={view.status} />
                <span>{lotLabel(view.lot)}</span>
                <span>{t('selection.common.nextAction', { action: nextAction(view) })}</span>
              </>
            )
          }
          primaryAction={
            view !== undefined && canManage && editing === null ? (
              view.status === 'draft' ? (
                <Button variant="primary" icon="edit" onClick={() => setEditing('edit')}>
                  {t('selection.shortlist.recordDecisions')}
                </Button>
              ) : view.status === 'approved' && view.notifiedAt === null ? (
                <Button
                  variant="primary"
                  icon="send"
                  disabled={!view.notifyGate.allowed}
                  onClick={() => setNotifying(true)}
                >
                  {t('selection.shortlist.notify')}
                </Button>
              ) : undefined
            ) : undefined
          }
          actions={
            view !== undefined && canManage && editing === null && view.status === 'approved' ? (
              <Button icon="repeat" onClick={() => setEditing('change')}>
                {t('selection.shortlist.change')}
              </Button>
            ) : undefined
          }
        />
      }
    >
      <QueryView query={query}>
        {() =>
          view === undefined ? null : (
            <>
              {notified !== null && (
                <Banner tone="success" title={t('selection.shortlist.notifiedTitle')}>
                  <p>
                    {t('selection.shortlist.notifiedDetail', {
                      outcome: notified.outcome,
                      invitations: notified.invitations,
                    })}
                  </p>
                </Banner>
              )}
              {view.status === 'approved' && view.notifiedAt === null && (
                <GatePanel
                  gate={view.notifyGate}
                  blockedTitle={t('selection.shortlist.notifyBlocked')}
                  allowedTitle={t('selection.shortlist.notifyOpen')}
                />
              )}
              {view.status === 'changed' && (
                <Banner tone="warning" title={t('selection.shortlist.changedBanner')}>
                  <p>{view.changeReason}</p>
                </Banner>
              )}
              {editing !== null && (
                <ShortlistEditor
                  shortlist={view}
                  candidates={summary.data?.candidates ?? []}
                  mode={editing}
                  onCancel={() => setEditing(null)}
                  onSaved={(result) => {
                    setLatest(result);
                    setEditing(null);
                  }}
                />
              )}
              <div className="tiq-grid tiq-grid--sidebar">
                <Card
                  title={t('selection.shortlist.entries')}
                  subtitle={t('selection.shortlists.counts', {
                    included: view.includedCount,
                    excluded: view.excludedCount,
                  })}
                  flush
                >
                  <DataTable
                    caption={t('selection.shortlist.entries')}
                    columns={columns}
                    rows={view.entries}
                    rowKey={(row) => String(row.entryId)}
                    empty={
                      <EmptyState
                        compact
                        title={t('selection.shortlist.noEntries')}
                        description={t('selection.shortlist.noEntriesHint')}
                      />
                    }
                  />
                </Card>
                <Card title={t('selection.shortlistForm.rule')}>
                  <DetailList
                    stacked
                    items={[
                      { label: t('selection.common.tender'), value: tenderLabel(view.tender) },
                      {
                        label: t('selection.shortlistForm.stage'),
                        value: t('selection.common.stageNo', { stage: view.stageNo }),
                      },
                      {
                        label: t('selection.shortlistForm.selectionRule'),
                        value: view.selectionRule,
                      },
                      {
                        label: t('selection.shortlistForm.threshold'),
                        value:
                          view.threshold === null
                            ? t('selection.shortlists.rankOnly')
                            : formatDecimalString(view.threshold, 2),
                      },
                      { label: t('selection.shortlistForm.rationale'), value: view.rationale },
                      {
                        label: t('selection.shortlist.approvedAt'),
                        value:
                          view.approvedAt === null
                            ? null
                            : formatDateTime(view.approvedAt, view.tender.officialTimeZone),
                      },
                      {
                        label: t('selection.shortlist.notifiedAt'),
                        value:
                          view.notifiedAt === null
                            ? null
                            : formatDateTime(view.notifiedAt, view.tender.officialTimeZone),
                      },
                    ]}
                  />
                </Card>
              </div>
              <div className="tiq-grid tiq-grid--2">
                <ApprovalStatusPanel
                  subjectType="shortlist"
                  subjectId={view.approvalSubject.subjectId}
                  subjectLabel={t('selection.shortlist.approvalLabel', {
                    tender: tenderLabel(view.tender, view.lot),
                    stage: view.stageNo,
                  })}
                  currentVersion={
                    requestable && canManage
                      ? {
                          subjectVersion: view.approvalSubject.subjectVersion,
                          contentHash: view.approvalSubject.contentHash,
                        }
                      : null
                  }
                  requestDefaults={{
                    title: t('selection.shortlist.approvalTitle', {
                      reference: view.tender.reference,
                      stage: view.stageNo,
                    }),
                    summary: view.rationale,
                  }}
                />
                <Card
                  title={t('selection.shortlist.nextStageTitle')}
                  subtitle={t('selection.shortlist.nextStageHint')}
                >
                  {view.nextStage.tender !== null ? (
                    <p>
                      {view.nextStage.tender.tenderId === view.tender.tenderId
                        ? t('selection.shortlist.nextStageSameEvent', {
                            stage: view.nextStage.tender.stageNo,
                          })
                        : t('selection.shortlist.nextStageLinked')}{' '}
                      <Reference
                        value={view.nextStage.tender.reference}
                        to={`/buyer/tenders/${view.nextStage.tender.tenderId}`}
                      />
                    </p>
                  ) : view.nextStage.createLink !== null && view.status === 'approved' ? (
                    <ButtonLink to={view.nextStage.createLink} icon="plus">
                      {t('selection.shortlist.createNextStage')}
                    </ButtonLink>
                  ) : (
                    <p className="tiq-text-muted">{t('selection.shortlist.nextStageLocked')}</p>
                  )}
                </Card>
              </div>
              {notifying && (
                <ConfirmActionDialog
                  open
                  title={t('selection.shortlist.notifyTitle')}
                  scope={tenderLabel(view.tender, view.lot)}
                  consequence={t('selection.shortlist.notifyConsequence', {
                    included: view.includedCount,
                    excluded: view.excludedCount,
                  })}
                  confirmLabel={t('selection.shortlist.notify')}
                  acknowledgement={t('selection.shortlist.notifyAcknowledgement')}
                  pending={notify.pending}
                  error={withSelectionMessage(notify.error)}
                  onCancel={() => {
                    notify.reset();
                    setNotifying(false);
                  }}
                  onConfirm={async () => {
                    const result = await attempt(
                      notify.mutate({
                        params: { shortlistId: view.shortlistId },
                        body: { confirmed: true },
                      }),
                    );
                    if (result === undefined) return;
                    setLatest(result.shortlist);
                    setNotified({
                      outcome: result.outcomeNoticesIssued,
                      invitations: result.nextStageInvitationsIssued,
                    });
                    toast.show(t('selection.shortlist.notifiedTitle'), 'success');
                    setNotifying(false);
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
