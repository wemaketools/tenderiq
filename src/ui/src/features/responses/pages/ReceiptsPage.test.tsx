import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { routeCalls, supplierReceipts, supplierState } from '../test/data';
import ReceiptsPage from './ReceiptsPage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  call: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('ReceiptsPage (SUP-17 register)', () => {
  it('lists every receipt with its status and marks the effective one', async () => {
    // Arrange
    routeCalls({ 'supplier.receipts.list': () => supplierReceipts() });

    // Act
    renderWithProviders(<ReceiptsPage />, { state: supplierState(['supplier.outcomes.view']) });

    // Assert
    const table = await screen.findByRole('table', { name: 'Official receipts' });
    const effective = await within(table).findByRole('row', { name: /RCPT-2026-000021/ });
    expect(within(effective).getByText('Effective')).toBeInTheDocument();
    const late = within(table).getByRole('row', { name: /RCPT-2026-000022/ });
    expect(within(late).getByText('Late / rejected')).toBeInTheDocument();
  });

  it('filters to effective receipts only', async () => {
    // Arrange
    const user = userEvent.setup();
    const calls = routeCalls({ 'supplier.receipts.list': () => supplierReceipts() });
    renderWithProviders(<ReceiptsPage />, { state: supplierState(['supplier.outcomes.view']) });

    // Act
    await user.click(await screen.findByRole('checkbox', { name: 'Effective only' }));

    // Assert
    await vi.waitFor(() =>
      expect(
        calls.some(
          (entry) => (entry.request.query as Record<string, unknown>).effectiveOnly === true,
        ),
      ).toBe(true),
    );
  });
});
