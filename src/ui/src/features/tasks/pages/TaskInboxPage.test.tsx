import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { businessError, callsTo, renderPage, routeCalls } from '../test/kit';
import { page, task, taskDetail, taskSummary } from '../test/workspaceData';
import TaskInboxPage from './TaskInboxPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/me/tasks', route: '/me/tasks' };

function baseRoutes(extra: Record<string, (request: Record<string, unknown>) => unknown> = {}) {
  return routeCalls({
    'me.tasks.summary': () => taskSummary(),
    'me.tasks.list': () => page([task()]),
    'me.tasks.get': () => taskDetail(),
    'me.tasks.reassignCandidates': () => ({
      items: [
        { userId: 5, fullName: 'Tebogo Molefe', capacity: 'Procurement Officer', openTasks: 3 },
      ],
    }),
    ...extra,
  });
}

async function openMenuAction(label: string): Promise<void> {
  const trigger = await screen.findByRole('button', {
    name: 'Actions for Approve exclusion of Makgadikgadi Civil Works',
  });
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByRole('menuitem', { name: label }));
}

describe('TaskInboxPage (COM-04)', () => {
  it('shows the task with its source, organization, owner, due date and overdue flag', async () => {
    baseRoutes();
    renderPage(<TaskInboxPage />, PATH);
    const row = (await screen.findByText('Approve exclusion of Makgadikgadi Civil Works')).closest(
      'tr',
    );
    expect(row).not.toBeNull();
    const cells = within(row as HTMLElement);
    expect(cells.getByText('T-2026-0003')).toBeInTheDocument();
    expect(cells.getByText('Kalahari Water Utilities (Pilot)')).toBeInTheDocument();
    expect(cells.getByText('Record owner: Boitumelo Kgari')).toBeInTheDocument();
    expect(cells.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('Open tasks')).toBeInTheDocument();
  });

  it('requests open work by default and the chosen filters when they change', async () => {
    const calls = baseRoutes();
    renderPage(<TaskInboxPage />, PATH);
    await screen.findByText('Approve exclusion of Makgadikgadi Civil Works');
    const first = callsTo(calls, 'me.tasks.list').find(
      (entry) => (entry.request.query as { pageSize?: number }).pageSize === 25,
    );
    expect(first?.request.query).toMatchObject({ status: ['open', 'in_progress'], sort: 'dueAt' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Overdue only' }));
    await waitFor(() =>
      expect(
        callsTo(calls, 'me.tasks.list').some(
          (entry) => (entry.request.query as { overdue?: boolean }).overdue === true,
        ),
      ).toBe(true),
    );
  });

  it('reassigns within the task organization after the colleague and reason are given', async () => {
    const calls = baseRoutes({
      'me.tasks.reassign': () => taskDetail({ status: 'reassigned', allowedActions: [] }),
    });
    renderPage(<TaskInboxPage />, PATH);
    await openMenuAction('Reassign');
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(await within(dialog).findByLabelText(/Reassign to/), {
      target: { value: '5' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Reason for the reassignment/), {
      target: { value: 'Mpho is on leave' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reassign' }));
    await waitFor(() => expect(callsTo(calls, 'me.tasks.reassign')).toHaveLength(1));
    const [sent] = callsTo(calls, 'me.tasks.reassign');
    expect(sent?.request).toMatchObject({
      params: { taskId: 104 },
      body: { assigneeUserId: 5, reason: 'Mpho is on leave' },
    });
    expect(sent?.options).toMatchObject({ tenantId: 2 });
    expect(await screen.findByText('Task reassigned to Tebogo Molefe.')).toBeInTheDocument();
  });

  it('keeps the return button disabled until a reason is given', async () => {
    baseRoutes();
    renderPage(<TaskInboxPage />, PATH);
    await openMenuAction('Return');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Kalahari Water Utilities (Pilot)')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Return' })).toBeDisabled();
  });

  it('explains a task completed by its source action', async () => {
    baseRoutes({
      'me.tasks.complete': () => {
        throw businessError('me.tasks.complete', 'TASK_COMPLETED_BY_SOURCE_ACTION');
      },
    });
    renderPage(<TaskInboxPage />, PATH);
    await openMenuAction('Mark complete');
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mark complete' }));
    expect(
      await within(dialog).findByText(
        'This task completes itself when you act on its source record. Open the source record instead.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the task history in the details drawer', async () => {
    baseRoutes();
    renderPage(<TaskInboxPage />, PATH);
    await openMenuAction('Details');
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Task history')).toBeInTheDocument();
    expect(within(dialog).getByText('Keabetswe Nkwe')).toBeInTheDocument();
  });

  it('shows an empty inbox when nothing is assigned', async () => {
    routeCalls({
      'me.tasks.summary': () =>
        taskSummary({ open: 0, overdue: 0, dueSoon: 0, byOrganization: [] }),
      'me.tasks.list': () => page([]),
    });
    renderPage(<TaskInboxPage />, PATH);
    expect(await screen.findByText('You have no open tasks.')).toBeInTheDocument();
  });
});
