/**
 * Direct exceptional access and explicit restrictions (ADM-04, PRD §4.2):
 * - a direct grant names the person, ONE permission, the scope, the owner, the reason, the start and the expiry
 *   (at most MAX_GRANT_DAYS); nobody can grant a permission they do not hold (GRANT_NOT_HELD) or grant to
 *   themselves (SELF_GRANT_FORBIDDEN);
 * - extending a grant keeps the total validity within the maximum; revoking ends it at once;
 * - a restriction wins over roles and grants; a conflict restriction is lifted only by the conflict review.
 */
import { useState } from 'react';

import { ACCESS_RESTRICTIONS_RESTRICTION_TYPE } from '@contracts/enums';
import type { AccessRestrictionsRestrictionType } from '@contracts/enums';
import { MAX_GRANT_DAYS, orgAdminEndpoints } from '@contracts/org-admin';
import type { AccessGrantRow, AccessRestrictionRow } from '@contracts/org-admin';
import type { PermissionCode } from '@contracts/permissions';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { ConfirmActionDialog, DateTimeInput, Select, formErrors } from '../../../components/ui';
import { formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useMemberAdmin } from '../lib/audience';
import { dialogError } from '../lib/errors';
import { useOfficialTimeZone } from '../lib/hooks';
import { ORGANIZATION_SCOPE } from '../lib/scope';
import type { ScopeValue } from '../lib/scope';
import { MemberSelect, ScopeInput } from './Pickers';

const DAY_MS = 24 * 60 * 60 * 1000;

function usePermissionOptions(open: boolean) {
  const { endpoints } = useMemberAdmin();
  const catalog = useApiQuery(endpoints.getRoleCatalog, open ? {} : null);
  return (catalog.data?.permissions ?? []).map((permission) => ({
    value: permission.code,
    label: `${permission.code} — ${permission.description}`,
  }));
}

const GRANT_FIELDS = ['userId', 'permissionCode', 'scope', 'ownerUserId', 'startsAt', 'expiresAt'];

