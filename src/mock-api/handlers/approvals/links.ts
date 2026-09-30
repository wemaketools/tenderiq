/**
 * Which approval subject links a caller may follow. An approver or requester sees every approval of their route in
 * COM-04/COM-05, but the subject's own screen has its own guard (for example the Chief Executive decides awards and
 * strategies above the manager's limit without holding the strategy register's read permissions). A link is only
 * returned when the caller holds one of the permissions of the page it opens, so the inbox never leads to a
 * "not available in your role" page; the reference is then shown as plain text.
 *
 * The permission sets mirror the SPA route guards of the linked screens (`src/ui/src/features/<feature>/routes.tsx`).
 */
import { AWARD_READ_PERMISSIONS } from '../../../contracts/awards.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import { REQUEST_READ, STRATEGY_READ } from '../../../contracts/requests/shared.js';
import { SELECTION_VIEW_PERMISSIONS } from '../../../contracts/selection.js';

interface LinkGuard {
  readonly pattern: RegExp;
  readonly anyOf: readonly PermissionCode[];
}

/** First match wins: specific screens before their area. */
export const SUBJECT_LINK_GUARDS: readonly LinkGuard[] = [
  {
    pattern: /^\/buyer\/requests\/\d+\/decision$/,
    anyOf: ['request.review', 'request.approve', 'request.funding_confirm', 'request.view_all'],
  },
  { pattern: /^\/buyer\/requests\/\d+$/, anyOf: REQUEST_READ },
  { pattern: /^\/buyer\/strategies\/\d+$/, anyOf: STRATEGY_READ },
  { pattern: /^\/buyer\/tenders\/\d+(\/release)?$/, anyOf: ['tender.view'] },
  { pattern: /^\/buyer\/compliance\/exclusions\/\d+$/, anyOf: ['compliance.assess', 'exclusion.approve'] },
  {
    pattern: /^\/buyer\/selection\/(tenders|shortlists|preferred-bidders|negotiations)\/\d+$/,
    anyOf: SELECTION_VIEW_PERMISSIONS,
  },
  { pattern: /^\/buyer\/awards\/\d+$/, anyOf: AWARD_READ_PERMISSIONS },
  { pattern: /^\/buyer\/contracts\/\d+(\/changes|\/preparation)?$/, anyOf: ['contract.view'] },
  {
    pattern: /^\/buyer\/admin\/records\/disposals\/\d+$/,
    anyOf: ['audit.view', 'records.retention.manage', 'records.hold.manage', 'records.disposal.approve'],
  },
  { pattern: /^\/buyer\/submissions\/\d+$/, anyOf: ['bid.monitor'] },
  { pattern: /^\/buyer\/clarifications\/addenda\/\d+$/, anyOf: ['tender.clarifications.manage', 'tender.addenda.approve'] },
  { pattern: /^\/me\/approvals$/, anyOf: [] },
];

/** The guard of a subject link, or `undefined` when no guard is known for it. */
export function subjectLinkGuard(link: string): LinkGuard | undefined {
  const path = link.split(/[?#]/)[0] ?? link;
  return SUBJECT_LINK_GUARDS.find((guard) => guard.pattern.test(path));
}

/**
 * The subject link the caller may follow, or `null`. Links without a known guard are withheld as well, so a new
 * subject screen is never linked before its guard is listed here.
 */
export function subjectLinkFor(link: string, permissions: readonly PermissionCode[]): string | null {
  const guard = subjectLinkGuard(link);
  if (guard === undefined) {
    return null;
  }
  return guard.anyOf.length === 0 || guard.anyOf.some((code) => permissions.includes(code)) ? link : null;
}
