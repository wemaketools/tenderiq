/** The next required action of a tender (PRD §19). */
import type { TenderDetail } from '@contracts/tenders';

import { t } from '../../../lib/i18n';

/** The next required action (PRD §19): the first blocking decision, else the first publication blocker. */
export function nextActionOf(tender: TenderDetail): string | null {
  const blocking = tender.outstandingDecisions.find((item) => item.severity === 'blocking');
  if (blocking !== undefined) return blocking.title;
  if (!tender.editability.editable) return null;
  if (
    tender.gate.canRequestReleaseApproval &&
    tender.releaseApproval?.coversCurrentRevision !== true
  ) {
    return t('tender-authoring.workspace.nextRequestApproval');
  }
  const first = tender.outstandingDecisions[0];
  if (first !== undefined) return first.title;
  return tender.gate.blockedReasons[0] ?? null;
}
