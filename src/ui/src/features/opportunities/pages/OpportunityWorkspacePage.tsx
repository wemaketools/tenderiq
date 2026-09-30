/**
 * SUP-08 Opportunity workspace: the current tender package, lots, dates, eligibility, addenda with this supplier's
 * acknowledgments, briefings and site visits, participation conditions and participation readiness (blocking errors
 * distinct from warnings). Actions: review, download, acknowledge, accept confidentiality, register interest or
 * request access, select eligible lots and move to response preparation. Private preparation progress (the pursuit,
 * drafts) is never shown to the buyer.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { publicationEndpoints } from '@contracts/publication';
import type {
  ConditionState,
  OpportunityWorkspace,
  OwnParticipation,
  WorkspaceAddendum,
  WorkspaceDocument,
  WorkspaceLot,
  WorkspaceSession,
} from '@contracts/publication';

import { isApiError } from '../../../api/client';
import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  ErrorState,
  KpiCard,
  KpiGrid,
  OfficialDeadline,
  PageHeader,
  ReadinessChecklist,
  Reference,
  RestrictedState,
  SkeletonBlock,
  StatusChip,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn, ReadinessItem } from '../../../components/ui';
import { formatCalendarDate, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import {
  AmendmentHistory,
  ConditionsCard,
  DocumentsCard,
  MilestonesCard,
} from '../../publication/components/NoticeSections';
import { lotColumns } from '../../publication/lib/lotColumns';
import { saveDownloadLink } from '../../publication/lib/download';
import { publicationErrorMessage, withPublicationMessage } from '../../publication/lib/errors';
import { useIdParam } from '../../publication/lib/hooks';
import { opportunityPaths } from '../../publication/lib/paths';
import { NOTICES_ACKNOWLEDGE, PURSUIT_MANAGE } from '../../publication/lib/permissions';
import {
  ConfidentialityDialog,
  RequestAccessDialog,
  SupplierInterestDialog,
} from '../components/ParticipationDialogs';

export default function OpportunityWorkspacePage() {
  const tenderId = useIdParam('tenderId');
  const query = useApiQuery(
    publicationEndpoints.opportunityWorkspace,
    tenderId === null ? null : { params: { tenderId } },
  );
  const back = { to: opportunityPaths.discovery, label: t('opportunities.workspace.back') };

  if (tenderId === null || query.error?.kind === 'not_found') {
    return (
      <div className="tiq-page">
        <PageHeader title={t('opportunities.workspace.notFoundTitle')} back={back} />
        <EmptyState
          icon="search"
          title={t('opportunities.workspace.notFoundTitle')}
          description={t('opportunities.workspace.notFound')}
          action={
            <ButtonLink to={opportunityPaths.discovery}>
              {t('opportunities.workspace.back')}
            </ButtonLink>
          }
        />
      </div>
    );
  }
  if (query.data === undefined) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('opportunities.workspace.loadingTitle')} back={back} />
        {query.error === null ? (
          <SkeletonBlock lines={10} />
        ) : query.error.kind === 'forbidden' ? (
          <RestrictedState />
        ) : (
          <ErrorState error={query.error} onRetry={query.reload} />
        )}
      </div>
    );
  }
  return <WorkspaceView key={tenderId} initial={query.data} back={back} />;
}

type Dialog = 'interest' | 'access' | 'confidentiality' | 'start' | null;
type AckTarget =
  | { readonly kind: 'addendum'; readonly addendum: WorkspaceAddendum }
  | { readonly kind: 'condition'; readonly condition: ConditionState };

/** Conditions a representative acknowledges directly (others are met by acceptance, qualification or attendance). */
const ACKNOWLEDGEABLE: readonly ConditionState['conditionType'][] = [
  'registration',
  'eligibility_review',
];

function nextActionOf(workspace: OpportunityWorkspace): string {
  const blocking = workspace.readiness.find((check) => check.status === 'blocking');
  if (blocking !== undefined) return blocking.detail ?? blocking.label;
  if (workspace.capabilities.canStartResponse) return t('opportunities.next.startResponse');
  if (!workspace.tender.isAcceptingResponses) return t('opportunities.next.closed');
  return t('opportunities.next.review');
}

