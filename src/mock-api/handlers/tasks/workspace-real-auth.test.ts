/**
 * The workspace modules behind REAL local Supabase Auth (DD-43): a signed-in persona reaches its own inbox, and a
 * forged token is refused before any workspace handler runs. Needs `npm run supabase:start` + `npm run auth:personas`.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { approvalEndpoints } from '../../../contracts/approvals.js';
import { notificationEndpoints } from '../../../contracts/notifications.js';
import { taskEndpoints } from '../../../contracts/tasks.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp } from '../../testing/index.js';
import { register as registerApprovals } from '../approvals/index.js';
import { register as registerAudit } from '../audit/index.js';
import { register as registerCalendars } from '../calendars/index.js';
import { register as registerDocuments } from '../documents/index.js';
import { register as registerNotificationRules } from '../notification-rules/index.js';
import { register as registerNotifications } from '../notifications/index.js';
import { register as registerTasks } from './index.js';

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp({
    modules: [
      { name: 'approvals', register: registerApprovals },
      { name: 'audit', register: registerAudit },
      { name: 'calendars', register: registerCalendars },
      { name: 'documents', register: registerDocuments },
      { name: 'notification-rules', register: registerNotificationRules },
      { name: 'notifications', register: registerNotifications },
      { name: 'tasks', register: registerTasks },
    ],
  });
});

describe('workspace modules with real authentication', () => {
  it('registers every workspace module without collisions', () => {
    expect(api.failed).toEqual([]);
    expect(api.loaded).toHaveLength(7);
  });

  it('serves the task summary of a really signed-in persona', async () => {
    const response = await api.callAs('mpho.manager@tenderiq.local', taskEndpoints.getMyTaskSummary);
    expect(response.status).toBe(200);
    expect(taskEndpoints.getMyTaskSummary.response.parse(response.body).open).toBeGreaterThan(0);
  });

  it('serves the routed approval to the executive (AC-05)', async () => {
    const response = await api.callAs('keabetswe.approver@tenderiq.local', approvalEndpoints.getMyApproval, { params: { approvalId: 305 } });
    expect(response.status).toBe(200);
  });

  it('answers 401 to a forged token before any workspace handler runs', async () => {
    const response = await api.request('GET', notificationEndpoints.listMyNotifications.path, { token: 'not-a-real-token' });
    expect(response.status).toBe(401);
  });
});
