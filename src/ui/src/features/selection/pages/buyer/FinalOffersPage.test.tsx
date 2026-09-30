import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../../test/fetchMock';
import { finalOfferRow, page, tenderRow } from '../../testing/data';
import { OFFICER, renderSelection } from '../../testing/render';
import FinalOffersPage from './FinalOffersPage';

afterEach(() => vi.unstubAllGlobals());

const PATH = '/buyer/selection/final-offers';

describe('FinalOffersPage', () => {
  it('lists rounds with the official deadline and procedural authority', async () => {
    installFetch({
      'GET /api/v1/buyer/selection/final-offer-rounds': () => ({ body: page([finalOfferRow()]) }),
      'GET /api/v1/buyer/selection/tenders': () => ({ body: page([tenderRow()]) }),
    });
    renderSelection(<FinalOffersPage />, { path: PATH, route: PATH, permissions: OFFICER });
    // The captioned table is already present (busy, with skeleton rows) while the rounds load: wait for the row.
    const table = await screen.findByRole('table', { name: 'Final-offer rounds' });
    expect(
      await within(table).findByText('Pending: process decision 2', {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(within(table).getByText(/Africa\/Gaborone/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request final offers' })).toBeInTheDocument();
  });

  it('shows the empty state when there is no round', async () => {
    installFetch({
      'GET /api/v1/buyer/selection/final-offer-rounds': () => ({ body: page([]) }),
      'GET /api/v1/buyer/selection/tenders': () => ({ body: page([]) }),
    });
    renderSelection(<FinalOffersPage />, { path: PATH, route: PATH });
    expect(await screen.findByText('No final-offer round.')).toBeInTheDocument();
  });
});