export function CreateGrantDialog({
  now,
  onClose,
  onCreated,
}: {
  /** The request time (from `useNow`), used as the default start. */
  readonly now: number;
  readonly onClose: () => void;
  readonly onCreated: (grant: AccessGrantRow) => void;
}) {
  const timeZone = useOfficialTimeZone();
  const create = useApiMutation(orgAdminEndpoints.createAccessGrant);
  const permissions = usePermissionOptions(true);
  const [userId, setUserId] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [permissionCode, setPermissionCode] = useState('');
  const [scope, setScope] = useState<ScopeValue>(ORGANIZATION_SCOPE);
  const [startsAt, setStartsAt] = useState<string | null>(() => new Date(now).toISOString());
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const server = formErrors(create.error, GRANT_FIELDS);
  const tooLong =
    startsAt !== null &&
    expiresAt !== null &&
    Date.parse(expiresAt) - Date.parse(startsAt) > MAX_GRANT_DAYS * DAY_MS;
  const inverted =
    startsAt !== null && expiresAt !== null && Date.parse(expiresAt) <= Date.parse(startsAt);
  const local: Record<string, string | undefined> = checked
    ? {
        userId: userId === '' ? t('admin-access.common.personRequired') : undefined,
        ownerUserId: ownerUserId === '' ? t('admin-access.grants.ownerRequired') : undefined,
        permissionCode:
          permissionCode === '' ? t('admin-access.grants.permissionRequired') : undefined,
        scope:
          scope.scopeType !== 'organization' && scope.scopeId === null
            ? t('admin-access.scope.required')
            : undefined,
        startsAt: startsAt === null ? t('admin-access.common.dateRequired') : undefined,
        expiresAt:
          expiresAt === null
            ? t('admin-access.grants.expiryRequired')
            : inverted
              ? t('admin-access.common.endAfterStart')
              : tooLong
                ? t('admin-access.grants.tooLong', { days: MAX_GRANT_DAYS })
                : undefined,
      }
    : {};
  const errorOf = (field: string): string | undefined => local[field] ?? server.forField(field);

  return (
    <ConfirmActionDialog
      open
      title={t('admin-access.grants.createTitle')}
      scope={t('admin-access.grants.createScope')}
      consequence={t('admin-access.grants.createConsequence', { days: MAX_GRANT_DAYS })}
      confirmLabel={t('admin-access.grants.create')}
      reason={{ label: t('admin-access.grants.reason'), required: true }}
      pending={create.pending}
      error={dialogError(create.error, GRANT_FIELDS)}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        setChecked(true);
        if (
          userId === '' ||
          ownerUserId === '' ||
          permissionCode === '' ||
          (scope.scopeType !== 'organization' && scope.scopeId === null) ||
          startsAt === null ||
          expiresAt === null ||
          inverted ||
          tooLong
        ) {
          return;
        }
        try {
          const grant = await create.mutate({
            body: {
              userId: Number(userId),
              permissionCode: permissionCode as PermissionCode,
              scope,
              reason,
              ownerUserId: Number(ownerUserId),
              startsAt,
              expiresAt,
            },
          });
          onCreated(grant);
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <div className="tiq-form-grid">
        <MemberSelect
          label={t('admin-access.grants.person')}
          value={userId}
          onChange={setUserId}
          error={errorOf('userId')}
          required
        />
        <MemberSelect
          label={t('admin-access.grants.owner')}
          hint={t('admin-access.grants.ownerHint')}
          value={ownerUserId}
          onChange={setOwnerUserId}
          error={errorOf('ownerUserId')}
          required
        />
        <Select
          label={t('admin-access.grants.permission')}
          hint={t('admin-access.grants.permissionHint')}
          value={permissionCode}
          onChange={setPermissionCode}
          options={permissions}
          placeholder={t('admin-access.common.choose')}
          error={errorOf('permissionCode')}
          required
          fieldClassName="tiq-form-full"
        />
        <ScopeInput value={scope} onChange={setScope} error={errorOf('scope')} />
        <DateTimeInput
          label={t('admin-access.grants.startsAt')}
          value={startsAt}
          onChange={setStartsAt}
          timeZone={timeZone}
          error={errorOf('startsAt')}
          required
        />
        <DateTimeInput
          label={t('admin-access.grants.expiresAt')}
          hint={t('admin-access.grants.expiresHint', { days: MAX_GRANT_DAYS })}
          value={expiresAt}
          onChange={setExpiresAt}
          timeZone={timeZone}
          error={errorOf('expiresAt')}
          required
        />
      </div>
    </ConfirmActionDialog>
  );
}

export function ExtendGrantDialog({
  grant,
  onClose,
  onDone,
}: {
  readonly grant: AccessGrantRow;
  readonly onClose: () => void;
  readonly onDone: (grant: AccessGrantRow) => void;
}) {
  const timeZone = useOfficialTimeZone();
  const extend = useApiMutation(orgAdminEndpoints.extendAccessGrant);
  const [expiresAt, setExpiresAt] = useState<string | null>(grant.expiresAt);
  const tooLong =
    expiresAt !== null &&
    Date.parse(expiresAt) - Date.parse(grant.startsAt) > MAX_GRANT_DAYS * DAY_MS;
  const notLater = expiresAt !== null && Date.parse(expiresAt) <= Date.parse(grant.expiresAt);
  return (
    <ConfirmActionDialog
      open
      title={t('admin-access.grants.extendTitle')}
      scope={t('admin-access.grants.rowScope', {
        permission: grant.permissionCode,
        person: grant.user.fullName,
      })}
      consequence={t('admin-access.grants.extendConsequence', {
        date: formatInstantDate(grant.expiresAt, timeZone),
      })}
      confirmLabel={t('admin-access.grants.extend')}
      reason={{ label: t('admin-access.common.reason'), required: true }}
      pending={extend.pending}
      error={dialogError(extend.error, ['expiresAt'])}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        if (expiresAt === null || tooLong || notLater) return;
        try {
          onDone(
            await extend.mutate({
              params: { grantId: grant.grantId },
              body: { expiresAt, reason },
            }),
          );
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <DateTimeInput
        label={t('admin-access.grants.newExpiry')}
        value={expiresAt}
        onChange={setExpiresAt}
        timeZone={timeZone}
        required
        error={
          tooLong
            ? t('admin-access.grants.tooLong', { days: MAX_GRANT_DAYS })
            : notLater
              ? t('admin-access.grants.notLater')
              : formErrors(extend.error, ['expiresAt']).forField('expiresAt')
        }
      />
    </ConfirmActionDialog>
  );
}

export function RevokeGrantDialog({
  grant,
  onClose,
  onDone,
}: {
  readonly grant: AccessGrantRow;
  readonly onClose: () => void;
  readonly onDone: (grant: AccessGrantRow) => void;
}) {
  const revoke = useApiMutation(orgAdminEndpoints.revokeAccessGrant);
  return (
    <ConfirmActionDialog
      open
      tone="danger"
      title={t('admin-access.grants.revokeTitle')}
      scope={t('admin-access.grants.rowScope', {
        permission: grant.permissionCode,
        person: grant.user.fullName,
      })}
      consequence={t('admin-access.grants.revokeConsequence')}
      confirmLabel={t('admin-access.grants.revoke')}
      reason={{ label: t('admin-access.common.reason'), required: true }}
      pending={revoke.pending}
      error={dialogError(revoke.error, [])}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        try {
          onDone(await revoke.mutate({ params: { grantId: grant.grantId }, body: { reason } }));
        } catch {
          // Shown in the dialog.
        }
      }}
    />
  );
}

const RESTRICTION_FIELDS = [
  'userId',
  'permissionCode',
  'scope',
  'restrictionType',
  'startsAt',
  'endsAt',
];

