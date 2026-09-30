/**
 * The sub-navigation of the policy administration screens (settings layout of `settings.png`): policy profiles
 * (ADM-06), forms and fields (ADM-07), templates (ADM-08) and the public portal policy (ADM-11). Each tab shows only
 * when the membership may open that screen.
 */
import type { ReactNode } from 'react';

import { usePermission } from '../../../auth/permissions';
import { VerticalTabs } from '../../../components/ui';
import type { LinkTabItem } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { policyPaths } from '../lib/paths';
import { FIELDS_READ, PORTAL_READ, PROFILES_READ, TEMPLATES_READ } from '../lib/permissions';

export function PolicyLayout({ children }: { readonly children: ReactNode }) {
  const profiles = usePermission(PROFILES_READ);
  const fields = usePermission(FIELDS_READ);
  const templates = usePermission(TEMPLATES_READ);
  const portal = usePermission(PORTAL_READ);
  const tabs: LinkTabItem[] = [];
  if (profiles) tabs.push({ to: policyPaths.profiles, label: t('admin-policy.nav.profiles') });
  if (fields) tabs.push({ to: policyPaths.fields, label: t('admin-policy.nav.fields') });
  if (templates) tabs.push({ to: policyPaths.templates, label: t('admin-policy.nav.templates') });
  if (portal) tabs.push({ to: policyPaths.portal, label: t('admin-policy.nav.portal') });
  return (
    <VerticalTabs
      title={t('admin-policy.nav.title')}
      label={t('admin-policy.nav.label')}
      tabs={tabs}
    >
      <div className="tiq-page">{children}</div>
    </VerticalTabs>
  );
}
