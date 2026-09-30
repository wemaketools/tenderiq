/**
 * ADM-03 — User detail (buyers) and SUP-04 — Supplier member detail: memberships, roles with scope, direct grants,
 * restrictions, delegations and authority limits, invitations, outstanding work and the history that stays
 * attributed (BR-38). Lifecycle actions follow the member's state and the administrator's permissions: invite
 * again, activate, approve or reject a membership request, suspend, deactivate with reassignment (AC-04), recover
 * a membership, reassign responsibilities, assign or end a scoped role. Suppliers also see tender assignments.
 */
import { useState } from 'react';
import { Link } from 'react-router';

import type {
  LifecycleEffects,
  MemberAction,
  MemberDetail,
  MemberRow,
  RoleAssignmentRow,
} from '@contracts/org-admin';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  Chip,
  DataTable,
  DetailList,
  EmptyState,
  MoneyText,
  OfficialDeadline,
  OverdueChip,
  PageHeader,
  QueryView,
  StatusChip,
  Tabs,
  Timeline,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatDateTime, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { AccessLayout } from '../components/AccessLayout';
import { AccessStatusChip, PersonCell, ScopeText } from '../components/AccessBits';
import { EffectiveAccessCard } from '../components/EffectiveAccessCard';
import { MemberCommandDialog, RevokeRoleDialog } from '../components/MemberDialogs';
import type { MemberCommand } from '../components/MemberDialogs';
import { DeactivateDialog, ReassignWorkDialog } from '../components/WorkDialogs';
import { afterDeactivation, afterReassignment, endLiveAssignments } from '../lib/lifecycle';
import { useMemberAdmin } from '../lib/audience';
import { useIdParam } from '../lib/hooks';
import { BUYER_GRANTS_READ } from '../lib/permissions';

type Tab = 'access' | 'work' | 'authority' | 'assignments' | 'invitations' | 'history';
type Open = MemberCommand | 'deactivate' | 'reassignWork' | null;

const LIFECYCLE_ACTIONS: readonly MemberAction[] = [
  'edit',
  'activate',
  'approveMembership',
  'rejectMembership',
  'suspend',
  'recover',
  'reassignWork',
  'deactivate',
];

function nextAction(member: MemberDetail): { tone: 'info' | 'warning'; text: string } | null {
  if (member.membershipStatus === 'pending_approval') {
    return { tone: 'warning', text: t('admin-access.member.next.pendingApproval') };
  }
  if (member.membershipStatus === 'invited') {
    return { tone: 'info', text: t('admin-access.member.next.invited') };
  }
  if (member.membershipStatus !== 'active' && member.openWork.length > 0) {
    return { tone: 'warning', text: t('admin-access.member.next.reassign') };
  }
  if (member.membershipStatus === 'suspended') {
    return { tone: 'warning', text: t('admin-access.member.next.suspended') };
  }
  return null;
}

function EffectsBanner({
  effects,
  message,
  onDismiss,
}: {
  readonly effects: LifecycleEffects | null;
  readonly message: string;
  readonly onDismiss: () => void;
}) {
  return (
    <Banner
      tone="success"
      title={message}
      actions={
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          {t('admin-access.common.dismiss')}
        </Button>
      }
    >
      {effects !== null && (
        <p>
          {t('admin-access.member.effects', {
            work: effects.reassignedWorkItems,
            delegations: effects.endedDelegations,
            grants: effects.endedGrants,
            roles: effects.endedRoleAssignments,
            history: effects.retainedHistoryRecords,
          })}
        </p>
      )}
    </Banner>
  );
}

