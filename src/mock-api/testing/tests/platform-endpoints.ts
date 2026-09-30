/**
 * Test-only endpoints that exercise the mock middleware chain for every audience (prefix/kind, permissions, 422,
 * response validation, declared and undeclared error codes, unexpected errors, 204, `/me` row actions).
 * They are registered only by the platform tests through `createTestMockApp({ modules: [...] })`.
 */
import { z } from 'zod';

import { Money, issue } from '../../../contracts/common.js';
import { defineEndpoint } from '../../../contracts/endpoint.js';
import { mockRoute } from '../../app.js';
import type { HandlerModule, MockApp } from '../../app.js';

const Echo = z.object({ tenantId: z.number().int(), access: z.enum(['membership', 'support_grant']), permissions: z.number().int() });

export const buyerPing = defineEndpoint({
  id: 'testPlatform.buyer.ping',
  method: 'GET',
  path: '/api/v1/buyer/test-platform/ping',
  audience: 'buyer',
  permission: 'tender.view',
  response: Echo,
  errors: [],
  screens: ['BUY-01'],
});

export const buyerAdminOnly = defineEndpoint({
  id: 'testPlatform.buyer.admin',
  method: 'GET',
  path: '/api/v1/buyer/test-platform/admin',
  audience: 'buyer',
  permission: 'org.users.manage',
  response: Echo,
  errors: [],
  screens: ['ADM-03'],
});

export const supplierPing = defineEndpoint({
  id: 'testPlatform.supplier.ping',
  method: 'GET',
  path: '/api/v1/supplier/test-platform/ping',
  audience: 'supplier',
  permission: 'supplier.dashboard.view',
  response: Echo,
  errors: [],
  screens: ['SUP-01'],
});

export const opsPing = defineEndpoint({
  id: 'testPlatform.ops.ping',
  method: 'GET',
  path: '/api/v1/ops/test-platform/ping',
  audience: 'ops',
  permission: 'ops.support.manage',
  response: Echo,
  errors: [],
  screens: ['OPS-04'],
});

export const publicHello = defineEndpoint({
  id: 'testPlatform.public.hello',
  method: 'GET',
  path: '/api/v1/public/test-platform/hello',
  audience: 'public',
  response: z.object({ hello: z.literal('world'), signedIn: z.boolean() }),
  errors: [],
  screens: ['PUB-01'],
});

export const validatedCommand = defineEndpoint({
  id: 'testPlatform.buyer.update',
  method: 'POST',
  path: '/api/v1/buyer/test-platform/items/:itemId',
  audience: 'buyer',
  permission: 'tender.view',
  params: z.object({ itemId: z.string().regex(/^\d+$/, issue('INVALID_ID', 'Must be a numeric id.')) }),
  query: z.object({ mode: z.enum(['draft', 'final'], { error: issue('INVALID_MODE', 'Use draft or final.') }) }),
  body: z.object({
    title: z.string().trim().min(1, issue('TITLE_REQUIRED', 'A title is required.')),
    budget: Money,
  }),
  response: z.object({ itemId: z.string(), mode: z.string(), title: z.string(), budget: Money }),
  errors: [],
  screens: ['BUY-07'],
});

export const driftingRead = defineEndpoint({
  id: 'testPlatform.buyer.drift',
  method: 'GET',
  path: '/api/v1/buyer/test-platform/drift',
  audience: 'buyer',
  permission: 'tender.view',
  response: z.object({ amount: Money }),
  errors: [],
  screens: ['BUY-01'],
});

export const lockedCommand = defineEndpoint({
  id: 'testPlatform.buyer.locked',
  method: 'POST',
  path: '/api/v1/buyer/test-platform/locked',
  audience: 'buyer',
  permission: 'tender.view',
  response: z.object({ ok: z.boolean() }),
  errors: ['ITEM_LOCKED'],
  screens: ['BUY-07'],
});

export const undeclaredCommand = defineEndpoint({
  id: 'testPlatform.buyer.undeclared',
  method: 'POST',
  path: '/api/v1/buyer/test-platform/undeclared',
  audience: 'buyer',
  permission: 'tender.view',
  response: z.object({ ok: z.boolean() }),
  errors: ['ITEM_LOCKED'],
  screens: ['BUY-07'],
});

export const exploding = defineEndpoint({
  id: 'testPlatform.buyer.explode',
  method: 'GET',
  path: '/api/v1/buyer/test-platform/explode',
  audience: 'buyer',
  permission: 'tender.view',
  response: z.object({ ok: z.boolean() }),
  errors: [],
  screens: ['BUY-01'],
});

export const deleteItem = defineEndpoint({
  id: 'testPlatform.buyer.delete',
  method: 'DELETE',
  path: '/api/v1/buyer/test-platform/items/:itemId',
  audience: 'buyer',
  permission: 'tender.view',
  params: z.object({ itemId: z.string() }),
  response: z.null(),
  status: 204,
  errors: [],
  screens: ['BUY-07'],
});

export const meRowAction = defineEndpoint({
  id: 'testPlatform.me.rowAck',
  method: 'POST',
  path: '/api/v1/me/test-platform/rows/:rowId/ack',
  audience: 'me',
  rowTenant: true,
  permission: 'tender.view',
  params: z.object({ rowId: z.string() }),
  response: z.object({ rowId: z.string(), tenantId: z.number().int() }),
  errors: [],
  screens: ['COM-04'],
});

/** A secret-looking message that must never reach a client. */
export const EXPLOSION_MESSAGE = ['db failure at postgres://svc', 'hunter2@db.internal/tenderiq'].join(':');

function echo(tenant: { tenant: { id: number }; access: 'membership' | 'support_grant'; permissions: readonly string[] }) {
  return { tenantId: tenant.tenant.id, access: tenant.access, permissions: tenant.permissions.length };
}

export function register(app: MockApp): void {
  mockRoute(app, buyerPing, ({ requireTenant }) => echo(requireTenant()));
  mockRoute(app, buyerAdminOnly, ({ requireTenant }) => echo(requireTenant()));
  mockRoute(app, supplierPing, ({ requireTenant }) => echo(requireTenant()));
  mockRoute(app, opsPing, ({ requireTenant }) => echo(requireTenant()));
  mockRoute(app, publicHello, ({ persona }) => ({ hello: 'world', signedIn: persona !== null }));
  mockRoute(app, validatedCommand, ({ params, query, body }) => ({ itemId: params.itemId, mode: query.mode, ...body }));
  // Fixture drift: a float instead of a decimal string.
  mockRoute(app, driftingRead, () => ({ amount: { amount: 12.5, currency: 'BWP' } }) as unknown as { amount: { amount: string; currency: string } });
  mockRoute(app, lockedCommand, ({ fail }) => fail(409, 'ITEM_LOCKED', 'The item is locked by an active hold.'));
  mockRoute(app, undeclaredCommand, ({ fail }) => fail(409, 'SOMETHING_ELSE'));
  mockRoute(app, exploding, () => {
    throw new Error(EXPLOSION_MESSAGE);
  });
  mockRoute(app, deleteItem, () => null);
  mockRoute(app, meRowAction, ({ params, requireTenant }) => ({ rowId: params.rowId, tenantId: requireTenant().tenant.id }));
}

/** The module, for `createTestMockApp({ modules: [...] })`. */
export const platformTestModule: HandlerModule = { name: 'platform-test-endpoints', register };
