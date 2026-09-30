import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../../test/fetchMock';
import { page, preferredRow, tenderRow } from '../../testing/data';
import { OFFICER, renderSelection } from '../../testing/render';
import PreferredBiddersPage from './PreferredBiddersPage';

afterEach(() => vi.unstubAllGlobals());

const PATH = '/buyer/selection/preferred-bidders';

describe('PreferredBiddersPage', () => {
  it('lists conditional preferred bidders with value, diligence blocks and fallback', async () => {
    installFetch({
      'GET /api/v1/buyer/selection/preferred-bidders': () => ({
        body: page([preferredRow(), preferredRow({ preferredBidderId: 2, status: 'approved' })]),
      }),
      'GET /api/v1/buyer/selection/tenders': () => ({ body: page([tenderRow()]) }),
    });
    renderSelection(<PreferredBiddersPage />, { path: PATH, route: PATH, permissions: OFFICER });
    const table = await screen.findByRole('table', { name: 'Preferred bidders' });
    expect(within(table).getAllByText('BWP 2,780,000')).toHaveLength(2);
    expect(within(table).getAllByText('1 blocking finding')).toHaveLength(2);
    expect(
      screen.getByText('Failed diligence', { selector: '.tiq-kpi-label' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/award/i, { selector: 'h1, .tiq-kpi-label' }),
    ).not.toBeInTheDocument();
  });

  it('shows the restricted state when the register may not be read', async () => {
    installFetch({
      'GET /api/v1/buyer/selection/preferred-bidders': () =>
        problem(403, 'Forbidden', { code: 'FORBIDDEN' }),
      'GET /api/v1/buyer/selection/tenders': () => problem(403, 'Forbidden', { code: 'FORBIDDEN' }),
    });
    renderSelection(<PreferredBiddersPage />, { path: PATH, route: PATH, permissions: OFFICER });
    expect((await screen.findAllByText(/restricted|permission/i)).length).toBeGreaterThan(0);
  });
});
