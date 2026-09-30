/**
 * Session contract: the SPA boot context and the theme preference (docs/technical/07-api.md §13 "00 Workspace";
 * COM-02, COM-03; DD-21, DD-36, DD-43).
 *
 * `GET /api/v1/me/context` returns the caller, every membership (active and pending, so COM-02 can explain a
 * pending or suspended one), the environment (`prototype` from the mock API, `live` from the Stage B session
 * domain; the SPA shows the prototype banner for `prototype`) and, when `?tenantId=` names a tenant, the
 * effective permissions in that tenant. The SPA remembers the active tenant in localStorage as a convenience and
 * re-validates it here (DD-36). An unknown, inactive or foreign tenant id gets the one identical 403.
 */
import { z } from 'zod';

import { CurrencyCode, Id, IdParam, Instant, Slug, TenantKind, TimeZone } from './common.js';
import { defineEndpoint } from './endpoint.js';
import {
  MembershipsStatus,
  RoleAssignmentsScopeType,
  SupportAccessGrantsScope,
  TenantsStatus,
  UsersStatus,
  UsersTheme,
} from './enums.js';
import { PermissionCodeSchema, RoleTemplateCode } from './permissions.js';

/** `APP_ENV` values (brief §5.4). */
export const APP_ENVS = ['local', 'dev', 'preview', 'staging', 'production'] as const;
export const AppEnv = z.enum(APP_ENVS);
export type AppEnv = z.infer<typeof AppEnv>;

/** Which API serves the SPA: the Stage A mock API (`prototype`) or the real backend (`live`) (DD-43). */
export const ENVIRONMENT_MODES = ['prototype', 'live'] as const;
export const EnvironmentMode = z.enum(ENVIRONMENT_MODES);
export type EnvironmentMode = z.infer<typeof EnvironmentMode>;

export const SessionEnvironment = z.object({
  mode: EnvironmentMode,
  appEnv: AppEnv,
});
export type SessionEnvironment = z.infer<typeof SessionEnvironment>;

/** The signed-in person (`users`). */
export const SessionUser = z.object({
  id: Id,
  email: z.email(),
  fullName: z.string().min(1),
  phone: z.string().nullable(),
  locale: z.string().min(2),
  displayTimeZone: TimeZone.nullable(),
  theme: UsersTheme,
  status: UsersStatus,
  isPlatformOperator: z.boolean(),
  lastSeenAt: Instant.nullable(),
});
export type SessionUser = z.infer<typeof SessionUser>;

/** A role held through a membership, with its scope (`role_assignments`). */
export const MembershipRole = z.object({
  roleId: Id,
  code: z.string().min(1),
  name: z.string().min(1),
  templateCode: RoleTemplateCode.nullable(),
  scopeType: RoleAssignmentsScopeType,
  scopeId: Id.nullable(),
  scopeLabel: z.string().nullable(),
});
export type MembershipRole = z.infer<typeof MembershipRole>;

/** One organization the user belongs to, in the capacity named by `capacity` (`memberships.title`, BR-02). */
export const SessionMembership = z.object({
  membershipId: Id,
  tenantId: Id,
  tenantKind: TenantKind,
  tenantName: z.string().min(1),
  tenantSlug: Slug,
  tenantStatus: TenantsStatus,
  capacity: z.string().nullable(),
  status: MembershipsStatus,
  joinedAt: Instant.nullable(),
  roles: z.array(MembershipRole),
});
export type SessionMembership = z.infer<typeof SessionMembership>;

/** How the caller reaches the active tenant: a membership, or an operator support access grant (OPS-04). */
export const ACTIVE_TENANT_ACCESS = ['membership', 'support_grant'] as const;
export const ActiveTenantAccess = z.enum(ACTIVE_TENANT_ACCESS);

/** The support grant in force when an operator views a customer tenant (effective set = `{support.view}`). */
export const ActiveSupportGrant = z.object({
  grantId: Id,
  caseId: Id,
  scope: SupportAccessGrantsScope,
  startsAt: Instant,
  expiresAt: Instant,
});
export type ActiveSupportGrant = z.infer<typeof ActiveSupportGrant>;

/** The tenant named by `?tenantId=`, with the caller's effective permissions in it. */
export const ActiveTenantContext = z.object({
  tenantId: Id,
  kind: TenantKind,
  name: z.string().min(1),
  slug: Slug,
  officialTimeZone: TimeZone,
  defaultCurrency: CurrencyCode.nullable(),
  workingLanguages: z.array(z.string().min(2)).min(1),
  capacity: z.string().nullable(),
  access: ActiveTenantAccess,
  supportGrant: ActiveSupportGrant.nullable(),
  permissions: z.array(PermissionCodeSchema),
});
export type ActiveTenantContext = z.infer<typeof ActiveTenantContext>;

export const SessionContext = z.object({
  user: SessionUser,
  memberships: z.array(SessionMembership),
  activeTenant: ActiveTenantContext.nullable(),
  environment: SessionEnvironment,
  serverTime: Instant,
});
export type SessionContext = z.infer<typeof SessionContext>;

export const SessionContextQuery = z.object({
  tenantId: IdParam.optional(),
});

/** GET /api/v1/me/context: the SPA boot context (COM-02). */
export const getSessionContext = defineEndpoint({
  id: 'me.session.context',
  method: 'GET',
  path: '/api/v1/me/context',
  audience: 'me',
  query: SessionContextQuery,
  response: SessionContext,
  errors: ['TENANT_ACCESS_DENIED'],
  screens: ['COM-01', 'COM-02', 'COM-03'],
  summary:
    'The caller, all memberships, the environment and, with ?tenantId=, the effective permissions in that tenant. A tenant the caller cannot enter returns the identical 403.',
});

export const UpdateThemeBody = z.object({
  theme: UsersTheme,
});
export type UpdateThemeBody = z.infer<typeof UpdateThemeBody>;

export const ThemeResponse = z.object({
  theme: UsersTheme,
});
export type ThemeResponse = z.infer<typeof ThemeResponse>;

/** PUT /api/v1/me/theme: stores `users.theme` (shell user menu). */
export const updateTheme = defineEndpoint({
  id: 'me.session.updateTheme',
  method: 'PUT',
  path: '/api/v1/me/theme',
  audience: 'me',
  body: UpdateThemeBody,
  response: ThemeResponse,
  errors: [],
  screens: ['COM-03'],
  summary: 'Stores the light or dark theme preference of the caller.',
});

/** The session endpoint map. */
export const sessionEndpoints = {
  getSessionContext,
  updateTheme,
} as const;
