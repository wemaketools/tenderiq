/**
 * Platform fixtures: every organization (tenant), tenant role, persona and membership of the demo world
 * (docs/plan/demo-storyline.md "Organizations" and "Personas"; architecture-plan §3.11; DD-43).
 *
 * - Tenants and personas use the natural keys of the storyline (slugs, `@tenderiq.local` emails), so every domain
 *   fixture can reference them. Ids are stable small integers.
 * - Roles are per-tenant copies of the role templates in `src/contracts/permissions.ts` (blueprint §P). One custom
 *   KWU role, "Opening witness", holds only the witness side of opening (`goitse.witness`).
 * - Effective permissions are NEVER listed per persona: `persona.ts` computes them from the roles, so the mock
 *   API's 403s follow the same catalog as Stage B.
 * - `npm run auth:personas` creates every persona below in local Supabase Auth (password `test1234`, local only).
 *   `former.officer` exists in Auth but is deactivated here, so the mock API answers 401 (AC-04).
 * - `UNMAPPED_AUTH_ACCOUNT` is a real Auth account with NO persona: it proves that a verified account without a
 *   fixture persona gets 401 (DD-43).
 *
 * Static data: nothing here is ever mutated at runtime (the arrays are frozen).
 */
import type { Money, TenantKind } from '../../contracts/common.js';
import type { MembershipsStatus, RoleAssignmentsScopeType, SupportAccessGrantsScope, TenantsStatus, UsersStatus } from '../../contracts/enums.js';
import { ROLE_TEMPLATES, ROLE_TEMPLATE_CODES } from '../../contracts/permissions.js';
import type { PermissionCode, RoleTemplateCode } from '../../contracts/permissions.js';

/** The e-mail domain of every demo account. */
export const PERSONA_EMAIL_DOMAIN = 'tenderiq.local';

/** A real local Auth account that deliberately maps to no persona (401 proof, DD-43). */
export const UNMAPPED_AUTH_ACCOUNT = { email: `unmapped.account@${PERSONA_EMAIL_DOMAIN}`, fullName: 'Unmapped Account' } as const;

export interface FixtureTenant {
  readonly id: number;
  readonly slug: string;
  readonly kind: TenantKind;
  readonly name: string;
  readonly legalName: string;
  readonly status: TenantsStatus;
  readonly officialTimeZone: string;
  readonly defaultCurrency: string | null;
  readonly workingLanguages: readonly string[];
  readonly createdAt: string;
}

export interface FixtureRole {
  readonly roleId: number;
  readonly tenantId: number;
  readonly code: string;
  readonly name: string;
  readonly templateCode: RoleTemplateCode | null;
  readonly permissions: readonly PermissionCode[];
}

export interface FixtureRoleAssignment {
  readonly roleCode: string;
  readonly scopeType: RoleAssignmentsScopeType;
  readonly scopeId: number | null;
  readonly scopeLabel: string | null;
}

export interface FixtureMembership {
  readonly membershipId: number;
  readonly tenantId: number;
  /** `memberships.title`: the capacity the person acts in (BR-02). */
  readonly capacity: string | null;
  readonly status: MembershipsStatus;
  readonly joinedAt: string | null;
  readonly roles: readonly FixtureRoleAssignment[];
  /** Approval authority (`authority_limits`) held through this membership, where the storyline names one. */
  readonly authorityLimit: Money | null;
}

export interface FixturePersona {
  readonly userId: number;
  readonly email: string;
  readonly fullName: string;
  readonly status: UsersStatus;
  readonly isPlatformOperator: boolean;
  readonly memberships: readonly FixtureMembership[];
}

/** An operator support access grant into a customer tenant (OPS-04, ADR 0013). */
export interface FixtureSupportGrant {
  readonly grantId: number;
  readonly caseId: number;
  readonly operatorUserId: number;
  readonly customerTenantId: number;
  readonly scope: SupportAccessGrantsScope;
  readonly authorizedByUserId: number;
  readonly startsAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
}

// ---------------------------------------------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------------------------------------------

const BOTSWANA = { officialTimeZone: 'Africa/Gaborone', workingLanguages: ['en'] } as const;

export const TENANT_IDS = {
  'tenderiq-ops': 1,
  kwu: 2,
  odc: 3,
  tsodilo: 4,
  'chobe-pipe': 5,
  makgadikgadi: 6,
  'serowe-ict': 7,
  'limpopo-env': 8,
  'gaborone-meter': 9,
} as const;
export type TenantSlug = keyof typeof TENANT_IDS;

