/** The OPS-04 sub-navigation: the case queue and the register of support access grants. */
import { LinkTabs } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { opsPaths } from '../lib/paths';

export function SupportTabs() {
  return (
    <LinkTabs
      label={t('ops.support.tabs')}
      tabs={[
        { to: opsPaths.support, label: t('ops.support.cases'), end: true },
        { to: opsPaths.supportGrants, label: t('ops.support.grants') },
      ]}
    />
  );
}

/** The OPS-07 sub-navigation: product announcements and help articles. */
export function ContentTabs() {
  return (
    <LinkTabs
      label={t('ops.content.tabs')}
      tabs={[
        { to: opsPaths.announcements, label: t('ops.content.announcements') },
        { to: opsPaths.helpArticles, label: t('ops.content.help') },
      ]}
    />
  );
}
