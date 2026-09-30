import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../../test/fetchMock';
import { renderWithProviders } from '../../../../test/render';
import {
  SUPPLIER_ALL,
  pageOf,
  supplierSession,
  supplierState,
  supplierTender,
} from '../../testData';
import SupplierSessionsPage from './SupplierSessionsPage';

const S = '/api/v1/supplier/clarifications';

function routes(rows = [supplierSession()]) {
  return installFetch({
    [`GET ${S}/tenders`]: () => ({ body: pageOf([supplierTender()]) }),
    [`GET ${S}/sessions`]: () => ({ body: pageOf(rows) }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SupplierSessionsPage (SUP-11)', () => {
  it('lists sessions with places, mandatory status, the registration deadline and the booking', async () => {
    routes();
    renderWithProviders(<SupplierSessionsPage />, { state: supplierState(SUPPLIER_ALL) });

    const table = await screen.findByRole('table', { name: 'Sessions' });
    expect(await within(table).findByText('Pre-bid briefing')).toBeInTheDocument();
    expect(within(table).getByText('18 places left')).toBeInTheDocument();
    expect(within(table).getByText('Mandatory')).toBeInTheDocument();
    expect(within(table).getByText('Not booked')).toBeInTheDocument();
    expect(within(table).getAllByTestId('official-deadline')).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Mandatory, not booked' })).toHaveTextContent('1');
  });

  it('filters to the supplier’s own bookings', async () => {
    const { requests } = routes();
    renderWithProviders(<SupplierSessionsPage />, { state: supplierState(SUPPLIER_ALL) });
    await screen.findByText('Pre-bid briefing');

    await userEvent.click(screen.getByLabelText('My bookings only'));

    await waitFor(() =>
      expect(requests.some((request) => request.search.includes('registered=true'))).toBe(true),
    );
  });

  it('shows the empty state', async () => {
    routes([]);
    renderWithProviders(<SupplierSessionsPage />, { state: supplierState(SUPPLIER_ALL) });
    expect(await screen.findByText('No sessions match these filters')).toBeInTheDocument();
  });
});
