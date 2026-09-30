import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { BID_MANAGER, apiError, bidDetail, bidPage, routeCalls, supplierState } from '../test/data';
import ResponsesPage from './ResponsesPage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  call: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('ResponsesPage (SUP-12 entry)', () => {
  it('shows internally approved work as not submitted, separately from its revision status (AC-11)', async () => {
    // Arrange
    const approved = bidDetail({
      id: 7,
      workingRevision: { id: 701, revisionNo: 1, status: 'approved_internally' },
    });
    routeCalls({ 'supplier.bids.list': () => bidPage([approved]) });

    // Act
    renderWithProviders(<ResponsesPage />, { state: supplierState(BID_MANAGER) });

    // Assert
    const table = await screen.findByRole('table', { name: 'Supplier responses' });
    const row = await within(table).findByRole('row', { name: /T-2026-0006/ });
    expect(within(row).getByText('Not submitted')).toBeInTheDocument();
    expect(within(row).getByText('Approved internally')).toBeInTheDocument();
    expect(within(row).getByText('Submit (authorized signatory)')).toBeInTheDocument();
    expect(within(row).getByTestId('official-deadline')).toHaveTextContent('Africa/Gaborone');
  });

  it('passes the tender hand-off from the opportunity workspace as a filter when a tenderId is in the URL', async () => {
    // Arrange
    const calls = routeCalls({ 'supplier.bids.list': () => bidPage([bidDetail()]) });

    // Act
    renderWithProviders(<ResponsesPage />, {
      state: supplierState(BID_MANAGER),
      route: '/supplier/responses?tenderId=6',
    });

    // Assert
    await screen.findByRole('table', { name: 'Supplier responses' });
    const filtered = calls.find(
      (entry) =>
        entry.id === 'supplier.bids.list' &&
        (entry.request.query as Record<string, unknown>).tenderId === 6,
    );
    expect(filtered).toBeDefined();
  });

  it('explains an empty list when the supplier has no responses yet', async () => {
    // Arrange
    routeCalls({ 'supplier.bids.list': () => bidPage([]) });

    // Act
    renderWithProviders(<ResponsesPage />, { state: supplierState(BID_MANAGER) });

    // Assert
    expect(await screen.findByText('No responses yet')).toBeInTheDocument();
  });

  it('shows the error state with a retry when the list fails to load', async () => {
    // Arrange
    routeCalls({ 'supplier.bids.list': () => apiError(500, null, 'server') });

    // Act
    renderWithProviders(<ResponsesPage />, { state: supplierState(BID_MANAGER) });

    // Assert
    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
