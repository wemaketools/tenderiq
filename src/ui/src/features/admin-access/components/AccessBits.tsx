/**
 * Small display components shared by the org-admin screens: the validity-window chip (DD-18), a scope label,
 * role chips and a person with capacity.
 */
import type { AccessItemStatus, AccessScope, RoleRef } from '@contracts/org-admin';

import { Chip } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { ACCESS_STATUS_TONE, accessStatusLabel } from '../lib/status';

export function AccessStatusChip({
  status,
  size = 'sm',
}: {
  readonly status: AccessItemStatus;
  readonly size?: 'sm' | 'md';
}) {
  return (
    <Chip tone={ACCESS_STATUS_TONE[status]} size={size}>
      {accessStatusLabel(status)}
    </Chip>
  );
}

export function ScopeText({ scope }: { readonly scope: AccessScope }) {
  return (
    <>
      <span>{scope.scopeLabel}</span>
      {scope.scopeType !== 'organization' && (
        <span className="tiq-cell-sub">{t(`admin-access.scopeType.${scope.scopeType}`)}</span>
      )}
    </>
  );
}

export function RoleChips({ roles }: { readonly roles: readonly RoleRef[] }) {
  if (roles.length === 0) {
    return <span className="tiq-text-muted">{t('admin-access.common.noRoles')}</span>;
  }
  return (
    <span className="tiq-inline">
      {roles.map((role) => (
        <Chip key={role.roleId} tone="neutral" size="sm">
          {role.name}
        </Chip>
      ))}
    </span>
  );
}

export function PersonCell({ name, sub }: { readonly name: string; readonly sub?: string | null }) {
  return (
    <>
      <span>{name}</span>
      {sub !== undefined && sub !== null && sub !== '' && (
        <span className="tiq-cell-sub">{sub}</span>
      )}
    </>
  );
}
