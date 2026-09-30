/**
 * Sub-navigation between the three operator supplier reviews: pending registrations, possible duplicates and
 * legal-identity changes. The operator sees organization identity metadata only, never procurement content.
 */
import { LinkTabs } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { directoryPaths } from '../lib/paths';

export function OpsReviewTabs() {
  return (
    <LinkTabs
      label={t('supplier-directory.ops.tabs')}
      tabs={[
        { to: directoryPaths.registrations, label: t('supplier-directory.ops.registrations') },
        { to: directoryPaths.duplicates, label: t('supplier-directory.ops.duplicates') },
        { to: directoryPaths.identityChanges, label: t('supplier-directory.ops.identityChanges') },
      ]}
    />
  );
}
