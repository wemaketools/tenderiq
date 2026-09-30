/**
 * Requests domain handlers (05) under the real mock API: auto-discovery of `handlers/requests/index.ts` and REAL
 * local Supabase authentication (DD-43; needs `npm run supabase:start` and `npm run auth:personas`).
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { Problem } from '../../../contracts/common.js';
import { RequestDecisionView, RequestPage, requestEndpoints as e } from '../../../contracts/requests.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp } from '../../testing/index.js';

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp();
});

describe('requests module with real authentication', () => {
  it('is auto-discovered and serves every endpoint of the contract', () => {
    expect(api.loaded).toContain('requests/index');
    expect(api.failed.map((failure) => failure.module)).not.toContain('requests/index');
    expect(api.endpointIds).toEqual(expect.arrayContaining(Object.values(e).map((endpoint) => endpoint.id)));
  });

  it('lists KWU requests for a signed-in officer and isolates the ODC officer', async () => {
    const kwu = RequestPage.parse((await api.callAs('tebogo.officer@tenderiq.local', e.listRequests, { tenant: 'kwu' })).body);
    expect(kwu.total).toBe(13);
    const odc = RequestPage.parse((await api.callAs('officer.odc@tenderiq.local', e.listRequests, { tenant: 'odc' })).body);
    expect(odc.items.map((row) => row.id).sort()).toEqual([101, 102]);
  });

  it('shows the AC-05 route to the signed-in procurement manager', async () => {
    const view = RequestDecisionView.parse((await api.callAs('mpho.manager@tenderiq.local', e.getRequestDecision, { tenant: 'kwu', params: { requestId: 3 } })).body);
    expect(view.routedToNextLevel).toBe(true);
    expect(view.eligibleApprovers[0]?.fullName).toBe('Keabetswe Nkwe');
  });

  it('answers 401 without a token and 403 to a supplier', async () => {
    expect((await api.request('GET', '/api/v1/buyer/requests', { tenant: 'kwu' })).status).toBe(401);
    const supplier = await api.callAs('chobe-pipe.admin@tenderiq.local', e.listRequests, { tenant: 'kwu' });
    expect(supplier.status).toBe(403);
    expect(Problem.parse(supplier.body).code).toBe('TENANT_ACCESS_DENIED');
  });
});
