/**
 * BUY-27 — One final-offer (BAFO) round: instructions, permitted changes, deadline, opening rules and evaluation
 * treatment, the procedural authority, the invitees with their earlier and revised offers, the issue gate and the
 * process decisions of the tender. Actions: seek approval, issue (blocked with every reason when not permitted),
 * cancel, and propose the process decision a blocked round needs (AC-23).
 */
import { useState } from 'react';

import { sub } from '@contracts/decimal';
import { selectionEndpoints } from '@contracts/selection';
import type {
  FinalOfferInvitee,
  FinalOfferRoundDetail,
  ProcessDecision,
} from '@contracts/selection';

import { useApiMutation, useApiQuery } from '../../../../api/hooks';
import { useCanCall, usePermission } from '../../../../auth/permissions';
import { ApprovalStatusPanel } from '../../../../components/approvals';
import {
  Button,
  Card,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  ErrorState,
  MoneyText,
  OfficialDeadline,
  OrDash,
  PageHeader,
  QueryView,
  Reference,
  StatusChip,
  useToast,
} from '../../../../components/ui';
import type { DataTableColumn } from '../../../../components/ui';
import { formatDateTime } from '../../../../lib/format';
import { t } from '../../../../lib/i18n';
import { BidName } from '../../components/BidName';
import { GatePanel } from '../../components/GatePanel';
import { ProcessDecisionDialog } from '../../components/ProcessDecisionDialog';
import { ProcessDecisionTable } from '../../components/ProcessDecisionTable';
import { SelectionPage } from '../../components/SelectionPage';
import { withSelectionMessage } from '../../lib/errors';
import { useCommandResult, useIdParam } from '../../lib/hooks';
import { lotLabel, tenderLabel } from '../../lib/labels';
import { attempt } from '../../lib/lists';
import { selectionPaths } from '../../lib/paths';
import { PROCESS_DECISION_PROPOSE, SELECTION_MANAGE } from '../../lib/permissions';

function nextAction(round: FinalOfferRoundDetail): string {
  switch (round.status) {
    case 'draft':
    case 'awaiting_approval':
      return round.issueGate.allowed
        ? t('selection.finalOffer.next.issue')
        : t('selection.finalOffer.next.blocked');
    case 'issued':
      return t('selection.finalOffer.next.await');
    case 'closed':
      return t('selection.finalOffer.next.evaluate');
    case 'evaluated':
      return t('selection.finalOffer.next.done');
    case 'cancelled':
      return t('selection.finalOffer.next.cancelled');
  }
}

