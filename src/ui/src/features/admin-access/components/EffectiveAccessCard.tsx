/**
 * Effective access of one member (ADM-04, PRD §4.2): every permission with its sources (roles held directly, roles
 * via groups, direct grants with their expiry), the restrictions that win over them, and incompatible authority
 * per the organization's segregation-of-duties policies.
 */
import { useState } from 'react';

import { orgAdminEndpoints } from '@contracts/org-admin';
import type { EffectivePermission } from '@contracts/org-admin';

import { useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Card,
  Chip,
  DataTable,
  EmptyState,
  QueryView,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import { formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useOfficialTimeZone } from '../lib/hooks';

export function EffectiveAccessCard({ userId }: { readonly userId: number }) {
  const timeZone = useOfficialTimeZone();
  const query = useApiQuery(orgAdminEndpoints.getEffectiveAccess, { params: { userId } });
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  return (
    <Card title={t('admin-access.effective.title')} subtitle={t('admin-access.effective.intro')}>
      <QueryView query={query}>
        {(access) => {
          const needle = search.trim().toLowerCase();
          const rows = access.permissions.filter(
            (permission) =>
              (needle === '' ||
                permission.code.includes(needle) ||
                permission.description.toLowerCase().includes(needle)) &&
              (state === '' ||
                (state === 'effective' && permission.effective) ||
                (state === 'restricted' && permission.restrictedBy.length > 0) ||
                (state === 'grant' &&
                  permission.sources.some((source) => source.kind === 'direct_grant'))),
          );
          return (
            <div className="tiq-stack">
              {access.sodBreaches.length > 0 && (
                <Banner tone="warning" title={t('admin-access.effective.sodTitle')}>
                  <ul>
                    {access.sodBreaches.map((breach) => (
                      <li key={breach.ruleCode}>
                        {t('admin-access.effective.sodLine', {
                          rule: tEnum('sod_policies.rule_code', breach.ruleCode),
                          first: breach.permissions[0],
                          second: breach.permissions[1],
                          mode: tEnum('sod_policies.mode', breach.mode),
                        })}
                      </li>
                    ))}
                  </ul>
                </Banner>
              )}
              <div className="tiq-filterbar">
                <SearchField
                  label={t('admin-access.effective.search')}
                  value={search}
                  onChange={setSearch}
                />
                <Select
                  label={t('admin-access.effective.filter')}
                  placeholder={t('admin-access.common.all')}
                  value={state}
                  onChange={setState}
                  options={[
                    { value: 'effective', label: t('admin-access.effective.effective') },
                    { value: 'restricted', label: t('admin-access.effective.restricted') },
                    { value: 'grant', label: t('admin-access.effective.fromGrant') },
                  ]}
                />
              </div>
              <DataTable<EffectivePermission>
                caption={t('admin-access.effective.title')}
                rows={rows}
                rowKey={(row) => row.code}
                empty={
                  <EmptyState
                    compact
                    title={
                      access.permissions.length === 0
                        ? t('admin-access.effective.none')
                        : t('admin-access.effective.empty')
                    }
                  />
                }
                columns={[
                  {
                    id: 'code',
                    header: t('admin-access.effective.col.permission'),
                    cell: (row) => (
                      <>
                        <span className="tiq-mono">{row.code}</span>
                        <span className="tiq-cell-sub">{row.description}</span>
                      </>
                    ),
                  },
                  {
                    id: 'category',
                    header: t('admin-access.effective.col.category'),
                    cell: (row) => row.category,
                  },
                  {
                    id: 'sources',
                    header: t('admin-access.effective.col.sources'),
                    cell: (row) => (
                      <ul className="tiq-stack">
                        {row.sources.map((source, index) => (
                          <li key={`${source.label}-${index}`}>
                            <span>{source.label}</span>
                            <span className="tiq-cell-sub">
                              {t(`admin-access.source.${source.kind}`)} · {source.scope.scopeLabel}
                              {source.expiresAt !== null &&
                                ` · ${t('admin-access.common.until', {
                                  date: formatInstantDate(source.expiresAt, timeZone),
                                })}`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ),
                  },
                  {
                    id: 'state',
                    header: t('admin-access.effective.col.state'),
                    cell: (row) => <PermissionState row={row} />,
                  },
                ]}
              />
            </div>
          );
        }}
      </QueryView>
    </Card>
  );
}

/**
 * Whether a permission can be used: restrictions win over roles and grants (PRD §4.2). An organization-wide
 * restriction (for example a suspension) blocks it everywhere; a scoped one (for example a conflict on one tender)
 * blocks it only there, so the permission stays effective elsewhere and the restriction is listed beside it.
 */
function PermissionState({ row }: { readonly row: EffectivePermission }) {
  const restrictions = row.restrictedBy.map((restriction) => (
    <span key={restriction.restrictionId} className="tiq-cell-sub">
      <StatusChip
        enum="access_restrictions.restriction_type"
        value={restriction.restrictionType}
        size="sm"
      />{' '}
      {restriction.scopeLabel}: {restriction.reason}
    </span>
  ));
  if (!row.effective) {
    return (
      <>
        <Chip tone="danger" size="sm" icon="lock">
          {t('admin-access.effective.restricted')}
        </Chip>
        {restrictions}
      </>
    );
  }
  if (row.restrictedBy.length > 0) {
    return (
      <>
        <Chip tone="warning" size="sm" icon="lock">
          {t('admin-access.effective.restrictedInScope')}
        </Chip>
        {restrictions}
      </>
    );
  }
  return (
    <Chip tone="success" size="sm">
      {t('admin-access.effective.effective')}
    </Chip>
  );
}
