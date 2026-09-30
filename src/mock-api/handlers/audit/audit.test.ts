import { beforeAll, describe, expect, it } from 'vitest';

import { auditEndpoints } from '../../../contracts/audit.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp } from '../../testing/index.js';
import { register } from './index.js';

const MPHO = 'mpho.manager@tenderiq.local';

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp({ auth: 'fixture', modules: [{ name: 'audit', register }] });
});

describe('buyer.audit.entityHistory', () => {
  it('loads without skipped modules', () => {
    expect(api.failed).toEqual([]);
    expect(api.loaded).toContain('audit');
  });

  it('returns the history of one record newest first with before and after states', async () => {
    const response = await api.callAs(MPHO, auditEndpoints.getEntityHistory, { tenant: 'kwu', params: { entityType: 'tender', entityId: 5 } });
    const page = auditEndpoints.getEntityHistory.response.parse(response.body);
    expect(page.items[0]?.action).toBe('tender.status_changed');
    expect(page.items.find((row) => row.id === 1005)?.afterState).toMatchObject({ revision: 3, estimatedValue: 'BWP 1,920,000.00' });
  });

  it('redacts restricted rows to metadata (DD-31)', async () => {
    const response = await api.callAs('pule.auditor@tenderiq.local', auditEndpoints.getEntityHistory, {
      tenant: 'kwu',
      params: { entityType: 'tender', entityId: 8 },
      query: { sensitivity: 'restricted' },
    });
    const rows = auditEndpoints.getEntityHistory.response.parse(response.body).items;
    expect(rows.length).toBe(3);
    expect(rows.every((row) => row.redacted && row.beforeState === null && row.afterState === null && row.reason === null)).toBe(true);
  });

  it('attributes actions of the departed officer and support access in the customer tenant', async () => {
    const t8 = await api.callAs(MPHO, auditEndpoints.getEntityHistory, { tenant: 'kwu', params: { entityType: 'tender', entityId: 8 } });
    expect(auditEndpoints.getEntityHistory.response.parse(t8.body).items.some((row) => row.actor?.fullName === 'Gaone Letsholo')).toBe(true);
    const t3 = await api.callAs(MPHO, auditEndpoints.getEntityHistory, { tenant: 'kwu', params: { entityType: 'tender', entityId: 3 } });
    expect(auditEndpoints.getEntityHistory.response.parse(t3.body).items.find((row) => row.supportGrantId !== null)?.actorCapacity).toBe(
      'Platform support (read-only)',
    );
  });

  it('keeps each buyer’s audit trail separate', async () => {
    const response = await api.callAs('admin.odc@tenderiq.local', auditEndpoints.getEntityHistory, {
      tenant: 'odc',
      params: { entityType: 'tender', entityId: 5 },
    });
    expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
    const kwuTender = await api.callAs(MPHO, auditEndpoints.getEntityHistory, { tenant: 'kwu', params: { entityType: 'tender', entityId: 11 } });
    expect(auditEndpoints.getEntityHistory.response.parse(kwuTender.body).total).toBe(0);
  });

  it('refuses members without audit.view and unknown entity types', async () => {
    const officer = await api.callAs('tebogo.officer@tenderiq.local', auditEndpoints.getEntityHistory, {
      tenant: 'kwu',
      params: { entityType: 'tender', entityId: 5 },
    });
    expect(officer.body).toMatchObject({ code: 'FORBIDDEN' });
    const unknown = await api.callAs(MPHO, auditEndpoints.getEntityHistory, { tenant: 'kwu', params: { entityType: 'weather', entityId: 1 } });
    expect(unknown.body).toMatchObject({ code: 'ENTITY_TYPE_NOT_AUDITED' });
  });
});
