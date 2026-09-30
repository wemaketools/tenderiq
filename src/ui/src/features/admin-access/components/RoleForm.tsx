/**
 * Create or revise a custom role (ADM-04 "create approved role combinations", SUP-04 roles): code, name,
 * description and permissions of THIS organization's kind only (the role catalog never lists another kind's
 * permissions nor support access). A template can prefill the permissions. Combinations that breach a
 * segregation-of-duties rule are flagged before saving (the API refuses them with SOD_INCOMPATIBLE_PERMISSIONS).
 */
import { useState } from 'react';

import { sodRulesBreachedBy } from '@contracts/org-admin';
import type { RoleCatalog, RoleDetail } from '@contracts/org-admin';
import type { PermissionCode } from '@contracts/permissions';

import { useApiMutation } from '../../../api/hooks';
import {
  Banner,
  ConfirmActionDialog,
  MultiSelect,
  Select,
  TextArea,
  TextField,
  formErrors,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { useMemberAdmin } from '../lib/audience';
import { dialogError } from '../lib/errors';

const FIELDS = ['code', 'name', 'description', 'permissionCodes'];

export interface RoleFormDialogProps {
  readonly catalog: RoleCatalog;
  /** The role being revised, or null to create one. */
  readonly role: RoleDetail | null;
  readonly onClose: () => void;
  readonly onSaved: (role: RoleDetail) => void;
}

export function RoleFormDialog({ catalog, role, onClose, onSaved }: RoleFormDialogProps) {
  const { endpoints, kind } = useMemberAdmin();
  const [code, setCode] = useState(role?.code ?? '');
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [permissions, setPermissions] = useState<string[]>(
    role?.permissions.map((permission) => permission.code) ?? [],
  );
  const [template, setTemplate] = useState('');
  const [checked, setChecked] = useState(false);
  const create = useApiMutation(endpoints.createRole);
  const update = useApiMutation(endpoints.updateRole);
  const error = role === null ? create.error : update.error;
  const pending = create.pending || update.pending;
  const server = formErrors(error, FIELDS);
  const breaches = kind === 'buyer' ? sodRulesBreachedBy(permissions) : [];
  const local: Record<string, string | undefined> = checked
    ? {
        code:
          role === null && !/^[a-z][a-z0-9_]{2,40}$/.test(code.trim())
            ? t('admin-access.roles.form.codeInvalid')
            : undefined,
        name: name.trim().length < 3 ? t('admin-access.roles.form.nameInvalid') : undefined,
        permissionCodes:
          permissions.length === 0 ? t('admin-access.roles.form.permissionsRequired') : undefined,
      }
    : {};
  const errorOf = (field: string): string | undefined => local[field] ?? server.forField(field);

  return (
    <ConfirmActionDialog
      open
      title={
        role === null
          ? t('admin-access.roles.form.createTitle')
          : t('admin-access.roles.form.editTitle', { name: role.name })
      }
      scope={t('admin-access.roles.form.scope', { count: permissions.length })}
      consequence={
        role === null
          ? t('admin-access.roles.form.createConsequence')
          : t('admin-access.roles.form.editConsequence', { count: role.activeAssignmentCount })
      }
      confirmLabel={
        role === null ? t('admin-access.roles.form.create') : t('admin-access.roles.form.save')
      }
      pending={pending}
      error={dialogError(error, FIELDS)}
      onCancel={onClose}
      onConfirm={async () => {
        setChecked(true);
        const invalid =
          (role === null && !/^[a-z][a-z0-9_]{2,40}$/.test(code.trim())) ||
          name.trim().length < 3 ||
          permissions.length === 0;
        if (invalid) return;
        const codes = permissions as PermissionCode[];
        const text = description.trim() === '' ? null : description.trim();
        try {
          const saved =
            role === null
              ? await create.mutate({
                  body: {
                    code: code.trim(),
                    name: name.trim(),
                    description: text,
                    permissionCodes: codes,
                  },
                })
              : await update.mutate({
                  params: { roleId: role.roleId },
                  body: { name: name.trim(), description: text, permissionCodes: codes },
                });
          onSaved(saved);
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <div className="tiq-form-grid">
        {role === null && (
          <TextField
            label={t('admin-access.roles.form.code')}
            hint={t('admin-access.roles.form.codeHint')}
            value={code}
            onChange={setCode}
            error={errorOf('code')}
            required
          />
        )}
        <TextField
          label={t('admin-access.roles.form.name')}
          value={name}
          onChange={setName}
          error={errorOf('name')}
          required
        />
        <TextArea
          label={t('admin-access.roles.form.description')}
          value={description}
          onChange={setDescription}
          error={errorOf('description')}
          rows={2}
          fieldClassName="tiq-form-full"
        />
        <Select
          label={t('admin-access.roles.form.template')}
          hint={t('admin-access.roles.form.templateHint')}
          placeholder={t('admin-access.roles.form.noTemplate')}
          value={template}
          options={catalog.templates.map((item) => ({ value: item.code, label: item.name }))}
          onChange={(next) => {
            setTemplate(next);
            const chosen = catalog.templates.find((item) => item.code === next);
            if (chosen !== undefined) setPermissions([...chosen.permissionCodes]);
          }}
          fieldClassName="tiq-form-full"
        />
        <MultiSelect
          label={t('admin-access.roles.form.permissions')}
          hint={t('admin-access.roles.form.permissionsHint')}
          value={permissions}
          onChange={setPermissions}
          options={catalog.permissions.map((permission) => ({
            value: permission.code,
            label: `${permission.code} — ${permission.description}`,
          }))}
          error={errorOf('permissionCodes')}
          required
          fieldClassName="tiq-form-full"
        />
      </div>
      {breaches.length > 0 && (
        <Banner tone="error" title={t('admin-access.roles.form.sodTitle')}>
          <ul>
            {breaches.map((rule) => (
              <li key={rule}>{tEnum('sod_policies.rule_code', rule)}</li>
            ))}
          </ul>
        </Banner>
      )}
    </ConfirmActionDialog>
  );
}
