import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OPERATOR, opsChange, page, renderPage, routeCalls } from '../../supplier-org/test/kit';
import OpsIdentityChangesPage from './OpsIdentityChangesPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/ops/supplier-identity-changes',
  route: '/ops/supplier-identity-changes',
  kind: 'operator' as const,
  permissions: OPERATOR,
};

describe('OpsIdentityChangesPage (FR-02)', () => {
  it('lists changes with supplier, proposed value, submitter and status', async () => {
    routeCalls({ 'ops.suppliers.identityChanges.list': () => page([opsChange()]) });
    renderPage(<OpsIdentityChangesPage />, PATH);
    const row = await screen.findByRole('row', {
      name: /Chobe Pipe & Valve Supplies \(Pty\) Ltd: Ownership/,
    });
    expect(within(row).getByText('Okavango Industrial 60%')).toBeInTheDocument();
    expect(within(row).getByText('Tumelo Sekgoma')).toBeInTheDocument();
    expect(within(row).getByText('Submitted')).toBeInTheDocument();
  });

  it('filters by change type and opens a change', async () => {
    const calls = routeCalls({ 'ops.suppliers.identityChanges.list': () => page([opsChange()]) });
    const { router } = renderPage(<OpsIdentityChangesPage />, PATH);
    await screen.findByRole('row', { name: /Ownership/ });
    fireEvent.change(screen.getByLabelText('Change type'), { target: { value: 'ownership' } });
    await waitFor(() =>
      expect(
        calls.filter((c) => c.id === 'ops.suppliers.identityChanges.list').at(-1)?.request,
      ).toEqual({
        query: expect.objectContaining({ changeType: ['ownership'] }),
      }),
    );
    fireEvent.click(screen.getByText('Okavango Industrial 60%'));
    expect(router.state.location.pathname).toBe('/ops/supplier-identity-changes/2');
  });

  it('shows the empty state', async () => {
    routeCalls({ 'ops.suppliers.identityChanges.list': () => page([]) });
    renderPage(<OpsIdentityChangesPage />, PATH);
    expect(await screen.findByText('No identity changes requested.')).toBeInTheDocument();
  });
});
