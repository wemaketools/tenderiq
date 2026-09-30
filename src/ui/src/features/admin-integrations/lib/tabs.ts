/** The service-area screens the membership may open (settings sub-navigation and the area entry). */
import { usePermission } from '../../../auth/permissions';
import type { LinkTabItem } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { servicePaths } from './paths';
import {
  EXCEPTIONS_ACCESS,
  IMPORTS_MANAGE,
  INTEGRATIONS_MANAGE,
  SUBSCRIPTION_VIEW,
  SUPPORT_ACCESS,
} from './permissions';

/** The screens of the service area the membership may open, in display order. */
export function useServiceTabs(): LinkTabItem[] {
  const integrations = usePermission(INTEGRATIONS_MANAGE);
  const exceptions = usePermission(EXCEPTIONS_ACCESS);
  const imports = usePermission(IMPORTS_MANAGE);
  const subscription = usePermission(SUBSCRIPTION_VIEW);
  const support = usePermission(SUPPORT_ACCESS);
  const tabs: LinkTabItem[] = [];
  if (integrations)
    tabs.push({ to: servicePaths.integrations, label: t('admin-integrations.nav.integrations') });
  if (exceptions)
    tabs.push({ to: servicePaths.exceptions, label: t('admin-integrations.nav.exceptions') });
  if (imports) tabs.push({ to: servicePaths.imports, label: t('admin-integrations.nav.imports') });
  if (subscription)
    tabs.push({ to: servicePaths.subscription, label: t('admin-integrations.nav.subscription') });
  if (support)
    tabs.push({ to: servicePaths.supportAccess, label: t('admin-integrations.nav.supportAccess') });
  return tabs;
}
