import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SUPPLIER_EVIDENCE_WINDOW_DAYS } from '@contracts/reporting';

import { installFetch } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { supplierState } from '../../reports/testSession';
import { SUPPLIER_DASHBOARD } from '../testData';
import SupplierDashboardPage from './SupplierDashboardPage';

/** The same dashboard for a capacity that may read the evidence library and contract delivery. */
const READABLE = {
  ...SUPPLIER_DASHBOARD,
  kpis: SUPPLIER_DASHBOARD.kpis.map((kpi) => ({
    ...kpi,
    value: kpi.value ?? 0,
    restricted: false,
  })),
  expiringEvidence: { restricted: false, items: [] },
  contractTasks: { restricted: false, items: [] },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SupplierDashboardPage (SUP-01)', () => {
  it('shows pursuits with their official submission status and receipts, deadlines and outcomes', async () => {
    installFetch({ 'GET /api/v1/supplier/dashboard': () => ({ body: SUPPLIER_DASHBOARD }) });
    renderWithProviders(<SupplierDashboardPage />, {
      state: supplierState(['supplier.dashboard.view']),
    });

    const pursuits = await screen.findByRole('table', {
      name: 'Active pursuits and submission status',
    });
    expect(within(pursuits).getByText('Receipt RCPT-2026-000027')).toBeInTheDocument();
    expect(within(pursuits).getAllByText('Not submitted').length).toBeGreaterThan(0);
    const deadlines = screen.getByRole('list', { name: 'Deadlines' });
    expect(within(deadlines).getAllByTestId('official-deadline')).toHaveLength(2);
    expect(screen.getByRole('list', { name: 'Outcomes' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Qualifications' })).toBeInTheDocument();
  });

  it('opens each pursuit on the supplier’s own bid and shows a withdrawn bid without a receipt', async () => {
    installFetch({ 'GET /api/v1/supplier/dashboard': () => ({ body: SUPPLIER_DASHBOARD }) });
    renderWithProviders(<SupplierDashboardPage />, {
      state: supplierState(['supplier.dashboard.view']),
    });

    const pursuits = await screen.findByRole('table', {
      name: 'Active pursuits and submission status',
    });
    expect(within(pursuits).getByRole('link', { name: 'T-2026-0002' })).toHaveAttribute(
      'href',
      '/supplier/responses/6',
    );
    const withdrawn = within(pursuits).getByRole('link', { name: 'T-2026-0008' });
    expect(withdrawn).toHaveAttribute('href', '/supplier/responses/20');
    const row = withdrawn.closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('Withdrawn')).toBeInTheDocument();
    expect(within(row as HTMLElement).queryByText(/^Receipt /)).toBeNull();
  });

  it('states the expiring-evidence window the service applies to a capacity that reads evidence', async () => {
    installFetch({ 'GET /api/v1/supplier/dashboard': () => ({ body: READABLE }) });
    renderWithProviders(<SupplierDashboardPage />, {
      state: supplierState(['supplier.dashboard.view']),
    });

    expect(
      await screen.findByText(
        `Documents expired or expiring within ${SUPPLIER_EVIDENCE_WINDOW_DAYS} days`,
      ),
    ).toBeInTheDocument();
  });

  it('leaves out the panels and KPIs the capacity may not read, with no placeholder in their place', async () => {
    installFetch({ 'GET /api/v1/supplier/dashboard': () => ({ body: SUPPLIER_DASHBOARD }) });
    renderWithProviders(<SupplierDashboardPage />, {
      state: supplierState(['supplier.dashboard.view']),
    });

    expect(await screen.findByRole('list', { name: 'Outcomes' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Expiring evidence' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Open contract tasks' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Expiring evidence' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Contract tasks' })).not.toBeInTheDocument();
    expect(screen.queryByText('Not available in your role')).not.toBeInTheDocument();
    expect(screen.queryByText(/your role/i)).not.toBeInTheDocument();
  });

  it('shows the evidence and contract task panels and KPIs when the capacity may read them', async () => {
    installFetch({ 'GET /api/v1/supplier/dashboard': () => ({ body: READABLE }) });
    renderWithProviders(<SupplierDashboardPage />, {
      state: supplierState(['supplier.dashboard.view']),
    });

    expect(await screen.findByRole('heading', { name: 'Expiring evidence' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Contract tasks' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Expiring evidence' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Open contract tasks' })).toBeInTheDocument();
    expect(screen.getByText('No evidence expires soon')).toBeInTheDocument();
  });
});
