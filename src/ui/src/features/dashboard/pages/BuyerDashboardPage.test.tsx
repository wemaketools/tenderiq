import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PermissionCode } from '@contracts/permissions';

import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { EMPTY_PAGE, buyerState } from '../../reports/testSession';
import { BUYER_DASHBOARD } from '../testData';
import BuyerDashboardPage from './BuyerDashboardPage';

const MANAGER: PermissionCode[] = ['dashboard.view', 'report.view', 'report.manage'];

function routes(body: unknown = BUYER_DASHBOARD) {
  return installFetch({
    'GET /api/v1/buyer/dashboard': () => ({ body }),
    'GET /api/v1/me/saved-views': () => ({ body: EMPTY_PAGE }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BuyerDashboardPage (BUY-01)', () => {
  it('shows the KPI cards, pipeline, deadlines, approvals, attention and renewals of the buyer', async () => {
    routes();
    renderWithProviders(<BuyerDashboardPage />, { state: buyerState(MANAGER) });

    const active = await screen.findByRole('region', { name: 'Active events' });
    expect(within(active).getByText('7')).toBeInTheDocument();
    for (const label of [
      'Pending approvals',
      'Closing within 7 days',
      'Open complaints',
      'Renewals within 90 days',
      'Overdue obligations',
    ]) {
      expect(screen.getAllByRole('region', { name: label }).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole('list', { name: 'Pipeline by stage' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Pending approvals' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Requires attention' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Upcoming renewals' })).toBeInTheDocument();
    const deadlines = screen.getByRole('list', { name: 'Upcoming deadlines' });
    expect(within(deadlines).getAllByTestId('official-deadline').length).toBeGreaterThan(0);
  });

  it('states that data is incomplete instead of counting missing values as zero', async () => {
    routes();
    renderWithProviders(<BuyerDashboardPage />, { state: buyerState(MANAGER) });
    expect(await screen.findByText('Some information is incomplete')).toBeInTheDocument();
  });

  it('shows restricted panels and KPIs without counts when the role may not read them', async () => {
    routes({
      ...BUYER_DASHBOARD,
      kpis: BUYER_DASHBOARD.kpis.map((kpi) =>
        kpi.key === 'overdue_obligations'
          ? { ...kpi, value: null, restricted: true, delta: null }
          : kpi,
      ),
      workload: { restricted: true, items: [] },
    });
    renderWithProviders(<BuyerDashboardPage />, { state: buyerState(MANAGER) });

    const overdue = await screen.findByRole('region', { name: 'Overdue obligations' });
    expect(within(overdue).queryByText('3')).not.toBeInTheDocument();
    expect(
      screen.getByText('Workload by owner is limited to procurement managers.'),
    ).toBeInTheDocument();
  });

  it('sends the chosen department filter to the API', async () => {
    const { requests } = routes();
    renderWithProviders(<BuyerDashboardPage />, { state: buyerState(MANAGER) });
    await screen.findByRole('region', { name: 'Active events' });

    await userEvent.selectOptions(screen.getByLabelText('Department'), 'Network Operations');

    await waitFor(() =>
      expect(requests.some((request) => request.search.includes('departmentId=3'))).toBe(true),
    );
  });

  it('offers management reports only to report holders', async () => {
    routes();
    renderWithProviders(<BuyerDashboardPage />, { state: buyerState(['dashboard.view']) });
    await screen.findByRole('region', { name: 'Active events' });
    expect(screen.queryByRole('link', { name: 'Management reports' })).not.toBeInTheDocument();
  });

  it('explains a failed load with a retry', async () => {
    installFetch({
      'GET /api/v1/buyer/dashboard': () => problem(500, 'Internal Server Error'),
      'GET /api/v1/me/saved-views': () => ({ body: EMPTY_PAGE }),
    });
    renderWithProviders(<BuyerDashboardPage />, { state: buyerState(MANAGER) });
    expect(await screen.findByText('The dashboard could not be loaded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
