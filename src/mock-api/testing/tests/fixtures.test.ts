/**
 * Consistency of the platform fixtures with docs/plan/demo-storyline.md and src/contracts/permissions.ts, and
 * contract validity of every persona's session context.
 */
import { describe, expect, it } from 'vitest';

import { PERMISSION_CATALOG, ROLE_TEMPLATES } from '../../../contracts/permissions.js';
import { SessionContext, getSessionContext } from '../../../contracts/session.js';
import { PERSONAS, SUPPORT_GRANTS, TENANTS, TENANT_ROLES } from '../../fixtures/platform.js';
import { SESSION_PROFILES } from '../../fixtures/session.js';
import { findPersonaById, findTenantById, findTenantRole, membershipPermissions } from '../../persona.js';
import { createTestMockApp } from '../index.js';

/** Every persona named by the storyline. */
const STORYLINE_PERSONAS = [
  'ops.admin',
  'support.agent',
  'admin.kwu',
  'mpho.manager',
  'tebogo.officer',
  'kagiso.requester',
  'onalenna.budget',
  'neo.assessor',
  'lesego.finance',
  'boitumelo.chair',
  'thato.eval',
  'kabo.eval',
  'amantle.eval',
  'refilwe.commercial',
  'oratile.opener',
  'goitse.witness',
  'dineo.legal',
  'keabetswe.approver',
  'masego.contracts',
  'pule.auditor',
  'admin.odc',
  'officer.odc',
  ...['tsodilo', 'chobe-pipe', 'serowe-ict', 'gaborone-meter'].flatMap((slug) =>
    ['admin', 'bidmanager', 'contributor', 'signatory'].map((role) => `${slug}.${role}`),
  ),
  'makgadikgadi.admin',
  'limpopo-env.admin',
  'sam.dual',
  'former.officer',
].map((localPart) => `${localPart}@tenderiq.local`);

const STORYLINE_TENANTS = ['tenderiq-ops', 'kwu', 'odc', 'tsodilo', 'chobe-pipe', 'makgadikgadi', 'serowe-ict', 'limpopo-env', 'gaborone-meter'];

describe('platform fixtures', () => {
  it('contain exactly the storyline organizations and personas', () => {
    expect(TENANTS.map((tenant) => tenant.slug).sort()).toEqual([...STORYLINE_TENANTS].sort());
    expect(PERSONAS.map((persona) => persona.email).sort()).toEqual([...STORYLINE_PERSONAS].sort());
  });

  it('use unique ids and e-mails', () => {
    const unique = <T>(values: T[]) => new Set(values).size === values.length;
    expect(unique(TENANTS.map((tenant) => tenant.id))).toBe(true);
    expect(unique(PERSONAS.map((persona) => persona.userId))).toBe(true);
    expect(unique(PERSONAS.map((persona) => persona.email))).toBe(true);
    expect(unique(PERSONAS.flatMap((persona) => persona.memberships.map((membership) => membership.membershipId)))).toBe(true);
    expect(unique(TENANT_ROLES.map((role) => role.roleId))).toBe(true);
  });

  it('give every membership an existing tenant and existing roles of that tenant', () => {
    for (const persona of PERSONAS) {
      for (const membership of persona.memberships) {
        expect(findTenantById(membership.tenantId), persona.email).toBeDefined();
        expect(membership.roles.length, persona.email).toBeGreaterThan(0);
        for (const assignment of membership.roles) {
          expect(findTenantRole(membership.tenantId, assignment.roleCode), `${persona.email} ${assignment.roleCode}`).toBeDefined();
        }
      }
    }
  });

  it('only hold permissions of the tenant kind in every role (a supplier can never grant buyer privileges)', () => {
    for (const role of TENANT_ROLES) {
      const tenant = findTenantById(role.tenantId);
      const kind = tenant?.kind === 'operator' ? 'operator' : tenant?.kind;
      for (const code of role.permissions) {
        expect([kind, 'any'], `${role.code} ${code}`).toContain(PERMISSION_CATALOG[code].tenantKind);
      }
      if (role.templateCode !== null) {
        expect(role.permissions).toEqual(ROLE_TEMPLATES[role.templateCode].permissions);
      }
    }
  });

  it('never give support.view through a role (only through a support grant)', () => {
    for (const persona of PERSONAS) {
      for (const membership of persona.memberships) {
        expect(membershipPermissions(membership)).not.toContain('support.view');
      }
    }
  });

  it('keep the org administrator away from tender content and bids (AC-15)', () => {
    const admin = PERSONAS.find((persona) => persona.email === 'admin.kwu@tenderiq.local');
    const permissions = admin?.memberships[0] === undefined ? [] : membershipPermissions(admin.memberships[0]);
    expect(permissions.every((code) => code.startsWith('org.'))).toBe(true);
  });

  it('record the storyline approval limits', () => {
    const limitOf = (email: string) => PERSONAS.find((persona) => persona.email === email)?.memberships[0]?.authorityLimit;
    expect(limitOf('mpho.manager@tenderiq.local')).toEqual({ amount: '2000000.00', currency: 'BWP' });
    expect(limitOf('keabetswe.approver@tenderiq.local')).toEqual({ amount: '10000000.00', currency: 'BWP' });
  });

  it('reference an operator and a customer administrator in every support grant', () => {
    for (const grant of SUPPORT_GRANTS) {
      expect(findPersonaById(grant.operatorUserId)?.isPlatformOperator).toBe(true);
      expect(findTenantById(grant.customerTenantId)?.kind).not.toBe('operator');
      const authorizer = findPersonaById(grant.authorizedByUserId);
      expect(authorizer?.memberships.some((membership) => membership.tenantId === grant.customerTenantId)).toBe(true);
      expect(Date.parse(grant.startsAt)).toBeLessThan(Date.parse(grant.expiresAt));
    }
  });

  it('key session profiles by existing persona e-mails', () => {
    for (const email of Object.keys(SESSION_PROFILES)) {
      expect(PERSONAS.some((persona) => persona.email === email), email).toBe(true);
    }
  });
});

describe('session context of every persona', () => {
  it('validates against the contract for every active persona and every membership tenant it may enter', async () => {
    // Arrange
    const api = await createTestMockApp();

    // Act + Assert
    for (const persona of PERSONAS.filter((candidate) => candidate.status === 'active')) {
      const plain = await api.callAs(persona.email, getSessionContext);
      expect(plain.status, persona.email).toBe(200);
      SessionContext.parse(plain.body);
      for (const membership of persona.memberships.filter((candidate) => candidate.status === 'active')) {
        const scoped = await api.callAs(persona.email, getSessionContext, { query: { tenantId: membership.tenantId } });
        expect(scoped.status, `${persona.email} in ${membership.tenantId}`).toBe(200);
        expect(SessionContext.parse(scoped.body).activeTenant?.permissions).toEqual(membershipPermissions(membership));
      }
    }
  });

  it('rejects the deactivated persona even with a verified identity', async () => {
    const api = await createTestMockApp();
    const response = await api.callAs('former.officer@tenderiq.local', getSessionContext);
    expect(response.status).toBe(401);
  });
});
