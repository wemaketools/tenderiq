/**
 * Permission sets of the evaluation screens, mirroring the contract (BR-26). The API still limits every row to the
 * caller's assignments; these only decide which routes, navigation items and actions are offered.
 */
import type { PermissionCode } from '@contracts/permissions';

export {
  ASSIGNMENT_ACT_PERMISSIONS,
  ASSIGNMENT_VIEW_PERMISSIONS,
  EVALUATION_OVERVIEW_PERMISSIONS,
  RESULTS_VIEW_PERMISSIONS,
} from '@contracts/evaluation';

type AnyOf = readonly [PermissionCode, ...PermissionCode[]];

/** EVA-02: the assigned evaluator, or the chair for oversight (read only). */
export const ASSESSMENT_VIEW_PERMISSIONS: AnyOf = ['evaluation.score', 'evaluation.chair'];

/** EVA-04: commercial reviewers and the chair. */
export const COMMERCIAL_VIEW_PERMISSIONS: AnyOf = ['evaluation.commercial', 'evaluation.chair'];

/** EVA-05: the moderating committee and the chair. */
export const MODERATION_VIEW_PERMISSIONS: AnyOf = ['evaluation.moderate', 'evaluation.chair'];

/** Who may request an export of the evaluation record. */
export const REPORT_EXPORT_PERMISSIONS: AnyOf = [
  'evaluation.chair',
  'evaluation.signoff',
  'award.recommend',
];
