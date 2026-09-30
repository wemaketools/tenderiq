import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { supplierState } from '../../reports/testSession';
import { SUPPLIER_DASHBOARD } from '../testData';
import SupplierDashboardPage from './SupplierDashboardPage';

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

  it('shows restricted panels without counts when the capacity may not read them', async () => {
    installFetch({ 'GET /api/v1/supplier/dashboard': () => ({ body: SUPPLIER_DASHBOARD }) });
    renderWithProviders(<SupplierDashboardPage />, {
      state: supplierState(['supplier.dashboard.view']),
    });

    expect(
      await screen.findByText('Your role does not manage the evidence library.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Your role does not include contract delivery.')).toBeInTheDocument();
    const evidence = screen.getAllByRole('region', { name: 'Expiring evidence' })[0];
    expect(within(evidence!).getByText('Not available in your role')).toBeInTheDocument();
  });
});
