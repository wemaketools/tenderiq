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

  it('labels the first column of the workload table as the owner, not a generic category', async () => {
    routes();
    renderWithProviders(<BuyerDashboardPage />, { state: buyerState(MANAGER) });

    const workload = await screen.findByRole('table', { name: 'Workload by owner' });
    expect(within(workload).getByRole('columnheader', { name: 'Owner' })).toBeInTheDocument();
    expect(
      within(workload).queryByRole('columnheader', { name: 'Category' }),
    ).not.toBeInTheDocument();
  });

  it('states that data is incomplete instead of counting missing values as zero', async () => {
    routes();
    renderWithProviders(<BuyerDashboardPage />, { state: buyerState(MANAGER) });
    expect(await screen.findByText('Some information is incomplete')).toBeInTheDocument();
  });

  it('leaves out a KPI and the workload card the role may not read, with no lock or explanation', async () => {
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

    expect(await screen.findByRole('region', { name: 'Active events' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Overdue obligations' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Workload by owner' })).not.toBeInTheDocument();
    expect(screen.queryByText(/limited to procurement managers/)).not.toBeInTheDocument();
    expect(screen.queryByText('Not available in your role')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pipeline by stage' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Upcoming deadlines' })).toBeInTheDocument();
  });

  it('leaves out every card and the pipeline value the role may not read, so no link leads to a forbidden page', async () => {
    routes({
      ...BUYER_DASHBOARD,
      pipelineValue: null,
      pipelineByStage: { restricted: true, items: [] },
      deadlines: { restricted: true, items: [] },
      approvals: { restricted: true, items: [] },
      renewals: { restricted: true, items: [] },
    });
    renderWithProviders(<BuyerDashboardPage />, { state: buyerState(MANAGER) });

    expect(await screen.findByRole('list', { name: 'Requires attention' })).toBeInTheDocument();
    for (const heading of [
      'Pipeline by stage',
      'Upcoming deadlines',
      'Pending approvals',
      'Upcoming renewals',
    ]) {
      expect(screen.queryByRole('heading', { name: heading })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('region', { name: 'Open pipeline value' })).not.toBeInTheDocument();
    for (const name of ['View all tenders', 'View tenders', 'Open my tasks', 'View contracts']) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/your role/i)).not.toBeInTheDocument();
  });

  it('gives the attention card the full width when the approvals card is left out', async () => {
    routes({ ...BUYER_DASHBOARD, approvals: { restricted: true, items: [] } });
    renderWithProviders(<BuyerDashboardPage />, { state: buyerState(MANAGER) });

    const attention = await screen.findByRole('list', { name: 'Requires attention' });
    expect(attention.closest('.tiq-grid')).toBeNull();
    const workload = screen.getByRole('heading', { name: 'Workload by owner' });
    expect(workload.closest('.tiq-grid')).toHaveClass('tiq-grid--3');
  });

  it('lays the two remaining summary cards out in two columns when one is left out', async () => {
    routes({ ...BUYER_DASHBOARD, workload: { restricted: true, items: [] } });
    renderWithProviders(<BuyerDashboardPage />, { state: buyerState(MANAGER) });

    const pipeline = await screen.findByRole('heading', { name: 'Pipeline by stage' });
    expect(pipeline.closest('.tiq-grid')).toHaveClass('tiq-grid--2');
    const attention = screen.getByRole('list', { name: 'Requires attention' });
    expect(attention.closest('.tiq-grid')).toHaveClass('tiq-grid--sidebar');
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
