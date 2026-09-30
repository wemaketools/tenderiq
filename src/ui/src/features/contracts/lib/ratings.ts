/**
 * Performance rating texts (CON-07, CON-10): a rating that is not finalized is only ever shown as a proposal.
 */
import type { ProposedRating } from '@contracts/contracts';

import { t, tEnum } from '../../../lib/i18n';

/** `Proposed: Partially meets, not final (disputed by the supplier)`. */
export function proposedRatingText(proposed: ProposedRating): string {
  return t('contracts.performance.proposed', {
    rating: tEnum('performance_reviews.overall_rating', proposed.rating),
    state: proposed.supplierDisputes
      ? t('contracts.performance.proposedDisputed')
      : tEnum('performance_reviews.status', proposed.reviewStatus),
  });
}
