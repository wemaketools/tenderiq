/**
 * BUY-08 team and responsibilities (BR-01): the accountable owner, officers, evaluators, the evaluation chair,
 * reviewers, the opening officer and witnesses, per tender or per lot. Assigning checks that the member holds the
 * role's permission; the owner cannot be removed (only replaced); removals keep their history and reason.
 */
import { useState } from 'react';

import { TENDER_TEAM_MEMBERS_TEAM_ROLE } from '@contracts/enums';
import type { TenderTeamMembersTeamRole } from '@contracts/enums';
import {
  assignTeamMember,
  getTeamCandidates,
  getTenderTeam,
  removeTeamMember,
} from '@contracts/tenders';
import type { TeamChangeResult, TeamMember, TenderDetail } from '@contracts/tenders';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  EmptyState,
  Select,
  formErrors,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { withTenderMessage } from '../lib/errors';
import { lotLabel, scopeLabel } from '../lib/labels';
import { useOverlay } from '../lib/overlay';
import { FormDialog } from './FormDialog';
import { IssueList } from './IssueList';

/** Rendered only when the membership may read the tender team (`useCanCall(getTenderTeam)`, DD-49). */
export interface TeamCardProps {
  readonly tender: TenderDetail;
  readonly canEdit: boolean;
  readonly onOwnerChanged: (result: TeamChangeResult) => void;
}

