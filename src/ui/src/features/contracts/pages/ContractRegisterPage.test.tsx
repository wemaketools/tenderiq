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

function lastListQuery(calls: ReturnType<typeof routeCalls>): Record<string, unknown> {
  const last = callsTo(calls, 'buyer.contracts.list').at(-1)?.request as {
    query: Record<string, unknown>;
  };
  return last.query;
}

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
    expect(cells.getByText('Kalahari Water Utilities Corporation')).toBeInTheDocument();
    expect(cells.getByText(/Owner: Tebogo Molefe/)).toBeInTheDocument();
    expect(cells.getByText(/Manager: Masego Rakgosi/)).toBeInTheDocument();
    expect(cells.getByText('BWP 1,995,000')).toBeInTheDocument();
    expect(cells.getByText('Original BWP 1,850,000')).toBeInTheDocument();
    expect(cells.getByText('Remaining BWP 255,000')).toBeInTheDocument();
    expect(cells.getByText('31 Mar 2027')).toBeInTheDocument();
    expect(cells.getByText('From 1 Apr 2026')).toBeInTheDocument();
    expect(cells.getByText('Renewal decision')).toBeInTheDocument();
    expect(cells.getByText('1 overdue')).toBeInTheDocument();
    // An active contract carries its status for assistive technology without a chip in every row.
    expect(cells.getByText('Active')).toHaveClass('tiq-visually-hidden');
    expect(screen.queryByRole('button', { name: /Assign owners of/ })).not.toBeInTheDocument();
  });

  it('lays the page out as a content heading, coming-up dates, views, a plain table and the summary foot', async () => {
    routeCalls({
      'buyer.contracts.list': listResponse(),
      'buyer.contracts.assignees': assignees(),
    });
    const { container } = renderPage(<ContractRegisterPage />, {
      ...OPTIONS,
      permissions: ['contract.view', 'contract.manage'],
    });
    await screen.findByText('C-2026-0001');

    expect(document.title).toBe('Contracts · TenderIQ');
    expect(container.querySelector('.tiq-kpi-grid')).toBeNull();
    expect(container.querySelector('.tiq-datatable--plain')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Coming up' })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Contract views' })).toBeInTheDocument();
    const headers = screen.getAllByRole('columnheader').map((cell) => cell.textContent ?? '');
    expect(headers).toEqual([
      'Contract',
      'Supplier',
      'Current value',
      'Term ends',
      'Next step',
      'Actions',
      'Open',
    ]);
    expect(
      screen.getByText('1 contract', { selector: '.tiq-register-foot span' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('1 contracts. One clear view.'.replace('1 contracts', '1 contract')),
    ).toBeInTheDocument();
  });

  it('lists the next dated decisions of the loaded contracts, soonest first, with their official deadline', async () => {
    routeCalls({
      'buyer.contracts.list': listResponse([
        contractRow({
          nextDecision: {
            kind: 'renewal_notice',
            dueAt: { at: '2031-03-01T15:00:00Z', timeZone: 'Africa/Gaborone' },
            detail: null,
          },
        }),
        contractRow({
          id: 2,
          reference: 'C-2026-0002',
          title: 'Laboratory reagents supply',
          nextDecision: {
            kind: 'signature',
            dueAt: { at: '2030-06-20T10:00:00Z', timeZone: 'Africa/Gaborone' },
            detail: null,
          },
        }),
        contractRow({
          id: 3,
          reference: 'C-2026-0003',
          title: 'Undated change',
          nextDecision: { kind: 'change_approval', dueAt: null, detail: null },
        }),
        contractRow({
          id: 4,
          reference: 'C-2026-0004',
          title: 'Nothing due',
          nextDecision: null,
        }),
      ]),
      'buyer.contracts.assignees': assignees(),
    });
    renderPage(<ContractRegisterPage />, { ...OPTIONS, permissions: ['contract.view'] });

    const list = await screen.findByRole('list', { name: 'Coming up' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0] as HTMLElement).getByRole('link')).toHaveTextContent(
      'Laboratory reagents supply',
    );
    expect(within(items[0] as HTMLElement).getByText('Signature')).toBeInTheDocument();
    expect(
      within(items[0] as HTMLElement).getByText('20', { selector: '.tiq-datebadge-day' }),
    ).toBeInTheDocument();
    expect(within(items[0] as HTMLElement).getByTestId('official-deadline')).toHaveTextContent(
      '20 Jun 2030, 12:00 (UTC+02:00) Africa/Gaborone',
    );
    expect(within(items[1] as HTMLElement).getByText('Renewal decision')).toBeInTheDocument();
    expect(within(items[1] as HTMLElement).getByRole('link')).toHaveAttribute(
      'href',
      '/buyer/contracts/1',
    );
    expect(
      screen.getByText(/next dated decisions of the contracts listed below/),
    ).toBeInTheDocument();
  });

  it('says so when no listed contract has a dated decision coming up', async () => {
    routeCalls({
      'buyer.contracts.list': listResponse([contractRow({ nextDecision: null })]),
      'buyer.contracts.assignees': assignees(),
    });
    renderPage(<ContractRegisterPage />, { ...OPTIONS, permissions: ['contract.view'] });
    expect(
      await screen.findByText('None of the contracts shown has a dated decision coming up.'),
    ).toBeInTheDocument();
  });

  it('sends the status and decision filters from the filter disclosure to the register query', async () => {
    const calls = routeCalls({
      'buyer.contracts.list': listResponse(),
      'buyer.contracts.assignees': assignees(),
    });
    const user = userEvent.setup();
    renderPage(<ContractRegisterPage />, { ...OPTIONS, permissions: ['contract.view'] });
    await screen.findByText('C-2026-0001');

    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Filters' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.selectOptions(screen.getByLabelText('Status'), 'active');
    await user.selectOptions(screen.getByLabelText('Decision'), 'yes');

    await waitFor(() => {
      expect(lastListQuery(calls)).toMatchObject({ status: ['active'], upcomingDecision: true });
    });
    await user.click(screen.getByRole('button', { name: 'Hide filters' }));
    expect(screen.getByRole('button', { name: 'Filters (2 active)' })).toBeInTheDocument();
  });

  it('maps the Mine and Renewals views to the owner and renewal-window filters', async () => {
    const calls = routeCalls({
      'buyer.contracts.list': listResponse(),
      'buyer.contracts.assignees': assignees(),
    });
    const user = userEvent.setup();
    renderPage(<ContractRegisterPage />, {
      ...OPTIONS,
      permissions: ['contract.view'],
      userId: 19,
    });
    await screen.findByText('C-2026-0001');

    await user.click(screen.getByRole('tab', { name: 'Mine' }));
    await waitFor(() => expect(lastListQuery(calls)).toMatchObject({ ownerUserId: 19 }));
    expect(screen.getByRole('tab', { name: 'Mine' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('tab', { name: 'Renewals' }));
    await waitFor(() => {
      const query = lastListQuery(calls);
      expect(query).toMatchObject({ renewalWithinDays: 90 });
      expect(query).not.toHaveProperty('ownerUserId');
    });

    await user.click(screen.getByRole('tab', { name: 'All contracts' }));
    await waitFor(() => {
      const query = lastListQuery(calls);
      expect(query).not.toHaveProperty('renewalWithinDays');
      expect(query).not.toHaveProperty('ownerUserId');
    });
  });

  it('shows the empty state when no contract is visible', async () => {
    routeCalls({
      'buyer.contracts.list': listResponse([]),
      'buyer.contracts.assignees': assignees(),
    });
    renderPage(<ContractRegisterPage />, { ...OPTIONS, permissions: ['contract.view'] });
    expect(await screen.findByText('No contracts yet')).toBeInTheDocument();
    expect(screen.queryByTestId('contracts-summary')).not.toBeInTheDocument();
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

  it('shows when the notice window opens and the summary figures per currency (AC-32)', async () => {
    routeCalls({
      'buyer.contracts.list': listResponse(),
      'buyer.contracts.assignees': assignees(),
    });
    renderPage(<ContractRegisterPage />, { ...OPTIONS, permissions: ['contract.view'] });

    const row = (await screen.findByText('C-2026-0001')).closest('tr');
    const cells = within(row as HTMLElement);
    expect(cells.getByText(/Window opens 5 Oct 2026/)).toBeInTheDocument();
    expect(cells.getByText(/in 5 days/)).toBeInTheDocument();
    expect(cells.queryByText('Deadline:')).not.toBeInTheDocument();

    const summary = screen.getByTestId('contracts-summary');
    expect(within(summary).getByText('BWP 8.7M')).toBeInTheDocument();
    expect(within(summary).getByText('committed')).toBeInTheDocument();
    expect(within(summary).getByText('Across your active contracts, in BWP')).toBeInTheDocument();
    expect(
      within(summary).getByText('Renewal decisions ≤ 90 days').nextElementSibling,
    ).toHaveTextContent('1');
    expect(within(summary).getByText('Upcoming decisions').nextElementSibling).toHaveTextContent(
      '6',
    );
    expect(within(summary).getByText('Active contracts').nextElementSibling).toHaveTextContent('1');
    expect(within(summary).getByText('3 obligations need attention')).toBeInTheDocument();
  });

  it('leaves the attention line out when no obligation is overdue and keeps currencies apart', async () => {
    const response = listResponse();
    routeCalls({
      'buyer.contracts.list': {
        ...response,
        summary: {
          ...response.summary,
          overdueObligations: 0,
          currentValueByCurrency: [
            { amount: '8700000.00', currency: 'BWP' },
            { amount: '120000.00', currency: 'USD' },
          ],
        },
      },
      'buyer.contracts.assignees': assignees(),
    });
    renderPage(<ContractRegisterPage />, { ...OPTIONS, permissions: ['contract.view'] });
    const summary = await screen.findByTestId('contracts-summary');
    expect(within(summary).getByText('BWP 8.7M')).toBeInTheDocument();
    expect(within(summary).getByText('USD 120K')).toBeInTheDocument();
    expect(within(summary).queryByText(/need attention/)).not.toBeInTheDocument();
  });

  it('shows the notice deadline in the term column when the next decision is not the renewal', async () => {
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
