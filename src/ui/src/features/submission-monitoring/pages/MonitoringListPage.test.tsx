import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { buyerState, monitoringPage, routeCalls } from '../../responses/test/data';
import MonitoringListPage from './MonitoringListPage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  call: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('MonitoringListPage (BUY-19 register)', () => {
  it('lists released tenders with unique supplier counts, closing status and incidents', async () => {
    // Arrange
    routeCalls({ 'buyer.submissions.list': () => monitoringPage() });

    // Act
    renderWithProviders(<MonitoringListPage />, { state: buyerState(['bid.monitor']) });

    // Assert
    const table = await screen.findByRole('table', {
      name: 'Released tenders and their submissions',
    });
    const row = within(table).getByRole('row', { name: /T-2026-0002/ });
    expect(within(row).getByText('Open for submissions')).toBeInTheDocument();
    expect(within(row).getByText('2')).toBeInTheDocument();
    expect(within(row).getByTestId('official-deadline')).toHaveTextContent('Africa/Gaborone');
    expect(
      screen.getByText(/Sealed content and supplier drafts are never shown/),
    ).toBeInTheDocument();
  });

  it('filters by closing status', async () => {
    // Arrange
    const user = userEvent.setup();
    const calls = routeCalls({ 'buyer.submissions.list': () => monitoringPage() });
    renderWithProviders(<MonitoringListPage />, { state: buyerState(['bid.monitor']) });

    // Act
    await user.selectOptions(await screen.findByLabelText('Closing status'), 'deadline_passed');

    // Assert
    await vi.waitFor(() =>
      expect(
        calls.some((entry) => {
          const query = entry.request.query as Record<string, unknown>;
          return Array.isArray(query.closingStatus) && query.closingStatus[0] === 'deadline_passed';
        }),
      ).toBe(true),
    );
  });

  it('shows an empty state when no tender is released', async () => {
    // Arrange
    routeCalls({
      'buyer.submissions.list': () => ({ items: [], total: 0, page: 1, pageSize: 25 }),
    });

    // Act
    renderWithProviders(<MonitoringListPage />, { state: buyerState(['bid.monitor']) });

    // Assert
    expect(await screen.findByText('No released tenders')).toBeInTheDocument();
  });
});
