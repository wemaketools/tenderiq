/**
 * Personas and tenant access for the mock API (architecture-plan §3.1, §3.2, §3.11; docs/technical/07-api.md §3.3).
 *
 * - `findPersonaByEmail` maps a VERIFIED token e-mail to its fixture persona (DD-43). Unknown → the caller answers
 *   401. A persona whose user status is not `active` also gets 401 (brief §5.7, AC-04).
 * - `resolveTenantAccess` is the tenant check behind the ONE identical 403: an active membership in an active
 *   tenant (or, for a platform operator, an active customer-authorized support grant), and a tenant kind equal to
 *   the one the route prefix requires. It returns `null` for every failure, so callers cannot tell them apart.
 * - Effective permissions are the union of the persona's role permissions in that tenant (templates from
 *   `src/contracts/permissions.ts`). Under a support grant the set is exactly `SUPPORT_GRANT_PERMISSIONS`.
 *   Stage B adds groups, direct grants and restrictions (docs/technical/04-security-model.md §5.3).
 */
import type { OrganizationLabel, PersonRef, TenantKind } from '../contracts/common.js';
import { PERMISSION_CODES, SUPPORT_GRANT_PERMISSIONS } from '../contracts/permissions.js';
import type { PermissionCode } from '../contracts/permissions.js';
import { PERSONAS, SUPPORT_GRANTS, TENANTS, TENANT_ROLES } from './fixtures/platform.js';
import type { FixtureMembership, FixturePersona, FixtureRole, FixtureSupportGrant, FixtureTenant } from './fixtures/platform.js';

export type Persona = FixturePersona;
export type { FixtureMembership, FixtureRole, FixtureSupportGrant, FixtureTenant } from './fixtures/platform.js';

/** How the caller reaches a tenant, with the effective permissions there. */
export interface TenantAccess {
  readonly tenant: FixtureTenant;
  readonly access: 'membership' | 'support_grant';
  /** The membership used (null under a support grant). */
  readonly membership: FixtureMembership | null;
  /** The grant in force (null for a membership). */
  readonly supportGrant: FixtureSupportGrant | null;
  /** The capacity the caller acts in (BR-02). */
  readonly capacity: string | null;
  /** Effective permissions in this tenant, in catalog order. */
  readonly permissions: readonly PermissionCode[];
}

const personasByEmail = new Map(PERSONAS.map((persona) => [persona.email.toLowerCase(), persona]));
const personasById = new Map(PERSONAS.map((persona) => [persona.userId, persona]));
const tenantsById = new Map(TENANTS.map((tenant) => [tenant.id, tenant]));
const tenantsBySlug = new Map(TENANTS.map((tenant) => [tenant.slug, tenant]));
const rolesByTenantAndCode = new Map(TENANT_ROLES.map((role) => [`${role.tenantId}:${role.code}`, role]));

/** The persona of a verified e-mail (case-insensitive), or `undefined`. */
export function findPersonaByEmail(email: string | null | undefined): Persona | undefined {
  if (email === null || email === undefined) {
    return undefined;
  }
  return personasByEmail.get(email.trim().toLowerCase());
}

/** The persona of a user id, or `undefined`. */
export function findPersonaById(userId: number): Persona | undefined {
  return personasById.get(userId);
}

/** The persona of an e-mail; throws for an unknown one (fixture code and tests). */
export function personaByEmail(email: string): Persona {
  const persona = findPersonaByEmail(email);
  if (persona === undefined) {
    throw new Error(`No fixture persona for ${email}.`);
  }
  return persona;
}

/** Every persona (read-only). */
export function allPersonas(): readonly Persona[] {
  return PERSONAS;
}

/** True when the persona may authenticate at all (user status `active`). */
export function isPersonaActive(persona: Persona): boolean {
  return persona.status === 'active';
}

/** The tenant of an id, or `undefined`. */
export function findTenantById(tenantId: number): FixtureTenant | undefined {
  return tenantsById.get(tenantId);
}

/** The tenant of a slug, or `undefined`. */
export function findTenantBySlug(slug: string): FixtureTenant | undefined {
  return tenantsBySlug.get(slug);
}