export function CreateRestrictionDialog({
  now,
  onClose,
  onCreated,
}: {
  readonly now: number;
  readonly onClose: () => void;
  readonly onCreated: (restriction: AccessRestrictionRow) => void;
}) {
  const timeZone = useOfficialTimeZone();
  const create = useApiMutation(orgAdminEndpoints.createAccessRestriction);
  const permissions = usePermissionOptions(true);
  const [userId, setUserId] = useState('');
  const [permissionCode, setPermissionCode] = useState('');
  const [restrictionType, setRestrictionType] =
    useState<AccessRestrictionsRestrictionType>('confidentiality');
  const [scope, setScope] = useState<ScopeValue>(ORGANIZATION_SCOPE);
  const [startsAt, setStartsAt] = useState<string | null>(() => new Date(now).toISOString());
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const server = formErrors(create.error, RESTRICTION_FIELDS);
  const inverted =
    startsAt !== null && endsAt !== null && Date.parse(endsAt) <= Date.parse(startsAt);
  const scopeMissing = scope.scopeType !== 'organization' && scope.scopeId === null;
  return (
    <ConfirmActionDialog
      open
      tone="danger"
      title={t('admin-access.restrictions.createTitle')}
      scope={t('admin-access.restrictions.createScope')}
      consequence={t('admin-access.restrictions.createConsequence')}
      confirmLabel={t('admin-access.restrictions.create')}
      reason={{ label: t('admin-access.common.reason'), required: true }}
      pending={create.pending}
      error={dialogError(create.error, RESTRICTION_FIELDS)}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        setChecked(true);
        if (userId === '' || scopeMissing || startsAt === null || inverted) return;
        try {
          const restriction = await create.mutate({
            body: {
              userId: Number(userId),
              permissionCode: permissionCode === '' ? null : (permissionCode as PermissionCode),
              scope,
              restrictionType,
              reason,
              startsAt,
              endsAt,
            },
          });
          onCreated(restriction);
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <div className="tiq-form-grid">
        <MemberSelect
          label={t('admin-access.grants.person')}
          value={userId}
          onChange={setUserId}
          error={
            checked && userId === ''
              ? t('admin-access.common.personRequired')
              : server.forField('userId')
          }
          required
        />
        <Select
          label={t('admin-access.restrictions.type')}
          value={restrictionType}
          onChange={(value) => setRestrictionType(value as AccessRestrictionsRestrictionType)}
          options={ACCESS_RESTRICTIONS_RESTRICTION_TYPE.filter((value) => value !== 'conflict').map(
            (value) => ({
              value,
              label: tEnum('access_restrictions.restriction_type', value),
            }),
          )}
          hint={t('admin-access.restrictions.typeHint')}
          error={server.forField('restrictionType')}
          required
        />
        <Select
          label={t('admin-access.restrictions.permission')}
          hint={t('admin-access.restrictions.permissionHint')}
          value={permissionCode}
          onChange={setPermissionCode}
          options={permissions}
          placeholder={t('admin-access.restrictions.allPermissions')}
          error={server.forField('permissionCode')}
          fieldClassName="tiq-form-full"
        />
        <ScopeInput
          value={scope}
          onChange={setScope}
          error={
            checked && scopeMissing ? t('admin-access.scope.required') : server.forField('scope')
          }
        />
        <DateTimeInput
          label={t('admin-access.grants.startsAt')}
          value={startsAt}
          onChange={setStartsAt}
          timeZone={timeZone}
          error={server.forField('startsAt')}
          required
        />
        <DateTimeInput
          label={t('admin-access.restrictions.endsAt')}
          hint={t('admin-access.restrictions.endsHint')}
          value={endsAt}
          onChange={setEndsAt}
          timeZone={timeZone}
          error={inverted ? t('admin-access.common.endAfterStart') : server.forField('endsAt')}
        />
      </div>
    </ConfirmActionDialog>
  );
}

export function LiftRestrictionDialog({
  restriction,
  onClose,
  onDone,
}: {
  readonly restriction: AccessRestrictionRow;
  readonly onClose: () => void;
  readonly onDone: (restriction: AccessRestrictionRow) => void;
}) {
  const lift = useApiMutation(orgAdminEndpoints.liftAccessRestriction);
  return (
    <ConfirmActionDialog
      open
      title={t('admin-access.restrictions.liftTitle')}
      scope={t('admin-access.restrictions.rowScope', {
        person: restriction.user.fullName,
        scope: restriction.scope.scopeLabel,
      })}
      consequence={t('admin-access.restrictions.liftConsequence')}
      confirmLabel={t('admin-access.restrictions.lift')}
      reason={{ label: t('admin-access.common.reason'), required: true }}
      pending={lift.pending}
      error={dialogError(lift.error, [])}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        try {
          onDone(
            await lift.mutate({
              params: { restrictionId: restriction.restrictionId },
              body: { reason },
            }),
          );
        } catch {
          // Shown in the dialog.
        }
      }}
    />
  );
}
