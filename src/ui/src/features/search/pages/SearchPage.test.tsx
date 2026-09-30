import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../test/fetchMock';
import { makeMembership, makeTenant, signedInSession, stateWith } from '../../../test/fixtures';
import { renderWithProviders } from '../../../test/render';
import { SAVED_VIEWS, SEARCH_RESPONSE } from '../testData';
import SearchPage from './SearchPage';

const state = stateWith(
  signedInSession({
    memberships: [
      makeMembership({ capacity: 'Evaluator, Engineering' }),
      makeMembership({
        membershipId: 12,
        tenantId: 4,
        tenantKind: 'supplier',
        tenantName: 'Tsodilo Engineering',
        tenantSlug: 'tsodilo',
        capacity: 'Technical Contributor',
      }),
      makeMembership({
        membershipId: 13,
        tenantId: 5,
        tenantKind: 'supplier',
        tenantName: 'Chobe Pipe & Valve Supplies',
        tenantSlug: 'chobe-pipe',
        capacity: 'Technical Contributor',
      }),
    ],
    activeTenant: makeTenant({ capacity: 'Evaluator, Engineering' }, ['tender.view']),
  }),
);

function routes() {
  return installFetch({
    'GET /api/v1/me/search': () => ({ body: SEARCH_RESPONSE }),
    'GET /api/v1/me/saved-views': () => ({ body: SAVED_VIEWS }),
    'DELETE /api/v1/me/saved-views/6': () => ({ status: 204 }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SearchPage (COM-08)', () => {
  it('lists authorized results labelled with their organization and the authorized counts', async () => {
    const { requests } = routes();
    renderWithProviders(<SearchPage />, { state, route: '/?q=water' });

    const table = await screen.findByRole('table', { name: 'Results' });
    expect(within(table).getAllByText('Chobe Pipe & Valve Supplies').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('Opens after switching organization').length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText(/Restricted records are never counted/)).toBeInTheDocument();
    expect(requests.some((request) => request.search.includes('q=water'))).toBe(true);
  });

  it('asks for at least two characters before searching', async () => {
    const { requests } = routes();
    renderWithProviders(<SearchPage />, { state, route: '/?q=w' });
    expect(await screen.findByText('Type at least 2 characters to search.')).toBeInTheDocument();
    expect(requests.some((request) => request.path === '/api/v1/me/search')).toBe(false);
  });

  it('confirms the organization switch before opening a result of another organization', async () => {
    routes();
    renderWithProviders(<SearchPage />, { state, route: '/?q=water' });
    const table = await screen.findByRole('table', { name: 'Results' });

    const row = within(table).getAllByRole('row', { name: /Chobe Pipe & Valve Supplies/ })[0];
    await userEvent.click(row!);

    const dialog = await screen.findByRole('dialog', {
      name: 'Switch organization to open this result',
    });
    expect(within(dialog).getByText('Chobe Pipe & Valve Supplies')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Switch and open' })).toBeEnabled();
  });

  it('filters by record type from the authorized counts', async () => {
    const { requests } = routes();
    renderWithProviders(<SearchPage />, { state, route: '/?q=water' });
    await screen.findByRole('table', { name: 'Results' });

    await userEvent.selectOptions(screen.getByLabelText('Record type'), 'Contract');

    await waitFor(() =>
      expect(requests.some((request) => request.search.includes('type=contract'))).toBe(true),
    );
  });

  it('deletes a saved view in the organization of the view after confirmation', async () => {
    const { requests } = routes();
    renderWithProviders(<SearchPage />, { state, route: '/?q=water' });

    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete saved view Tsodilo water opportunities' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Delete saved view' });
    expect(within(dialog).getByText('Tsodilo Engineering')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      const deletion = requests.find((request) => request.method === 'DELETE');
      expect(deletion?.headers['x-tenant-id']).toBe('4');
    });
  });
});
