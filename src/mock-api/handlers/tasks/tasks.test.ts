import { beforeAll, describe, expect, it } from 'vitest';

import { TaskDetail, taskEndpoints } from '../../../contracts/tasks.js';
import { WORKSPACE_AS_OF } from '../../fixtures/approvals/world.js';
import { TASKS } from '../../fixtures/tasks.js';
import { allPersonas } from '../../persona.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp } from '../../testing/index.js';
import { register } from './index.js';

const EMAIL = (login: string): string => `${login}@tenderiq.local`;

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp({ auth: 'fixture', modules: [{ name: 'tasks', register }] });
});

describe('tasks module', () => {
  it('loads without skipped modules', () => {
    expect(api.failed).toEqual([]);
    expect(api.loaded).toContain('tasks');
  });

  it.each(allPersonas().filter((persona) => persona.status === 'active').map((persona) => [persona.email] as const))(
    'serves a contract-valid inbox, summary and task details for %s',
    async (email) => {
      const list = await api.callAs(email, taskEndpoints.listMyTasks, { query: { pageSize: 100 } });
      expect(list.status).toBe(200);
      const page = taskEndpoints.listMyTasks.response.parse(list.body);
      const summary = await api.callAs(email, taskEndpoints.getMyTaskSummary);
      expect(summary.status).toBe(200);
      for (const row of page.items) {
        const detail = await api.callAs(email, taskEndpoints.getMyTask, { params: { taskId: row.id } });
        expect(TaskDetail.parse(detail.body).id).toBe(row.id);
      }
    },
  );

  it('gives every active persona at least one task (fixtures cover every persona)', async () => {
    for (const persona of allPersonas().filter((candidate) => candidate.status === 'active')) {
      const list = await api.callAs(persona.email, taskEndpoints.listMyTasks);
      expect(taskEndpoints.listMyTasks.response.parse(list.body).total, persona.email).toBeGreaterThan(0);
    }
  });
});

describe('me.tasks.list', () => {
  it('labels each row with its organization and spans every membership of a multi-org person', async () => {
    const list = await api.callAs(EMAIL('sam.dual'), taskEndpoints.listMyTasks, { query: { pageSize: 100 } });
    const tenants = new Set(taskEndpoints.listMyTasks.response.parse(list.body).items.map((row) => row.organization.tenantName));
    expect([...tenants].sort()).toEqual(['Chobe Pipe & Valve Supplies', 'Kalahari Water Utilities (Pilot)', 'Tsodilo Engineering']);
  });

  it('includes group tasks of the caller’s groups but never another person’s tasks', async () => {
    const list = await api.callAs(EMAIL('tebogo.officer'), taskEndpoints.listMyTasks, { query: { pageSize: 100 } });
    const rows = taskEndpoints.listMyTasks.response.parse(list.body).items;
    expect(rows.some((row) => row.assigneeGroup?.name === 'Procurement team')).toBe(true);
    expect(rows.every((row) => row.assignee === null || row.assignee.fullName === 'Tebogo Molefe')).toBe(true);
  });

  it('filters overdue work, delegations and task types', async () => {
    const overdue = await api.callAs(EMAIL('mpho.manager'), taskEndpoints.listMyTasks, { query: { overdue: 'true' } });
    expect(taskEndpoints.listMyTasks.response.parse(overdue.body).items.map((row) => row.id)).toEqual([104]);
    const delegated = await api.callAs(EMAIL('mpho.manager'), taskEndpoints.listMyTasks, { query: { delegated: 'true' } });
    expect(taskEndpoints.listMyTasks.response.parse(delegated.body).items.map((row) => row.delegatedFrom?.fullName)).toEqual([
      'Keabetswe Nkwe',
    ]);
    const exceptions = await api.callAs(EMAIL('tebogo.officer'), taskEndpoints.listMyTasks, { query: { taskType: 'delivery_exception' } });
    expect(taskEndpoints.listMyTasks.response.parse(exceptions.body).items.map((row) => row.id)).toEqual([114, 190]);
  });

  it('sorts by priority on request', async () => {
    const list = await api.callAs(EMAIL('tebogo.officer'), taskEndpoints.listMyTasks, { query: { sort: 'priority', status: 'open' } });
    const priorities = taskEndpoints.listMyTasks.response.parse(list.body).items.map((row) => row.priority);
    expect(priorities[0]).toBe('urgent');
  });

  it('keeps one supplier’s tasks away from another supplier', async () => {
    const list = await api.callAs(EMAIL('chobe-pipe.bidmanager'), taskEndpoints.listMyTasks, { query: { pageSize: 100 } });
    const rows = taskEndpoints.listMyTasks.response.parse(list.body).items;
    expect(rows.every((row) => row.organization.tenantName === 'Chobe Pipe & Valve Supplies')).toBe(true);
  });

  it('never lists tasks of an inactive membership', async () => {
    const list = await api.callAs(EMAIL('sam.dual'), taskEndpoints.listMyTasks, { query: { pageSize: 100 } });
    const rows = taskEndpoints.listMyTasks.response.parse(list.body).items;
    expect(rows.some((row) => row.organization.tenantName === 'Serowe ICT Solutions')).toBe(false);
  });
});

