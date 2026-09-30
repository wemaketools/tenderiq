/**
 * Record access shared by the dashboards and global search: the same predicates the owning domains apply when the
 * record is opened, so a dashboard row or a search hit never points at a record that answers 404 or 403 (BR-43;
 * plan §2, no dead ends).
 *
 * - Tenders: the tenders domain rule (`../tenders/model.ts`): holders of `tender.create` or `audit.view` see every
 *   tender of the organization; everyone else only the tenders whose team they are on.
 * - Approvals: the approvals domain rule: only the requester and the step approvers or their delegates open one.
 * - Documents: the documents domain access registry (`../documents/access.ts`).
 * - Links: the permission each SPA route requires (the routes of the owning features).
 */
import { CASE_READ_PERMISSIONS } from '../../../contracts/awards.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import { findFixtureApproval } from '../../fixtures/approvals.js';
import { findFixtureDocument } from '../../fixtures/documents.js';
import { TENDERS } from '../../fixtures/tenders/tenders.js';
import { involvementOf } from '../approvals/view.js';
import { canRead } from '../documents/access.js';
import { isActiveMember, seesAllTenders } from '../tenders/model.js';
import { hasAny } from './engine.js';

/** Who is looking, in the tenant they act in. */
export interface Viewer {
  readonly tenantId: number;
  readonly userId: number;
  readonly permissions: readonly PermissionCode[];
}

/**
 * The caller may open this tender of the tenant (`GET /api/v1/buyer/tenders/{id}` answers 200). A tender outside
 * the tenders-domain register (the imported legacy tender) is reachable only for organization-wide readers.
 */
export function tenderAccessible(viewer: Viewer, tenderId: number): boolean {
  if (!viewer.permissions.includes('tender.view')) {
    return false;
  }
  const registered = TENDERS.find((tender) => tender.id === tenderId && !tender.isTemplate);
  if (registered !== undefined && registered.tenantId !== viewer.tenantId) {
    return false;
  }
  return seesAllTenders(viewer.permissions) || (registered !== undefined && isActiveMember(tenderId, viewer.userId));
}

/** The caller is the requester, a step approver or a delegate of the approval (`/me/approvals/{id}` opens). */
export function approvalAccessible(viewer: Viewer, approvalId: number): boolean {
  const approval = findFixtureApproval(approvalId);
  return approval !== undefined && approval.tenantId === viewer.tenantId && involvementOf(approval, viewer.userId) !== null;
}

/** The caller may read the document in this tenant (`/me/documents/{id}` opens). */
export function documentAccessible(viewer: Viewer, documentId: number): boolean {
  const document = findFixtureDocument(documentId);
  return document !== undefined && canRead(document, { tenantId: viewer.tenantId, permissions: viewer.permissions });
}

interface RouteRule {
  readonly pattern: RegExp;
  readonly allowed: (viewer: Viewer, match: RegExpExecArray) => boolean;
}

const idOf = (match: RegExpExecArray): number => Number(match[1]);

/** Buyer routes the dashboards link to, most specific first, with the access their pages require. */
const ROUTE_RULES: readonly RouteRule[] = [
  {
    pattern: /^\/buyer\/tenders\/(\d+)\/publication$/,
    allowed: (viewer, match) => hasAny(viewer.permissions, ['tender.publish', 'tender.view']) && tenderAccessible(viewer, idOf(match)),
  },
  { pattern: /^\/buyer\/tenders\/(\d+)/, allowed: (viewer, match) => tenderAccessible(viewer, idOf(match)) },
  { pattern: /^\/buyer\/tenders(\?|$)/, allowed: (viewer) => viewer.permissions.includes('tender.view') },
  { pattern: /^\/buyer\/contracts/, allowed: (viewer) => viewer.permissions.includes('contract.view') },
  { pattern: /^\/buyer\/award-cases\/complaints/, allowed: (viewer) => hasAny(viewer.permissions, CASE_READ_PERMISSIONS) },
  { pattern: /^\/buyer\/admin\/service\/integrations/, allowed: (viewer) => viewer.permissions.includes('org.integrations.manage') },
  { pattern: /^\/buyer\/suppliers/, allowed: (viewer) => viewer.permissions.includes('supplier.directory.view') },
  { pattern: /^\/buyer\/requests\//, allowed: (viewer) => hasAny(viewer.permissions, ['request.view_all', 'request.create']) },
  { pattern: /^\/me\/approvals\/(\d+)$/, allowed: (viewer, match) => approvalAccessible(viewer, idOf(match)) },
  { pattern: /^\/me\/documents\/(\d+)$/, allowed: (viewer, match) => documentAccessible(viewer, idOf(match)) },
];

/** The caller's page for `to` opens (routes without a rule here are personal pages such as `/me/tasks`). */
export function linkAccessible(viewer: Viewer, to: string): boolean {
  for (const rule of ROUTE_RULES) {
    const match = rule.pattern.exec(to);
    if (match !== null) {
      return rule.allowed(viewer, match);
    }
  }
  return true;
}