export function TeamCard({ tender, canEdit, onOwnerChanged }: TeamCardProps) {
  const toast = useToast();
  const query = useApiQuery(getTenderTeam, { params: { tenderId: tender.id } });
  const overlay = useOverlay<TeamMember>();
  const [removedNow, setRemovedNow] = useState<TeamMember[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const remove = useApiMutation(removeTeamMember);
  const zone = tender.officialTimeZone;

  const members = query.data === undefined ? undefined : overlay.apply(query.data.members);
  const removed = [...removedNow, ...(query.data?.removed ?? [])];

  const onAssigned = (result: TeamChangeResult): void => {
    overlay.put(result.member);
    if (result.newOwner !== null) onOwnerChanged(result);
    toast.show(
      t('tender-authoring.team.assigned', {
        name: result.member.user.fullName,
        role: tEnum('tender_team_members.team_role', result.member.teamRole),
      }),
      'success',
    );
  };

  const confirmRemove = async ({ reason }: { readonly reason: string }): Promise<void> => {
    if (removing === null) return;
    try {
      const result = await remove.mutate({
        params: { tenderId: tender.id, memberId: removing.id },
        body: { reason },
      });
      overlay.remove(removing.id);
      setRemovedNow((current) => [result.member, ...current]);
      setRemoving(null);
      remove.reset();
      toast.show(
        t('tender-authoring.team.removed', { name: result.member.user.fullName }),
        'success',
      );
    } catch {
      // Shown in the dialog.
    }
  };

  const columns: DataTableColumn<TeamMember>[] = [
    {
      id: 'user',
      header: t('tender-authoring.team.col.member'),
      cell: (row) => (
        <>
          <span>{row.user.fullName}</span>
          <span className="tiq-cell-sub">{row.capacity ?? t('tender-authoring.common.none')}</span>
        </>
      ),
    },
    {
      id: 'role',
      header: t('tender-authoring.team.col.role'),
      cell: (row) => (
        <span className="tiq-inline">
          <StatusRole role={row.teamRole} />
          {row.conflictReviewPending && (
            <Chip tone="warning" size="sm" icon="alertTriangle">
              {t('tender-authoring.team.conflictPending')}
            </Chip>
          )}
        </span>
      ),
    },
    {
      id: 'scope',
      header: t('tender-authoring.team.col.scope'),
      cell: (row) => scopeLabel(row.lot),
    },
    {
      id: 'assigned',
      header: t('tender-authoring.team.col.assigned'),
      cell: (row) => (
        <>
          <span>{formatDateTime(row.assignedAt, zone)}</span>
          <span className="tiq-cell-sub">
            {row.assignedBy?.fullName ?? t('tender-authoring.common.none')}
          </span>
        </>
      ),
    },
    {
      id: 'actions',
      header: t('tender-authoring.common.actions'),
      cell: (row) =>
        canEdit && row.teamRole !== 'owner' ? (
          <Button size="sm" variant="ghost" icon="trash" onClick={() => setRemoving(row)}>
            {t('tender-authoring.team.remove')}
          </Button>
        ) : null,
    },
  ];

  // DD-49: a membership the server refuses the team to sees no team card at all.
  if (query.error?.kind === 'forbidden') return null;

  return (
    <Card
      title={t('tender-authoring.team.title')}
      subtitle={t('tender-authoring.team.subtitle')}
      actions={
        canEdit ? (
          <Button size="sm" icon="userPlus" onClick={() => setAssignOpen(true)}>
            {t('tender-authoring.team.assign')}
          </Button>
        ) : undefined
      }
    >
      {query.data !== undefined && (
        <div className="tiq-inline" aria-label={t('tender-authoring.team.coverage')}>
          {query.data.coverage
            .filter((row) => row.required || row.satisfied)
            .map((row) => (
              <Chip
                key={row.teamRole}
                size="sm"
                tone={row.satisfied ? 'success' : row.required ? 'danger' : 'neutral'}
                icon={row.satisfied ? 'checkCircle' : 'xCircle'}
              >
                {tEnum('tender_team_members.team_role', row.teamRole)}
                {row.required && !row.satisfied ? ` · ${t('tender-authoring.team.missing')}` : ''}
              </Chip>
            ))}
        </div>
      )}
      {query.data !== undefined && (
        <IssueList issues={query.data.issues} label={t('tender-authoring.team.issues')} />
      )}
      <DataTable
        caption={t('tender-authoring.team.caption')}
        columns={columns}
        rows={members}
        rowKey={(row) => String(row.id)}
        loading={query.isFetching}
        error={query.error}
        onRetry={query.reload}
        empty={<EmptyState compact icon="users" title={t('tender-authoring.team.empty')} />}
      />
      {removed.length > 0 && (
        <details>
          <summary>{t('tender-authoring.team.history', { count: removed.length })}</summary>
          <ul className="tiq-stack">
            {removed.map((row) => (
              <li key={`${row.id}-${row.removedAt ?? ''}`}>
                {t('tender-authoring.team.removedLine', {
                  name: row.user.fullName,
                  role: tEnum('tender_team_members.team_role', row.teamRole),
                  date: row.removedAt === null ? '' : formatDateTime(row.removedAt, zone),
                  reason: row.removalReason ?? t('tender-authoring.common.none'),
                })}
              </li>
            ))}
          </ul>
        </details>
      )}
      {canEdit && (
        <AssignMemberDialog
          open={assignOpen}
          tender={tender}
          onClose={() => setAssignOpen(false)}
          onAssigned={onAssigned}
        />
      )}
      <ConfirmActionDialog
        open={removing !== null}
        tone="danger"
        title={t('tender-authoring.team.removeTitle')}
        scope={
          removing === null
            ? ''
            : `${tender.reference} · ${removing.user.fullName} · ${tEnum('tender_team_members.team_role', removing.teamRole)}`
        }
        consequence={t('tender-authoring.team.removeResult')}
        confirmLabel={t('tender-authoring.team.remove')}
        reason={{ label: t('tender-authoring.common.reason'), required: true }}
        onConfirm={confirmRemove}
        onCancel={() => {
          setRemoving(null);
          remove.reset();
        }}
        pending={remove.pending}
        error={withTenderMessage(remove.error)}
      />
    </Card>
  );
}

function StatusRole({ role }: { readonly role: TenderTeamMembersTeamRole }) {
  return (
    <Chip tone={role === 'owner' ? 'accent' : 'neutral'} size="sm">
      {tEnum('tender_team_members.team_role', role)}
    </Chip>
  );
}

// ---------------------------------------------------------------------------------------------------------

interface AssignMemberDialogProps {
  readonly open: boolean;
  readonly tender: TenderDetail;
  readonly onClose: () => void;
  readonly onAssigned: (result: TeamChangeResult) => void;
}

function AssignMemberDialog({ open, tender, onClose, onAssigned }: AssignMemberDialogProps) {
  const [role, setRole] = useState('');
  const [user, setUser] = useState('');
  const [lot, setLot] = useState('');
  const [touched, setTouched] = useState(false);
  const mutation = useApiMutation(assignTeamMember);
  const candidates = useApiQuery(
    getTeamCandidates,
    open && role !== ''
      ? { params: { tenderId: tender.id }, query: { teamRole: role as TenderTeamMembersTeamRole } }
      : null,
  );
  const errors = formErrors(mutation.error, ['userId', 'teamRole', 'lotId']);

  const close = (): void => {
    setRole('');
    setUser('');
    setLot('');
    setTouched(false);
    mutation.reset();
    onClose();
  };

  const submit = async (): Promise<void> => {
    setTouched(true);
    if (role === '' || user === '') return;
    try {
      const result = await mutation.mutate({
        params: { tenderId: tender.id },
        body: {
          userId: Number(user),
          teamRole: role as TenderTeamMembersTeamRole,
          ...(lot === '' ? {} : { lotId: Number(lot) }),
        },
      });
      onAssigned(result);
      close();
    } catch {
      // Shown in the dialog.
    }
  };

  const options = (candidates.data?.candidates ?? []).map((row) => ({
    value: String(row.user.userId),
    label: row.eligible
      ? `${row.user.fullName}${row.capacity === null ? '' : ` · ${row.capacity}`}${row.alreadyAssigned ? ` · ${t('tender-authoring.team.alreadyAssigned')}` : ''}`
      : `${row.user.fullName} · ${row.ineligibleReason ?? t('tender-authoring.team.notEligible')}`,
    disabled: !row.eligible,
  }));

  return (
    <FormDialog
      open={open}
      title={t('tender-authoring.team.assignTitle')}
      description={t('tender-authoring.team.assignDescription')}
      submitLabel={t('tender-authoring.team.assign')}
      onSubmit={() => void submit()}
      onClose={close}
      pending={mutation.pending}
      error={mutation.error}
      otherErrors={errors.other}
    >
      <Select
        label={t('tender-authoring.team.role')}
        required
        placeholder={t('tender-authoring.common.select')}
        value={role}
        options={TENDER_TEAM_MEMBERS_TEAM_ROLE.map((value) => ({
          value,
          label: tEnum('tender_team_members.team_role', value),
        }))}
        onChange={(next) => {
          setRole(next);
          setUser('');
        }}
        hint={role === 'owner' ? t('tender-authoring.team.ownerHint') : undefined}
        error={
          errors.forField('teamRole') ??
          (touched && role === '' ? t('tender-authoring.create.required') : undefined)
        }
      />
      <Select
        label={t('tender-authoring.team.member')}
        required
        placeholder={
          role === ''
            ? t('tender-authoring.team.chooseRoleFirst')
            : candidates.data === undefined
              ? t('tender-authoring.common.loading')
              : t('tender-authoring.common.select')
        }
        value={user}
        options={options}
        onChange={setUser}
        disabled={role === '' || candidates.data === undefined}
        hint={
          candidates.data === undefined
            ? undefined
            : t('tender-authoring.team.requires', {
                permission: candidates.data.requiredPermission,
              })
        }
        error={
          errors.forField('userId') ??
          (touched && user === '' ? t('tender-authoring.create.required') : undefined)
        }
      />
      <Select
        label={t('tender-authoring.team.lot')}
        placeholder={t('tender-authoring.common.wholeTender')}
        value={lot}
        options={tender.lots.map((row) => ({ value: String(row.id), label: lotLabel(row) }))}
        onChange={setLot}
        error={errors.forField('lotId')}
      />
    </FormDialog>
  );
}
