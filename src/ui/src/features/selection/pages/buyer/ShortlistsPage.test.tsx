import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../../test/fetchMock';
import { page, shortlistRow, tenderRow } from '../../testing/data';
import { AUDITOR, OFFICER, renderSelection } from '../../testing/render';
import ShortlistsPage from './ShortlistsPage';

afterEach(() => vi.unstubAllGlobals());

const PATH = '/buyer/selection/shortlists';

describe('ShortlistsPage', () => {
  it('lists shortlists with rule, threshold, counts and outstanding notices', async () => {
    installFetch({
      'GET /api/v1/buyer/selection/shortlists': () => ({ body: page([shortlistRow()]) }),
      'GET /api/v1/buyer/selection/tenders': () => ({ body: page([tenderRow()]) }),
    });
    renderSelection(<ShortlistsPage />, { path: PATH, route: PATH, permissions: OFFICER });
    const table = await screen.findByRole('table', { name: 'Shortlists' });
    expect(within(table).getByText('Threshold 49.00')).toBeInTheDocument();
    expect(within(table).getByText('2 included · 1 excluded')).toBeInTheDocument();
    expect(within(table).getByText('Notices outstanding')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New shortlist' })).toBeInTheDocument();
  });

  it('shows the empty state and hides the create action for a read-only auditor', async () => {
    installFetch({
      'GET /api/v1/buyer/selection/shortlists': () => ({ body: page([]) }),
      'GET /api/v1/buyer/selection/tenders': () => ({ body: page([]) }),
    });
    renderSelection(<ShortlistsPage />, { path: PATH, route: PATH, permissions: AUDITOR });
    expect(await screen.findByText('No shortlist yet.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New shortlist' })).not.toBeInTheDocument();
  });
});
