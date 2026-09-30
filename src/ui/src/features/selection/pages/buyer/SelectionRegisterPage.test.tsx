import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../../test/fetchMock';
import { page, tenderRow } from '../../testing/data';
import { EVALUATOR, OFFICER, renderSelection } from '../../testing/render';
import SelectionRegisterPage from './SelectionRegisterPage';

afterEach(() => vi.unstubAllGlobals());

const PATH = '/buyer/selection';

describe('SelectionRegisterPage', () => {
  it('lists the tenders in selection with their blocked actions and KPIs when the register loads', async () => {
    installFetch({
      'GET /api/v1/buyer/selection/tenders': () => ({
        body: page([
          tenderRow(),
          tenderRow({
            tenderId: 1,
            reference: 'T-2026-0001',
            blockerCount: 0,
            negotiationStatus: null,
          }),
        ]),
      }),
    });
    renderSelection(<SelectionRegisterPage />, { path: PATH, route: PATH, permissions: OFFICER });

    const table = await screen.findByRole('table', { name: 'Tenders in the selection stage' });
    expect(within(table).getByText('T-2026-0009')).toBeInTheDocument();
    expect(within(table).getByText('2 blocked')).toBeInTheDocument();
    expect(screen.getByText('Tenders with blocks').closest('.tiq-kpi')).toHaveTextContent('1');
  });

  it('shows the empty state when no tender is in selection', async () => {
    installFetch({ 'GET /api/v1/buyer/selection/tenders': () => ({ body: page([]) }) });
    renderSelection(<SelectionRegisterPage />, { path: PATH, route: PATH });
    expect(await screen.findByText('No tender is in the selection stage.')).toBeInTheDocument();
  });

  it('shows an error with retry when the register fails to load', async () => {
    installFetch({ 'GET /api/v1/buyer/selection/tenders': () => problem(500, 'Internal error') });
    renderSelection(<SelectionRegisterPage />, { path: PATH, route: PATH });
    expect((await screen.findAllByRole('button', { name: 'Try again' })).length).toBeGreaterThan(0);
  });

  it('redirects an evaluator without selection access to the demonstrations register', async () => {
    const { router } = renderSelection(<SelectionRegisterPage />, {
      path: PATH,
      route: PATH,
      permissions: EVALUATOR,
    });
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe('/buyer/selection/assessments'),
    );
  });
});
