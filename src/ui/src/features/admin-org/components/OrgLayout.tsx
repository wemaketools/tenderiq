/**
 * The sub-navigation of the organization screens (settings layout of `settings.png`): organization and legal
 * entities (ADM-01), departments, locations and classifications (ADM-02), and authority, committees and delegations
 * (ADM-05). Each tab shows only when the membership may open that screen.
 */
import type { ReactNode } from 'react';

import { usePermission } from '../../../auth/permissions';
import { VerticalTabs } from '../../../components/ui';
import type { LinkTabItem } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { orgPaths } from '../lib/paths';
import { AUTHORITY_READ, COMMITTEES_READ, ORG_READ, STRUCTURE_READ } from '../lib/permissions';

export function OrgLayout({ children }: { readonly children: ReactNode }) {
  const organization = usePermission(ORG_READ);
  const structure = usePermission(STRUCTURE_READ);
  const authority = usePermission(AUTHORITY_READ);
  const committees = usePermission(COMMITTEES_READ);
  const tabs: LinkTabItem[] = [];
  if (organization) tabs.push({ to: orgPaths.settings, label: t('admin-org.nav.settings') });
  if (structure) tabs.push({ to: orgPaths.structure, label: t('admin-org.nav.structure') });
  if (authority || committees) {
    tabs.push({ to: orgPaths.authority, label: t('admin-org.nav.authority') });
  }
  return (
    <VerticalTabs title={t('admin-org.nav.title')} label={t('admin-org.nav.label')} tabs={tabs}>
      <div className="tiq-page">{children}</div>
    </VerticalTabs>
  );
}
