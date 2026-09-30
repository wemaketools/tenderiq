/**
 * The clarification sources the active membership may raise from: `evaluation` for evaluators and the chair, the
 * others for compliance assessors (the API answers SOURCE_NOT_PERMITTED otherwise).
 */
import { BID_CLARIFICATIONS_SOURCE } from '@contracts/enums';
import type { BidClarificationsSource } from '@contracts/enums';

import { usePermission } from '../../../auth/permissions';

export function useClarificationSources(): BidClarificationsSource[] {
  const evaluator = usePermission(['evaluation.score', 'evaluation.chair']);
  const assessor = usePermission('compliance.assess');
  return BID_CLARIFICATIONS_SOURCE.filter((source) =>
    source === 'evaluation' ? evaluator : assessor,
  );
}
