/**
 * The member lifecycle and role commands of ADM-03 / SUP-04 (FR-03), each confirmed with the acting organization,
 * capacity, scope and result (COM-02): edit capacity, activate (lift a suspension), approve or reject a membership
 * request, suspend, recover a revoked membership, assign a scoped role, and end a role assignment. Business errors
 * (SELF_GRANT_FORBIDDEN, LAST_ADMINISTRATOR, ROLE_NOT_GRANTABLE, SOD_CONFLICT…) are explained in the dialog.
 */
import { useState } from 'react';

import type {
  LifecycleResult,
  MemberDetail,
  MemberRow,
  RoleAssignmentRow,
} from '@contracts/org-admin';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import {
  ConfirmActionDialog,
  DateTimeInput,
  MultiSelect,
  Select,
  TextField,
  formErrors,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { useMemberAdmin } from '../lib/audience';
import { dialogError } from '../lib/errors';
import { ORGANIZATION_SCOPE } from '../lib/scope';
import type { ScopeValue } from '../lib/scope';
import { ScopeInput } from './Pickers';

export type MemberCommand =
  | 'edit'
  | 'activate'
  | 'approveMembership'
  | 'rejectMembership'
  | 'suspend'
  | 'recover'
  | 'assignRole';

interface CommandProps {
  readonly member: MemberDetail;
  readonly onClose: () => void;
  readonly onLifecycle: (result: LifecycleResult, message: string) => void;
  readonly onMember: (row: MemberRow, message: string) => void;
  readonly onAssignment: (row: RoleAssignmentRow, message: string) => void;
}

function useActiveRoles(open: boolean) {
  const { endpoints } = useMemberAdmin();
  return useApiQuery(
    endpoints.listRoles,
    open ? { query: { active: true, sort: 'name', pageSize: 100 } } : null,
  );
}

function EditCapacityDialog({ member, onClose, onMember }: CommandProps) {
  const { endpoints } = useMemberAdmin();
  const [capacity, setCapacity] = useState(member.capacity ?? '');
  const update = useApiMutation(endpoints.updateMember);
  const invalid = capacity.trim().length < 2;
  return (
    <ConfirmActionDialog
      open
      title={t('admin-access.member.edit.title')}
      scope={member.fullName}
      consequence={t('admin-access.member.edit.consequence')}
      confirmLabel={t('admin-access.member.edit.confirm')}
      pending={update.pending}
      error={dialogError(update.error, ['capacity'])}
      onCancel={onClose}
      onConfirm={async () => {
        if (invalid) return;
        try {
          const row = await update.mutate({
            params: { userId: member.userId },
            body: { capacity: capacity.trim() },
          });
          onMember(row, t('admin-access.member.edit.done'));
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <TextField
        label={t('admin-access.invite.capacity')}
        hint={t('admin-access.invite.capacityHint')}
        value={capacity}
        onChange={setCapacity}
        error={
          invalid
            ? t('admin-access.invite.error.capacity')
            : formErrors(update.error, ['capacity']).forField('capacity')
        }
        required
      />
    </ConfirmActionDialog>
  );
}

function ActivateDialog({ member, onClose, onLifecycle }: CommandProps) {
  const { endpoints } = useMemberAdmin();
  const activate = useApiMutation(endpoints.activateMember);
  return (
    <ConfirmActionDialog
      open
      title={t('admin-access.member.activate.title')}
      scope={member.fullName}
      consequence={t('admin-access.member.activate.consequence')}
      confirmLabel={t('admin-access.member.activate.confirm')}
      reason={{ label: t('admin-access.common.reason'), required: true }}
      pending={activate.pending}
      error={dialogError(activate.error, [])}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        try {
          const result = await activate.mutate({
            params: { userId: member.userId },
            body: { reason },
          });
          onLifecycle(result, t('admin-access.member.activate.done'));
        } catch {
          // Shown in the dialog.
        }
      }}
    />
  );
}

function ApproveDialog({ member, onClose, onLifecycle }: CommandProps) {
  const { endpoints } = useMemberAdmin();
  const roles = useActiveRoles(true);
  const [capacity, setCapacity] = useState(member.capacity ?? '');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const approve = useApiMutation(endpoints.approveMembership);
  const server = formErrors(approve.error, ['capacity', 'roleIds']);
  return (
    <ConfirmActionDialog
      open
      title={t('admin-access.member.approve.title')}
      scope={member.fullName}
      consequence={t('admin-access.member.approve.consequence')}
      confirmLabel={t('admin-access.member.approve.confirm')}
      pending={approve.pending}
      error={dialogError(approve.error, ['capacity', 'roleIds'])}
      onCancel={onClose}
      onConfirm={async () => {
        setChecked(true);
        if (capacity.trim().length < 2 || roleIds.length === 0) return;
        try {
          const result = await approve.mutate({
            params: { userId: member.userId },
            body: { capacity: capacity.trim(), roleIds: roleIds.map(Number) },
          });
          onLifecycle(result, t('admin-access.member.approve.done'));
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <TextField
        label={t('admin-access.invite.capacity')}
        value={capacity}
        onChange={setCapacity}
        error={
          checked && capacity.trim().length < 2
            ? t('admin-access.invite.error.capacity')
            : server.forField('capacity')
        }
        required
      />
      <MultiSelect
        label={t('admin-access.invite.roles')}
        hint={t('admin-access.invite.rolesHint')}
        value={roleIds}
        onChange={setRoleIds}
        options={(roles.data?.items ?? []).map((role) => ({
          value: String(role.roleId),
          label: role.name,
        }))}
        error={
          checked && roleIds.length === 0
            ? t('admin-access.invite.error.roles')
            : server.forField('roleIds')
        }
        required
      />
    </ConfirmActionDialog>
  );
}

function RejectDialog({ member, onClose, onLifecycle }: CommandProps) {
  const { endpoints } = useMemberAdmin();
  const reject = useApiMutation(endpoints.rejectMembership);
  return (
    <ConfirmActionDialog
      open
      tone="danger"
      title={t('admin-access.member.reject.title')}
      scope={member.fullName}
      consequence={t('admin-access.member.reject.consequence')}
      confirmLabel={t('admin-access.member.reject.confirm')}
      reason={{ label: t('admin-access.common.reason'), required: true }}
      pending={reject.pending}
      error={dialogError(reject.error, [])}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        try {
          const result = await reject.mutate({
            params: { userId: member.userId },
            body: { reason },
          });
          onLifecycle(result, t('admin-access.member.reject.done'));
        } catch {
          // Shown in the dialog.
        }
      }}
    />
  );
}

function SuspendDialog({ member, onClose, onLifecycle }: CommandProps) {
  const { endpoints } = useMemberAdmin();
  const timeZone = useActiveTenant()?.officialTimeZone ?? 'UTC';
  const [until, setUntil] = useState<string | null>(null);
  const suspend = useApiMutation(endpoints.suspendMember);
  return (
    <ConfirmActionDialog
      open
      tone="danger"
      title={t('admin-access.member.suspend.title')}
      scope={member.fullName}
      consequence={t('admin-access.member.suspend.consequence')}
      confirmLabel={t('admin-access.member.suspend.confirm')}
      reason={{ label: t('admin-access.common.reason'), required: true }}
      pending={suspend.pending}
      error={dialogError(suspend.error, ['until'])}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        try {
          const result = await suspend.mutate({
            params: { userId: member.userId },
            body: { reason, until },
          });
          onLifecycle(result, t('admin-access.member.suspend.done'));
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <DateTimeInput
        label={t('admin-access.member.suspend.until')}
        hint={t('admin-access.member.suspend.untilHint')}
        value={until}
        onChange={setUntil}
        timeZone={timeZone}
        error={formErrors(suspend.error, ['until']).forField('until')}
      />
    </ConfirmActionDialog>
  );
}

function RecoverDialog({ member, onClose, onLifecycle }: CommandProps) {
  const { endpoints } = useMemberAdmin();
  const roles = useActiveRoles(true);
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const recover = useApiMutation(endpoints.recoverMembership);
  return (
    <ConfirmActionDialog
      open
      title={t('admin-access.member.recover.title')}
      scope={member.fullName}
      consequence={t('admin-access.member.recover.consequence')}
      confirmLabel={t('admin-access.member.recover.confirm')}
      reason={{ label: t('admin-access.common.reason'), required: true }}
      pending={recover.pending}
      error={dialogError(recover.error, ['roleIds'])}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        setChecked(true);
        if (roleIds.length === 0) return;
        try {
          const result = await recover.mutate({
            params: { userId: member.userId },
            body: { reason, roleIds: roleIds.map(Number) },
          });
          onLifecycle(result, t('admin-access.member.recover.done'));
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <MultiSelect
        label={t('admin-access.invite.roles')}
        value={roleIds}
        onChange={setRoleIds}
        options={(roles.data?.items ?? []).map((role) => ({
          value: String(role.roleId),
          label: role.name,
        }))}
        error={
          checked && roleIds.length === 0
            ? t('admin-access.invite.error.roles')
            : formErrors(recover.error, ['roleIds']).forField('roleIds')
        }
        required
      />
    </ConfirmActionDialog>
  );
}

const ROLE_FIELDS = ['roleId', 'scope', 'startsAt', 'endsAt'];

function AssignRoleDialog({ member, onClose, onAssignment }: CommandProps) {
  const { endpoints } = useMemberAdmin();
  const timeZone = useActiveTenant()?.officialTimeZone ?? 'UTC';
  const roles = useActiveRoles(true);
  const [roleId, setRoleId] = useState('');
  const [scope, setScope] = useState<ScopeValue>(ORGANIZATION_SCOPE);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const assign = useApiMutation(endpoints.addRoleAssignment);
  const server = formErrors(assign.error, ROLE_FIELDS);
  const scopeMissing = scope.scopeType !== 'organization' && scope.scopeId === null;
  const datesInvalid =
    startsAt !== null && endsAt !== null && Date.parse(endsAt) <= Date.parse(startsAt);
  return (
    <ConfirmActionDialog
      open
      title={t('admin-access.member.assign.title')}
      scope={member.fullName}
      consequence={t('admin-access.member.assign.consequence')}
      confirmLabel={t('admin-access.member.assign.confirm')}
      reason={{ label: t('admin-access.common.reason'), required: true }}
      pending={assign.pending}
      error={dialogError(assign.error, ROLE_FIELDS)}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        setChecked(true);
        if (roleId === '' || scopeMissing || datesInvalid) return;
        try {
          const row = await assign.mutate({
            params: { userId: member.userId },
            body: { roleId: Number(roleId), scope, startsAt, endsAt, reason },
          });
          onAssignment(row, t('admin-access.member.assign.done', { role: row.role.name }));
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <Select
        label={t('admin-access.member.assign.role')}
        hint={t('admin-access.member.assign.roleHint')}
        value={roleId}
        onChange={setRoleId}
        placeholder={t('admin-access.common.choose')}
        options={(roles.data?.items ?? []).map((role) => ({
          value: String(role.roleId),
          label: role.name,
        }))}
        error={
          checked && roleId === ''
            ? t('admin-access.member.assign.roleRequired')
            : server.forField('roleId')
        }
        required
      />
      <ScopeInput
        value={scope}
        onChange={setScope}
        error={
          checked && scopeMissing ? t('admin-access.scope.required') : server.forField('scope')
        }
      />
      <DateTimeInput
        label={t('admin-access.member.assign.startsAt')}
        hint={t('admin-access.member.assign.startsHint')}
        value={startsAt}
        onChange={setStartsAt}
        timeZone={timeZone}
        error={server.forField('startsAt')}
      />
      <DateTimeInput
        label={t('admin-access.member.assign.endsAt')}
        hint={t('admin-access.member.assign.endsHint')}
        value={endsAt}
        onChange={setEndsAt}
        timeZone={timeZone}
        error={datesInvalid ? t('admin-access.common.endAfterStart') : server.forField('endsAt')}
      />
    </ConfirmActionDialog>
  );
}

export function MemberCommandDialog({
  command,
  ...props
}: CommandProps & { readonly command: MemberCommand }) {
  switch (command) {
    case 'edit':
      return <EditCapacityDialog {...props} />;
    case 'activate':
      return <ActivateDialog {...props} />;
    case 'approveMembership':
      return <ApproveDialog {...props} />;
    case 'rejectMembership':
      return <RejectDialog {...props} />;
    case 'suspend':
      return <SuspendDialog {...props} />;
    case 'recover':
      return <RecoverDialog {...props} />;
    case 'assignRole':
      return <AssignRoleDialog {...props} />;
    default:
      return null;
  }
}

export function RevokeRoleDialog({
  member,
  assignment,
  onClose,
  onRevoked,
}: {
  readonly member: MemberDetail;
  readonly assignment: RoleAssignmentRow;
  readonly onClose: () => void;
  readonly onRevoked: (row: RoleAssignmentRow) => void;
}) {
  const { endpoints } = useMemberAdmin();
  const revoke = useApiMutation(endpoints.revokeRoleAssignment);
  return (
    <ConfirmActionDialog
      open
      tone="danger"
      title={t('admin-access.member.revokeRole.title')}
      scope={t('admin-access.member.revokeRole.scope', {
        role: assignment.role.name,
        person: member.fullName,
        scope: assignment.scope.scopeLabel,
      })}
      consequence={t('admin-access.member.revokeRole.consequence')}
      confirmLabel={t('admin-access.member.revokeRole.confirm')}
      reason={{ label: t('admin-access.common.reason'), required: true }}
      pending={revoke.pending}
      error={dialogError(revoke.error, [])}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        try {
          const row = await revoke.mutate({
            params: { userId: member.userId, assignmentId: assignment.assignmentId },
            body: { reason },
          });
          onRevoked(row);
        } catch {
          // Shown in the dialog.
        }
      }}
    />
  );
}
