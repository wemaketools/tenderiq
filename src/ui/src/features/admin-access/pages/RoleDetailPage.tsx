/**
 * ADM-04 / SUP-04 — Role detail: the permissions a role grants (by category), who holds it (people directly or
 * through groups, with scope and validity) and the segregation-of-duties rules it combines. Custom roles can be
 * revised or deactivated (system roles are read-only; a role with active holders cannot be deactivated).
 */
import { useState } from 'react';
import { Link, useLocation } from 'react-router';

import type { RoleDetail } from '@contracts/org-admin';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  PageHeader,
  QueryView,
  useToast,
} from '../../../components/ui';
import { formatCount, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { AccessLayout } from '../components/AccessLayout';
import { AccessStatusChip, ScopeText } from '../components/AccessBits';
import { RoleFormDialog } from '../components/RoleForm';
import { useMemberAdmin } from '../lib/audience';
import { dialogError } from '../lib/errors';
import { useIdParam, useOfficialTimeZone } from '../lib/hooks';

function RoleView({ role: loaded }: { readonly role: RoleDetail }) {
  const admin = useMemberAdmin();
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const [role, setRole] = useState<RoleDetail>(loaded);
  const [open, setOpen] = useState<'edit' | 'deactivate' | null>(null);
  const catalog = useApiQuery(admin.endpoints.getRoleCatalog, open === 'edit' ? {} : null);
  const deactivate = useApiMutation(admin.endpoints.deactivateRole);
  const editable = admin.canManageRoles && !role.isSystem && role.active;
  const categories = [...new Set(role.permissions.map((permission) => permission.category))];

  return (
    <>
      <PageHeader
        title={role.name}
        subtitle={role.description ?? undefined}
        back={{ to: admin.paths.roles, label: t('admin-access.roles.title') }}
        meta={
          <span className="tiq-inline">
            <span className="tiq-mono">{role.code}</span>
            {role.isSystem ? (
              <Chip tone="neutral">{t('admin-access.roles.system')}</Chip>
            ) : (
              <Chip tone="accent">{t('admin-access.roles.custom')}</Chip>
            )}
            {role.active ? (
              <Chip tone="success">{t('admin-access.common.active')}</Chip>
            ) : (
              <Chip tone="neutral-outlined">{t('admin-access.common.inactive')}</Chip>
            )}
          </span>
        }
        primaryAction={
          editable ? (
            <Button variant="primary" icon="edit" onClick={() => setOpen('edit')}>
              {t('admin-access.roles.edit')}
            </Button>
          ) : undefined
        }
        actions={
          editable ? (
            <Button variant="danger-soft" icon="ban" onClick={() => setOpen('deactivate')}>
              {t('admin-access.roles.deactivate')}
            </Button>
          ) : undefined
        }
      />
      {role.isSystem && (
        <Banner tone="info" title={t('admin-access.roles.systemTitle')}>
          <p>{t('admin-access.roles.systemBody')}</p>
        </Banner>
      )}
      {role.sodWarnings.length > 0 && (
        <Banner tone="warning" title={t('admin-access.roles.sodTitle')}>
          <ul>
            {role.sodWarnings.map((warning) => (
              <li key={warning.ruleCode}>
                {tEnum('sod_policies.rule_code', warning.ruleCode)}:{' '}
                {warning.permissions.join(' + ')}
              </li>
            ))}
          </ul>
        </Banner>
      )}
      <Card title={t('admin-access.roles.summary')}>
        <DetailList
          items={[
            { key: 'template', label: t('admin-access.roles.template'), value: role.templateCode },
            {
              key: 'permissions',
              label: t('admin-access.roles.col.permissions'),
              value: formatCount(role.permissionCount),
            },
            {
              key: 'holders',
              label: t('admin-access.roles.col.holders'),
              value: formatCount(role.activeAssignmentCount),
            },
            {
              key: 'deactivated',
              label: t('admin-access.roles.deactivatedAt'),
              value:
                role.deactivatedAt === null
                  ? null
                  : formatInstantDate(role.deactivatedAt, timeZone),
            },
          ]}
        />
      </Card>
      <div className="tiq-grid tiq-grid--2">
        <Card title={t('admin-access.roles.permissionsTitle')}>
          {role.permissions.length === 0 ? (
            <EmptyState compact title={t('admin-access.roles.noPermissions')} />
          ) : (
            <div className="tiq-stack">
              {categories.map((category) => (
                <section key={category} className="tiq-stack">
                  <h3 className="tiq-form-section-title">{category}</h3>
                  <ul className="tiq-stack">
                    {role.permissions
                      .filter((permission) => permission.category === category)
                      .map((permission) => (
                        <li key={permission.code}>
                          <span className="tiq-mono">{permission.code}</span>
                          <span className="tiq-cell-sub">{permission.description}</span>
                        </li>
                      ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </Card>
        <Card title={t('admin-access.roles.holdersTitle')} flush>
          <DataTable
            caption={t('admin-access.roles.holdersTitle')}
            rows={role.holders}
            rowKey={(row) => String(row.assignmentId)}
            empty={<EmptyState compact title={t('admin-access.roles.noHolders')} />}
            columns={[
              {
                id: 'holder',
                header: t('admin-access.roles.col.holder'),
                cell: (row) => (
                  <>
                    {row.holderKind === 'user' ? (
                      <Link to={admin.paths.user(row.holderId)}>{row.holderName}</Link>
                    ) : (
                      <Link to={admin.paths.group(row.holderId)}>{row.holderName}</Link>
                    )}
                    <span className="tiq-cell-sub">
                      {t(`admin-access.roles.holderKind.${row.holderKind}`)}
                    </span>
                  </>
                ),
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
      {open === 'edit' && catalog.data !== undefined && (
        <RoleFormDialog
          catalog={catalog.data}
          role={role}
          onClose={() => setOpen(null)}
          onSaved={(saved) => {
            setRole(saved);
            setOpen(null);
            toast.show(t('admin-access.roles.saved'), 'success');
          }}
        />
      )}
      {open === 'deactivate' && (
        <ConfirmActionDialog
          open
          tone="danger"
          title={t('admin-access.roles.deactivateTitle')}
          scope={role.name}
          consequence={t('admin-access.roles.deactivateConsequence')}
          confirmLabel={t('admin-access.roles.deactivate')}
          reason={{ label: t('admin-access.common.reason'), required: true }}
          pending={deactivate.pending}
          error={dialogError(deactivate.error, [])}
          onCancel={() => {
            deactivate.reset();
            setOpen(null);
          }}
          onConfirm={async ({ reason }) => {
            try {
              const saved = await deactivate.mutate({
                params: { roleId: role.roleId },
                body: { reason },
              });
              setRole(saved);
              setOpen(null);
              toast.show(t('admin-access.roles.deactivated'), 'success');
            } catch {
              // Shown in the dialog.
            }
          }}
        />
      )}
    </>
  );
}

export default function RoleDetailPage() {
  const admin = useMemberAdmin();
  const roleId = useIdParam('roleId');
  const location = useLocation();
  const seeded = (location.state as { readonly record?: RoleDetail } | null)?.record;
  const fromCommand = seeded !== undefined && seeded.roleId === roleId ? seeded : null;
  const query = useApiQuery(
    admin.endpoints.getRole,
    roleId === null || fromCommand !== null ? null : { params: { roleId } },
  );
  return (
    <AccessLayout>
      {roleId === null ? (
        <EmptyState title={t('admin-access.roles.notFound')} />
      ) : fromCommand !== null ? (
        <RoleView role={fromCommand} />
      ) : (
        <QueryView query={query}>{(role) => <RoleView key={role.roleId} role={role} />}</QueryView>
      )}
    </AccessLayout>
  );
}
