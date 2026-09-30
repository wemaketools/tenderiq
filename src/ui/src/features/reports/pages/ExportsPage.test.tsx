import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { EXPORT, EXPORTS } from '../testData';
import { buyerState } from '../testSession';
import ExportPage from './ExportPage';
import ExportsPage from './ExportsPage';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ExportsPage (ADM-13 export history)', () => {
  it('lists exports with status, requester and a download for ready ones', async () => {
    installFetch({ 'GET /api/v1/buyer/exports': () => ({ body: EXPORTS }) });
    renderWithProviders(<ExportsPage />, { state: buyerState(['report.manage', 'report.view']) });

    const table = await screen.findByRole('table', { name: 'Export history' });
    expect(
      within(table).getAllByRole('button', { name: /^Download export/ }).length,
    ).toBeGreaterThan(0);
    expect(within(table).getAllByText('Not ready').length).toBeGreaterThan(0);
  });

  it('tells an export holder they see only their own exports and filters by status', async () => {
    const { requests } = installFetch({ 'GET /api/v1/buyer/exports': () => ({ body: EXPORTS }) });
    renderWithProviders(<ExportsPage />, { state: buyerState(['export.create', 'report.view']) });

    expect(await screen.findByText('Your own exports')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Ready');
    await waitFor(() =>
      expect(requests.some((request) => request.search.includes('status=ready'))).toBe(true),
    );
  });
});

describe('ExportPage (manifest)', () => {
  it('shows the manifest contents, versions, omissions and redactions', async () => {
    installFetch({ 'GET /api/v1/buyer/exports/4': () => ({ body: EXPORT }) });
    renderWithProviders(<ExportPage />, {
      state: buyerState(['report.manage']),
      route: '/buyer/admin/reports/exports/4',
      path: '/buyer/admin/reports/exports/:exportId',
    });

    expect(await screen.findByRole('table', { name: 'Contents' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Versions' })).toBeInTheDocument();
    expect(screen.getByText('Compliance counts for unopened events')).toBeInTheDocument();
    expect(screen.getByText('Bidder names for sealed events')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
  });
});