describe('me.tasks.summary', () => {
  it('counts open and overdue tasks per organization', async () => {
    const response = await api.callAs(EMAIL('sam.dual'), taskEndpoints.getMyTaskSummary);
    const summary = taskEndpoints.getMyTaskSummary.response.parse(response.body);
    expect(summary.byOrganization).toHaveLength(3);
    expect(summary.open).toBe(summary.byOrganization.reduce((total, row) => total + row.open, 0));
  });
});

describe('task actions', () => {
  it('answers 404 for another person’s task', async () => {
    const response = await api.callAs(EMAIL('kabo.eval'), taskEndpoints.getMyTask, { params: { taskId: 113 } });
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'TASK_NOT_FOUND' });
  });

  it('completes an action task and records the outcome', async () => {
    const response = await api.callAs(EMAIL('tebogo.officer'), taskEndpoints.completeMyTask, {
      params: { taskId: 115 },
      tenant: 'kwu',
      body: { outcomeNote: 'Answer published to all participants.' },
    });
    expect(response.status).toBe(200);
    const task = TaskDetail.parse(response.body);
    expect(task).toMatchObject({ status: 'completed', outcomeNote: 'Answer published to all participants.' });
    // Stamped on the storyline clock, never before the task was created.
    expect(Date.parse(task.completedAt ?? '')).toBeGreaterThanOrEqual(Date.parse(WORKSPACE_AS_OF));
    expect(Date.parse(task.completedAt ?? '')).toBeGreaterThanOrEqual(Date.parse(task.createdAt));
  });

  it('refuses to complete a task that completes through its source action', async () => {
    const response = await api.callAs(EMAIL('mpho.manager'), taskEndpoints.completeMyTask, { params: { taskId: 101 }, tenant: 'kwu', body: {} });
    expect(response.body).toMatchObject({ code: 'TASK_COMPLETED_BY_SOURCE_ACTION' });
  });

  it('refuses an action on a closed task', async () => {
    const response = await api.callAs(EMAIL('tebogo.officer'), taskEndpoints.returnMyTask, {
      params: { taskId: 118 },
      tenant: 'kwu',
      body: { reason: 'Not mine' },
    });
    expect(response.body).toMatchObject({ code: 'TASK_NOT_OPEN' });
  });

  it('refuses an action sent in another organization of the same person', async () => {
    const response = await api.callAs(EMAIL('sam.dual'), taskEndpoints.completeMyTask, { params: { taskId: 161 }, tenant: 'kwu', body: {} });
    expect(response.body).toMatchObject({ code: 'TASK_TENANT_MISMATCH' });
  });

  it('requires a reason to return a task', async () => {
    const response = await api.callAs(EMAIL('tebogo.officer'), taskEndpoints.returnMyTask, { params: { taskId: 115 }, tenant: 'kwu', body: {} });
    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ errors: [{ field: 'reason', code: 'REASON_REQUIRED' }] });
  });

  it('offers only eligible, unconflicted colleagues for reassignment', async () => {
    const response = await api.callAs(EMAIL('thato.eval'), taskEndpoints.listReassignCandidates, { params: { taskId: 140 } });
    const names = taskEndpoints.listReassignCandidates.response.parse(response.body).items.map((row) => row.fullName);
    expect(names).toEqual(expect.arrayContaining(['Kabo Ntsima', 'Amantle Segwai']));
    expect(names).not.toContain('Sam Keitumetse');
    expect(names).not.toContain('Thato Mokgosi');
  });

  it('reassigns within authority and refuses self, conflicted and ineligible colleagues', async () => {
    const kabo = allPersonas().find((persona) => persona.email === EMAIL('kabo.eval'));
    const sam = allPersonas().find((persona) => persona.email === EMAIL('sam.dual'));
    const thato = allPersonas().find((persona) => persona.email === EMAIL('thato.eval'));
    const admin = allPersonas().find((persona) => persona.email === EMAIL('admin.kwu'));
    const call = (assigneeUserId: number | undefined) =>
      api.callAs(EMAIL('thato.eval'), taskEndpoints.reassignMyTask, {
        params: { taskId: 140 },
        tenant: 'kwu',
        body: { assigneeUserId, reason: 'On site visit that day' },
      });
    expect((await call(kabo?.userId)).body).toMatchObject({ status: 'reassigned' });
    expect((await call(thato?.userId)).body).toMatchObject({ code: 'REASSIGN_TO_SELF' });
    expect((await call(sam?.userId)).body).toMatchObject({ code: 'REASSIGNEE_CONFLICTED' });
    expect((await call(admin?.userId)).body).toMatchObject({ code: 'REASSIGNEE_NOT_ELIGIBLE' });
  });

  it('keeps the fixture unchanged after a command (nothing persists)', async () => {
    await api.callAs(EMAIL('tebogo.officer'), taskEndpoints.completeMyTask, { params: { taskId: 113 }, tenant: 'kwu', body: {} });
    const after = await api.callAs(EMAIL('tebogo.officer'), taskEndpoints.getMyTask, { params: { taskId: 113 } });
    expect(TaskDetail.parse(after.body).status).toBe(TASKS.find((task) => task.id === 113)?.status);
  });
});