function AccessTab({
  member,
  assignments,
  canManageRoles,
  onRevoke,
}: {
  readonly member: MemberDetail;
  readonly assignments: readonly RoleAssignmentRow[];
  readonly canManageRoles: boolean;
  readonly onRevoke: (row: RoleAssignmentRow) => void;
}) {
  const { kind } = useMemberAdmin();
  const timeZone = useActiveTenant()?.officialTimeZone ?? 'UTC';
  const canReview = usePermission(BUYER_GRANTS_READ);
  const columns: DataTableColumn<RoleAssignmentRow>[] = [
    {
      id: 'role',
      header: t('admin-access.member.col.role'),
      cell: (row) => (
        <PersonCell
          name={row.role.name}
          sub={
            row.viaGroup === null
              ? t('admin-access.member.direct')
              : t('admin-access.member.viaGroup', { group: row.viaGroup.name })
          }
        />
      ),
    },
    {
      id: 'scope',
      header: t('admin-access.member.col.scope'),
      cell: (row) => <ScopeText scope={row.scope} />,
    },
    {
      id: 'dates',
      header: t('admin-access.member.col.dates'),
      cell: (row) => (
        <>
          <span>{formatInstantDate(row.startsAt, timeZone)}</span>
          <span className="tiq-cell-sub">
            {row.endsAt === null
              ? t('admin-access.common.openEnded')
              : t('admin-access.common.until', { date: formatInstantDate(row.endsAt, timeZone) })}
          </span>
        </>
      ),
    },
    {
      id: 'grantedBy',
      header: t('admin-access.member.col.grantedBy'),
      cell: (row) => <PersonCell name={row.grantedBy?.fullName ?? '—'} sub={row.reason} />,
    },
    {
      id: 'status',
      header: t('admin-access.member.col.status'),
      cell: (row) => <AccessStatusChip status={row.status} />,
    },
    {
      id: 'actions',
      header: t('admin-access.common.actions'),
      cell: (row) =>
        canManageRoles &&
        row.viaGroup === null &&
        row.status !== 'revoked' &&
        row.status !== 'expired' ? (
          <div className="tiq-row-actions">
            <Button size="sm" onClick={() => onRevoke(row)}>
              {t('admin-access.member.endRole')}
            </Button>
          </div>
        ) : (
          '—'
        ),
    },
  ];
  return (
    <div className="tiq-stack">
      <Card
        title={t('admin-access.member.rolesTitle')}
        subtitle={t('admin-access.member.rolesIntro')}
        flush
      >
        <DataTable
          caption={t('admin-access.member.rolesTitle')}
          columns={columns}
          rows={assignments}
          rowKey={(row) => String(row.assignmentId)}
          empty={<EmptyState compact title={t('admin-access.member.noRoles')} />}
        />
      </Card>
      {kind === 'buyer' && (
        <div className="tiq-grid tiq-grid--2">
          <Card
            title={t('admin-access.member.grantsTitle')}
            subtitle={t('admin-access.member.grantsIntro')}
          >
            {member.directGrants.length === 0 ? (
              <EmptyState compact title={t('admin-access.member.noGrants')} />
            ) : (
              <ul className="tiq-stack">
                {member.directGrants.map((grant) => (
                  <li key={grant.grantId} className="tiq-stack">
                    <span className="tiq-inline">
                      <span className="tiq-mono">{grant.permissionCode}</span>
                      <AccessStatusChip status={grant.status} />
                    </span>
                    <span className="tiq-cell-sub">
                      {t('admin-access.member.grantLine', {
                        scope: grant.scope.scopeLabel,
                        owner: grant.owner.fullName,
                        expires: formatInstantDate(grant.expiresAt, timeZone),
                      })}
                    </span>
                    <span className="tiq-cell-sub">{grant.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card
            title={t('admin-access.member.restrictionsTitle')}
            subtitle={t('admin-access.member.restrictionsIntro')}
          >
            {member.restrictions.length === 0 ? (
              <EmptyState compact title={t('admin-access.member.noRestrictions')} />
            ) : (
              <ul className="tiq-stack">
                {member.restrictions.map((restriction) => (
                  <li key={restriction.restrictionId} className="tiq-stack">
                    <span className="tiq-inline">
                      <StatusChip
                        enum="access_restrictions.restriction_type"
                        value={restriction.restrictionType}
                        size="sm"
                      />
                      <AccessStatusChip status={restriction.status} />
                    </span>
                    <span className="tiq-cell-sub">
                      {restriction.permissionCode ?? t('admin-access.restrictions.allPermissions')}{' '}
                      · {restriction.scope.scopeLabel}
                    </span>
                    <span className="tiq-cell-sub">{restriction.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
      {kind === 'buyer' && canReview && member.membershipStatus !== 'invited' && (
        <EffectiveAccessCard userId={member.userId} />
      )}
    </div>
  );
}

function WorkTab({ member }: { readonly member: MemberDetail }) {
  const timeZone = useActiveTenant()?.officialTimeZone ?? 'UTC';
  if (member.openWork.length === 0) {
    return (
      <EmptyState
        title={t('admin-access.member.noWork')}
        description={t('admin-access.member.noWorkHint')}
      />
    );
  }
  return (
    <Card flush>
      <DataTable
        caption={t('admin-access.member.workTitle')}
        rows={member.openWork}
        rowKey={(row) => String(row.workItemId)}
        columns={[
          {
            id: 'title',
            header: t('admin-access.member.col.work'),
            cell: (row) => (
              <>
                <span>
                  {row.reference !== null && <span className="tiq-ref">{row.reference} </span>}
                  {row.title}
                </span>
                <span className="tiq-cell-sub">{t(`admin-access.workKind.${row.kind}`)}</span>
              </>
            ),
          },
          {
            id: 'due',
            header: t('admin-access.member.col.due'),
            cell: (row) =>
              row.dueAt === null ? (
                '—'
              ) : (
                <span className="tiq-inline">
                  <OfficialDeadline deadline={{ at: row.dueAt, timeZone }} showLocal={false} />
                  {row.isOverdue && <OverdueChip />}
                </span>
              ),
          },
          {
            id: 'reassign',
            header: t('admin-access.member.col.reassignment'),
            cell: (row) =>
              row.requiresReassignment ? (
                <Chip tone="warning" size="sm">
                  {t('admin-access.member.mustReassign')}
                </Chip>
              ) : (
                <Chip tone="neutral-outlined" size="sm">
                  {t('admin-access.member.mayLapse')}
                </Chip>
              ),
          },
        ]}
      />
    </Card>
  );
}

function AuthorityTab({ member }: { readonly member: MemberDetail }) {
  const timeZone = useActiveTenant()?.officialTimeZone ?? 'UTC';
  const delegations = [
    ...member.delegationsGiven.map((row) => ({ row, direction: 'given' as const })),
    ...member.delegationsReceived.map((row) => ({ row, direction: 'received' as const })),
  ];
  return (
    <div className="tiq-stack">
      {member.supplierAuthority !== null && (
        <Card title={t('admin-access.member.supplierAuthority')}>
          <DetailList
            items={[
              {
                key: 'submit',
                label: t('admin-access.authority.canSubmit'),
                value: member.supplierAuthority.canSubmit
                  ? t('admin-access.common.yes')
                  : t('admin-access.common.no'),
              },
              {
                key: 'approve',
                label: t('admin-access.authority.canApprove'),
                value: member.supplierAuthority.canApprove
                  ? t('admin-access.common.yes')
                  : t('admin-access.common.no'),
              },
              {
                key: 'price',
                label: t('admin-access.authority.canPrice'),
                value: member.supplierAuthority.canPrice
                  ? t('admin-access.common.yes')
                  : t('admin-access.common.no'),
              },
              {
                key: 'limit',
                label: t('admin-access.authority.signingLimit'),
                value:
                  member.supplierAuthority.signingLimit === null ? null : (
                    <MoneyText value={member.supplierAuthority.signingLimit} />
                  ),
              },
            ]}
          />
        </Card>
      )}
      <Card title={t('admin-access.member.limitsTitle')} flush>
        <DataTable
          caption={t('admin-access.member.limitsTitle')}
          rows={member.authorityLimits}
          rowKey={(row) => String(row.limitId)}
          empty={<EmptyState compact title={t('admin-access.member.noLimits')} />}
          columns={[
            {
              id: 'decision',
              header: t('admin-access.member.col.decision'),
              cell: (row) => tEnum('authority_limits.decision_type', row.decisionType),
            },
            {
              id: 'max',
              header: t('admin-access.member.col.max'),
              numeric: true,
              cell: (row) =>
                row.maxAmount === null ? (
                  t('admin-access.common.unlimited')
                ) : (
                  <MoneyText value={row.maxAmount} />
                ),
            },
            {
              id: 'effective',
              header: t('admin-access.member.col.effective'),
              cell: (row) => (
                <>
                  <span>{formatInstantDate(row.effectiveFrom, timeZone)}</span>
                  <span className="tiq-cell-sub">
                    {row.effectiveTo === null
                      ? t('admin-access.common.openEnded')
                      : t('admin-access.common.until', {
                          date: formatInstantDate(row.effectiveTo, timeZone),
                        })}
                  </span>
                </>
              ),
            },
            {
              id: 'status',
              header: t('admin-access.member.col.status'),
              cell: (row) => <AccessStatusChip status={row.status} />,
            },
          ]}
        />
      </Card>
      <Card
        title={t('admin-access.member.delegationsTitle')}
        subtitle={t('admin-access.member.delegationsIntro')}
        flush
      >
        <DataTable
          caption={t('admin-access.member.delegationsTitle')}
          rows={delegations}
          rowKey={(entry) => `${entry.direction}-${entry.row.delegationId}`}
          empty={<EmptyState compact title={t('admin-access.member.noDelegations')} />}
          columns={[
            {
              id: 'direction',
              header: t('admin-access.member.col.direction'),
              cell: (entry) =>
                entry.direction === 'given'
                  ? t('admin-access.member.delegatedTo', { name: entry.row.delegate.fullName })
                  : t('admin-access.member.delegatedFrom', { name: entry.row.delegator.fullName }),
            },
            {
              id: 'decisions',
              header: t('admin-access.member.col.decisions'),
              cell: (entry) =>
                entry.row.decisionTypes
                  .map((value) => tEnum('authority_limits.decision_type', value))
                  .join(', '),
            },
            {
              id: 'cap',
              header: t('admin-access.member.col.max'),
              numeric: true,
              cell: (entry) =>
                entry.row.maxAmount === null ? (
                  t('admin-access.common.unlimited')
                ) : (
                  <MoneyText value={entry.row.maxAmount} />
                ),
            },
            {
              id: 'dates',
              header: t('admin-access.member.col.dates'),
              cell: (entry) => (
                <>
                  <span>{formatInstantDate(entry.row.startsAt, timeZone)}</span>
                  <span className="tiq-cell-sub">
                    {t('admin-access.common.until', {
                      date: formatInstantDate(entry.row.endsAt, timeZone),
                    })}
                  </span>
                </>
              ),
            },
            {
              id: 'status',
              header: t('admin-access.member.col.status'),
              cell: (entry) => <AccessStatusChip status={entry.row.status} />,
            },
          ]}
        />
      </Card>
    </div>
  );
}

function AssignmentsTab({ member }: { readonly member: MemberDetail }) {
  const timeZone = useActiveTenant()?.officialTimeZone ?? 'UTC';
  return (
    <Card flush>
      <DataTable
        caption={t('admin-access.member.assignmentsTitle')}
        rows={member.tenderAssignments}
        rowKey={(row) => String(row.assignmentId)}
        empty={<EmptyState compact title={t('admin-access.member.noAssignments')} />}
        columns={[
          {
            id: 'tender',
            header: t('admin-access.assignments.col.tender'),
            cell: (row) => (
              <>
                <span>
                  <span className="tiq-ref">{row.tender.reference}</span> {row.tender.title}
                </span>
                <span className="tiq-cell-sub">{row.tender.buyerName}</span>
              </>
            ),
          },
          {
            id: 'responsibility',
            header: t('admin-access.assignments.col.responsibility'),
            cell: (row) => tEnum('pursuit_team_members.responsibility', row.responsibility),
          },
          {
            id: 'sections',
            header: t('admin-access.assignments.col.sections'),
            cell: (row) =>
              row.sectionScope.length === 0
                ? t('admin-access.assignments.allSections')
                : row.sectionScope.join(', '),
          },
          {
            id: 'pricing',
            header: t('admin-access.assignments.col.pricing'),
            cell: (row) =>
              row.canViewPricing ? t('admin-access.common.yes') : t('admin-access.common.no'),
          },
          {
            id: 'due',
            header: t('admin-access.assignments.col.due'),
            cell: (row) =>
              row.dueAt === null ? (
                '—'
              ) : (
                <OfficialDeadline deadline={{ at: row.dueAt, timeZone }} showLocal={false} />
              ),
          },
          {
            id: 'status',
            header: t('admin-access.member.col.status'),
            cell: (row) =>
              row.active ? (
                <Chip tone="success" size="sm">
                  {t('admin-access.common.active')}
                </Chip>
              ) : (
                <Chip tone="neutral-outlined" size="sm">
                  {t('admin-access.common.ended')}
                </Chip>
              ),
          },
        ]}
      />
    </Card>
  );
}

function InvitationsTab({ member }: { readonly member: MemberDetail }) {
  const timeZone = useActiveTenant()?.officialTimeZone ?? 'UTC';
  return (
    <Card flush>
      <DataTable
        caption={t('admin-access.member.invitationsTitle')}
        rows={member.invitations}
        rowKey={(row) => String(row.invitationId)}
        empty={<EmptyState compact title={t('admin-access.member.noInvitations')} />}
        columns={[
          {
            id: 'status',
            header: t('admin-access.invitations.col.status'),
            cell: (row) => <StatusChip enum="invitations.status" value={row.status} size="sm" />,
          },
          {
            id: 'capacity',
            header: t('admin-access.invitations.col.capacity'),
            cell: (row) => (
              <PersonCell
                name={row.capacity ?? '—'}
                sub={row.roles.map((role) => role.name).join(', ')}
              />
            ),
          },
          {
            id: 'created',
            header: t('admin-access.invitations.col.created'),
            cell: (row) => (
              <PersonCell
                name={formatInstantDate(row.createdAt, timeZone)}
                sub={row.invitedBy?.fullName ?? null}
              />
            ),
          },
          {
            id: 'expires',
            header: t('admin-access.invitations.col.expires'),
            cell: (row) =>
              row.acceptedAt !== null ? (
                t('admin-access.invitations.acceptedOn', {
                  date: formatInstantDate(row.acceptedAt, timeZone),
                })
              ) : (
                <OfficialDeadline deadline={{ at: row.expiresAt, timeZone }} showLocal={false} />
              ),
          },
        ]}
      />
    </Card>
  );
}

function HistoryTab({ member }: { readonly member: MemberDetail }) {
  const timeZone = useActiveTenant()?.officialTimeZone ?? 'UTC';
  return (
    <Card
      title={t('admin-access.member.historyTitle')}
      subtitle={t('admin-access.member.historyIntro')}
    >
      {member.attributedHistory.length === 0 ? (
        <EmptyState compact title={t('admin-access.member.noHistory')} />
      ) : (
        <Timeline
          label={t('admin-access.member.historyTitle')}
          items={member.attributedHistory.map((record, index) => ({
            id: `${record.reference}-${index}`,
            title: `${record.reference} · ${record.description}`,
            meta: formatDateTime(record.occurredAt, timeZone),
            detail: `${t(`admin-access.recordKind.${record.kind}`)}${record.capacity === null ? '' : ` · ${t('admin-access.member.actedAs', { capacity: record.capacity })}`}`,
            tone: 'neutral',
            icon: 'history',
          }))}
        />
      )}
    </Card>
  );
}

function MemberView({ member: loaded }: { readonly member: MemberDetail }) {
  const admin = useMemberAdmin();
  const tenant = useActiveTenant();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('access');
  const [open, setOpen] = useState<Open>(null);
  const [row, setRow] = useState<MemberRow | null>(null);
  const [detail, setDetail] = useState<MemberDetail>(loaded);
  const [assignments, setAssignments] = useState<readonly RoleAssignmentRow[]>(
    loaded.roleAssignments,
  );
  const [revoking, setRevoking] = useState<RoleAssignmentRow | null>(null);
  const [outcome, setOutcome] = useState<{
    message: string;
    effects: LifecycleEffects | null;
  } | null>(null);
  const member: MemberDetail = row === null ? detail : { ...detail, ...row };
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const actions = row === null ? loaded.availableActions : [];
  const allowed = (action: MemberAction): boolean =>
    actions.includes(action) &&
    (action === 'assignRole' ? admin.canManageRoles : admin.canManageUsers);
  const next = nextAction(member);

  const done = (message: string, effects: LifecycleEffects | null): void => {
    setOpen(null);
    setOutcome({ message, effects });
    toast.show(message, 'success');
  };

  const tabs = [
    { id: 'access', label: t('admin-access.member.tab.access') },
    { id: 'work', label: t('admin-access.member.tab.work'), count: member.openWork.length },
    { id: 'authority', label: t('admin-access.member.tab.authority') },
    ...(admin.kind === 'supplier'
      ? [
          {
            id: 'assignments',
            label: t('admin-access.member.tab.assignments'),
            count: member.tenderAssignments.length,
          },
        ]
      : []),
    {
      id: 'invitations',
      label: t('admin-access.member.tab.invitations'),
      count: member.invitations.length,
    },
    {
      id: 'history',
      label: t('admin-access.member.tab.history'),
      count: member.attributedHistory.length,
    },
  ];

  return (
    <>
      <PageHeader
        title={member.fullName}
        subtitle={member.email}
        back={{
          to: admin.paths.users,
          label:
            admin.kind === 'buyer'
              ? t('admin-access.users.title')
              : t('admin-access.users.supplierTitle'),
        }}
        meta={
          <span className="tiq-inline">
            <StatusChip enum="memberships.status" value={member.membershipStatus} />
            {member.userStatus !== 'active' && (
              <StatusChip enum="users.status" value={member.userStatus} />
            )}
            {member.capacity !== null && <span>{member.capacity}</span>}
          </span>
        }
        primaryAction={
          allowed('assignRole') ? (
            <Button variant="primary" icon="plus" onClick={() => setOpen('assignRole')}>
              {t('admin-access.member.assignRole')}
            </Button>
          ) : undefined
        }
        actions={
          <>
            {LIFECYCLE_ACTIONS.filter(allowed).map((action) => (
              <Button
                key={action}
                variant={
                  action === 'deactivate' || action === 'rejectMembership' || action === 'suspend'
                    ? 'danger-soft'
                    : 'secondary'
                }
                icon={ACTION_ICONS[action]}
                onClick={() => setOpen(action as Open)}
              >
                {t(`admin-access.member.action.${action}`)}
              </Button>
            ))}
          </>
        }
      />
      {outcome !== null && (
        <EffectsBanner
          effects={outcome.effects}
          message={outcome.message}
          onDismiss={() => setOutcome(null)}
        />
      )}
      {next !== null && (
        <Banner tone={next.tone} title={t('admin-access.member.nextTitle')}>
          <p>{next.text}</p>
        </Banner>
      )}
      <Card title={t('admin-access.member.summary')}>
        <DetailList
          items={[
            { key: 'org', label: t('admin-access.member.organization'), value: tenant?.name },
            { key: 'capacity', label: t('admin-access.invite.capacity'), value: member.capacity },
            {
              key: 'membership',
              label: t('admin-access.member.membership'),
              value: tEnum('memberships.status', member.membershipStatus),
            },
            {
              key: 'account',
              label: t('admin-access.member.account'),
              value: tEnum('users.status', member.userStatus),
            },
            {
              key: 'joined',
              label: t('admin-access.users.col.joined'),
              value: member.joinedAt === null ? null : formatInstantDate(member.joinedAt, timeZone),
            },
            {
              key: 'lastSeen',
              label: t('admin-access.users.col.lastSeen'),
              value:
                member.lastSeenAt === null ? null : formatDateTime(member.lastSeenAt, timeZone),
            },
            {
              key: 'groups',
              label: t('admin-access.member.groups'),
              value:
                member.groups.length === 0
                  ? null
                  : member.groups.map((group) => group.name).join(', '),
            },
            {
              key: 'work',
              label: t('admin-access.users.col.work'),
              value: formatCount(member.openWorkCount),
            },
            ...(member.endedAt === null
              ? []
              : [
                  {
                    key: 'ended',
                    label: t('admin-access.member.ended'),
                    value: `${formatInstantDate(member.endedAt, timeZone)}${member.endReason === null ? '' : ` · ${member.endReason}`}`,
                  },
                ]),
          ]}
        />
      </Card>
      <Tabs
        label={t('admin-access.member.tabs')}
        selected={tab}
        onSelect={(id) => setTab(id as Tab)}
        tabs={tabs}
      >
        {tab === 'access' && (
          <AccessTab
            member={member}
            assignments={assignments}
            canManageRoles={admin.canManageRoles && row === null}
            onRevoke={setRevoking}
          />
        )}
        {tab === 'work' && (
          <div className="tiq-stack">
            {allowed('reassignWork') && (
              <div className="tiq-inline">
                <Button icon="repeat" onClick={() => setOpen('reassignWork')}>
                  {t('admin-access.member.action.reassignWork')}
                </Button>
              </div>
            )}
            <WorkTab member={member} />
          </div>
        )}
        {tab === 'authority' && <AuthorityTab member={member} />}
        {tab === 'assignments' && <AssignmentsTab member={member} />}
        {tab === 'invitations' && <InvitationsTab member={member} />}
        {tab === 'history' && <HistoryTab member={member} />}
      </Tabs>
      {admin.kind === 'buyer' && (
        <p className="tiq-text-muted">
          <Link to={admin.paths.roles}>{t('admin-access.member.rolesLink')}</Link>
        </p>
      )}
      {open !== null && open !== 'deactivate' && open !== 'reassignWork' && (
        <MemberCommandDialog
          command={open}
          member={member}
          onClose={() => setOpen(null)}
          onLifecycle={(result, message) => {
            setRow(result.member);
            done(message, result.effects);
          }}
          onMember={(updated, message) => {
            setRow(updated);
            done(message, null);
          }}
          onAssignment={(assignment, message) => {
            setAssignments([assignment, ...assignments]);
            done(message, null);
          }}
        />
      )}
      {open === 'deactivate' && (
        <DeactivateDialog
          member={member}
          onClose={() => setOpen(null)}
          onDone={(result, endedAt) => {
            setDetail(afterDeactivation(member, result, endedAt));
            setAssignments(endLiveAssignments(assignments, endedAt));
            setRow(result.member);
            done(t('admin-access.deactivate.done', { name: member.fullName }), result.effects);
          }}
        />
      )}
      {open === 'reassignWork' && (
        <ReassignWorkDialog
          member={member}
          onClose={() => setOpen(null)}
          onDone={(result, workItemIds) => {
            const updated = afterReassignment(member, result, workItemIds);
            setDetail(updated);
            setRow({ ...result.member, openWorkCount: updated.openWorkCount });
            done(t('admin-access.reassign.done'), result.effects);
          }}
        />
      )}
      {revoking !== null && (
        <RevokeRoleDialog
          member={member}
          assignment={revoking}
          onClose={() => setRevoking(null)}
          onRevoked={(ended) => {
            setAssignments(
              assignments.map((item) => (item.assignmentId === ended.assignmentId ? ended : item)),
            );
            setRevoking(null);
            done(t('admin-access.member.revokeRole.done', { role: ended.role.name }), null);
          }}
        />
      )}
    </>
  );
}

const ACTION_ICONS = {
  edit: 'edit',
  activate: 'play',
  approveMembership: 'userCheck',
  rejectMembership: 'xCircle',
  suspend: 'pause',
  recover: 'refresh',
  reassignWork: 'repeat',
  deactivate: 'ban',
  assignRole: 'plus',
} as const;

export default function UserDetailPage() {
  const admin = useMemberAdmin();
  const userId = useIdParam('userId');
  const query = useApiQuery(
    admin.endpoints.getMember,
    userId === null ? null : { params: { userId } },
  );
  return (
    <AccessLayout>
      {userId === null ? (
        <EmptyState title={t('admin-access.member.notFound')} />
      ) : (
        <QueryView query={query}>
          {(member) => <MemberView key={member.userId} member={member} />}
        </QueryView>
      )}
    </AccessLayout>
  );
}
