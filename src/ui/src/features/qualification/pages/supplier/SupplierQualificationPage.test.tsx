import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  SUPPLIER_APPLY,
  SUPPLIER_VIEW,
  page,
  renderPage,
  routeCalls,
  supplierApplicationRow,
  supplierOverview,
  supplierProgramRow,
} from '../../test/kit';
import SupplierQualificationPage from './SupplierQualificationPage';

vi.mock('../../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/supplier/qualification', route: '/supplier/qualification', supplier: true };

function routes() {
  return routeCalls({
    'supplier.qualification.overview': () => supplierOverview(),
    'supplier.qualification.applications.list': () => page([supplierApplicationRow()]),
    'supplier.qualification.programs.list': () => page([supplierProgramRow()]),
  });
}

describe('SupplierQualificationPage (SUP-20)', () => {
  it('separates registration from qualification: "Registered — not qualified for WTR-PUMP" (AC-07)', async () => {
    routes();
    renderPage(<SupplierQualificationPage />, { ...PATH, permissions: SUPPLIER_APPLY });
    expect(
      await screen.findByText('Makgadikgadi Civil Works is registered on TenderIQ'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Registration is not qualification/)).toBeInTheDocument();
    expect(
      screen.getByText('Registered — not qualified for WTR-INFRA, WTR-PUMP, WTR-PIPE'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Kalahari Water Utilities (Pilot)', { selector: 'strong' }),
    ).toBeInTheDocument();
  });

  it('lists applications with review status, completeness and the next request due time', async () => {
    routes();
    renderPage(<SupplierQualificationPage />, { ...PATH, permissions: SUPPLIER_APPLY });
    const row = await screen.findByRole('row', { name: /QA-2026-0006 Water Infrastructure/ });
    expect(within(row).getByText('More info required')).toBeInTheDocument();
    expect(within(row).getByText('12 of 13 answered')).toBeInTheDocument();
    expect(within(row).getByText('1 open request')).toBeInTheDocument();
    expect(within(row).getAllByText(/Africa\/Gaborone/).length).toBeGreaterThan(0);
  });

  it('lists programs with categories, thresholds and the supplier status and filters them', async () => {
    const calls = routes();
    renderPage(<SupplierQualificationPage />, { ...PATH, permissions: SUPPLIER_APPLY });
    fireEvent.click(await screen.findByRole('tab', { name: 'Programs' }));
    const table = await screen.findByRole('table', {
      name: 'Qualification programs you can apply to',
    });
    const row = await within(table).findByRole('row', { name: /Water Infrastructure Suppliers/ });
    expect(within(row).getByText(/13 questions/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Category code'), { target: { value: 'WTR-PUMP' } });
    await waitFor(() =>
      expect(
        calls.filter((item) => item.id === 'supplier.qualification.programs.list').at(-1)?.request,
      ).toEqual({
        query: expect.objectContaining({ categoryCode: 'WTR-PUMP' }),
      }),
    );
  });

  it('shows outcomes read-only to a contributor who cannot apply', async () => {
    const calls = routes();
    renderPage(<SupplierQualificationPage />, { ...PATH, permissions: SUPPLIER_VIEW });
    expect(await screen.findByText('Read-only access')).toBeInTheDocument();
    expect(calls.some((item) => item.id === 'supplier.qualification.applications.list')).toBe(
      false,
    );
  });
});
