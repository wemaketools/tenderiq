/** Sub-navigation of BUY-29: debrief requests and complaint cases. */
import { LinkTabs } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { awardPaths } from '../lib/paths';

export function CasesTabs() {
  return (
    <LinkTabs
      label={t('awards.cases.tabs')}
      tabs={[
        { to: awardPaths.debriefs, label: t('awards.cases.debriefs'), end: true },
        { to: awardPaths.complaints, label: t('awards.cases.complaints') },
      ]}
    />
  );
}
