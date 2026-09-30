/**
 * COM-08 handlers: global search across the caller's active memberships and the caller's saved views (DD-21).
 * Each index entry is checked against the caller's permissions IN ITS OWN TENANT before it is matched or counted,
 * so results, counts and organization totals never reveal restricted records (BR-43).
 */
import type { OrganizationLabel } from '../../../contracts/common.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import type { SavedView, SearchResult, SearchResultType } from '../../../contracts/reporting.js';
import { SEARCH_RESULT_TYPES, createSavedView, deleteSavedView, listSavedViews, search, updateSavedView } from '../../../contracts/reporting.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { SAVED_VIEWS, SEARCH_INDEX } from '../../fixtures/reporting/index.js';
import type { FixtureSavedView, FixtureSearchEntry } from '../../fixtures/reporting/index.js';
import { membershipPermissions, organizationLabel } from '../../persona.js';
import { containsText, hasAny } from './engine.js';

/** Most saved views one person may keep per organization. */
export const SAVED_VIEW_LIMIT = 50;

function visibleTo(entry: FixtureSearchEntry, userId: number, permissions: readonly PermissionCode[]): boolean {
  if (entry.ownerUserIds !== null) {
    return entry.ownerUserIds.includes(userId);
  }
  return entry.alsoVisibleTo.includes(userId) || (entry.visibleWith.length > 0 && hasAny(permissions, entry.visibleWith));
}

function matchedOn(entry: FixtureSearchEntry, q: string): string {
  const needle = q.toLowerCase();
  if (entry.reference !== null && entry.reference.toLowerCase().includes(needle)) {
    return 'Reference';
  }
  if (entry.title.toLowerCase().includes(needle)) {
    return 'Title';
  }
  if ((entry.subtitle ?? '').toLowerCase().includes(needle)) {
    return 'Description';
  }
  return 'Related terms';
}

function relevance(entry: FixtureSearchEntry, q: string): number {
  const needle = q.toLowerCase();
  if (entry.reference?.toLowerCase() === needle) return 0;
  if (entry.title.toLowerCase().startsWith(needle)) return 1;
  if (entry.title.toLowerCase().includes(needle)) return 2;
  if (entry.reference?.toLowerCase().includes(needle) === true) return 3;
  return 4;
}

function toSavedView(view: FixtureSavedView): SavedView {
  const { tenantId, userId: _userId, ...rest } = view;
  return { ...rest, filters: { ...rest.filters }, organization: organizationLabel(tenantId) };
}

