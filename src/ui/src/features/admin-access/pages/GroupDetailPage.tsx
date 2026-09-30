/**
 * ADM-04 / SUP-04 — Group detail: members (added by whom and when), the roles the group carries with scope and
 * validity, and membership management (add a member, remove a member with a reason, deactivate the group; past
 * membership stays recorded). Adding yourself is refused (SELF_GRANT_FORBIDDEN).
 */
import { useState } from 'react';
import { Link, useLocation } from 'react-router';

import type { GroupDetail } from '@contracts/org-admin';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  EmptyState,
  PageHeader,
  QueryView,
  useToast,
} from '../../../components/ui';
import { formatInstantDate } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { AccessLayout } from '../components/AccessLayout';
import { AccessStatusChip, ScopeText } from '../components/AccessBits';
import { MemberSelect } from '../components/Pickers';
import { useMemberAdmin } from '../lib/audience';
import { dialogError } from '../lib/errors';
import { useIdParam, useOfficialTimeZone } from '../lib/hooks';

type Open =
  | { readonly kind: 'add' }
  | { readonly kind: 'remove'; readonly userId: number; readonly name: string }
  | { readonly kind: 'deactivate' };

function GroupView({ group: loaded }: { readonly group: GroupDetail }) {
  const admin = useMemberAdmin();
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const [group, setGroup] = useState<GroupDetail>(loaded);
  const [open, setOpen] = useState<Open | null>(null);
  const [userId, setUserId] = useState('');
  const [checked, setChecked] = useState(false);
  const add = useApiMutation(admin.endpoints.addGroupMember);
  const remove = useApiMutation(admin.endpoints.removeGroupMember);
  const deactivate = useApiMutation(admin.endpoints.deactivateGroup);
  const manage = admin.canManageRoles && group.active;

  const close = (): void => {
    setOpen(null);
    setUserId('');
    setChecked(false);
    add.reset();
    remove.reset();
    deactivate.reset();
  };
  const saved = (next: GroupDetail, message: string): void => {
    setGroup(next);
    close();
    toast.show(message, 'success');
  };

  return (
    <>
      <PageHeader
        title={group.name}
        subtitle={group.description ?? undefined}
        back={{ to: admin.paths.groups, label: t('admin-access.groups.title') }}
        meta={
          group.active ? (
            <Chip tone="success">{t('admin-access.common.active')}</Chip>
          ) : (
            <Chip tone="neutral-outlined">
              {group.deactivatedAt === null
                ? t('admin-access.common.inactive')
                : t('admin-access.groups.deactivatedOn', {
                    date: formatInstantDate(group.deactivatedAt, timeZone),
                  })}
            </Chip>
          )
        }
        primaryAction={
          manage ? (
            <Button variant="primary" icon="userPlus" onClick={() => setOpen({ kind: 'add' })}>
              {t('admin-access.groups.addMember')}
            </Button>
          ) : undefined
        }
        actions={
          manage ? (
            <Button
              variant="danger-soft"
              icon="ban"
              onClick={() => setOpen({ kind: 'deactivate' })}
            >
              {t('admin-access.groups.deactivate')}
            </Button>
          ) : undefined
        }
      />
      <div className="tiq-grid tiq-grid--2">
        <Card title={t('admin-access.groups.membersTitle', { count: group.members.length })} flush>
          <DataTable
            caption={t('admin-access.groups.membersTitle', { count: group.members.length })}
            rows={group.members}
            rowKey={(row) => String(row.userId)}
            empty={<EmptyState compact title={t('admin-access.groups.noMembers')} />}
            columns={[
              {
                id: 'name',
                header: t('admin-access.users.col.name'),
                cell: (row) => (
                  <>
                    <Link to={admin.paths.user(row.userId)}>{row.fullName}</Link>
                    <span className="tiq-cell-sub">{row.capacity ?? ''}</span>
                  </>
                ),
              },
              {
                id: 'added',
                header: t('admin-access.groups.col.added'),
                cell: (row) => (
                  <>
                    <span>{formatInstantDate(row.addedAt, timeZone)}</span>
                    <span className="tiq-cell-sub">{row.addedBy?.fullName ?? ''}</span>
                  </>
                ),
              },
              {
                id: 'actions',
                header: t('admin-access.common.actions'),
                cell: (row) =>
                  manage ? (
                    <div className="tiq-row-actions">
                      <Button
                        size="sm"
                        onClick={() =>
                          setOpen({ kind: 'remove', userId: row.userId, name: row.fullName })
                        }
                      >
                        {t('admin-access.groups.remove')}
                      </Button>
                    </div>
                  ) : (
                    '—'
                  ),
              },
            ]}
          />
        </Card>
        <Card
          title={t('admin-access.groups.rolesTitle')}
          subtitle={t('admin-access.groups.rolesIntro')}
          flush
        >
          <DataTable
            caption={t('admin-access.groups.rolesTitle')}
            rows={group.roleAssignments}
            rowKey={(row) => String(row.assignmentId)}
            empty={<EmptyState compact title={t('admin-access.groups.noRoles')} />}
            columns={[
              {
                id: 'role',
                header: t('admin-access.member.col.role'),
                cell: (row) => <Link to={admin.paths.role(row.role.roleId)}>{row.role.name}</Link>,
              },
              {
                id: 'scope',
                header: t('admin-access.member.col.scope'),
                cell: (row) => <ScopeText scope={row.scope} />,
              },
              {
                id: 'status',
                header: t('admin-access.member.col.status'),
                cell: (row) => <AccessStatusChip status={row.status} />,
              },
            ]}
          />
        </Card>
      </div>
      {open?.kind === 'add' && (
        <ConfirmActionDialog
          open
          title={t('admin-access.groups.addTitle')}
          scope={group.name}
          consequence={t('admin-access.groups.addConsequence', {
            roles: group.roles.map((role) => role.name).join(', ') || '—',
          })}
          confirmLabel={t('admin-access.groups.addMember')}
          pending={add.pending}
          error={dialogError(add.error, ['userId'])}
          onCancel={close}
          onConfirm={async () => {
            setChecked(true);
            if (userId === '') return;
            try {
              const next = await add.mutate({
                params: { groupId: group.groupId },
                body: { userId: Number(userId) },
              });
              saved(next, t('admin-access.groups.added'));
            } catch {
              // Shown in the dialog.
            }
          }}
        >
          <MemberSelect
            label={t('admin-access.groups.person')}
            value={userId}
            onChange={setUserId}
            exclude={group.members.map((member) => member.userId)}
            error={checked && userId === '' ? t('admin-access.common.personRequired') : undefined}
            required
          />
        </ConfirmActionDialog>
      )}
      {open?.kind === 'remove' && (
        <ConfirmActionDialog
          open
          tone="danger"
          title={t('admin-access.groups.removeTitle')}
          scope={t('admin-access.groups.removeScope', { name: open.name, group: group.name })}
          consequence={t('admin-access.groups.removeConsequence')}
          confirmLabel={t('admin-access.groups.remove')}
          reason={{ label: t('admin-access.common.reason'), required: true }}
          pending={remove.pending}
          error={dialogError(remove.error, [])}
          onCancel={close}
          onConfirm={async ({ reason }) => {
            try {
              const next = await remove.mutate({
                params: { groupId: group.groupId, userId: open.userId },
                body: { reason },
              });
              saved(next, t('admin-access.groups.removed'));
            } catch {
              // Shown in the dialog.
            }
          }}
        />
      )}
      {open?.kind === 'deactivate' && (
        <ConfirmActionDialog
          open
          tone="danger"
          title={t('admin-access.groups.deactivateTitle')}
          scope={group.name}
          consequence={t('admin-access.groups.deactivateConsequence')}
          confirmLabel={t('admin-access.groups.deactivate')}
          reason={{ label: t('admin-access.common.reason'), required: true }}
          pending={deactivate.pending}
          error={dialogError(deactivate.error, [])}
          onCancel={close}
          onConfirm={async ({ reason }) => {
            try {
              const next = await deactivate.mutate({
                params: { groupId: group.groupId },
                body: { reason },
              });
              saved(next, t('admin-access.groups.deactivated'));
            } catch {
              // Shown in the dialog.
            }
          }}
        />
      )}
    </>
  );
}

export default function GroupDetailPage() {
  const admin = useMemberAdmin();
  const groupId = useIdParam('groupId');
  const location = useLocation();
  const seeded = (location.state as { readonly record?: GroupDetail } | null)?.record;
  const fromCommand = seeded !== undefined && seeded.groupId === groupId ? seeded : null;
  const query = useApiQuery(
    admin.endpoints.getGroup,
    groupId === null || fromCommand !== null ? null : { params: { groupId } },
  );
  return (
    <AccessLayout>
      {groupId === null ? (
        <EmptyState title={t('admin-access.groups.notFound')} />
      ) : fromCommand !== null ? (
        <GroupView group={fromCommand} />
      ) : (
        <QueryView query={query}>
          {(group) => <GroupView key={group.groupId} group={group} />}
        </QueryView>
      )}
    </AccessLayout>
  );
}
