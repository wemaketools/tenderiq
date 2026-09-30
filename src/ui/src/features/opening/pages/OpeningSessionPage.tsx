/**
 * BUY-20 — One opening session: the opening authority (officer), the required participants and their confirmed
 * presence (quorum), the eligible envelopes, the readiness to open (blocking conditions vs warnings), the unseal
 * records with their recorded time, irregularities, the permitted minutes and the public opening information.
 *
 * Actions: confirm presence (officer, witness or committee member), open the stage (officer, after quorum; a staged
 * commercial envelope only after the price gate is released, AC-16), record the minutes, issue the public summary
 * and abort. Every consequential action is confirmed with the acting organization, capacity, scope and result.
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import {
  COMPLIANCE_VIEW_PERMISSIONS,
  RecordSessionBody,
  openingEndpoints,
} from '@contracts/opening';
import type {
  EnvelopeOpening,
  OpeningParticipant,
  OpeningSessionDetail,
  SessionBid,
} from '@contracts/opening';
import type { FieldError } from '@contracts/common';

import { useAppSelector } from '../../../app/hooks';
import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
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
  FormErrorSummary,
  KpiCard,
  KpiGrid,
  OfficialDeadline,
  OrDash,
  PageHeader,
  ReadinessChecklist,
  Reference,
  StatusChip,
  TextArea,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatOfficialTime, officialTimeParts } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { ActionError } from '../components/ActionError';
import { EnvelopeChips } from '../components/EnvelopeChips';
import { LoadingFrame } from '../components/LoadingFrame';
import { RecordNotFound } from '../components/RecordNotFound';
import { withBusinessMessage } from '../lib/errors';
import { sessionNextAction } from '../lib/nextAction';
import { ineligibleLabel, readinessDetail, readinessLabel } from '../lib/options';
import { idParam, openingPaths } from '../lib/paths';
import { formFeedback, validateBody } from '../lib/validation';

type DialogKind = 'confirm' | 'open' | 'abort' | 'publish';

const OPENABLE: ReadonlySet<OpeningSessionDetail['status']> = new Set([
  'scheduled',
  'awaiting_quorum',
]);

function refreshLists(): void {
  invalidateApiQueries('buyer.opening.listSessions');
  invalidateApiQueries('buyer.opening.listTenders');
  invalidateApiQueries('buyer.opening.getTender');
}

function MinutesForm({
  session,
  onSaved,
}: {
  readonly session: OpeningSessionDetail;
  readonly onSaved: (session: OpeningSessionDetail) => void;
}) {
  const toast = useToast();
  const mutation = useApiMutation(openingEndpoints.recordSession);
  const [minutes, setMinutes] = useState(session.minutes ?? '');
  const [irregularities, setIrregularities] = useState(session.irregularities ?? '');
  const [clientErrors, setClientErrors] = useState<FieldError[]>([]);
  const feedback = formFeedback(clientErrors, mutation.error, ['minutes', 'irregularities']);
  const dirty =
    minutes !== (session.minutes ?? '') || irregularities !== (session.irregularities ?? '');

  const save = async (): Promise<void> => {
    const checked = validateBody(RecordSessionBody, {
      minutes,
      irregularities: irregularities.trim() === '' ? null : irregularities,
    });
    if (!checked.ok) {
      setClientErrors(checked.errors);
      return;
    }
    setClientErrors([]);
    try {
      const saved = await mutation.mutate({
        params: { sessionId: session.id },
        body: checked.data,
      });
      onSaved(saved);
      toast.show(t('opening.minutes.saved'), 'success');
    } catch {
      // Shown below the form.
    }
  };

  return (
    <div className="tiq-form-stack">
      <UnsavedChangesGuard when={dirty && !mutation.pending} />
      <p className="tiq-text-muted">
        {session.minutes === null ? t('opening.minutes.notSaved') : t('opening.minutes.savedState')}
      </p>
      <TextArea
        label={t('opening.minutes.minutes')}
        hint={t('opening.minutes.minutesHint')}
        required
        rows={6}
        value={minutes}
        onChange={setMinutes}
        error={feedback.forField('minutes')}
      />
      <TextArea
        label={t('opening.minutes.irregularities')}
        hint={t('opening.minutes.irregularitiesHint')}
        rows={3}
        value={irregularities}
        onChange={setIrregularities}
        error={feedback.forField('irregularities')}
      />
      <FormErrorSummary errors={feedback.other} />
      <ActionError error={mutation.error} />
      <div className="tiq-inline">
        <Button
          variant="secondary"
          icon="check"
          loading={mutation.pending}
          disabled={!dirty}
          onClick={() => {
            void save();
          }}
        >
          {t('opening.minutes.save')}
        </Button>
        {dirty && <span className="tiq-text-warning">{t('opening.minutes.unsaved')}</span>}
      </div>
    </div>
  );
}

function SessionView({ sessionId }: { readonly sessionId: number }) {
  const query = useApiQuery(openingEndpoints.getSession, { params: { sessionId } });
  const userId = useAppSelector((state) => state.session.user?.id ?? null);
  const canOpen = usePermission('bid.open');
  const canConfirm = usePermission(['bid.open', 'bid.witness']);
  const canReviewCompliance = usePermission(COMPLIANCE_VIEW_PERMISSIONS);
  const toast = useToast();
  const [latest, setLatest] = useState<OpeningSessionDetail | null>(null);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [publicSummary, setPublicSummary] = useState('');
  const confirm = useApiMutation(openingEndpoints.confirmParticipant);
  const open = useApiMutation(openingEndpoints.openSession);
  const abort = useApiMutation(openingEndpoints.abortSession);
  const publish = useApiMutation(openingEndpoints.releasePublicSummary);
  const back = { to: `${openingPaths.hub}?tab=sessions`, label: t('opening.session.back') };

  const closeDialog = (): void => {
    confirm.reset();
    open.reset();
    abort.reset();
    publish.reset();
    setDialog(null);
  };

  return (
    <LoadingFrame title={t('opening.session.loadingTitle')} back={back} query={query}>
      {(fetched) => {
        const session = latest ?? fetched;
        const timeZone = session.scheduledAt.timeZone;
        const isOfficer = canOpen && session.openingOfficer.userId === userId;
        const myParticipant =
          session.participants.find((row) => row.id === session.myParticipantId) ?? null;
        const openable = OPENABLE.has(session.status);
        const blocking = session.readiness.filter((item) => item.status === 'blocking');
        const eligible = session.bids.filter((bid) => bid.eligible);
        const scope = t('opening.session.scope', {
          envelope: tEnum('opening_sessions.envelope', session.envelope),
          reference: session.tenderReference,
          title: session.tenderTitle,
        });

        const run = async (
          action: () => Promise<OpeningSessionDetail>,
          message: string,
        ): Promise<void> => {
          try {
            const result = await action();
            setLatest(result);
            refreshLists();
            toast.show(message, 'success');
            setDialog(null);
          } catch {
            // The dialog shows the error.
          }
        };

        const participantColumns: DataTableColumn<OpeningParticipant>[] = [
          {
            id: 'name',
            header: t('opening.columns.participant'),
            cell: (row) => (
              <>
                {row.user.fullName}
                <span className="tiq-cell-sub">
                  <OrDash>{row.capacity}</OrDash>
                </span>
              </>
            ),
          },
          {
            id: 'role',
            header: t('opening.columns.role'),
            cell: (row) => <StatusChip enum="opening_participants.role" value={row.role} />,
          },
          {
            id: 'confirmed',
            header: t('opening.columns.presence'),
            cell: (row) =>
              row.confirmedAt === null ? (
                <Chip tone="warning" size="sm">
                  {t('opening.participants.awaiting')}
                </Chip>
              ) : (
                <>
                  <Chip tone="success" size="sm" icon="check">
                    {t('opening.participants.confirmed')}
                  </Chip>
                  <span className="tiq-cell-sub">
                    {formatOfficialTime(row.confirmedAt, timeZone)}
                  </span>
                </>
              ),
          },
          {
            id: 'action',
            header: <span className="tiq-visually-hidden">{t('opening.columns.actions')}</span>,
            cell: (row) =>
              row.id === session.myParticipantId &&
              row.confirmedAt === null &&
              canConfirm &&
              openable ? (
                <Button size="sm" icon="userCheck" onClick={() => setDialog('confirm')}>
                  {t('opening.participants.confirmMine')}
                </Button>
              ) : null,
          },
        ];

        const bidColumns: DataTableColumn<SessionBid>[] = [
          {
            id: 'supplier',
            header: t('opening.columns.supplier'),
            cell: (row) => (
              <>
                {row.supplier.name}
                <span className="tiq-cell-sub tiq-mono">{row.receiptNo}</span>
              </>
            ),
          },
          {
            id: 'receivedAt',
            header: t('opening.columns.receivedAt'),
            cell: (row) => formatOfficialTime(row.receivedAt, timeZone),
          },
          {
            id: 'state',
            header: t('opening.columns.submissionState'),
            cell: (row) => <StatusChip enum="bids.submission_state" value={row.submissionState} />,
          },
          {
            id: 'eligible',
            header: t('opening.columns.eligibility'),
            cell: (row) =>
              row.eligible ? (
                <Chip tone="success" size="sm">
                  {t('opening.bids.eligible')}
                </Chip>
              ) : (
                <Chip tone="warning" size="sm" icon="lock">
                  {row.ineligibleReason === null
                    ? t('opening.bids.notEligible')
                    : ineligibleLabel(row.ineligibleReason)}
                </Chip>
              ),
          },
          {
            id: 'envelopes',
            header: t('opening.columns.envelopes'),
            cell: (row) => <EnvelopeChips envelopes={row.envelopes} />,
          },
        ];

        const openingColumns: DataTableColumn<EnvelopeOpening>[] = [
          {
            id: 'supplier',
            header: t('opening.columns.supplier'),
            cell: (row) => row.supplier.name,
          },
          {
            id: 'envelope',
            header: t('opening.columns.envelope'),
            cell: (row) => tEnum('tender_envelopes.envelope', row.envelope),
          },
          {
            id: 'openedAt',
            header: t('opening.columns.openedAt'),
            cell: (row) => formatOfficialTime(row.openedAt, timeZone),
          },
        ];

        return (
          <div className="tiq-page">
            <PageHeader
              title={t('opening.session.title', {
                envelope: tEnum('opening_sessions.envelope', session.envelope),
                reference: session.tenderReference,
              })}
              subtitle={session.tenderTitle}
              back={back}
              primaryAction={
                isOfficer && openable ? (
                  <Button variant="primary" icon="unlock" onClick={() => setDialog('open')}>
                    {t('opening.open.action')}
                  </Button>
                ) : undefined
              }
              actions={
                <>
                  <ButtonLink to={openingPaths.tender(session.tenderId)} icon="layers">
                    {t('opening.session.toTender')}
                  </ButtonLink>
                  {canReviewCompliance && session.status === 'completed' && (
                    <ButtonLink to={openingPaths.register(session.tenderId)} icon="clipboardCheck">
                      {t('opening.tender.toCompliance')}
                    </ButtonLink>
                  )}
                  {isOfficer && session.status !== 'completed' && session.status !== 'aborted' && (
                    <Button variant="danger-soft" icon="ban" onClick={() => setDialog('abort')}>
                      {t('opening.abort.action')}
                    </Button>
                  )}
                </>
              }
              meta={
                <>
                  <Reference
                    value={session.tenderReference}
                    to={openingPaths.tender(session.tenderId)}
                  />
                  <StatusChip enum="opening_sessions.status" value={session.status} />
                  <span>{tEnum('tenders.opening_mode', session.openingMode)}</span>
                  <OfficialDeadline
                    deadline={session.scheduledAt}
                    label={t('opening.columns.scheduledAt')}
                  />
                  <span>
                    <strong>{t('opening.common.nextAction')}</strong> {sessionNextAction(session)}
                  </span>
                </>
              }
            />
            {session.status === 'aborted' && (
              <Banner tone="warning" title={t('opening.session.abortedTitle')}>
                {t('opening.session.aborted')}
              </Banner>
            )}
            {!session.priceGate.released &&
              session.priceGate.applies &&
              session.envelope === 'commercial' && (
                <Banner tone="error" title={t('opening.gate.blockedTitle')}>
                  {t('opening.gate.blocked')}
                </Banner>
              )}
            <KpiGrid>
              <KpiCard
                label={t('opening.kpi.quorum')}
                value={t('opening.quorum.short', {
                  confirmed: session.quorum.confirmed,
                  required: session.quorum.required,
                })}
                icon="users"
                tone={session.quorum.met ? 'success' : 'warning'}
                hint={session.quorum.met ? t('opening.quorum.met') : t('opening.quorum.notMet')}
              />
              <KpiCard
                label={t('opening.kpi.eligibleBids')}
                value={t('opening.kpi.ofTotal', {
                  done: eligible.length,
                  total: session.bids.length,
                })}
                icon="inbox"
                tone="info"
              />
              <KpiCard
                label={t('opening.kpi.unsealRecords')}
                value={formatCount(session.openings.length)}
                icon="unlock"
                tone="success"
              />
              <KpiCard
                label={t('opening.kpi.openedAt')}
                value={
                  session.openedAt === null
                    ? t('opening.session.notOpened')
                    : formatOfficialTime(session.openedAt, timeZone)
                }
                hint={
                  session.openedAt === null
                    ? undefined
                    : officialTimeParts(session.openedAt, timeZone).text
                }
                icon="clock"
              />
            </KpiGrid>
            <div className="tiq-grid tiq-grid--sidebar">
              <div className="tiq-stack">
                <Card
                  title={t('opening.participants.title')}
                  subtitle={t('opening.participants.subtitle')}
                  flush
                >
                  <DataTable
                    caption={t('opening.participants.title')}
                    columns={participantColumns}
                    rows={session.participants}
                    rowKey={(row) => String(row.id)}
                    empty={<EmptyState compact title={t('opening.participants.none')} />}
                  />
                </Card>
                <Card
                  title={t('opening.sessionBids.title')}
                  subtitle={t('opening.sessionBids.subtitle')}
                  flush
                >
                  <DataTable
                    caption={t('opening.sessionBids.title')}
                    columns={bidColumns}
                    rows={session.bids}
                    rowKey={(row) => String(row.bidId)}
                    empty={<EmptyState compact icon="inbox" title={t('opening.bids.none')} />}
                  />
                </Card>
                <Card
                  title={t('opening.openings.title')}
                  subtitle={t('opening.openings.subtitle')}
                  flush
                >
                  <DataTable
                    caption={t('opening.openings.title')}
                    columns={openingColumns}
                    rows={session.openings}
                    rowKey={(row) => String(row.id)}
                    empty={<EmptyState compact icon="lock" title={t('opening.openings.none')} />}
                  />
                </Card>
              </div>
              <div className="tiq-stack">
                <Card title={t('opening.session.authority')}>
                  <DetailList
                    stacked
                    items={[
                      {
                        key: 'officer',
                        label: t('opening.columns.officer'),
                        value: session.openingOfficer.fullName,
                      },
                      {
                        key: 'lot',
                        label: t('opening.columns.lot'),
                        value:
                          session.lot === null
                            ? t('opening.lot.whole')
                            : t('opening.lot.label', {
                                number: session.lot.lotNo,
                                title: session.lot.title,
                              }),
                      },
                      {
                        key: 'tenderStatus',
                        label: t('opening.session.tenderStatus'),
                        value: <StatusChip enum="tenders.status" value={session.tenderStatus} />,
                      },
                      {
                        key: 'quorum',
                        label: t('opening.session.quorumRequired'),
                        value: formatCount(session.quorumRequired),
                      },
                    ]}
                  />
                </Card>
                {openable && (
                  <Card title={t('opening.readiness.title')}>
                    <ReadinessChecklist
                      label={t('opening.readiness.title')}
                      items={session.readiness.map((item) => ({
                        id: item.code,
                        label: readinessLabel(item.code),
                        detail: readinessDetail(item.code, item.status),
                        status: item.status,
                      }))}
                    />
                  </Card>
                )}
                <Card title={t('opening.gate.title')}>
                  {!session.priceGate.applies ? (
                    <EmptyState compact icon="unlock" title={t('opening.gate.notApplicable')} />
                  ) : (
                    <DetailList
                      items={[
                        {
                          key: 'state',
                          label: t('opening.columns.state'),
                          value: (
                            <Chip tone={session.priceGate.released ? 'success' : 'danger'}>
                              {session.priceGate.released
                                ? t('opening.gate.released')
                                : t('opening.gate.pending')}
                            </Chip>
                          ),
                        },
                        {
                          key: 'releasedAt',
                          label: t('opening.gate.releasedAt'),
                          value:
                            session.priceGate.releasedAt === null
                              ? null
                              : formatOfficialTime(session.priceGate.releasedAt, timeZone),
                        },
                        {
                          key: 'releasedBy',
                          label: t('opening.gate.releasedBy'),
                          value: session.priceGate.releasedBy?.fullName ?? null,
                        },
                      ]}
                    />
                  )}
                </Card>
              </div>
            </div>
            <div className="tiq-grid tiq-grid--2">
              <Card title={t('opening.minutes.title')} subtitle={t('opening.minutes.subtitle')}>
                {session.status === 'completed' && isOfficer ? (
                  <MinutesForm key={session.minutes ?? ''} session={session} onSaved={setLatest} />
                ) : (
                  <DetailList
                    stacked
                    items={[
                      {
                        key: 'minutes',
                        label: t('opening.minutes.minutes'),
                        value: session.minutes,
                      },
                      {
                        key: 'irregularities',
                        label: t('opening.minutes.irregularities'),
                        value: session.irregularities,
                      },
                    ]}
                  />
                )}
              </Card>
              <Card
                title={t('opening.publicSummary.title')}
                subtitle={t('opening.publicSummary.subtitle')}
              >
                {session.publicReleaseApproved ? (
                  <div className="tiq-stack">
                    <Chip tone="success" icon="globe">
                      {t('opening.session.publicReleased')}
                    </Chip>
                    <p>{session.publicReleaseSummary}</p>
                  </div>
                ) : session.status === 'completed' && isOfficer ? (
                  <div className="tiq-form-stack">
                    <TextArea
                      label={t('opening.publicSummary.text')}
                      hint={t('opening.publicSummary.hint')}
                      required
                      rows={4}
                      value={publicSummary}
                      onChange={setPublicSummary}
                    />
                    <div className="tiq-inline">
                      <Button
                        icon="globe"
                        disabled={publicSummary.trim() === ''}
                        onClick={() => setDialog('publish')}
                      >
                        {t('opening.publicSummary.action')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    compact
                    icon="globe"
                    title={t('opening.publicSummary.none')}
                    description={
                      session.status === 'completed'
                        ? undefined
                        : t('opening.publicSummary.afterOpening')
                    }
                  />
                )}
              </Card>
            </div>

            <ConfirmActionDialog
              key={`confirm-${String(dialog === 'confirm')}`}
              open={dialog === 'confirm'}
              title={t('opening.participants.confirmTitle')}
              scope={scope}
              consequence={t('opening.participants.confirmResult', {
                role:
                  myParticipant === null
                    ? ''
                    : tEnum('opening_participants.role', myParticipant.role),
              })}
              confirmLabel={t('opening.participants.confirmMine')}
              acknowledgement={t('opening.participants.acknowledgement')}
              pending={confirm.pending}
              error={withBusinessMessage(confirm.error)}
              onCancel={closeDialog}
              onConfirm={async () => {
                if (session.myParticipantId === null) return;
                const participantId = session.myParticipantId;
                try {
                  const result = await confirm.mutate({
                    params: { sessionId: session.id, participantId },
                  });
                  setLatest({
                    ...session,
                    status: result.sessionStatus,
                    quorum: result.quorum,
                    participants: session.participants.map((row) =>
                      row.id === result.participant.id ? result.participant : row,
                    ),
                  });
                  refreshLists();
                  toast.show(t('opening.participants.confirmedToast'), 'success');
                  setDialog(null);
                } catch {
                  // Shown in the dialog.
                }
              }}
            />
            <ConfirmActionDialog
              key={`open-${String(dialog === 'open')}`}
              open={dialog === 'open'}
              title={t('opening.open.title')}
              scope={scope}
              consequence={t('opening.open.result', { count: eligible.length })}
              confirmLabel={t('opening.open.confirm')}
              acknowledgement={t('opening.open.noConflict')}
              pending={open.pending}
              error={withBusinessMessage(open.error)}
              onCancel={closeDialog}
              onConfirm={() =>
                run(
                  () =>
                    open.mutate({
                      params: { sessionId: session.id },
                      body: { noConflictConfirmed: true },
                    }),
                  t('opening.open.done'),
                )
              }
            >
              {blocking.length > 0 && (
                <Banner tone="warning" title={t('opening.open.blockingTitle')}>
                  <ul>
                    {blocking.map((item) => (
                      <li key={item.code}>{readinessDetail(item.code, item.status)}</li>
                    ))}
                  </ul>
                </Banner>
              )}
            </ConfirmActionDialog>
            <ConfirmActionDialog
              key={`abort-${String(dialog === 'abort')}`}
              open={dialog === 'abort'}
              title={t('opening.abort.title')}
              scope={scope}
              consequence={t('opening.abort.result')}
              confirmLabel={t('opening.abort.confirm')}
              tone="danger"
              reason={{ label: t('opening.abort.reason'), required: true }}
              pending={abort.pending}
              error={withBusinessMessage(abort.error)}
              onCancel={closeDialog}
              onConfirm={({ reason }) =>
                run(
                  () => abort.mutate({ params: { sessionId: session.id }, body: { reason } }),
                  t('opening.abort.done'),
                )
              }
            />
            <ConfirmActionDialog
              key={`publish-${String(dialog === 'publish')}`}
              open={dialog === 'publish'}
              title={t('opening.publicSummary.confirmTitle')}
              scope={scope}
              consequence={t('opening.publicSummary.result')}
              confirmLabel={t('opening.publicSummary.action')}
              pending={publish.pending}
              error={withBusinessMessage(publish.error)}
              onCancel={closeDialog}
              onConfirm={() =>
                run(
                  () =>
                    publish.mutate({
                      params: { sessionId: session.id },
                      body: { publicReleaseSummary: publicSummary },
                    }),
                  t('opening.publicSummary.done'),
                )
              }
            >
              <blockquote>{publicSummary}</blockquote>
            </ConfirmActionDialog>
          </div>
        );
      }}
    </LoadingFrame>
  );
}

export default function OpeningSessionPage() {
  const params = useParams();
  const sessionId = idParam(params.sessionId);
  if (sessionId === null) {
    return (
      <RecordNotFound
        title={t('opening.session.loadingTitle')}
        back={{ to: openingPaths.hub, label: t('opening.hub.back') }}
      />
    );
  }
  return <SessionView key={sessionId} sessionId={sessionId} />;
}
