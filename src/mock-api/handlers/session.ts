/**
 * Mock handlers of the session contract (`src/contracts/session.ts`; COM-01..03, DD-21, DD-36, DD-43).
 *
 * - `GET /api/v1/me/context`: the caller, EVERY membership (active and not, so COM-02 can explain a pending or
 *   suspended one; each with its own tenant only), `environment = { mode: 'prototype', appEnv }` (the SPA shows the
 *   prototype banner) and, with `?tenantId=`, the effective permissions there. A tenant the caller cannot enter
 *   gets the one identical 403 of the tenant middleware.
 * - `PUT /api/v1/me/theme`: echoes the requested theme; nothing is stored (static prototype).
 */
import type { SessionContext, SessionMembership } from '../../contracts/session.js';
import { getSessionContext, updateTheme } from '../../contracts/session.js';
import { mockRoute } from '../app.js';
import type { MockApp } from '../app.js';
import { sessionProfileOf } from '../fixtures/session.js';
import { tenantAccessDeniedError } from '../middleware/problem.js';
import { findTenantById, findTenantRole, resolveTenantAccess } from '../persona.js';
import type { Persona, TenantAccess } from '../persona.js';

function membershipsOf(persona: Persona): SessionMembership[] {
  return persona.memberships.flatMap((membership) => {
    const tenant = findTenantById(membership.tenantId);
    if (tenant === undefined) {
      return [];
    }
    return [
      {
        membershipId: membership.membershipId,
        tenantId: tenant.id,
        tenantKind: tenant.kind,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        tenantStatus: tenant.status,
        capacity: membership.capacity,
        status: membership.status,
        joinedAt: membership.joinedAt,
        roles: membership.roles.map((assignment) => {
          const role = findTenantRole(tenant.id, assignment.roleCode);
          if (role === undefined) {
            throw new Error(`Unknown role ${assignment.roleCode} in tenant ${tenant.slug}.`);
          }
          return {
            roleId: role.roleId,
            code: role.code,
            name: role.name,
            templateCode: role.templateCode,
            scopeType: assignment.scopeType,
            scopeId: assignment.scopeId,
            scopeLabel: assignment.scopeLabel,
          };
        }),
      },
    ];
  });
}

function activeTenantOf(access: TenantAccess): NonNullable<SessionContext['activeTenant']> {
  const grant = access.supportGrant;
  return {
    tenantId: access.tenant.id,
    kind: access.tenant.kind,
    name: access.tenant.name,
    slug: access.tenant.slug,
    officialTimeZone: access.tenant.officialTimeZone,
    defaultCurrency: access.tenant.defaultCurrency,
    workingLanguages: [...access.tenant.workingLanguages],
    capacity: access.capacity,
    access: access.access,
    supportGrant:
      grant === null
        ? null
        : { grantId: grant.grantId, caseId: grant.caseId, scope: grant.scope, startsAt: grant.startsAt, expiresAt: grant.expiresAt },
    permissions: [...access.permissions],
  };
}

export function register(app: MockApp): void {
  mockRoute(app, getSessionContext, ({ requirePersona, query, now, appEnv }) => {
    const persona = requirePersona();
    const profile = sessionProfileOf(persona.email);
    let activeTenant: SessionContext['activeTenant'] = null;
    if (query.tenantId !== undefined) {
      const access = resolveTenantAccess(persona, query.tenantId, now, null);
      if (access === null) {
        throw tenantAccessDeniedError();
      }
      activeTenant = activeTenantOf(access);
    }
    const context: SessionContext = {
      user: {
        id: persona.userId,
        email: persona.email,
        fullName: persona.fullName,
        phone: profile.phone,
        locale: profile.locale,
        displayTimeZone: profile.displayTimeZone,
        theme: profile.theme,
        status: persona.status,
        isPlatformOperator: persona.isPlatformOperator,
        lastSeenAt: profile.lastSeenAt,
      },
      memberships: membershipsOf(persona),
      activeTenant,
      environment: { mode: 'prototype', appEnv },
      serverTime: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    };
    return context;
  });

  mockRoute(app, updateTheme, ({ body }) => ({ theme: body.theme }));
}
