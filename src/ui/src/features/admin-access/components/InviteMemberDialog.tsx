/**
 * Invite a person (ADM-03, SUP-04; FR-03): e-mail, name, capacity, roles and groups of THIS organization's kind
 * only (a supplier administrator never sees buyer privileges), and the link validity. The invitation is sent at
 * once; the person becomes a member only when they accept it (COM-01).
 */
import { useState } from 'react';

import type { InvitationRow } from '@contracts/org-admin';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  ConfirmActionDialog,
  MultiSelect,
  NumberInput,
  TextArea,
  TextField,
  formErrors,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { useMemberAdmin } from '../lib/audience';
import { dialogError } from '../lib/errors';

const FIELDS = ['email', 'fullName', 'capacity', 'roleIds', 'groupIds', 'expiresInDays', 'message'];

interface Draft {
  email: string;
  fullName: string;
  capacity: string;
  roleIds: string[];
  groupIds: string[];
  expiresInDays: string;
  message: string;
}

const EMPTY: Draft = {
  email: '',
  fullName: '',
  capacity: '',
  roleIds: [],
  groupIds: [],
  expiresInDays: '14',
  message: '',
};

export interface InviteMemberDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onInvited: (invitation: InvitationRow) => void;
}

export function InviteMemberDialog({ open, onClose, onInvited }: InviteMemberDialogProps) {
  const { endpoints } = useMemberAdmin();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [local, setLocal] = useState<Record<string, string>>({});
  const invite = useApiMutation(endpoints.inviteMember);
  const roles = useApiQuery(
    endpoints.listRoles,
    open ? { query: { active: true, sort: 'name', pageSize: 100 } } : null,
  );
  const groups = useApiQuery(
    endpoints.listGroups,
    open ? { query: { active: true, sort: 'name', pageSize: 100 } } : null,
  );
  const server = formErrors(invite.error, FIELDS);
  const errorOf = (field: string): string | undefined => local[field] ?? server.forField(field);

  const close = (): void => {
    setDraft(EMPTY);
    setLocal({});
    invite.reset();
    onClose();
  };

  const submit = async (): Promise<void> => {
    const problems: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
      problems.email = t('admin-access.invite.error.email');
    }
    if (draft.fullName.trim().length < 2) problems.fullName = t('admin-access.invite.error.name');
    if (draft.capacity.trim().length < 2) {
      problems.capacity = t('admin-access.invite.error.capacity');
    }
    if (draft.roleIds.length === 0) problems.roleIds = t('admin-access.invite.error.roles');
    const days = Number(draft.expiresInDays);
    if (!Number.isInteger(days) || days < 1 || days > 30) {
      problems.expiresInDays = t('admin-access.invite.error.expiry');
    }
    setLocal(problems);
    if (Object.keys(problems).length > 0) return;
    try {
      const result = await invite.mutate({
        body: {
          email: draft.email.trim(),
          fullName: draft.fullName.trim(),
          capacity: draft.capacity.trim(),
          roleIds: draft.roleIds.map(Number),
          groupIds: draft.groupIds.map(Number),
          expiresInDays: days,
          message: draft.message.trim() === '' ? null : draft.message.trim(),
        },
      });
      setDraft(EMPTY);
      setLocal({});
      onInvited(result);
    } catch {
      // The error is shown in the dialog.
    }
  };

  return (
    <ConfirmActionDialog
      open={open}
      title={t('admin-access.invite.title')}
      scope={t('admin-access.invite.scope')}
      consequence={t('admin-access.invite.consequence', { days: draft.expiresInDays })}
      confirmLabel={t('admin-access.invite.confirm')}
      onConfirm={submit}
      onCancel={close}
      pending={invite.pending}
      error={dialogError(invite.error, FIELDS)}
    >
      <div className="tiq-form-grid">
        <TextField
          label={t('admin-access.invite.email')}
          type="email"
          value={draft.email}
          onChange={(email) => setDraft({ ...draft, email })}
          error={errorOf('email')}
          required
        />
        <TextField
          label={t('admin-access.invite.fullName')}
          value={draft.fullName}
          onChange={(fullName) => setDraft({ ...draft, fullName })}
          error={errorOf('fullName')}
          required
        />
        <TextField
          label={t('admin-access.invite.capacity')}
          hint={t('admin-access.invite.capacityHint')}
          value={draft.capacity}
          onChange={(capacity) => setDraft({ ...draft, capacity })}
          error={errorOf('capacity')}
          required
        />
        <NumberInput
          label={t('admin-access.invite.expiresInDays')}
          hint={t('admin-access.invite.expiresHint')}
          value={draft.expiresInDays}
          places={0}
          onChange={(expiresInDays) => setDraft({ ...draft, expiresInDays })}
          error={errorOf('expiresInDays')}
          required
        />
        <MultiSelect
          label={t('admin-access.invite.roles')}
          hint={t('admin-access.invite.rolesHint')}
          value={draft.roleIds}
          options={(roles.data?.items ?? []).map((role) => ({
            value: String(role.roleId),
            label: role.name,
          }))}
          onChange={(roleIds) => setDraft({ ...draft, roleIds })}
          error={errorOf('roleIds')}
          required
          fieldClassName="tiq-form-full"
        />
        <MultiSelect
          label={t('admin-access.invite.groups')}
          value={draft.groupIds}
          options={(groups.data?.items ?? []).map((group) => ({
            value: String(group.groupId),
            label: group.name,
          }))}
          onChange={(groupIds) => setDraft({ ...draft, groupIds })}
          error={errorOf('groupIds')}
          fieldClassName="tiq-form-full"
        />
        <TextArea
          label={t('admin-access.invite.message')}
          value={draft.message}
          onChange={(message) => setDraft({ ...draft, message })}
          error={errorOf('message')}
          rows={3}
          fieldClassName="tiq-form-full"
        />
      </div>
    </ConfirmActionDialog>
  );
}
