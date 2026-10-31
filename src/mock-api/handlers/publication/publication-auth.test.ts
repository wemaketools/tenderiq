/**
 * Publication handlers through the full authentication chain (prototype persona token, DD-50): a signed-in buyer
 * officer and supplier bid manager reach their own rows, and a supplier cannot enter a buyer tenant.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { Problem } from '../../../contracts/common.js';
import { publicationEndpoints as ep } from '../../../contracts/publication.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp } from '../../testing/index.js';
import { register } from './index.js';

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp({ modules: [{ name: 'publication', register }], now: () => new Date('2026-09-30T08:00:00Z') });
});

describe('publication with real Supabase Auth', () => {
  it('serves the participant list to a signed-in KWU officer', async () => {
    const response = await api.callAs('tebogo.officer@tenderiq.local', ep.listParticipants, { tenant: 'kwu', params: { tenderId: 2 } });
    expect(response.status).toBe(200);
    expect((response.body as { total: number }).total).toBe(5);
  });

  it('serves the invitation-only workspace to an invited supplier and refuses the buyer tenant to it', async () => {
    const workspace = await api.callAs('tsodilo.bidmanager@tenderiq.local', ep.opportunityWorkspace, { tenant: 'tsodilo', params: { tenderId: 6 } });
    const buyer = await api.callAs('tsodilo.bidmanager@tenderiq.local', ep.listParticipants, { tenant: 'kwu', params: { tenderId: 6 } });
    expect(workspace.status).toBe(200);
    expect(buyer.status).toBe(403);
    expect(Problem.parse(buyer.body).code).toBe('TENANT_ACCESS_DENIED');
  });
});