function WorkspaceView({
  initial,
  back,
}: {
  readonly initial: OpportunityWorkspace;
  readonly back: { readonly to: string; readonly label: string };
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const canAcknowledgePermission = usePermission(NOTICES_ACKNOWLEDGE);
  const canPursuePermission = usePermission(PURSUIT_MANAGE);
  const [workspace, setWorkspace] = useState(initial);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [ackTarget, setAckTarget] = useState<AckTarget | null>(null);
  const [lotDraft, setLotDraft] = useState<readonly number[]>(
    initial.lots.filter((lot) => lot.selected).map((lot) => lot.lotId),
  );
  const [downloading, setDownloading] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const acknowledge = useApiMutation(publicationEndpoints.acknowledge);
  const selectLots = useApiMutation(publicationEndpoints.selectLots);
  const download = useApiMutation(publicationEndpoints.opportunityDocumentDownload);
  const start = useApiMutation(publicationEndpoints.startResponse);
  const addWatch = useApiMutation(publicationEndpoints.addToWatchlist);
  const removeWatch = useApiMutation(publicationEndpoints.removeFromWatchlist);

  const { tender, capabilities } = workspace;
  const timeZone = tender.officialTimeZone;
  const savedLots = workspace.lots.filter((lot) => lot.selected).map((lot) => lot.lotId);
  const lotsDirty =
    lotDraft.length !== savedLots.length || lotDraft.some((id) => !savedLots.includes(id));

  const updateParticipation = (participation: OwnParticipation): void => {
    setWorkspace((current) => ({ ...current, participation }));
    invalidateApiQueries('supplier.invitations.');
    invalidateApiQueries('supplier.opportunities.list');
  };

  const readiness: ReadinessItem[] = workspace.readiness.map((check) => ({
    id: check.id,
    label: check.label,
    detail: check.detail ?? undefined,
    status: check.status,
    action:
      check.status !== 'passed' &&
      check.id === 'confidentiality' &&
      capabilities.canAcceptConfidentiality ? (
        <Button size="sm" onClick={() => setDialog('confidentiality')}>
          {t('opportunities.confidentiality.accept')}
        </Button>
      ) : check.status !== 'passed' &&
        check.id.startsWith('session_') &&
        capabilities.canViewClarifications ? (
        <ButtonLink
          size="sm"
          to={opportunityPaths.briefing(Number(check.id.slice('session_'.length)))}
        >
          {t('opportunities.workspace.openSession')}
        </ButtonLink>
      ) : undefined,
  }));

  const blockingCount = workspace.readiness.filter((check) => check.status === 'blocking').length;
  const warningCount = workspace.readiness.filter((check) => check.status === 'warning').length;
  const addendaOutstanding = workspace.addenda.filter(
    (addendum) => addendum.acknowledgmentRequired && addendum.acknowledgedAt === null,
  ).length;
  const lockedDocuments = workspace.documents.filter((document) => !document.available).length;

  const fetchDocument = async (document: WorkspaceDocument): Promise<void> => {
    setDownloading(document.documentId);
    setDownloadError(null);
    try {
      const link = await download.mutate({
        params: { tenderId: tender.tenderId, documentId: document.documentId },
      });
      saveDownloadLink(link);
    } catch (error) {
      setDownloadError(
        isApiError(error) ? publicationErrorMessage(error) : t('opportunities.dialogs.failed'),
      );
    } finally {
      setDownloading(null);
    }
  };

  const toggleWatch = async (): Promise<void> => {
    try {
      if (workspace.watchlistItemId === null) {
        const item = await addWatch.mutate({ body: { tenderId: tender.tenderId } });
        setWorkspace((current) => ({ ...current, watchlistItemId: item.id }));
        toast.show(t('opportunities.discover.watched', { reference: tender.reference }), 'success');
      } else {
        await removeWatch.mutate({ params: { watchlistItemId: workspace.watchlistItemId } });
        setWorkspace((current) => ({ ...current, watchlistItemId: null }));
        toast.show(
          t('opportunities.discover.unwatched', { reference: tender.reference }),
          'success',
        );
      }
      invalidateApiQueries('supplier.watchlist.list');
    } catch (error) {
      toast.show(
        isApiError(error) ? publicationErrorMessage(error) : t('opportunities.dialogs.failed'),
        'error',
      );
    }
  };

  const saveLots = async (): Promise<void> => {
    try {
      const result = await selectLots.mutate({
        params: { tenderId: tender.tenderId },
        body: { lotIds: [...lotDraft] },
      });
      setWorkspace((current) => ({
        ...current,
        lots: current.lots.map((lot) => ({
          ...lot,
          selected: result.selectedLotIds.includes(lot.lotId),
        })),
        participation:
          current.participation === null
            ? null
            : { ...current.participation, selectedLotIds: result.selectedLotIds },
      }));
      setLotDraft(result.selectedLotIds);
      toast.show(
        t('opportunities.workspace.lotsSaved', { count: result.selectedLotIds.length }),
        'success',
      );
    } catch {
      // Shown next to the lots.
    }
  };

  const lotSelection: DataTableColumn<WorkspaceLot> = {
    id: 'select',
    header: t('opportunities.workspace.col.select'),
    cell: (lot) =>
      lot.eligible ? (
        <Checkbox
          label={t('opportunities.workspace.selectLot', { no: lot.lotNo })}
          checked={lotDraft.includes(lot.lotId)}
          disabled={!capabilities.canSelectLots || !canPursuePermission}
          onChange={(checked) =>
            setLotDraft((current) =>
              checked ? [...current, lot.lotId] : current.filter((id) => id !== lot.lotId),
            )
          }
        />
      ) : (
        <span className="tiq-text-danger">
          {lot.ineligibleReason ?? t('opportunities.workspace.notEligible')}
        </span>
      ),
  };

  const sessionColumns: DataTableColumn<WorkspaceSession>[] = [
    {
      id: 'session',
      header: t('opportunities.workspace.col.session'),
      cell: (session) => (
        <>
          {capabilities.canViewClarifications ? (
            <Reference value={session.title} to={opportunityPaths.briefing(session.sessionId)} />
          ) : (
            <strong>{session.title}</strong>
          )}
          <span className="tiq-cell-sub">
            {tEnum('sessions.session_type', session.sessionType)}
            {session.lotNo === null
              ? ''
              : ` · ${t('publication.common.lotNo', { no: session.lotNo })}`}
          </span>
          <span className="tiq-cell-sub">{session.venue}</span>
        </>
      ),
    },
    {
      id: 'when',
      header: t('opportunities.workspace.col.when'),
      cell: (session) => <OfficialDeadline deadline={session.startsAt} showLocal={false} />,
    },
    {
      id: 'mandatory',
      header: t('opportunities.workspace.col.mandatory'),
      cell: (session) =>
        session.mandatory ? (
          <Chip tone="danger" size="sm">
            {t('opportunities.workspace.mandatory')}
          </Chip>
        ) : (
          <Chip tone="neutral" size="sm">
            {t('opportunities.workspace.optional')}
          </Chip>
        ),
    },
    {
      id: 'places',
      header: t('opportunities.workspace.col.places'),
      cell: (session) =>
        session.placesLeft === null
          ? t('opportunities.workspace.unlimited')
          : t('opportunities.workspace.placesLeft', { count: session.placesLeft }),
    },
    {
      id: 'registration',
      header: t('opportunities.workspace.col.registration'),
      cell: (session) => (
        <>
          <StatusChip enum="sessions.status" value={session.status} size="sm" />
          {session.registrationStatus === null ? (
            <span className="tiq-cell-sub">{t('opportunities.workspace.notBooked')}</span>
          ) : (
            <StatusChip
              enum="session_registrations.status"
              value={session.registrationStatus}
              size="sm"
            />
          )}
          {session.registrationDeadline !== null && (
            <span className="tiq-cell-sub">
              {t('opportunities.workspace.registerBy')}{' '}
              <OfficialDeadline deadline={session.registrationDeadline} showLocal={false} />
            </span>
          )}
        </>
      ),
    },
  ];

  return (
    <div className="tiq-page">
      <UnsavedChangesGuard when={lotsDirty} />
      <PageHeader
        title={tender.title}
        subtitle={tender.summary ?? undefined}
        back={back}
        meta={
          <>
            <Reference value={tender.reference} />
            <span>{workspace.buyer.name}</span>
            <StatusChip enum="tenders.status" value={tender.status} />
            {tender.submissionDeadline !== null && (
              <OfficialDeadline
                deadline={tender.submissionDeadline}
                label={t('opportunities.common.submissionDeadline')}
                showRemaining={tender.isAcceptingResponses}
              />
            )}
            <span className="tiq-text-muted">
              {t('opportunities.common.nextAction')}: <strong>{nextActionOf(workspace)}</strong>
            </span>
          </>
        }
        primaryAction={
          capabilities.canStartResponse ? (
            <Button variant="primary" icon="arrowRight" onClick={() => setDialog('start')}>
              {t('opportunities.workspace.startResponse')}
            </Button>
          ) : undefined
        }
        actions={
          <>
            {capabilities.canRegisterInterest && (
              <Button icon="flag" onClick={() => setDialog('interest')}>
                {t('opportunities.interest.action')}
              </Button>
            )}
            {capabilities.canRequestAccess && canAcknowledgePermission && (
              <Button icon="key" onClick={() => setDialog('access')}>
                {t('opportunities.access.requestAction')}
              </Button>
            )}
            {capabilities.canAcceptConfidentiality && canAcknowledgePermission && (
              <Button icon="lock" onClick={() => setDialog('confidentiality')}>
                {t('opportunities.confidentiality.accept')}
              </Button>
            )}
            <Button
              icon={workspace.watchlistItemId === null ? 'eye' : 'eyeOff'}
              loading={addWatch.pending || removeWatch.pending}
              onClick={() => void toggleWatch()}
            >
              {workspace.watchlistItemId === null
                ? t('opportunities.actions.watch')
                : t('opportunities.actions.unwatch')}
            </Button>
            <ButtonLink to={opportunityPaths.pursuit(tender.tenderId)} icon="target">
              {t('opportunities.workspace.pursuit')}
            </ButtonLink>
            {capabilities.canViewClarifications && (
              <ButtonLink
                to={opportunityPaths.clarifications(tender.tenderId)}
                icon="messageQuestion"
              >
                {t('opportunities.workspace.clarifications')}
              </ButtonLink>
            )}
          </>
        }
      />
      <Banner tone="info">
        <p>{t('opportunities.workspace.privacy')}</p>
      </Banner>
      {!capabilities.canViewClarifications && (
        <Banner tone="info" title={t('opportunities.workspace.clarificationsRestrictedTitle')}>
          <p>
            {workspace.participation === null
              ? t('opportunities.workspace.clarificationsRestrictedNotParticipating')
              : t('opportunities.workspace.clarificationsRestrictedParticipant')}
          </p>
        </Banner>
      )}
      {startError !== null && (
        <Banner tone="error" title={t('opportunities.workspace.startBlocked')}>
          <p>{startError}</p>
        </Banner>
      )}

      <KpiGrid>
        <KpiCard
          label={t('opportunities.workspace.kpi.readiness')}
          icon={blockingCount > 0 ? 'alertOctagon' : 'checkCircle'}
          tone={blockingCount > 0 ? 'danger' : warningCount > 0 ? 'warning' : 'success'}
          value={
            blockingCount > 0
              ? t('opportunities.workspace.kpi.blocking', { count: blockingCount })
              : t('opportunities.workspace.kpi.ready')
          }
          hint={t('opportunities.workspace.kpi.warnings', { count: warningCount })}
        />
        <KpiCard
          label={t('opportunities.workspace.kpi.addenda')}
          icon="fileText"
          tone={addendaOutstanding > 0 ? 'warning' : 'info'}
          value={t('opportunities.workspace.kpi.addendaValue', {
            outstanding: addendaOutstanding,
            total: workspace.addenda.length,
          })}
          hint={t('opportunities.workspace.kpi.version', { version: tender.currentVersionNo })}
        />
        <KpiCard
          label={t('opportunities.workspace.kpi.documents')}
          icon="files"
          tone={lockedDocuments > 0 ? 'warning' : 'info'}
          value={String(workspace.documents.length - lockedDocuments)}
          hint={t('opportunities.workspace.kpi.locked', { count: lockedDocuments })}
        />
        <KpiCard
          label={t('opportunities.workspace.kpi.participation')}
          icon="userCheck"
          value={
            workspace.participation === null
              ? t('opportunities.workspace.notParticipating')
              : tEnum('participants.bid_intent', workspace.participation.bidIntent)
          }
          hint={
            workspace.pursuitDecision === null
              ? t('opportunities.workspace.noPursuit')
              : t('opportunities.workspace.pursuitPrivate', {
                  decision: tEnum('pursuits.decision', workspace.pursuitDecision),
                })
          }
          to={opportunityPaths.pursuit(tender.tenderId)}
        />
      </KpiGrid>

      <div className="tiq-grid tiq-grid--2">
        <Card
          title={t('opportunities.workspace.readinessTitle')}
          subtitle={t('opportunities.workspace.readinessIntro')}
        >
          {readiness.length === 0 ? (
            <EmptyState
              compact
              icon="listChecks"
              title={t('opportunities.workspace.noReadiness')}
            />
          ) : (
            <ReadinessChecklist
              items={readiness}
              label={t('opportunities.workspace.readinessTitle')}
            />
          )}
        </Card>
        <Card title={t('opportunities.workspace.participationTitle')}>
          <DetailList
            items={[
              {
                key: 'source',
                label: t('opportunities.workspace.source'),
                value:
                  workspace.participation === null
                    ? t('opportunities.workspace.notParticipating')
                    : tEnum('participants.source', workspace.participation.source),
              },
              {
                key: 'invitation',
                label: t('opportunities.invitations.invitationStatus'),
                value:
                  workspace.participation === null ? null : (
                    <StatusChip
                      enum="participants.invitation_status"
                      value={workspace.participation.invitationStatus}
                    />
                  ),
              },
              {
                key: 'access',
                label: t('opportunities.invitations.accessStatus'),
                value:
                  workspace.participation === null ? null : (
                    <StatusChip
                      enum="participants.access_status"
                      value={workspace.participation.accessStatus}
                    />
                  ),
              },
              {
                key: 'confidentiality',
                label: t('opportunities.invitations.col.confidentiality'),
                value:
                  workspace.participation?.confidentialityAcceptedAt === null ||
                  workspace.participation === null
                    ? null
                    : formatDateTime(workspace.participation.confidentialityAcceptedAt, timeZone),
              },
              {
                key: 'qualification',
                label: t('opportunities.workspace.qualification'),
                value:
                  workspace.qualification === null ? (
                    t('opportunities.workspace.noQualificationRequired')
                  ) : (
                    <span className="tiq-inline">
                      <span>{workspace.qualification.programName}</span>
                      <StatusChip
                        enum="v_qualification_status.effective_status"
                        value={workspace.qualification.effectiveStatus}
                        size="sm"
                      />
                      {workspace.qualification.effectiveTo !== null && (
                        <span className="tiq-text-muted">
                          {t('opportunities.workspace.until', {
                            date: formatCalendarDate(workspace.qualification.effectiveTo),
                          })}
                        </span>
                      )}
                    </span>
                  ),
              },
              {
                key: 'intent',
                label: t('opportunities.workspace.sharedIntent'),
                value:
                  workspace.participation === null
                    ? null
                    : tEnum('participants.bid_intent', workspace.participation.bidIntent),
              },
            ]}
          />
        </Card>
      </div>

      <AmendmentHistory
        addenda={workspace.addenda}
        versions={workspace.versions}
        timeZone={timeZone}
        currentVersionNo={tender.currentVersionNo}
        renderAddendumExtra={(addendum) =>
          !addendum.acknowledgmentRequired ? (
            <span className="tiq-text-muted">{t('opportunities.workspace.noAckRequired')}</span>
          ) : addendum.acknowledgedAt !== null ? (
            <span className="tiq-text-success">
              {t('opportunities.workspace.acknowledgedBy', {
                at: formatDateTime(addendum.acknowledgedAt, timeZone),
                by: addendum.acknowledgedBy?.fullName ?? '',
              })}
            </span>
          ) : (
            <span className="tiq-inline">
              <Chip tone="warning" size="sm">
                {t('opportunities.workspace.ackOutstanding')}
              </Chip>
              {capabilities.canAcknowledge && canAcknowledgePermission && (
                <Button
                  size="sm"
                  icon="checkSquare"
                  onClick={() => setAckTarget({ kind: 'addendum', addendum })}
                >
                  {t('opportunities.workspace.acknowledge')}
                </Button>
              )}
            </span>
          )
        }
      />

      <div className="tiq-grid tiq-grid--2">
        <MilestonesCard milestones={workspace.milestones} timeZone={timeZone} />
        <ConditionsCard
          conditions={workspace.conditions}
          intro={t('opportunities.conditions.intro')}
          renderState={(condition) =>
            condition.state === 'met' ? (
              <Chip tone="success" size="sm">
                {t('opportunities.conditions.met')}
              </Chip>
            ) : condition.state === 'not_applicable' ? (
              <Chip tone="neutral" size="sm">
                {t('opportunities.conditions.notApplicable')}
              </Chip>
            ) : (
              <span className="tiq-inline">
                <Chip tone="warning" size="sm">
                  {t('opportunities.conditions.outstanding')}
                </Chip>
                {ACKNOWLEDGEABLE.includes(condition.conditionType) &&
                  capabilities.canAcknowledge &&
                  canAcknowledgePermission && (
                    <Button
                      size="sm"
                      onClick={() => setAckTarget({ kind: 'condition', condition })}
                    >
                      {t('opportunities.workspace.acknowledge')}
                    </Button>
                  )}
              </span>
            )
          }
        />
      </div>

      <Card title={t('opportunities.workspace.scopeTitle')}>
        <DetailList
          items={[
            {
              key: 'category',
              label: t('public-portal.notice.category'),
              value: tender.category.name,
            },
            {
              key: 'regions',
              label: t('public-portal.notice.regions'),
              value: tender.regions.join(', '),
            },
            {
              key: 'eligibility',
              label: t('public-portal.notice.eligibility'),
              value: tender.eligibilitySummary,
            },
            {
              key: 'delivery',
              label: t('public-portal.notice.delivery'),
              value: tender.deliveryRequirements,
            },
            { key: 'rules', label: t('public-portal.notice.rules'), value: tender.submissionRules },
            {
              key: 'contract',
              label: t('opportunities.workspace.contractConditions'),
              value: tender.contractConditions,
            },
            {
              key: 'contact',
              label: t('public-portal.notice.contact'),
              value: tender.communicationChannelNote,
            },
            {
              key: 'languages',
              label: t('public-portal.notice.languages'),
              value: tender.acceptedLanguages.join(', ').toUpperCase(),
            },
            { key: 'zone', label: t('public-portal.notice.officialTime'), value: timeZone },
          ]}
        />
      </Card>

      <Card
        flush
        title={t('publication.shared.lotsTitle', { count: workspace.lots.length })}
        subtitle={
          tender.maxLotsPerSupplier === null
            ? t('opportunities.workspace.lotsIntro')
            : t('opportunities.workspace.lotsMax', { count: tender.maxLotsPerSupplier })
        }
        footer={
          workspace.lots.length > 0 && capabilities.canSelectLots && canPursuePermission ? (
            <div className="tiq-inline">
              <Button
                variant="primary"
                size="sm"
                disabled={!lotsDirty || lotDraft.length === 0}
                loading={selectLots.pending}
                onClick={() => void saveLots()}
              >
                {t('opportunities.workspace.saveLots')}
              </Button>
              {lotsDirty && (
                <span className="tiq-text-warning">{t('opportunities.workspace.lotsUnsaved')}</span>
              )}
              {selectLots.error !== null && (
                <span className="tiq-text-danger">{publicationErrorMessage(selectLots.error)}</span>
              )}
            </div>
          ) : undefined
        }
      >
        <DataTable
          caption={t('publication.shared.lotsCaption')}
          columns={[lotSelection, ...lotColumns<WorkspaceLot>()]}
          rows={workspace.lots}
          rowKey={(lot) => String(lot.lotId)}
          empty={
            <EmptyState compact icon="layers" title={t('opportunities.workspace.singleLot')} />
          }
        />
      </Card>

      <Card flush title={t('opportunities.workspace.sessionsTitle')}>
        <DataTable
          caption={t('opportunities.workspace.sessionsTitle')}
          columns={sessionColumns}
          rows={workspace.sessions}
          rowKey={(session) => String(session.sessionId)}
          empty={
            <EmptyState compact icon="mapPin" title={t('opportunities.workspace.noSessions')} />
          }
        />
      </Card>

      {downloadError !== null && (
        <Banner tone="warning" title={t('public-portal.notice.downloadBlocked')}>
          <p>{downloadError}</p>
        </Banner>
      )}
      <DocumentsCard
        documents={workspace.documents}
        timeZone={timeZone}
        renderAction={(document) =>
          document.available ? (
            <Button
              size="sm"
              icon="download"
              loading={downloading === document.documentId}
              onClick={() => void fetchDocument(document)}
              aria-label={t('public-portal.notice.downloadNamed', { title: document.title })}
            >
              {t('public-portal.notice.download')}
            </Button>
          ) : (
            <span className="tiq-text-muted">
              {document.lockedReason ?? t('opportunities.workspace.locked')}
            </span>
          )
        }
      />

      <SupplierInterestDialog
        tender={dialog === 'interest' ? tender : null}
        onClose={() => setDialog(null)}
        onDone={(participation) => {
          setDialog(null);
          updateParticipation(participation);
          toast.show(
            t('opportunities.interest.registered', { reference: tender.reference }),
            'success',
          );
        }}
      />
      <RequestAccessDialog
        tender={dialog === 'access' ? tender : null}
        onClose={() => setDialog(null)}
        onDone={(participation) => {
          setDialog(null);
          updateParticipation(participation);
          toast.show(
            t('opportunities.access.requested', {
              reference: tender.reference,
              status: tEnum('participants.access_status', participation.accessStatus),
            }),
            'success',
          );
        }}
      />
      <ConfidentialityDialog
        open={dialog === 'confidentiality'}
        tender={tender}
        text={
          workspace.conditions.find(
            (condition) => condition.conditionType === 'confidentiality_undertaking',
          )?.description ?? null
        }
        onClose={() => setDialog(null)}
        onDone={(participation) => {
          setDialog(null);
          updateParticipation(participation);
          toast.show(t('opportunities.confidentiality.accepted'), 'success');
        }}
      />
      <ConfirmActionDialog
        open={ackTarget !== null}
        title={t('opportunities.workspace.ackTitle')}
        scope={
          ackTarget === null
            ? ''
            : ackTarget.kind === 'addendum'
              ? `${tender.reference} · ${t('publication.shared.addendumNo', { no: ackTarget.addendum.number })} ${ackTarget.addendum.title}`
              : `${tender.reference} · ${ackTarget.condition.description}`
        }
        consequence={t('opportunities.workspace.ackConsequence', { buyer: workspace.buyer.name })}
        confirmLabel={t('opportunities.workspace.acknowledge')}
        pending={acknowledge.pending}
        error={withPublicationMessage(acknowledge.error)}
        onCancel={() => {
          acknowledge.reset();
          setAckTarget(null);
        }}
        onConfirm={async () => {
          if (ackTarget === null) return;
          try {
            const receipt = await acknowledge.mutate({
              params: { tenderId: tender.tenderId },
              body:
                ackTarget.kind === 'addendum'
                  ? { subjectType: 'addendum', subjectId: ackTarget.addendum.addendumId }
                  : {
                      subjectType: 'participation_condition',
                      subjectId: ackTarget.condition.conditionId,
                    },
            });
            setWorkspace((current) => ({
              ...current,
              addenda: current.addenda.map((addendum) =>
                receipt.subjectType === 'addendum' && addendum.addendumId === receipt.subjectId
                  ? {
                      ...addendum,
                      acknowledgedAt: receipt.acknowledgedAt,
                      acknowledgedBy: receipt.acknowledgedBy,
                    }
                  : addendum,
              ),
              conditions: current.conditions.map((condition) =>
                receipt.subjectType === 'participation_condition' &&
                condition.conditionId === receipt.subjectId
                  ? { ...condition, state: 'met', metAt: receipt.acknowledgedAt }
                  : condition,
              ),
            }));
            acknowledge.reset();
            setAckTarget(null);
            toast.show(t('opportunities.workspace.acknowledged'), 'success');
          } catch {
            // Shown in the dialog.
          }
        }}
      />
      <ConfirmActionDialog
        open={dialog === 'start'}
        title={t('opportunities.workspace.startTitle')}
        scope={`${tender.reference} ${tender.title}`}
        consequence={t('opportunities.workspace.startConsequence')}
        confirmLabel={t('opportunities.workspace.startResponse')}
        pending={start.pending}
        error={withPublicationMessage(start.error)}
        onCancel={() => {
          start.reset();
          setDialog(null);
        }}
        onConfirm={async () => {
          try {
            const outcome = await start.mutate({ params: { tenderId: tender.tenderId } });
            setDialog(null);
            setStartError(null);
            void navigate(outcome.nextPath);
          } catch (error) {
            if (isApiError(error) && error.code === 'READINESS_BLOCKED') {
              setDialog(null);
              start.reset();
              setStartError(publicationErrorMessage(error));
            }
          }
        }}
      />
    </div>
  );
}
