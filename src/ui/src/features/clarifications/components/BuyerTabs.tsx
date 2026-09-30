/**
 * Sub-navigation of the buyer clarifications workspace: Tender Q&A (BUY-16), Addenda and date changes (BUY-17) and
 * Briefings and site visits (BUY-18). Each tab shows only when the membership holds its permission.
 */
import { LinkTabs } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { useVisibleTabs } from '../hooks';

export function BuyerTabs() {
  const tabs = useVisibleTabs();
  return <LinkTabs label={t('clarifications.tabs.label')} tabs={tabs} />;
}
