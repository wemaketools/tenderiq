/**
 * The sub-navigation of the users-and-access screens (settings layout of `settings.png`). Buyers: users (ADM-03),
 * roles and groups, access review and conflict reviews (ADM-04). Suppliers (SUP-04): members, roles, groups,
 * authority and tender assignments. Each tab shows only when the membership may open that screen.
 */
import type { ReactNode } from 'react';

import { usePermission } from '../../../auth/permissions';
import { VerticalTabs } from '../../../components/ui';
import type { LinkTabItem } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { useAdminKind } from '../lib/audience';
import { accessPaths, buyerAccessPaths, supplierAccessPaths } from '../lib/paths';
import {
  BUYER_CONFLICTS_READ,
  BUYER_GRANTS_READ,
  BUYER_ROLES_READ,
  BUYER_USERS_READ,
  SUPPLIER_USERS_MANAGE,
} from '../lib/permissions';

export function AccessLayout({ children }: { readonly children: ReactNode }) {
  const kind = useAdminKind();
  const users = usePermission(BUYER_USERS_READ);
  const roles = usePermission(BUYER_ROLES_READ);
  const grants = usePermission(BUYER_GRANTS_READ);
  const conflicts = usePermission(BUYER_CONFLICTS_READ);
  const supplier = usePermission(SUPPLIER_USERS_MANAGE);
  const paths = accessPaths(kind);
  const tabs: LinkTabItem[] = [];
  if (kind === 'buyer') {
    if (users) tabs.push({ to: paths.users, label: t('admin-access.nav.users') });
    if (roles) tabs.push({ to: paths.roles, label: t('admin-access.nav.roles') });
    if (roles) tabs.push({ to: paths.groups, label: t('admin-access.nav.groups') });
    if (grants) tabs.push({ to: buyerAccessPaths.review, label: t('admin-access.nav.review') });
    if (conflicts) {
      tabs.push({ to: buyerAccessPaths.conflicts, label: t('admin-access.nav.conflicts') });
    }
  } else if (supplier) {
    tabs.push({ to: paths.users, label: t('admin-access.nav.members') });
    tabs.push({ to: paths.roles, label: t('admin-access.nav.roles') });
    tabs.push({ to: paths.groups, label: t('admin-access.nav.groups') });
    tabs.push({ to: supplierAccessPaths.authority, label: t('admin-access.nav.authority') });
    tabs.push({ to: supplierAccessPaths.assignments, label: t('admin-access.nav.assignments') });
  }
  return (
    <VerticalTabs
      title={kind === 'buyer' ? t('admin-access.nav.title') : t('admin-access.nav.supplierTitle')}
      label={t('admin-access.nav.label')}
      tabs={tabs}
    >
      <div className="tiq-page">{children}</div>
    </VerticalTabs>
  );
}