/** The tenant of a slug; throws for an unknown one (fixture code and tests). */
export function tenantBySlug(slug: string): FixtureTenant {
  const tenant = findTenantBySlug(slug);
  if (tenant === undefined) {
    throw new Error(`No fixture tenant ${slug}.`);
  }
  return tenant;
}

/** Every tenant (read-only). */
export function allTenants(): readonly FixtureTenant[] {
  return TENANTS;
}

/** The tenant role with `code` in `tenantId`, or `undefined`. */
export function findTenantRole(tenantId: number, code: string): FixtureRole | undefined {
  return rolesByTenantAndCode.get(`${tenantId}:${code}`);
}

/** The persona's memberships whose status is `active` and whose tenant is `active` (the `/me` scope, DD-21). */
export function activeMemberships(persona: Persona): FixtureMembership[] {
  return persona.memberships.filter(
    (membership) => membership.status === 'active' && findTenantById(membership.tenantId)?.status === 'active',
  );
}

/** Effective permissions of a membership: the union of its roles' permissions, in catalog order. */
export function membershipPermissions(membership: FixtureMembership): PermissionCode[] {
  const granted = new Set<PermissionCode>();
  for (const assignment of membership.roles) {
    const role = findTenantRole(membership.tenantId, assignment.roleCode);
    if (role === undefined) {
      throw new Error(`Membership ${membership.membershipId} names unknown role ${assignment.roleCode}.`);
    }
    for (const code of role.permissions) {
      granted.add(code);
    }
  }
  return PERMISSION_CODES.filter((code) => granted.has(code));
}

/** True when the grant is in force at `now` (starts, expiry and revocation compared directly, DD-18). */
export function isSupportGrantActive(grant: FixtureSupportGrant, now: Date): boolean {
  const at = now.getTime();
  return (
    grant.revokedAt === null && Date.parse(grant.startsAt) <= at && at < Date.parse(grant.expiresAt)
  );
}

/**
 * The caller's access to `tenantId`, or `null` for ANY failure (unknown tenant, no active membership, inactive
 * tenant, kind mismatch, no active support grant). `requiredKind = null` accepts any kind (`/me` row actions).
 */
export function resolveTenantAccess(
  persona: Persona,
  tenantId: number,
  now: Date,
  requiredKind: TenantKind | null,
): TenantAccess | null {
  if (!isPersonaActive(persona)) {
    return null;
  }
  const tenant = findTenantById(tenantId);
  if (tenant === undefined || tenant.status !== 'active') {
    return null;
  }
  if (requiredKind !== null && tenant.kind !== requiredKind) {
    return null;
  }
  const membership = persona.memberships.find(
    (candidate) => candidate.tenantId === tenantId && candidate.status === 'active',
  );
  if (membership !== undefined) {
    return {
      tenant,
      access: 'membership',
      membership,
      supportGrant: null,
      capacity: membership.capacity,
      permissions: membershipPermissions(membership),
    };
  }
  if (persona.isPlatformOperator && tenant.kind !== 'operator') {
    const operatorActive = activeMemberships(persona).some(
      (candidate) => findTenantById(candidate.tenantId)?.kind === 'operator',
    );
    const grant = SUPPORT_GRANTS.find(
      (candidate) =>
        candidate.operatorUserId === persona.userId &&
        candidate.customerTenantId === tenantId &&
        isSupportGrantActive(candidate, now),
    );
    if (operatorActive && grant !== undefined) {
      return {
        tenant,
        access: 'support_grant',
        membership: null,
        supportGrant: grant,
        capacity: 'Platform support (read-only)',
        permissions: [...SUPPORT_GRANT_PERMISSIONS],
      };
    }
  }
  return null;
}

/** `{ userId, fullName }` for a persona id (handlers building person references). */
export function personRef(userId: number): PersonRef {
  const persona = findPersonaById(userId);
  if (persona === undefined) {
    throw new Error(`No fixture persona with user id ${userId}.`);
  }
  return { userId: persona.userId, fullName: persona.fullName };
}

/** The organization label of a `/me` row (DD-21). */
export function organizationLabel(tenantId: number): OrganizationLabel {
  const tenant = findTenantById(tenantId);
  if (tenant === undefined) {
    throw new Error(`No fixture tenant with id ${tenantId}.`);
  }
  return { tenantId: tenant.id, tenantName: tenant.name, tenantKind: tenant.kind };
}
