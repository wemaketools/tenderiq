import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { businessError, myRequest, page, renderPage, routeCalls } from '../test/kit';
import MyMembershipRequestsPage from './MyMembershipRequestsPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/me/membership-requests', route: '/me/membership-requests' };

describe('MyMembershipRequestsPage (SUP-02)', () => {
  it('names an organization only once it approved the request', async () => {
    routeCalls({
      'me.suppliers.membershipRequests.list': () =>
        page([
          myRequest(),
          myRequest({
            id: 4,
            organizationName: 'Tsodilo Engineering',
            status: 'approved',
            decidedAt: '2026-09-26T09:00:00Z',
            decisionNote: 'Welcome.',
          }),
        ]),
    });
    renderPage(<MyMembershipRequestsPage />, PATH);
    expect(await screen.findByText('Not disclosed until approved')).toBeInTheDocument();
    expect(screen.getByText('Tsodilo Engineering')).toBeInTheDocument();
    expect(screen.getByText('Welcome.')).toBeInTheDocument();
  });

  it('withdraws a pending request after confirmation and shows its new status', async () => {
    const calls = routeCalls({
      'me.suppliers.membershipRequests.list': () => page([myRequest()]),
      'me.suppliers.membershipRequests.withdraw': () => myRequest({ status: 'withdrawn' }),
    });
    renderPage(<MyMembershipRequestsPage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw request' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Requester')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Withdraw request' }));
    await waitFor(() => expect(screen.getByText('Withdrawn')).toBeInTheDocument());
    expect(calls.find((c) => c.id === 'me.suppliers.membershipRequests.withdraw')?.request).toEqual(
      {
        params: { requestId: 3 },
      },
    );
  });

  it('explains a request that was already decided', async () => {
    routeCalls({
      'me.suppliers.membershipRequests.list': () => page([myRequest()]),
      'me.suppliers.membershipRequests.withdraw': () => {
        throw businessError(
          'me.suppliers.membershipRequests.withdraw',
          'MEMBERSHIP_REQUEST_NOT_PENDING',
        );
      },
    });
    renderPage(<MyMembershipRequestsPage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw request' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Withdraw request' }));
    expect(
      await within(dialog).findByText('This request has already been decided or withdrawn.'),
    ).toBeInTheDocument();
  });

  it('shows an empty state and filters by status', async () => {
    const calls = routeCalls({ 'me.suppliers.membershipRequests.list': () => page([]) });
    renderPage(<MyMembershipRequestsPage />, PATH);
    expect(await screen.findByText('You have no membership requests.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'approved' } });
    await waitFor(() =>
      expect(calls.at(-1)?.request).toEqual({
        query: expect.objectContaining({ status: ['approved'] }),
      }),
    );
  });
});
