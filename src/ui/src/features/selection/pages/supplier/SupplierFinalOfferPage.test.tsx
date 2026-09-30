import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../../test/fetchMock';
import { supplierFinalOffer } from '../../testing/data';
import { renderSelection } from '../../testing/render';
import SupplierFinalOfferPage from './SupplierFinalOfferPage';

afterEach(() => vi.unstubAllGlobals());

const PATH = '/supplier/final-offers/:roundId';
const ROUTE = '/supplier/final-offers/3';

describe('SupplierFinalOfferPage', () => {
  it('shows the round terms and the official deadline and links to the response workspace', async () => {
    installFetch({
      'GET /api/v1/supplier/selection/final-offer-rounds/3': () => ({ body: supplierFinalOffer() }),
    });
    renderSelection(<SupplierFinalOfferPage />, { path: PATH, route: ROUTE, supplier: true });
    expect(await screen.findByText('Final offer not submitted')).toBeInTheDocument();
    expect(screen.getByText('Unit rates only.')).toBeInTheDocument();
    expect(screen.getAllByText(/Africa\/Gaborone/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Open response workspace' })).toHaveAttribute(
      'href',
      '/supplier/responses/908',
    );
  });

  it('confirms receipt and offers no submission once the round is closed', async () => {
    installFetch({
      'GET /api/v1/supplier/selection/final-offer-rounds/3': () => ({
        body: supplierFinalOffer({
          status: 'closed',
          finalOfferReceivedAt: '2026-10-19T08:00:00Z',
        }),
      }),
    });
    renderSelection(<SupplierFinalOfferPage />, { path: PATH, route: ROUTE, supplier: true });
    expect(await screen.findByText('Your final offer was received')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open response workspace' })).not.toBeInTheDocument();
  });
});
