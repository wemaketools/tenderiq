import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RequestRow, RequestSummary } from '@contracts/requests';

import { installFetch, problem } from '../../../test/fetchMock';
import { rowOf } from '../lib';
import { options, request } from '../testing/data';
import { OFFICER, renderPage } from '../testing/render';
import RequestRegisterPage from './RequestRegisterPage';

const submitted: RequestRow = {
  ...rowOf(request),
  id: 8,
  reference: 'PR-2026-0008',
  title: 'Protective clothing and PPE annual supply',
  status: 'submitted',
  owner: null,
};
const approvedRow: RequestRow = {
  ...rowOf(request),
  id: 5,
  reference: 'PR-2026-0005',
  status: 'approved',
};

const summary: RequestSummary = {
  byStatus: [
    { status: 'submitted', count: 1 },
    { status: 'under_review', count: 1 },
  ],
  openCount: 2,
  unassignedCount: 1,
  awaitingMyDecisionCount: 0,
  openInfoRequestCount: 1,
  reapprovalRequiredCount: 1,
  openEstimatedValue: [{ amount: '5270000.00', currency: 'BWP' }],
};

function page(items: RequestRow[]) {
  return { items, total: items.length, page: 1, pageSize: 25 };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RequestRegisterPage (BUY-02)', () => {
  it('shows each request with requester, purpose, estimate, funding, priority, status and age when loaded', async () => {
    installFetch({
      'GET /api/v1/buyer/requests': () => ({ body: page([submitted, rowOf(request)]) }),
      'GET /api/v1/buyer/request-summary': () => ({ body: summary }),
      'GET /api/v1/buyer/request-options': () => ({ body: options }),
    });
    renderPage(<RequestRegisterPage />, { route: '/buyer/requests' });

    const table = await screen.findByRole('table', { name: 'Request register' });
    const row = within(table).getByText('PR-2026-0003').closest('tr') as HTMLElement;
    expect(within(row).getByText('Kagiso Phiri')).toBeInTheDocument();
    expect(within(row).getByText('BWP 4,850,000')).toBeInTheDocument();
    expect(within(row).getByText('Approved budget')).toBeInTheDocument();
    expect(within(row).getByText('Critical')).toBeInTheDocument();
    expect(within(row).getByText('Under review')).toBeInTheDocument();
    expect(within(row).getByText('15 days')).toBeInTheDocument();
    expect(within(table).getByText('Unassigned')).toBeInTheDocument();
    expect(screen.getByText('Open requests').closest('.tiq-kpi')).toHaveTextContent('2');
  });

  it('shows each status quick filter with its count inline, not as an absolutely positioned badge, when the summary loads', async () => {
    installFetch({
      'GET /api/v1/buyer/requests': () => ({ body: page([submitted]) }),
      'GET /api/v1/buyer/request-summary': () => ({
        body: { ...summary, byStatus: [{ status: 'submitted', count: 7 }] },
      }),
      'GET /api/v1/buyer/request-options': () => ({ body: options }),
    });
    renderPage(<RequestRegisterPage />, { route: '/buyer/requests' });

    const group = await screen.findByRole('group', { name: 'Requests by status' });
    const chip = within(group).getByRole('button');
    expect(chip).toHaveTextContent('Submitted7');
    expect(chip.querySelector('.tiq-count')).toBeNull();
    expect(within(chip).getByText('7')).toHaveClass('tiq-tab-count');
  });

  it('keeps the request column readable and clamps the purpose to one line with the full text in its title', async () => {
    installFetch({
      'GET /api/v1/buyer/requests': () => ({ body: page([rowOf(request)]) }),
      'GET /api/v1/buyer/request-summary': () => ({ body: summary }),
      'GET /api/v1/buyer/request-options': () => ({ body: options }),
    });
    renderPage(<RequestRegisterPage />, { route: '/buyer/requests' });

    const table = await screen.findByRole('table', { name: 'Request register' });
    const header = within(table).getByRole('columnheader', { name: /Request$/ });
    expect(header.style.minWidth).toBe('18rem');
    const purpose = within(table).getByTestId('request-purpose');
    expect(purpose).toHaveAttribute('title', request.problemStatement ?? '');
    expect(purpose).toHaveStyle({ whiteSpace: 'nowrap', textOverflow: 'ellipsis' });
    expect(within(table).getByText('15 days').closest('td')).not.toHaveClass('tiq-num');
  });

  it('sends the status filter to the API when a status is chosen', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/requests': () => ({ body: page([submitted]) }),
      'GET /api/v1/buyer/request-summary': () => ({ body: summary }),
      'GET /api/v1/buyer/request-options': () => ({ body: options }),
    });
    renderPage(<RequestRegisterPage />, { route: '/buyer/requests' });
    await screen.findByText('PR-2026-0008');

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'submitted');

    await waitFor(() =>
      expect(
        requests.some(
          (item) =>
            item.path === '/api/v1/buyer/requests' && item.search.includes('status=submitted'),
        ),
      ).toBe(true),
    );
  });

  it('assigns an owner through the confirmation dialog when the row action is used', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/requests': () => ({ body: page([submitted]) }),
      'GET /api/v1/buyer/request-summary': () => ({ body: summary }),
      'GET /api/v1/buyer/request-options': () => ({ body: options }),
      'POST /api/v1/buyer/requests/8/assign': () => ({
        body: {
          ...request,
          id: 8,
          reference: 'PR-2026-0008',
          owner: { userId: 5, fullName: 'Tebogo Molefe' },
        },
      }),
    });
    renderPage(<RequestRegisterPage />, { route: '/buyer/requests', permissions: OFFICER });
    await screen.findByText('PR-2026-0008');

    await userEvent.click(screen.getByRole('button', { name: 'Actions for PR-2026-0008' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Assign owner' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText(/Procurement owner/), '5');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Assign' }));

    await waitFor(() =>
      expect(requests.find((item) => item.method === 'POST')?.body).toEqual({
        ownerUserId: 5,
        note: null,
      }),
    );
    expect(await screen.findByText('PR-2026-0008 assigned to Tebogo Molefe.')).toBeInTheDocument();
  });

  it('offers no reviewer actions and no create button to a caller holding only request.view_all', async () => {
    installFetch({
      'GET /api/v1/buyer/requests': () => ({ body: page([approvedRow]) }),
      'GET /api/v1/buyer/request-summary': () => ({ body: summary }),
      'GET /api/v1/buyer/request-options': () => problem(403, 'Forbidden', { code: 'FORBIDDEN' }),
    });
    renderPage(<RequestRegisterPage />, {
      route: '/buyer/requests',
      permissions: ['request.view_all'],
    });
    await screen.findByText('PR-2026-0005');

    expect(screen.queryByRole('link', { name: /New request/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Actions for PR-2026-0005' }));
    expect(screen.queryByRole('menuitem', { name: 'Assign owner' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Open request' })).toBeInTheDocument();
  });

  it('shows the empty state when no request matches', async () => {
    installFetch({
      'GET /api/v1/buyer/requests': () => ({ body: page([]) }),
      'GET /api/v1/buyer/request-summary': () => ({ body: summary }),
      'GET /api/v1/buyer/request-options': () => ({ body: options }),
    });
    renderPage(<RequestRegisterPage />, { route: '/buyer/requests' });

    expect(await screen.findByText('No requests found')).toBeInTheDocument();
  });
});
