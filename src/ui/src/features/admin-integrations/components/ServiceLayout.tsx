/**
 * The sub-navigation of the buyer service screens (settings layout of `settings.png`): integrations and exceptions
 * (ADM-15), imports (ADM-16), subscription and offboarding (ADM-17) and support access. Each entry shows only when
 * the membership may open that screen.
 */
import type { ReactNode } from 'react';

import { VerticalTabs } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { useServiceTabs } from '../lib/tabs';

export function ServiceLayout({ children }: { readonly children: ReactNode }) {
  const tabs = useServiceTabs();
  return (
    <VerticalTabs
      title={t('admin-integrations.nav.title')}
      label={t('admin-integrations.nav.label')}
      tabs={tabs}
    >
      <div className="tiq-page">{children}</div>
    </VerticalTabs>
  );
}
