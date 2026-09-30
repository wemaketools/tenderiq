import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ClientModule from '../../../api/client';

import { assignees, contractRow, listResponse } from '../test/data';
import { businessError, callsTo, renderPage, routeCalls } from '../test/harness';
import ContractRegisterPage from './ContractRegisterPage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof ClientModule>()),
  call: vi.fn(),
}));

const OPTIONS = {
  route: '/buyer/contracts',
  path: '/buyer/contracts',
} as const;

describe('ContractRegisterPage (CON-01)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows parties, owner, value, remaining ceiling, term, status, renewal date and next decision', async () => {
    routeCalls({
      'buyer.contracts.list': listResponse(),
      'buyer.contracts.assignees': assignees(),
    });
    renderPage(<ContractRegisterPage />, { ...OPTIONS, permissions: ['contract.view'] });

    const row = (await screen.findByText('C-2026-0001')).closest('tr');
    expect(row).not.toBeNull();
    const cells = within(row as HTMLElement);
    expect(cells.getByText('Tsodilo Engineering')).toBeInTheDocument();
    expect(cells.getByText('Tebogo Molefe')).toBeInTheDocument();
    expect(cells.getByText('BWP 1,995,000')).toBeInTheDocument();
    expect(cells.getByText('Remaining ceiling BWP 255,000')).toBeInTheDocument();
    expect(cells.getByText('Renewal decision')).toBeInTheDocument();
    expect(cells.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Upcoming decisions')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /New contract/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Assign owners of/ })).not.toBeInTheDocument();
  });

  it('sends the status and decision filters to the register query', async () => {
    const calls = routeCalls({
      'buyer.contracts.list': listResponse(),
      'buyer.contracts.assignees': assignees(),
    });
    const user = userEvent.setup();
    renderPage(<ContractRegisterPage />, { ...OPTIONS, permissions: ['contract.view'] });
    await screen.findByText('C-2026-0001');

    await user.selectOptions(screen.getByLabelText('Status'), 'active');
    await user.selectOptions(screen.getByLabelText('Decision'), 'yes');

    await waitFor(() => {
      const last = callsTo(calls, 'buyer.contracts.list').at(-1)?.request as {
        query: Record<string, unknown>;
      };
      expect(last.query).toMatchObject({ status: ['active'], upcomingDecision: true });
    });
  });

  it('shows the empty state when no contract is visible', async () => {
    routeCalls({
      'buyer.contracts.list': listResponse([]),
      'buyer.contracts.assignees': assignees(),
    });
    renderPage(<ContractRegisterPage />, { ...OPTIONS, permissions: ['contract.view'] });
    expect(await screen.findByText('No contracts yet')).toBeInTheDocument();
  });

  it('assigns owners through the confirmation dialog and shows a business refusal', async () => {
    const calls = routeCalls({
      'buyer.contracts.list': listResponse([contractRow()]),
      'buyer.contracts.assignees': assignees(),
      'buyer.contracts.assignOwners': businessError('ASSIGNEE_NOT_ELIGIBLE', 409, 'Not eligible.'),
    });
    const user = userEvent.setup();
    renderPage(<ContractRegisterPage />, {
      ...OPTIONS,
      permissions: ['contract.view', 'contract.manage', 'contract.prepare'],
    });
    expect(await screen.findByRole('link', { name: /New contract/ })).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Assign owners of C-2026-0001' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Kalahari Water Utilities (Pilot)')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Assign' }));

    expect(await within(dialog).findByText('Not eligible.')).toBeInTheDocument();
    expect(callsTo(calls, 'buyer.contracts.assignOwners')[0]?.request).toMatchObject({
      params: { contractId: 1 },
      body: { ownerUserId: 5, contractManagerUserId: 19 },
    });
  });

  it('shows when the notice window opens and counts window openings in the renewal KPI (AC-32)', async () => {
    routeCalls({
      'buyer.contracts.list': listResponse(),
      'buyer.contracts.assignees': assignees(),
    });
    renderPage(<ContractRegisterPage />, { ...OPTIONS, permissions: ['contract.view'] });

    const row = (await screen.findByText('C-2026-0001')).closest('tr');
    const cells = within(row as HTMLElement);
    expect(cells.getByText('Window opens 5 Oct 2026')).toBeInTheDocument();
    expect(cells.getByText('in 5 days')).toBeInTheDocument();
    expect(cells.queryByText('Deadline:')).not.toBeInTheDocument();
    expect(screen.getByText('Renewal decisions ≤ 90 days')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Notice window opens or deadline falls within 90 days; nothing renews automatically',
      ),
    ).toBeInTheDocument();
  });

  it('shows the notice deadline in the window column when the next decision is not the renewal', async () => {
    routeCalls({
      'buyer.contracts.list': listResponse([
        contractRow({
          nextRenewalWindow: { windowStart: '2026-09-01', state: 'open', daysUntilOpens: -29 },
          nextDecision: {
            kind: 'change_approval',
            dueAt: null,
            detail: 'A change request awaits approval.',
          },
        }),
      ]),
      'buyer.contracts.assignees': assignees(),
    });
    renderPage(<ContractRegisterPage />, { ...OPTIONS, permissions: ['contract.view'] });

    const row = (await screen.findByText('C-2026-0001')).closest('tr');
    const cells = within(row as HTMLElement);
    expect(cells.getByText('Window open')).toBeInTheDocument();
    expect(cells.getByText(/Deadline:/)).toBeInTheDocument();
  });
});
