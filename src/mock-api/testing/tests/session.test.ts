/**
 * The session contract on the mock API with REAL authentication (DD-43): the boot context, the prototype
 * environment, effective permissions per tenant, support grants, the identical 403, supplier isolation (a supplier
 * persona never sees another supplier's data) and the non-persisting theme command.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { Problem } from '../../../contracts/common.js';
import { permissionsForTemplates } from '../../../contracts/permissions.js';
import { SessionContext, getSessionContext, updateTheme } from '../../../contracts/session.js';
import { PERSONAS, TENANTS } from '../../fixtures/platform.js';
import { createTestMockApp, tenantIdOf } from '../index.js';
import type { TestMockApp, TestResponse } from '../index.js';

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp();
});

function contextOf(response: TestResponse): SessionContext {
  expect(response.status).toBe(200);
  return SessionContext.parse(response.body);
}

function withoutCorrelation(response: TestResponse): Record<string, unknown> {
  const { correlationId: _ignored, ...rest } = Problem.parse(response.body);
  return rest;
}

describe('GET /api/v1/me/context', () => {
  it('is served by the auto-discovered session module', () => {
    expect(api.loaded).toContain('session');
    expect(api.endpointIds).toEqual(expect.arrayContaining(['me.session.context', 'me.session.updateTheme']));
  });

  it('returns the caller, the membership and the prototype environment for a buyer officer', async () => {
    // Act
    const context = contextOf(await api.callAs('tebogo.officer@tenderiq.local', getSessionContext));

    // Assert
    expect(context.user).toMatchObject({ email: 'tebogo.officer@tenderiq.local', fullName: 'Tebogo Molefe', status: 'active' });
    expect(context.environment).toEqual({ mode: 'prototype', appEnv: 'local' });
    expect(context.activeTenant).toBeNull();
    expect(context.memberships).toHaveLength(1);
    expect(context.memberships[0]).toMatchObject({
      tenantSlug: 'kwu',
      tenantName: 'Kalahari Water Utilities (Pilot)',
      capacity: 'Procurement Officer',
      status: 'active',
      roles: [expect.objectContaining({ templateCode: 'procurement_officer', scopeType: 'organization' })],
    });
  });

  it('returns the effective permissions of the requested tenant, computed from the role templates', async () => {
    const context = contextOf(
      await api.callAs('tebogo.officer@tenderiq.local', getSessionContext, { query: { tenantId: tenantIdOf('kwu') } }),
    );
    expect(context.activeTenant).toMatchObject({
      slug: 'kwu',
      kind: 'buyer',
      access: 'membership',
      officialTimeZone: 'Africa/Gaborone',
      defaultCurrency: 'BWP',
      supportGrant: null,
    });
    expect(context.activeTenant?.permissions).toEqual(permissionsForTemplates(['procurement_officer']));
  });

  it('lists every membership of the dual-capacity person, including the pending one (AC-02, COM-02)', async () => {
    // Act
    const context = contextOf(await api.callAs('sam.dual@tenderiq.local', getSessionContext));

    // Assert
    expect(context.memberships.map((membership) => [membership.tenantSlug, membership.status])).toEqual([
      ['kwu', 'active'],
      ['tsodilo', 'active'],
      ['chobe-pipe', 'active'],
      ['serowe-ict', 'pending_approval'],
    ]);
  });

  it('refuses the tenant of a pending membership with the identical 403', async () => {
    const response = await api.callAs('sam.dual@tenderiq.local', getSessionContext, { query: { tenantId: tenantIdOf('serowe-ict') } });
    expect(response.status).toBe(403);
    expect(withoutCorrelation(response)).toMatchObject({ code: 'TENANT_ACCESS_DENIED' });
  });

  it('gives an operator support.view only inside a customer tenant with an active grant (OPS-04)', async () => {
    const context = contextOf(
      await api.callAs('support.agent@tenderiq.local', getSessionContext, { query: { tenantId: tenantIdOf('kwu') } }),
    );
    expect(context.activeTenant).toMatchObject({ access: 'support_grant', permissions: ['support.view'] });
    expect(context.activeTenant?.supportGrant).toMatchObject({ caseId: 1, scope: 'metadata_only' });
  });

  it('refuses a customer tenant to an operator without a grant', async () => {
    const response = await api.callAs('ops.admin@tenderiq.local', getSessionContext, { query: { tenantId: tenantIdOf('kwu') } });
    expect(withoutCorrelation(response)).toMatchObject({ status: 403, code: 'TENANT_ACCESS_DENIED' });
  });

  it('answers 422 for a malformed tenantId', async () => {
    const response = await api.callAs('tebogo.officer@tenderiq.local', getSessionContext, { query: { tenantId: 'kwu' } });
    expect(response.status).toBe(422);
    expect(Problem.parse(response.body).errors?.[0]).toMatchObject({ field: 'tenantId', code: 'INVALID_ID' });
  });
});

describe('supplier isolation through the session contract', () => {
  const suppliers = TENANTS.filter((tenant) => tenant.kind === 'supplier');
  const supplierPersonas = PERSONAS.filter(
    (persona) =>
      persona.status === 'active' &&
      persona.memberships.length === 1 &&
      suppliers.some((tenant) => tenant.id === persona.memberships[0]?.tenantId),
  );

  it.each(supplierPersonas.map((persona) => [persona.email, persona.memberships[0]?.tenantId ?? 0] as const))(
    '%s sees only its own organization and gets the identical 403 for every other supplier',
    async (email, ownTenantId) => {
      // Act
      const own = contextOf(await api.callAs(email, getSessionContext, { query: { tenantId: ownTenantId } }));
      const others = [];
      for (const other of suppliers.filter((tenant) => tenant.id !== ownTenantId)) {
        others.push({ other, response: await api.callAs(email, getSessionContext, { query: { tenantId: other.id } }) });
      }

      // Assert
      expect(own.memberships.map((membership) => membership.tenantId)).toEqual([ownTenantId]);
      expect(own.activeTenant?.tenantId).toBe(ownTenantId);
      const ownText = JSON.stringify(own);
      for (const { other, response } of others) {
        expect(response.status).toBe(403);
        expect(withoutCorrelation(response)).toMatchObject({ code: 'TENANT_ACCESS_DENIED' });
        expect(response.text).not.toContain(other.name);
        expect(ownText).not.toContain(other.name);
        expect(ownText).not.toContain(`"${other.slug}"`);
      }
    },
  );

  it('answers a foreign supplier with exactly the body the tenant middleware uses', async () => {
    // Arrange
    const email = 'tsodilo.bidmanager@tenderiq.local';

    // Act
    const viaContext = await api.callAs(email, getSessionContext, { query: { tenantId: tenantIdOf('chobe-pipe') } });
    const viaUnknown = await api.callAs(email, getSessionContext, { query: { tenantId: 9999 } });

    // Assert
    expect(withoutCorrelation(viaContext)).toEqual(withoutCorrelation(viaUnknown));
  });
});

describe('PUT /api/v1/me/theme', () => {
  it('echoes the requested theme without persisting it', async () => {
    // Act
    const updated = await api.callAs('tebogo.officer@tenderiq.local', updateTheme, { body: { theme: 'dark' } });
    const after = contextOf(await api.callAs('tebogo.officer@tenderiq.local', getSessionContext));

    // Assert
    expect(updated).toMatchObject({ status: 200, body: { theme: 'dark' } });
    expect(after.user.theme).toBe('light');
  });

  it('rejects an unknown theme with 422 on the theme field', async () => {
    const response = await api.callAs('tebogo.officer@tenderiq.local', updateTheme, { body: { theme: 'sepia' } });
    expect(response.status).toBe(422);
    expect(Problem.parse(response.body).errors?.[0]?.field).toBe('theme');
  });
});
