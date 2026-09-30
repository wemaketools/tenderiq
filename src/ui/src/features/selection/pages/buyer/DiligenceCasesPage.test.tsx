import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../../test/fetchMock';
import { diligenceRow, page, tenderRow } from '../../testing/data';
import { renderSelection } from '../../testing/render';
import DiligenceCasesPage from './DiligenceCasesPage';

afterEach(() => vi.unstubAllGlobals());

const PATH = '/buyer/selection/due-diligence';

describe('DiligenceCasesPage', () => {
  it('lists cases with disposition counts, blocking findings and the next official due date', async () => {
    installFetch({
      'GET /api/v1/buyer/selection/due-diligence-cases': () => ({ body: page([diligenceRow()]) }),
      'GET /api/v1/buyer/selection/tenders': () => ({ body: page([tenderRow()]) }),
    });
    renderSelection(<DiligenceCasesPage />, { path: PATH, route: PATH });
    const table = await screen.findByRole('table', { name: 'Due-diligence cases' });
    expect(within(table).getByText('3 satisfied')).toBeInTheDocument();
    expect(within(table).getByText('1 unresolved')).toBeInTheDocument();
    expect(within(table).getByText(/Africa\/Gaborone/)).toBeInTheDocument();
  });

  it('shows the empty state when no case is open', async () => {
    installFetch({
      'GET /api/v1/buyer/selection/due-diligence-cases': () => ({ body: page([]) }),
      'GET /api/v1/buyer/selection/tenders': () => ({ body: page([]) }),
    });
    renderSelection(<DiligenceCasesPage />, { path: PATH, route: PATH });
    expect(await screen.findByText('No due-diligence case is open.')).toBeInTheDocument();
  });
});
