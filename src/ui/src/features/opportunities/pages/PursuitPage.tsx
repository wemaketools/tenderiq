/**
 * SUP-09 Bid/no-bid and pursuit team: the private pursuit rationale, internal risk, capacity, effort, owner, team
 * assignments with internal dates, and private notes. Actions: save the assessment, record the private decision,
 * allocate work and record notes. The buyer sees only what the supplier explicitly shares with "Notify buyer"
 * (DD-41): an intent and, for a no-bid, an optional reason. Saved (private) differs from decided (private) and from
 * shared with the buyer, and the page shows each distinctly.
 */
import { useState } from 'react';

import { publicationEndpoints } from '@contracts/publication';
import type {
  BuyerVisibleIntent,
  PursuitDetail,
  PursuitNote,
  PursuitTeamMember,
  PursuitView,
} from '@contracts/publication';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  EmptyState,
  ErrorState,
  FormErrorSummary,
  NumberInput,
  OfficialDeadline,
  OrDash,
  PageHeader,
  Reference,
  RestrictedState,
  Select,
  SkeletonBlock,
  StatusChip,
  TextArea,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { fieldMessage, withPublicationMessage } from '../../publication/lib/errors';
import { useIdParam } from '../../publication/lib/hooks';
import { opportunityPaths } from '../../publication/lib/paths';
import { PURSUIT_MANAGE } from '../../publication/lib/permissions';
import { DecisionDialog, NotifyBuyerDialog, TeamMemberDialog } from '../components/PursuitDialogs';

export default function PursuitPage() {
  const tenderId = useIdParam('tenderId');
  const query = useApiQuery(
    publicationEndpoints.getPursuit,
    tenderId === null ? null : { params: { tenderId } },
  );
  const back =
    tenderId === null
      ? { to: opportunityPaths.pursuits, label: t('opportunities.pursuit.backToList') }
      : {
          to: opportunityPaths.workspace(tenderId),
          label: t('opportunities.pursuit.backToWorkspace'),
        };

  if (tenderId === null || query.error?.kind === 'not_found') {
    return (
      <div className="tiq-page">
        <PageHeader title={t('opportunities.workspace.notFoundTitle')} back={back} />
        <EmptyState
          icon="target"
          title={t('opportunities.workspace.notFoundTitle')}
          description={t('opportunities.workspace.notFound')}
        />
      </div>
    );
  }
  if (query.data === undefined) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('opportunities.pursuit.loadingTitle')} back={back} />
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
  return <PursuitViewPage key={tenderId} initial={query.data} back={back} />;
}

interface AssessmentDraft {
  readonly attractiveness: string;
  readonly capacityNote: string;
  readonly estimatedEffortHours: string;
  readonly risks: string;
  readonly pursuitOwnerUserId: string;
}

function draftOf(pursuit: PursuitDetail | null): AssessmentDraft {
  return {
    attractiveness:
      pursuit?.attractiveness === null || pursuit === null ? '' : String(pursuit.attractiveness),
    capacityNote: pursuit?.capacityNote ?? '',
    estimatedEffortHours:
      pursuit?.estimatedEffortHours === null || pursuit === null
        ? ''
        : String(pursuit.estimatedEffortHours),
    risks: pursuit?.risks ?? '',
    pursuitOwnerUserId:
      pursuit?.pursuitOwner === null || pursuit === null ? '' : String(pursuit.pursuitOwner.userId),
  };
}

function sameDraft(a: AssessmentDraft, b: AssessmentDraft): boolean {
  return (
    a.attractiveness === b.attractiveness &&
    a.capacityNote === b.capacityNote &&
    a.estimatedEffortHours === b.estimatedEffortHours &&
    a.risks === b.risks &&
    a.pursuitOwnerUserId === b.pursuitOwnerUserId
  );
}

