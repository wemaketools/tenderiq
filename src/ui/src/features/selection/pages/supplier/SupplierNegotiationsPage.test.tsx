import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../../test/fetchMock';
import { page, supplierFinalOffer, supplierNegotiationRow } from '../../testing/data';
import { renderSelection } from '../../testing/render';
import SupplierNegotiationsPage from './SupplierNegotiationsPage';

afterEach(() => vi.unstubAllGlobals());

const PATH = '/supplier/negotiations';

describe('SupplierNegotiationsPage', () => {
  it('lists own negotiations with responses due and final-offer rounds with official deadlines', async () => {
    installFetch({
      'GET /api/v1/supplier/selection/negotiations': () => ({
        body: page([supplierNegotiationRow()]),
      }),
      'GET /api/v1/supplier/selection/final-offer-rounds': () => ({
        body: page([supplierFinalOffer()]),
      }),
    });
    renderSelection(<SupplierNegotiationsPage />, { path: PATH, route: PATH, supplier: true });
    const negotiations = await screen.findByRole('table', { name: 'Negotiations' });
    expect(within(negotiations).getByText('Response due')).toBeInTheDocument();
    const rounds = await screen.findByRole('table', { name: 'Final-offer rounds' });
    expect(within(rounds).getByText(/Africa\/Gaborone/)).toBeInTheDocument();
    expect(within(rounds).getByText('Final offer not submitted')).toBeInTheDocument();
  });

  it('shows the empty states when the supplier has no negotiation', async () => {
    installFetch({
      'GET /api/v1/supplier/selection/negotiations': () => ({ body: page([]) }),
      'GET /api/v1/supplier/selection/final-offer-rounds': () => ({ body: page([]) }),
    });
    renderSelection(<SupplierNegotiationsPage />, { path: PATH, route: PATH, supplier: true });
    expect(await screen.findByText('No negotiation.')).toBeInTheDocument();
    expect(await screen.findByText('No final-offer round.')).toBeInTheDocument();
  });

  it('leaves out the final-offer tile, filter and card when the rounds are refused', async () => {
    installFetch({
      'GET /api/v1/supplier/selection/negotiations': () => ({
        body: page([supplierNegotiationRow()]),
      }),
      'GET /api/v1/supplier/selection/final-offer-rounds': () => problem(403, 'Forbidden'),
    });
    renderSelection(<SupplierNegotiationsPage />, { path: PATH, route: PATH, supplier: true });
    expect(await screen.findByRole('table', { name: 'Negotiations' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('table', { name: 'Final-offer rounds' })).not.toBeInTheDocument(),
    );
    expect(screen.queryByText('Open final-offer rounds')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Final-offer status')).not.toBeInTheDocument();
    expect(screen.queryByText('Restricted')).not.toBeInTheDocument();
  });
});