export default function FinalOfferPage() {
  const roundId = useIdParam('roundId');
  const toast = useToast();
  const canManage = usePermission(SELECTION_MANAGE);
  const canPropose = usePermission(PROCESS_DECISION_PROPOSE);
  const [latest, setLatest] = useCommandResult<FinalOfferRoundDetail>(
    roundId,
    (record) => record.roundId,
  );
  const [dialog, setDialog] = useState<'issue' | 'cancel' | 'decision' | null>(null);
  const [proposed, setProposed] = useState<readonly ProcessDecision[]>([]);
  const query = useApiQuery(
    selectionEndpoints.getFinalOfferRound,
    roundId === null ? null : { params: { roundId } },
  );
  const view = latest ?? query.data;
  const canReadDecisions = useCanCall(selectionEndpoints.listProcessDecisions);
  const decisions = useApiQuery(
    selectionEndpoints.listProcessDecisions,
    view === undefined || !canReadDecisions
      ? null
      : {
          query: { tenderId: view.tender.tenderId, pageSize: 100, sort: 'createdAt', dir: 'desc' },
        },
  );
  const issue = useApiMutation(selectionEndpoints.issueFinalOfferRound);
  const cancel = useApiMutation(selectionEndpoints.cancelFinalOfferRound);
  const close = (): void => setDialog(null);
  const zone = view?.tender.officialTimeZone ?? 'UTC';
  const cancellable =
    view !== undefined &&
    (view.status === 'draft' || view.status === 'awaiting_approval' || view.status === 'issued');

  const columns: DataTableColumn<FinalOfferInvitee>[] = [
    {
      id: 'supplier',
      header: t('selection.finalOffer.col.supplier'),
      cell: (row) => <BidName bid={row.bid} />,
    },
    {
      id: 'notified',
      header: t('selection.finalOffer.col.notified'),
      cell: (row) => (
        <OrDash>{row.notifiedAt === null ? null : formatDateTime(row.notifiedAt, zone)}</OrDash>
      ),
    },
    {
      id: 'received',
      header: t('selection.finalOffer.col.received'),
      cell: (row) => (
        <OrDash>
          {row.finalOfferReceivedAt === null
            ? null
            : formatDateTime(row.finalOfferReceivedAt, zone)}
        </OrDash>
      ),
    },
    {
      id: 'earlier',
      header: t('selection.finalOffer.col.earlier'),
      numeric: true,
      cell: (row) => <MoneyText value={row.earlierOffer} />,
    },
    {
      id: 'final',
      header: t('selection.finalOffer.col.final'),
      numeric: true,
      cell: (row) =>
        row.finalOffer === null ? (
          <span className="tiq-text-muted">{t('selection.finalOffer.sealed')}</span>
        ) : (
          <MoneyText value={row.finalOffer} />
        ),
    },
    {
      id: 'change',
      header: t('selection.finalOffer.col.change'),
      numeric: true,
      cell: (row) =>
        row.finalOffer === null ||
        row.earlierOffer === null ||
        row.finalOffer.currency !== row.earlierOffer.currency ? (
          <OrDash>{null}</OrDash>
        ) : (
          <MoneyText
            value={{
              amount: sub(row.finalOffer.amount, row.earlierOffer.amount),
              currency: row.finalOffer.currency,
            }}
          />
        ),
    },
  ];

  return (
    <SelectionPage
      header={
        <PageHeader
          title={
            view === undefined
              ? t('selection.finalOffer.title')
              : t('selection.finalOffer.heading', { reference: view.tender.reference })
          }
          back={{ to: selectionPaths.finalOffers, label: t('selection.finalOffers.title') }}
          meta={
            view === undefined ? undefined : (
              <>
                <Reference
                  value={view.tender.reference}
                  to={selectionPaths.tender(view.tender.tenderId)}
                />
                <StatusChip enum="final_offer_rounds.status" value={view.status} />
                {view.deadline !== null && (
                  <OfficialDeadline
                    deadline={view.deadline}
                    label={t('selection.finalOffers.col.deadline')}
                  />
                )}
                <span>{t('selection.common.nextAction', { action: nextAction(view) })}</span>
              </>
            )
          }
          primaryAction={
            view !== undefined &&
            canManage &&
            (view.status === 'draft' || view.status === 'awaiting_approval') ? (
              <Button
                variant="primary"
                icon="send"
                disabled={!view.issueGate.allowed}
                onClick={() => setDialog('issue')}
              >
                {t('selection.finalOffer.issue')}
              </Button>
            ) : undefined
          }
          actions={
            view === undefined ? undefined : (
              <>
                {canPropose && (
                  <Button icon="gavel" onClick={() => setDialog('decision')}>
                    {t('selection.processDecision.propose')}
                  </Button>
                )}
                {canManage && cancellable && (
                  <Button variant="danger-soft" icon="ban" onClick={() => setDialog('cancel')}>
                    {t('selection.finalOffer.cancel')}
                  </Button>
                )}
              </>
            )
          }
        />
      }
    >
      <QueryView query={query}>
        {() =>
          view === undefined ? null : (
            <>
              {(view.status === 'draft' || view.status === 'awaiting_approval') && (
                <GatePanel
                  gate={view.issueGate}
                  blockedTitle={t('selection.tender.gate.finalOfferBlocked')}
                  allowedTitle={t('selection.finalOffer.issueOpen')}
                  actions={
                    !view.issueGate.allowed && canPropose ? (
                      <Button size="sm" icon="gavel" onClick={() => setDialog('decision')}>
                        {t('selection.processDecision.propose')}
                      </Button>
                    ) : undefined
                  }
                />
              )}
              <div className="tiq-grid tiq-grid--sidebar">
                <Card title={t('selection.finalOffer.terms')}>
                  <DetailList
                    stacked
                    items={[
                      { label: t('selection.common.tender'), value: tenderLabel(view.tender) },
                      { label: t('selection.common.lot'), value: lotLabel(view.lot) },
                      {
                        label: t('selection.finalOfferForm.authority'),
                        value: view.proceduralAuthorityRef,
                      },
                      {
                        label: t('selection.finalOfferForm.instructions'),
                        value: view.instructions,
                      },
                      {
                        label: t('selection.finalOfferForm.permittedChanges'),
                        value: view.permittedChanges,
                      },
                      {
                        label: t('selection.finalOfferForm.openingRules'),
                        value: view.openingRules,
                      },
                      {
                        label: t('selection.finalOfferForm.evaluationTreatment'),
                        value: view.evaluationTreatment,
                      },
                    ]}
                  />
                </Card>
                <ApprovalStatusPanel
                  subjectType="final_offer_round"
                  subjectId={view.approvalSubject.subjectId}
                  subjectLabel={tenderLabel(view.tender, view.lot)}
                  currentVersion={
                    canManage && view.status === 'draft' && view.issueGate.allowed
                      ? {
                          subjectVersion: view.approvalSubject.subjectVersion,
                          contentHash: view.approvalSubject.contentHash,
                        }
                      : null
                  }
                  requestDefaults={{
                    title: t('selection.finalOffer.approvalTitle', {
                      reference: view.tender.reference,
                    }),
                    summary: view.instructions,
                  }}
                />
              </div>
              <Card
                title={t('selection.finalOffer.invitees')}
                subtitle={t('selection.finalOffer.inviteesHint')}
                flush
              >
                <DataTable
                  caption={t('selection.finalOffer.invitees')}
                  columns={columns}
                  rows={view.invitees}
                  rowKey={(row) => String(row.bid.bidId)}
                  empty={<EmptyState compact title={t('selection.finalOffer.noInvitees')} />}
                />
              </Card>
              {canReadDecisions && decisions.error?.kind !== 'forbidden' && (
                <Card title={t('selection.tender.decisions')} flush>
                  {decisions.error !== null ? (
                    <ErrorState error={decisions.error} onRetry={decisions.reload} />
                  ) : (
                    <ProcessDecisionTable
                      decisions={[...proposed, ...(decisions.data?.items ?? [])]}
                      timeZone={zone}
                    />
                  )}
                </Card>
              )}
              <ProcessDecisionDialog
                open={dialog === 'decision'}
                onClose={close}
                tender={view.tender}
                lot={view.lot}
                defaultType="reopen_round"
                context={t('selection.finalOfferForm.decisionContext')}
                onProposed={(decision) => setProposed((list) => [decision, ...list])}
              />
              {dialog === 'issue' && (
                <ConfirmActionDialog
                  open
                  title={t('selection.finalOffer.issueTitle')}
                  scope={tenderLabel(view.tender, view.lot)}
                  consequence={t('selection.finalOffer.issueConsequence', {
                    count: view.invitees.length,
                  })}
                  confirmLabel={t('selection.finalOffer.issue')}
                  acknowledgement={t('selection.finalOffer.issueAcknowledgement')}
                  pending={issue.pending}
                  error={withSelectionMessage(issue.error)}
                  onCancel={() => {
                    issue.reset();
                    close();
                  }}
                  onConfirm={async () => {
                    const result = await attempt(
                      issue.mutate({
                        params: { roundId: view.roundId },
                        body: { confirmed: true },
                      }),
                    );
                    if (result === undefined) return;
                    toast.show(t('selection.finalOffer.issued'), 'success');
                    setLatest(result);
                    close();
                  }}
                />
              )}
              {dialog === 'cancel' && (
                <ConfirmActionDialog
                  open
                  tone="danger"
                  title={t('selection.finalOffer.cancelTitle')}
                  scope={tenderLabel(view.tender, view.lot)}
                  consequence={t('selection.finalOffer.cancelConsequence')}
                  confirmLabel={t('selection.finalOffer.cancel')}
                  reason={{ label: t('selection.common.reason'), required: true }}
                  pending={cancel.pending}
                  error={withSelectionMessage(cancel.error)}
                  onCancel={() => {
                    cancel.reset();
                    close();
                  }}
                  onConfirm={async ({ reason }) => {
                    const result = await attempt(
                      cancel.mutate({ params: { roundId: view.roundId }, body: { reason } }),
                    );
                    if (result === undefined) return;
                    toast.show(t('selection.finalOffer.cancelled'), 'success');
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