export const TENANTS: readonly FixtureTenant[] = Object.freeze([
  {
    id: TENANT_IDS['tenderiq-ops'],
    slug: 'tenderiq-ops',
    kind: 'operator',
    name: 'TenderIQ Platform Operations',
    legalName: 'TenderIQ Platform Operations',
    status: 'active',
    ...BOTSWANA,
    defaultCurrency: null,
    createdAt: '2026-01-05T08:00:00Z',
  },
  {
    id: TENANT_IDS.kwu,
    slug: 'kwu',
    kind: 'buyer',
    name: 'Kalahari Water Utilities (Pilot)',
    legalName: 'Kalahari Water Utilities Corporation',
    status: 'active',
    ...BOTSWANA,
    defaultCurrency: 'BWP',
    createdAt: '2026-01-12T08:00:00Z',
  },
  {
    id: TENANT_IDS.odc,
    slug: 'odc',
    kind: 'buyer',
    name: 'Okavango District Council',
    legalName: 'Okavango District Council',
    status: 'active',
    ...BOTSWANA,
    defaultCurrency: 'BWP',
    createdAt: '2026-02-02T08:00:00Z',
  },
  {
    id: TENANT_IDS.tsodilo,
    slug: 'tsodilo',
    kind: 'supplier',
    name: 'Tsodilo Engineering',
    legalName: 'Tsodilo Engineering (Pty) Ltd',
    status: 'active',
    ...BOTSWANA,
    defaultCurrency: 'BWP',
    createdAt: '2026-02-10T08:00:00Z',
  },
  {
    id: TENANT_IDS['chobe-pipe'],
    slug: 'chobe-pipe',
    kind: 'supplier',
    name: 'Chobe Pipe & Valve Supplies',
    legalName: 'Chobe Pipe & Valve Supplies (Pty) Ltd',
    status: 'active',
    ...BOTSWANA,
    defaultCurrency: 'BWP',
    createdAt: '2026-02-11T08:00:00Z',
  },
  {
    id: TENANT_IDS.makgadikgadi,
    slug: 'makgadikgadi',
    kind: 'supplier',
    name: 'Makgadikgadi Civil Works',
    legalName: 'Makgadikgadi Civil Works (Pty) Ltd',
    status: 'active',
    ...BOTSWANA,
    defaultCurrency: 'BWP',
    createdAt: '2026-03-03T08:00:00Z',
  },
  {
    id: TENANT_IDS['serowe-ict'],
    slug: 'serowe-ict',
    kind: 'supplier',
    name: 'Serowe ICT Solutions',
    legalName: 'Serowe ICT Solutions (Pty) Ltd',
    status: 'active',
    ...BOTSWANA,
    defaultCurrency: 'BWP',
    createdAt: '2026-03-09T08:00:00Z',
  },
  {
    id: TENANT_IDS['limpopo-env'],
    slug: 'limpopo-env',
    kind: 'supplier',
    name: 'Limpopo Environmental Services',
    legalName: 'Limpopo Environmental Services (Pty) Ltd',
    status: 'active',
    ...BOTSWANA,
    defaultCurrency: 'BWP',
    createdAt: '2026-03-16T08:00:00Z',
  },
  {
    id: TENANT_IDS['gaborone-meter'],
    slug: 'gaborone-meter',
    kind: 'supplier',
    name: 'Gaborone Metering Co.',
    legalName: 'Gaborone Metering Company (Pty) Ltd',
    status: 'active',
    ...BOTSWANA,
    defaultCurrency: 'BWP',
    createdAt: '2026-03-23T08:00:00Z',
  },
] satisfies FixtureTenant[]);

// ---------------------------------------------------------------------------------------------------------
// Roles: per-tenant copies of the templates of the tenant's kind, plus one custom KWU role
// ---------------------------------------------------------------------------------------------------------

/** Custom (non-template) roles, by tenant. */
const CUSTOM_ROLES: readonly FixtureRole[] = [
  {
    roleId: TENANT_IDS.kwu * 100 + 90,
    tenantId: TENANT_IDS.kwu,
    code: 'opening_witness',
    name: 'Opening witness',
    templateCode: null,
    permissions: ['dashboard.view', 'tender.view', 'bid.monitor', 'bid.witness'],
  },
];

function templateRolesFor(tenant: FixtureTenant): FixtureRole[] {
  return ROLE_TEMPLATE_CODES.filter((code) => ROLE_TEMPLATES[code].tenantKind === tenant.kind).map((code, index) => ({
    roleId: tenant.id * 100 + index + 1,
    tenantId: tenant.id,
    code,
    name: ROLE_TEMPLATES[code].name,
    templateCode: code,
    permissions: ROLE_TEMPLATES[code].permissions,
  }));
}

