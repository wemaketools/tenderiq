/**
 * Sub-navigation of the buyer selection workspace: overview, demonstrations and references (BUY-22), shortlists
 * (BUY-23), preferred bidders (BUY-24), due diligence (BUY-25), negotiations and final offers (BUY-27). Each tab
 * shows only when the membership may open that screen.
 */
import { usePermission } from '../../../auth/permissions';
import { LinkTabs } from '../../../components/ui';
import type { LinkTabItem } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { selectionPaths } from '../lib/paths';
import { ASSESSMENT_READ, SELECTION_READ } from '../lib/permissions';

export function SelectionTabs() {
  const canRead = usePermission(SELECTION_READ);
  const canAssess = usePermission(ASSESSMENT_READ);
  const tabs: LinkTabItem[] = [];
  if (canRead)
    tabs.push({ to: selectionPaths.home, label: t('selection.tabs.overview'), end: true });
  if (canAssess) {
    tabs.push({ to: selectionPaths.assessments, label: t('selection.tabs.assessments') });
    tabs.push({ to: selectionPaths.references, label: t('selection.tabs.references') });
  }
  if (canRead) {
    tabs.push({ to: selectionPaths.shortlists, label: t('selection.tabs.shortlists') });
    tabs.push({ to: selectionPaths.preferredBidders, label: t('selection.tabs.preferredBidders') });
    tabs.push({ to: selectionPaths.diligence, label: t('selection.tabs.diligence') });
    tabs.push({ to: selectionPaths.negotiations, label: t('selection.tabs.negotiations') });
    tabs.push({ to: selectionPaths.finalOffers, label: t('selection.tabs.finalOffers') });
  }
  return <LinkTabs label={t('selection.tabs.label')} tabs={tabs} />;
}