export function registerSearch(app: MockApp): void {
  mockRoute(app, search, ({ requirePersona, fixtures, query, fail }) => {
    const persona = requirePersona();
    const memberships = fixtures.activeMemberships();
    if (query.tenantId !== undefined && !memberships.some((membership) => membership.tenantId === query.tenantId)) {
      fail(403, 'TENANT_ACCESS_DENIED');
    }
    const permissionsByTenant = new Map(memberships.map((membership) => [membership.tenantId, membershipPermissions(membership)]));
    const authorized = SEARCH_INDEX.filter((entry) => {
      const permissions = permissionsByTenant.get(entry.tenantId);
      return permissions !== undefined && visibleTo(entry, persona.userId, permissions);
    });
    const matching = authorized
      .filter((entry) => containsText(`${entry.title} ${entry.reference ?? ''} ${entry.subtitle ?? ''} ${entry.keywords}`, query.q))
      .filter((entry) => query.updatedFrom === undefined || entry.updatedAt.slice(0, 10) >= query.updatedFrom)
      .filter((entry) => query.updatedTo === undefined || entry.updatedAt.slice(0, 10) <= query.updatedTo);
    const inTenant = matching.filter((entry) => query.tenantId === undefined || entry.tenantId === query.tenantId);
    const types: readonly SearchResultType[] = query.type ?? SEARCH_RESULT_TYPES;
    const selected = inTenant.filter((entry) => types.includes(entry.type));

    const sorted = [...selected].sort((a, b) => {
      if (query.sort === 'title') {
        return (query.dir === 'desc' ? -1 : 1) * a.title.localeCompare(b.title);
      }
      if (query.sort === 'updatedAt') {
        return (query.dir === 'desc' ? -1 : 1) * a.updatedAt.localeCompare(b.updatedAt);
      }
      return relevance(a, query.q) - relevance(b, query.q) || b.updatedAt.localeCompare(a.updatedAt);
    });
    const results: SearchResult[] = sorted.map((entry) => ({
      key: `${entry.type}:${entry.tenantId}:${entry.recordId}`,
      type: entry.type,
      recordId: entry.recordId,
      title: entry.title,
      reference: entry.reference,
      subtitle: entry.subtitle,
      status: entry.status === null ? null : { enum: entry.status.enum, value: entry.status.value },
      organization: organizationLabel(entry.tenantId),
      to: entry.to,
      updatedAt: entry.updatedAt,
      matchedOn: matchedOn(entry, query.q),
    }));

    const organizations = new Map<number, { organization: OrganizationLabel; count: number }>();
    for (const entry of matching.filter((item) => types.includes(item.type))) {
      const current = organizations.get(entry.tenantId) ?? { organization: organizationLabel(entry.tenantId), count: 0 };
      organizations.set(entry.tenantId, { ...current, count: current.count + 1 });
    }
    return {
      ...fixtures.page(results),
      query: query.q,
      counts: SEARCH_RESULT_TYPES.map((type) => ({ type, count: inTenant.filter((entry) => entry.type === type).length })).filter((item) => item.count > 0),
      organizations: [...organizations.values()],
    };
  });

  mockRoute(app, listSavedViews, ({ requirePersona, fixtures, query }) => {
    const persona = requirePersona();
    const tenantIds = new Set(fixtures.activeMemberships().map((membership) => membership.tenantId));
    const rows = SAVED_VIEWS.filter((view) => view.userId === persona.userId && tenantIds.has(view.tenantId))
      .filter((view) => query.scope === undefined || view.scope === query.scope)
      .filter((view) => query.tenantId === undefined || view.tenantId === query.tenantId)
      .filter((view) => containsText(view.name, query.q))
      .sort((a, b) => a.scope.localeCompare(b.scope) || Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name))
      .map(toSavedView);
    return fixtures.page(rows);
  });

  mockRoute(app, createSavedView, ({ requirePersona, requireTenant, body, now, fail }) => {
    const persona = requirePersona();
    const { tenant } = requireTenant();
    const own = SAVED_VIEWS.filter((view) => view.userId === persona.userId && view.tenantId === tenant.id);
    if (own.some((view) => view.scope === body.scope && view.name.toLowerCase() === body.name.toLowerCase())) {
      fail(409, 'DUPLICATE_VIEW_NAME', 'You already have a saved view with this name on this screen.');
    }
    if (own.length >= SAVED_VIEW_LIMIT) {
      fail(409, 'SAVED_VIEW_LIMIT_REACHED', `You can keep at most ${SAVED_VIEW_LIMIT} saved views per organization.`);
    }
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    return toSavedView({ id: 900, tenantId: tenant.id, userId: persona.userId, ...body, createdAt: at, updatedAt: at });
  });

  mockRoute(app, updateSavedView, ({ requirePersona, requireTenant, params, body, now, fail, notFound }) => {
    const persona = requirePersona();
    const { tenant } = requireTenant();
    const view = SAVED_VIEWS.find((row) => row.id === params.viewId && row.userId === persona.userId && row.tenantId === tenant.id);
    if (view === undefined) {
      return notFound('No such saved view.');
    }
    if (SAVED_VIEWS.some((row) => row.id !== view.id && row.userId === persona.userId && row.tenantId === tenant.id && row.scope === body.scope && row.name.toLowerCase() === body.name.toLowerCase())) {
      fail(409, 'DUPLICATE_VIEW_NAME', 'You already have a saved view with this name on this screen.');
    }
    return toSavedView({ ...view, ...body, updatedAt: now.toISOString().replace(/\.\d{3}Z$/, 'Z') });
  });

  mockRoute(app, deleteSavedView, ({ requirePersona, requireTenant, params, notFound }) => {
    const persona = requirePersona();
    const { tenant } = requireTenant();
    const view = SAVED_VIEWS.find((row) => row.id === params.viewId && row.userId === persona.userId && row.tenantId === tenant.id);
    if (view === undefined) {
      return notFound('No such saved view.');
    }
    return null;
  });
}