/** Every tenant role (`roles`), template copies first. */
export const TENANT_ROLES: readonly FixtureRole[] = Object.freeze([
  ...TENANTS.flatMap(templateRolesFor),
  ...CUSTOM_ROLES,
]);

// ---------------------------------------------------------------------------------------------------------
// Personas and memberships
// ---------------------------------------------------------------------------------------------------------

let nextMembershipId = 1;

interface MembershipSpec {
  readonly tenant: TenantSlug;
  readonly capacity: string;
  readonly roles: readonly string[];
  readonly status?: MembershipsStatus;
  readonly joinedAt?: string | null;
  readonly authorityLimit?: Money;
}

function membership(spec: MembershipSpec): FixtureMembership {
  const status = spec.status ?? 'active';
  return {
    membershipId: nextMembershipId++,
    tenantId: TENANT_IDS[spec.tenant],
    capacity: spec.capacity,
    status,
    joinedAt: spec.joinedAt === undefined ? (status === 'active' ? '2026-04-01T07:00:00Z' : null) : spec.joinedAt,
    roles: spec.roles.map((roleCode) => ({ roleCode, scopeType: 'organization', scopeId: null, scopeLabel: null })),
    authorityLimit: spec.authorityLimit ?? null,
  };
}

let nextUserId = 1;

function persona(
  localPart: string,
  fullName: string,
  memberships: readonly MembershipSpec[],
  options: { status?: UsersStatus; isPlatformOperator?: boolean } = {},
): FixturePersona {
  return {
    userId: nextUserId++,
    email: `${localPart}@${PERSONA_EMAIL_DOMAIN}`,
    fullName,
    status: options.status ?? 'active',
    isPlatformOperator: options.isPlatformOperator ?? false,
    memberships: memberships.map(membership),
  };
}

const kwu = (capacity: string, roles: readonly string[], extra: Partial<MembershipSpec> = {}): MembershipSpec => ({
  tenant: 'kwu',
  capacity,
  roles,
  ...extra,
});

/** The four standard personas of a supplier organization (`<slug>.admin`, `.bidmanager`, `.contributor`, `.signatory`). */
function supplierTeam(slug: TenantSlug, people: readonly [string, string, string, string]): FixturePersona[] {
  const [admin, bidManager, contributor, signatory] = people;
  return [
    persona(`${slug}.admin`, admin, [{ tenant: slug, capacity: 'Organization Administrator', roles: ['supplier_admin'] }]),
    persona(`${slug}.bidmanager`, bidManager, [{ tenant: slug, capacity: 'Bid Manager', roles: ['bid_manager'] }]),
    persona(`${slug}.contributor`, contributor, [{ tenant: slug, capacity: 'Technical Contributor', roles: ['contributor'] }]),
    persona(`${slug}.signatory`, signatory, [
      { tenant: slug, capacity: 'Managing Director', roles: ['authorized_signatory'] },
    ]),
  ];
}

