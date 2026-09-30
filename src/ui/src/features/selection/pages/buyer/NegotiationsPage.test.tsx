import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../../test/fetchMock';
import { negotiationRow, page, tenderRow } from '../../testing/data';
import { AUDITOR, OFFICER, renderSelection } from '../../testing/render';
import NegotiationsPage from './NegotiationsPage';

afterEach(() => vi.unstubAllGlobals());

const PATH = '/buyer/selection/negotiations';

function routes() {
  return {
    'GET /api/v1/buyer/selection/negotiations': () => ({
      body: page([
        negotiationRow(),
        negotiationRow({ negotiationId: 3, status: 'planned', approval: null }),
      ]),
    }),
    'GET /api/v1/buyer/selection/tenders': () => ({ body: page([tenderRow()]) }),
  };
}

describe('NegotiationsPage', () => {
  it('lists negotiations with mandate, authority and rounds', async () => {
    installFetch(routes());
    renderSelection(<NegotiationsPage />, { path: PATH, route: PATH, permissions: OFFICER });
    const table = await screen.findByRole('table', { name: 'Negotiations' });
    expect(within(table).getAllByText('BWP 2,940,000')).toHaveLength(2);
    expect(within(table).getByText('Not requested')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open negotiation' })).toBeInTheDocument();
  });

  it('hides the open action without negotiation authority', async () => {
    installFetch(routes());
    renderSelection(<NegotiationsPage />, { path: PATH, route: PATH, permissions: AUDITOR });
    await screen.findByRole('table', { name: 'Negotiations' });
    expect(screen.queryByRole('link', { name: 'Open negotiation' })).not.toBeInTheDocument();
  });
});