function PursuitViewPage({
  initial,
  back,
}: {
  readonly initial: PursuitView;
  readonly back: { readonly to: string; readonly label: string };
}) {
  const toast = useToast();
  const hasPermission = usePermission(PURSUIT_MANAGE);
  const [view, setView] = useState(initial);
  const [draft, setDraft] = useState(() => draftOf(initial.pursuit));
  const [savedDraft, setSavedDraft] = useState(() => draftOf(initial.pursuit));
  const [dialog, setDialog] = useState<'decision' | 'notify' | null>(null);
  const [memberDialog, setMemberDialog] = useState<PursuitTeamMember | 'new' | null>(null);
  const [removing, setRemoving] = useState<PursuitTeamMember | null>(null);
  const [note, setNote] = useState('');
  const canManage = hasPermission && view.capabilities.canManage;
  const canNotify = hasPermission && view.capabilities.canNotifyBuyer;

  const candidates = useApiQuery(publicationEndpoints.pursuitTeamCandidates, canManage ? {} : null);
  const save = useApiMutation(publicationEndpoints.savePursuit);
  const addNote = useApiMutation(publicationEndpoints.addNote);
  const removeMember = useApiMutation(publicationEndpoints.removeTeamMember);

  const { tender, pursuit, buyerVisible } = view;
  const timeZone = view.buyer.officialTimeZone;
  const dirty = !sameDraft(draft, savedDraft);
  const effortInvalid =
    draft.estimatedEffortHours !== '' && !/^\d+$/.test(draft.estimatedEffortHours);

  const setPursuit = (next: PursuitDetail): void => {
    setView((current) => ({ ...current, pursuit: next }));
  };

  const saveAssessment = async (): Promise<void> => {
    if (effortInvalid) return;
    try {
      const next = await save.mutate({
        params: { tenderId: tender.tenderId },
        body: {
          attractiveness: draft.attractiveness === '' ? null : Number(draft.attractiveness),
          capacityNote: draft.capacityNote.trim() === '' ? null : draft.capacityNote.trim(),
          estimatedEffortHours:
            draft.estimatedEffortHours === '' ? null : Number(draft.estimatedEffortHours),
          risks: draft.risks.trim() === '' ? null : draft.risks.trim(),
          pursuitOwnerUserId:
            draft.pursuitOwnerUserId === '' ? null : Number(draft.pursuitOwnerUserId),
        },
      });
      setPursuit(next);
      const fresh = draftOf(next);
      setDraft(fresh);
      setSavedDraft(fresh);
      toast.show(t('opportunities.pursuit.saved'), 'success');
    } catch {
      // Shown in the form.
    }
  };

  const submitNote = async (): Promise<void> => {
    if (note.trim() === '' || pursuit === null) return;
    try {
      const created = await addNote.mutate({
        params: { tenderId: tender.tenderId },
        body: { body: note.trim() },
      });
      setPursuit({ ...pursuit, notes: [created, ...pursuit.notes] });
      setNote('');
      toast.show(t('opportunities.pursuit.noteAdded'), 'success');
    } catch {
      // Shown next to the note.
    }
  };

  const ownerOptions = (candidates.data?.items ?? []).map((item) => ({
    value: String(item.user.userId),
    label: `${item.user.fullName}${item.capacity === null ? '' : ` (${item.capacity})`}`,
  }));
  if (
    pursuit?.pursuitOwner &&
    !ownerOptions.some((option) => option.value === String(pursuit.pursuitOwner?.userId))
  ) {
    ownerOptions.push({
      value: String(pursuit.pursuitOwner.userId),
      label: pursuit.pursuitOwner.fullName,
    });
  }

  const lotLabel = (lotId: number): string => {
    const lot = view.lots.find((item) => item.lotId === lotId);
    return lot === undefined ? `#${lotId}` : t('publication.common.lotNo', { no: lot.lotNo });
  };

  const teamColumns: DataTableColumn<PursuitTeamMember>[] = [
    {
      id: 'member',
      header: t('opportunities.team.member'),
      cell: (member) => (
        <>
          <span>{member.user.fullName}</span>
          <span className="tiq-cell-sub">{member.capacity}</span>
        </>
      ),
    },
    {
      id: 'responsibility',
      header: t('opportunities.team.responsibility'),
      cell: (member) => tEnum('pursuit_team_members.responsibility', member.responsibility),
    },
    {
      id: 'scope',
      header: t('opportunities.team.assignment'),
      cell: (member) => (
        <>
          <OrDash>{member.sectionScope.join(', ')}</OrDash>
          {member.lotIds.length > 0 && (
            <span className="tiq-cell-sub">{member.lotIds.map(lotLabel).join(', ')}</span>
          )}
        </>
      ),
    },
    {
      id: 'due',
      header: t('opportunities.team.dueAt'),
      cell: (member) => (
        <OrDash>{member.dueAt === null ? null : formatDateTime(member.dueAt, timeZone)}</OrDash>
      ),
    },
    {
      id: 'pricing',
      header: t('opportunities.team.pricingCol'),
      cell: (member) =>
        member.canViewPricing ? (
          <Chip tone="accent" size="sm" icon="coins">
            {t('opportunities.team.pricingYes')}
          </Chip>
        ) : (
          <span className="tiq-text-muted">{t('opportunities.team.pricingNo')}</span>
        ),
    },
    {
      id: 'actions',
      header: (
        <span className="tiq-visually-hidden">{t('opportunities.discover.col.actions')}</span>
      ),
      cell: (member) =>
        canManage ? (
          <div className="tiq-row-actions">
            <Button size="sm" icon="edit" onClick={() => setMemberDialog(member)}>
              {t('opportunities.actions.edit')}
            </Button>
            <Button size="sm" variant="ghost" icon="trash" onClick={() => setRemoving(member)}>
              {t('opportunities.team.remove')}
            </Button>
          </div>
        ) : null,
    },
  ];

  const nextAction =
    pursuit === null
      ? t('opportunities.next.assess')
      : pursuit.decision === 'undecided'
        ? t('opportunities.next.decide')
        : buyerVisible.bidIntent === 'undecided'
          ? t('opportunities.next.notify')
          : t('opportunities.next.prepare');

  return (
    <div className="tiq-page">
      <UnsavedChangesGuard when={dirty} />
      <PageHeader
        title={t('opportunities.pursuit.title', { reference: tender.reference })}
        subtitle={tender.title}
        back={back}
        meta={
          <>
            <Reference value={tender.reference} to={opportunityPaths.workspace(tender.tenderId)} />
            <span>{view.buyer.name}</span>
            <StatusChip enum="tenders.status" value={tender.status} />
            {tender.closingAt !== null && (
              <OfficialDeadline
                deadline={tender.closingAt}
                label={t('opportunities.common.closing')}
                showRemaining={tender.isAcceptingResponses}
              />
            )}
            <span className="tiq-text-muted">
              {t('opportunities.common.nextAction')}: <strong>{nextAction}</strong>
            </span>
          </>
        }
        primaryAction={
          canManage && pursuit !== null ? (
            <Button variant="primary" icon="gavel" onClick={() => setDialog('decision')}>
              {t('opportunities.pursuit.recordDecision')}
            </Button>
          ) : undefined
        }
        actions={
          <>
            {canNotify && (
              <Button icon="send" onClick={() => setDialog('notify')}>
                {t('opportunities.pursuit.notify')}
              </Button>
            )}
            <ButtonLink to={opportunityPaths.pursuits} icon="list">
              {t('opportunities.pursuit.backToList')}
            </ButtonLink>
          </>
        }
      />
      <Banner tone="info" title={t('opportunities.pursuit.privateTitle')}>
        <p>{t('opportunities.pursuit.private')}</p>
      </Banner>

      <div className="tiq-grid tiq-grid--3">
        <Card
          title={t('opportunities.pursuit.stateSaved')}
          subtitle={
            pursuit === null
              ? t('opportunities.pursuit.stateNotStartedHint')
              : pursuit.decision === 'undecided'
                ? t('opportunities.pursuit.stateSavedHint')
                : t('opportunities.pursuit.stateDecidedSavedHint')
          }
        >
          {pursuit === null ? (
            <Chip tone="neutral">{t('opportunities.pursuit.notStarted')}</Chip>
          ) : (
            <p>
              {t('opportunities.pursuit.updatedAt', {
                at: formatDateTime(pursuit.updatedAt, timeZone),
              })}
              {dirty && (
                <>
                  {' '}
                  <Chip tone="warning" size="sm">
                    {t('opportunities.pursuit.unsaved')}
                  </Chip>
                </>
              )}
            </p>
          )}
        </Card>
        <Card
          title={t('opportunities.pursuit.stateDecided')}
          subtitle={t('opportunities.pursuit.stateDecidedHint')}
        >
          {pursuit === null ? (
            <Chip tone="neutral">{tEnum('pursuits.decision', 'undecided')}</Chip>
          ) : (
            <div className="tiq-stack">
              <span className="tiq-inline">
                <StatusChip enum="pursuits.decision" value={pursuit.decision} />
              </span>
              {pursuit.decidedAt !== null && (
                <span className="tiq-text-muted">
                  {t('opportunities.pursuit.decidedBy', {
                    at: formatDateTime(pursuit.decidedAt, timeZone),
                    by: pursuit.decidedBy?.fullName ?? '',
                  })}
                </span>
              )}
              {pursuit.internalRationale !== null && <span>{pursuit.internalRationale}</span>}
            </div>
          )}
        </Card>
        <Card
          title={t('opportunities.pursuit.stateShared')}
          subtitle={t('opportunities.pursuit.stateSharedHint')}
        >
          <BuyerIntent intent={buyerVisible} timeZone={timeZone} />
        </Card>
      </div>

      <Card
        title={t('opportunities.pursuit.assessmentTitle')}
        subtitle={t('opportunities.pursuit.assessmentIntro')}
        footer={
          canManage ? (
            <div className="tiq-inline">
              <Button
                variant="primary"
                icon="check"
                disabled={!dirty && pursuit !== null}
                loading={save.pending}
                onClick={() => void saveAssessment()}
              >
                {pursuit === null
                  ? t('opportunities.pursuit.start')
                  : t('opportunities.pursuit.save')}
              </Button>
              {dirty && (
                <Button
                  onClick={() => {
                    setDraft(savedDraft);
                    save.reset();
                  }}
                >
                  {t('opportunities.pursuit.discard')}
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        <div className="tiq-stack">
          {save.error !== null && (
            <FormErrorSummary
              title={withPublicationMessage(save.error)?.detail ?? save.error.title}
              errors={
                withPublicationMessage(save.error, [
                  'attractiveness',
                  'capacityNote',
                  'estimatedEffortHours',
                  'risks',
                  'pursuitOwnerUserId',
                ])?.fieldErrors ?? []
              }
            />
          )}
          <div className="tiq-form-grid">
            <Select
              label={t('opportunities.pursuit.attractiveness')}
              placeholder={t('opportunities.pursuit.notRated')}
              value={draft.attractiveness}
              disabled={!canManage}
              onChange={(attractiveness) => setDraft({ ...draft, attractiveness })}
              options={['1', '2', '3', '4', '5'].map((value) => ({
                value,
                label: t(`opportunities.pursuit.rating.${value}`),
              }))}
              error={fieldMessage(save.error, 'attractiveness')}
            />
            <NumberInput
              label={t('opportunities.pursuit.effort')}
              places={0}
              suffix={t('opportunities.pursuit.hours')}
              value={draft.estimatedEffortHours}
              disabled={!canManage}
              onChange={(estimatedEffortHours) => setDraft({ ...draft, estimatedEffortHours })}
              error={
                fieldMessage(save.error, 'estimatedEffortHours') ??
                (effortInvalid ? t('opportunities.pursuit.effortInvalid') : undefined)
              }
            />
            <Select
              label={t('opportunities.pursuit.owner')}
              placeholder={t('opportunities.pursuit.noOwner')}
              value={draft.pursuitOwnerUserId}
              disabled={!canManage}
              onChange={(pursuitOwnerUserId) => setDraft({ ...draft, pursuitOwnerUserId })}
              options={ownerOptions}
              error={fieldMessage(save.error, 'pursuitOwnerUserId')}
            />
            <TextArea
              label={t('opportunities.pursuit.capacity')}
              rows={3}
              value={draft.capacityNote}
              disabled={!canManage}
              onChange={(capacityNote) => setDraft({ ...draft, capacityNote })}
              error={fieldMessage(save.error, 'capacityNote')}
              fieldClassName="tiq-form-full"
            />
            <TextArea
              label={t('opportunities.pursuit.risks')}
              rows={4}
              value={draft.risks}
              disabled={!canManage}
              onChange={(risks) => setDraft({ ...draft, risks })}
              error={fieldMessage(save.error, 'risks')}
              fieldClassName="tiq-form-full"
            />
          </div>
        </div>
      </Card>

      <Card
        flush
        title={t('opportunities.team.title', { count: pursuit?.team.length ?? 0 })}
        actions={
          canManage && pursuit !== null ? (
            <Button size="sm" icon="userPlus" onClick={() => setMemberDialog('new')}>
              {t('opportunities.team.add')}
            </Button>
          ) : undefined
        }
      >
        <DataTable
          caption={t('opportunities.team.caption')}
          columns={teamColumns}
          rows={pursuit?.team ?? []}
          rowKey={(member) => String(member.id)}
          empty={
            <EmptyState
              compact
              icon="users"
              title={
                pursuit === null
                  ? t('opportunities.team.startFirst')
                  : t('opportunities.team.empty')
              }
            />
          }
        />
      </Card>

      <Card title={t('opportunities.notes.title')} subtitle={t('opportunities.notes.intro')}>
        <div className="tiq-stack">
          {canManage && pursuit !== null && (
            <div className="tiq-stack">
              <TextArea
                label={t('opportunities.notes.new')}
                rows={3}
                value={note}
                onChange={setNote}
                error={fieldMessage(addNote.error, 'body')}
              />
              {addNote.error !== null && addNote.error.fieldErrors.length === 0 && (
                <span className="tiq-text-danger">
                  {withPublicationMessage(addNote.error)?.detail}
                </span>
              )}
              <div className="tiq-inline">
                <Button
                  icon="plus"
                  disabled={note.trim() === ''}
                  loading={addNote.pending}
                  onClick={() => void submitNote()}
                >
                  {t('opportunities.notes.add')}
                </Button>
              </div>
            </div>
          )}
          {pursuit === null || pursuit.notes.length === 0 ? (
            <EmptyState compact icon="messageSquare" title={t('opportunities.notes.empty')} />
          ) : (
            <ul className="tiq-stack tiq-stack--spaced">
              {pursuit.notes.map((item: PursuitNote) => (
                <li key={item.id} className="tiq-stack">
                  <span className="tiq-text-muted">
                    {t('opportunities.notes.meta', {
                      author: item.author.fullName,
                      at: formatDateTime(item.createdAt, timeZone),
                    })}
                  </span>
                  <span>{item.body}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {dialog === 'decision' && pursuit !== null && (
        <DecisionDialog
          open
          tender={tender}
          current={pursuit.decision}
          onClose={() => setDialog(null)}
          onDone={(next) => {
            setDialog(null);
            setPursuit(next);
            toast.show(t('opportunities.pursuit.decisionRecorded'), 'success');
          }}
        />
      )}
      {dialog === 'notify' && (
        <NotifyBuyerDialog
          open
          tender={tender}
          buyerName={view.buyer.name}
          suggested={pursuit?.decision === 'no_bid' ? 'no_bid' : 'intends_to_bid'}
          onClose={() => setDialog(null)}
          onDone={(intent) => {
            setDialog(null);
            setView((current) => ({ ...current, buyerVisible: intent }));
            toast.show(t('opportunities.pursuit.notified', { buyer: view.buyer.name }), 'success');
          }}
        />
      )}
      {memberDialog !== null && pursuit !== null && (
        <TeamMemberDialog
          open
          tender={tender}
          timeZone={timeZone}
          lots={view.lots}
          candidates={candidates.data?.items ?? []}
          member={memberDialog === 'new' ? null : memberDialog}
          existingUserIds={pursuit.team.map((member) => member.user.userId)}
          onClose={() => setMemberDialog(null)}
          onDone={(member) => {
            setMemberDialog(null);
            const exists = pursuit.team.some((item) => item.id === member.id);
            setPursuit({
              ...pursuit,
              team: exists
                ? pursuit.team.map((item) => (item.id === member.id ? member : item))
                : [...pursuit.team, member],
            });
            toast.show(t('opportunities.team.saved', { name: member.user.fullName }), 'success');
          }}
        />
      )}
      <ConfirmActionDialog
        open={removing !== null}
        tone="danger"
        title={t('opportunities.team.removeTitle')}
        scope={removing === null ? '' : `${tender.reference} · ${removing.user.fullName}`}
        consequence={t('opportunities.team.removeConsequence')}
        confirmLabel={t('opportunities.team.remove')}
        pending={removeMember.pending}
        error={withPublicationMessage(removeMember.error)}
        onCancel={() => {
          removeMember.reset();
          setRemoving(null);
        }}
        onConfirm={async () => {
          if (removing === null || pursuit === null) return;
          try {
            await removeMember.mutate({
              params: { tenderId: tender.tenderId, memberId: removing.id },
            });
            setPursuit({
              ...pursuit,
              team: pursuit.team.filter((item) => item.id !== removing.id),
            });
            toast.show(
              t('opportunities.team.removed', { name: removing.user.fullName }),
              'success',
            );
            setRemoving(null);
          } catch {
            // Shown in the dialog.
          }
        }}
      />
    </div>
  );
}

function BuyerIntent({
  intent,
  timeZone,
}: {
  readonly intent: BuyerVisibleIntent;
  readonly timeZone: string;
}) {
  if (intent.participantId === null) {
    return <p className="tiq-text-muted">{t('opportunities.pursuit.notParticipant')}</p>;
  }
  return (
    <div className="tiq-stack">
      <span className="tiq-inline">
        <StatusChip enum="participants.bid_intent" value={intent.bidIntent} />
      </span>
      {intent.sharedNoBidReason !== null && <span>{intent.sharedNoBidReason}</span>}
      {intent.intentChangedAt !== null && (
        <span className="tiq-text-muted">
          {t('opportunities.pursuit.sharedOn', {
            at: formatDateTime(intent.intentChangedAt, timeZone),
          })}
        </span>
      )}
    </div>
  );
}