export const PERSONAS: readonly FixturePersona[] = Object.freeze([
  // Operator
  persona('ops.admin', 'Naledi Sebego', [{ tenant: 'tenderiq-ops', capacity: 'Platform Operator', roles: ['platform_operator'] }], {
    isPlatformOperator: true,
  }),
  persona('support.agent', 'Kitso Ramotswa', [{ tenant: 'tenderiq-ops', capacity: 'Support Agent', roles: ['support_agent'] }], {
    isPlatformOperator: true,
  }),
  // Kalahari Water Utilities
  persona('admin.kwu', 'Lorato Kgosi', [kwu('Organization Administrator', ['org_admin'])]),
  persona('mpho.manager', 'Mpho Dikgang', [
    kwu('Procurement Manager', ['procurement_manager'], { authorityLimit: { amount: '2000000.00', currency: 'BWP' } }),
  ]),
  persona('tebogo.officer', 'Tebogo Molefe', [kwu('Procurement Officer', ['procurement_officer'])]),
  persona('kagiso.requester', 'Kagiso Phiri', [kwu('Operations Engineer', ['requester'])]),
  persona('onalenna.budget', 'Onalenna Tau', [kwu('Budget Owner, Operations', ['budget_owner'])]),
  persona('neo.assessor', 'Neo Mothibi', [kwu('Qualification Assessor', ['qualification_assessor'])]),
  persona('lesego.finance', 'Lesego Seretse', [kwu('Financial Reviewer', ['financial_reviewer'])]),
  persona('boitumelo.chair', 'Boitumelo Kgari', [kwu('Evaluation Chair', ['evaluation_chair'])]),
  persona('thato.eval', 'Thato Mokgosi', [kwu('Evaluator, Technical Services', ['evaluator'])]),
  persona('kabo.eval', 'Kabo Ntsima', [kwu('Evaluator, Network Operations', ['evaluator'])]),
  persona('amantle.eval', 'Amantle Segwai', [kwu('Evaluator, Water Quality', ['evaluator'])]),
  persona('refilwe.commercial', 'Refilwe Motsumi', [kwu('Commercial Reviewer', ['commercial_reviewer'])]),
  persona('oratile.opener', 'Oratile Baitse', [kwu('Bid Opening Officer', ['opening_officer'])]),
  persona('goitse.witness', 'Goitse Mooketsi', [kwu('Opening Witness, Internal Audit', ['opening_witness'])]),
  persona('dineo.legal', 'Dineo Masire', [kwu('Legal Counsel', ['legal_reviewer'])]),
  persona('keabetswe.approver', 'Keabetswe Nkwe', [
    kwu('Chief Executive (Award Approver)', ['award_approver'], { authorityLimit: { amount: '10000000.00', currency: 'BWP' } }),
  ]),
  persona('masego.contracts', 'Masego Rakgosi', [kwu('Contract Manager', ['contract_manager'])]),
  persona('pule.auditor', 'Pule Modise', [kwu('Internal Auditor', ['auditor'])]),
  persona('former.officer', 'Gaone Letsholo', [kwu('Procurement Officer (departed)', ['procurement_officer'], { status: 'revoked' })], {
    status: 'deactivated',
  }),
  // Okavango District Council
  persona('admin.odc', 'Wame Olebile', [{ tenant: 'odc', capacity: 'Organization Administrator', roles: ['org_admin'] }]),
  persona('officer.odc', 'Kefilwe Sekgoma', [{ tenant: 'odc', capacity: 'Procurement Officer', roles: ['procurement_officer'] }]),
  // Suppliers with full teams
  ...supplierTeam('tsodilo', ['Tumelo Sekgoma', 'Boago Moremi', 'Ditiro Kebonang', 'Motsamai Tsodilo']),
  ...supplierTeam('chobe-pipe', ['Chedza Ramokate', 'Bakang Chobe', 'Thabo Maano', 'Gorata Mphoeng']),
  ...supplierTeam('serowe-ict', ['Refentse Kgama', 'Otsile Serowe', 'Mmoloki Seabo', 'Tshepiso Khama']),
  ...supplierTeam('gaborone-meter', ['Palesa Gabo', 'Kagiso Metsi', 'Omphile Ditshego', 'Lame Ntshole']),
  // Suppliers with an administrator only
  persona('makgadikgadi.admin', 'Sethunya Makgadi', [
    { tenant: 'makgadikgadi', capacity: 'Organization Administrator', roles: ['supplier_admin'] },
  ]),
  persona('limpopo-env.admin', 'Mothusi Limpopo', [
    { tenant: 'limpopo-env', capacity: 'Organization Administrator', roles: ['supplier_admin'] },
  ]),
  // Dual-capacity person (AC-02): evaluator at KWU and contributor at two suppliers; a pending request at a third
  // supplier demonstrates the COM-02 explanation of a membership that cannot be used yet.
  persona('sam.dual', 'Sam Keitumetse', [
    kwu('Evaluator, Engineering', ['evaluator']),
    { tenant: 'tsodilo', capacity: 'Technical Contributor', roles: ['contributor'] },
    { tenant: 'chobe-pipe', capacity: 'Technical Contributor', roles: ['contributor'] },
    { tenant: 'serowe-ict', capacity: 'Technical Contributor', roles: ['contributor'], status: 'pending_approval' },
  ]),
] satisfies FixturePersona[]);

// ---------------------------------------------------------------------------------------------------------
// Support access grants (OPS-04): support.agent may read KWU metadata for support case 1 while the grant is valid
// ---------------------------------------------------------------------------------------------------------

function userIdOf(localPart: string): number {
  const match = PERSONAS.find((candidate) => candidate.email === `${localPart}@${PERSONA_EMAIL_DOMAIN}`);
  if (match === undefined) {
    throw new Error(`Unknown persona ${localPart}.`);
  }
  return match.userId;
}

export const SUPPORT_GRANTS: readonly FixtureSupportGrant[] = Object.freeze([
  {
    grantId: 1,
    caseId: 1,
    operatorUserId: userIdOf('support.agent'),
    customerTenantId: TENANT_IDS.kwu,
    scope: 'metadata_only',
    authorizedByUserId: userIdOf('admin.kwu'),
    startsAt: '2026-09-28T07:00:00Z',
    expiresAt: '2026-12-31T15:00:00Z',
    revokedAt: null,
  },
] satisfies FixtureSupportGrant[]);
