import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  ODC,
  SUPPLIER_VIEW,
  businessError,
  page,
  renderPage,
  routeCalls,
  supplierDecision,
  supplierOverview,
} from '../../test/kit';
import SupplierDecisionsPage from './SupplierDecisionsPage';

vi.mock('../../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/supplier/qualification/decisions',
  route: '/supplier/qualification/decisions',
  supplier: true,
};

describe('SupplierDecisionsPage (SUP-24)', () => {
  it('groups decisions by the deciding buyer so a suspension at one buyer stays separate', async () => {
    routeCalls({
      'supplier.qualification.overview': () => supplierOverview(),
      'supplier.qualification.decisions.list': () =>
        page([
          supplierDecision({
            id: 705,
            outcome: 'suspended',
            effectiveStatus: 'suspended',
            renewalDueFrom: null,
          }),
          supplierDecision({
            id: 801,
            buyer: ODC,
            outcome: 'qualified',
            effectiveStatus: 'qualified',
            blockedGate: 'none',
            conditions: null,
          }),
        ]),
    });
    renderPage(<SupplierDecisionsPage />, { ...PATH, permissions: SUPPLIER_VIEW });
    const kwu = await screen.findByRole('table', {
      name: 'Decisions of Kalahari Water Utilities (Pilot)',
    });
    const odc = screen.getByRole('table', { name: 'Decisions of Okavango District Council' });
    expect(within(kwu).getByText('Suspended')).toBeInTheDocument();
    expect(within(odc).getByText('Qualified')).toBeInTheDocument();
    expect(screen.getByText('Decisions are buyer-specific')).toBeInTheDocument();
  });

  it('shows scope, dates, renewal deadline, conditions and the blocked gate', async () => {
    routeCalls({
      'supplier.qualification.overview': () => supplierOverview(),
      'supplier.qualification.decisions.list': () => page([supplierDecision()]),
    });
    renderPage(<SupplierDecisionsPage />, { ...PATH, permissions: SUPPLIER_VIEW });
    const row = await screen.findByRole('row', { name: /Water Infrastructure Suppliers/ });
    expect(within(row).getByText('Renew from 4 Mar 2028')).toBeInTheDocument();
    expect(within(row).getByText('Award blocked until the conditions are met')).toBeInTheDocument();
    expect(
      within(row).getByText(/WTR-PIPE Pipes, valves and fittings · up to BWP 5,000,000/),
    ).toBeInTheDocument();
  });

  it('sends status, superseded and sort filters', async () => {
    const calls = routeCalls({
      'supplier.qualification.overview': () => supplierOverview(),
      'supplier.qualification.decisions.list': () => page([supplierDecision()]),
    });
    renderPage(<SupplierDecisionsPage />, { ...PATH, permissions: SUPPLIER_VIEW });
    await screen.findByRole('row', { name: /Water Infrastructure Suppliers/ });
    fireEvent.click(screen.getByLabelText('Include superseded'));
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'effectiveTo:asc' } });
    await waitFor(() =>
      expect(
        calls.filter((item) => item.id === 'supplier.qualification.decisions.list').at(-1)?.request,
      ).toEqual({
        query: expect.objectContaining({
          includeSuperseded: true,
          sort: 'effectiveTo',
          dir: 'asc',
        }),
      }),
    );
  });

  it('explains when there is no decision yet and when access is refused', async () => {
    routeCalls({
      'supplier.qualification.overview': () => supplierOverview(),
      'supplier.qualification.decisions.list': () => page([]),
    });
    const first = renderPage(<SupplierDecisionsPage />, { ...PATH, permissions: SUPPLIER_VIEW });
    expect(await screen.findByText('No qualification decision yet')).toBeInTheDocument();
    first.unmount();

    routeCalls({
      'supplier.qualification.overview': () => supplierOverview(),
      'supplier.qualification.decisions.list': () => {
        throw businessError('supplier.qualification.decisions.list', 'FORBIDDEN', 403);
      },
    });
    renderPage(<SupplierDecisionsPage />, { ...PATH, permissions: SUPPLIER_VIEW });
    expect(
      await screen.findByText('Your role cannot see qualification decisions.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Current decisions')).not.toBeInTheDocument();
    expect(screen.queryByText('…')).not.toBeInTheDocument();
  });

  it('shows the decision tiles when the list loads', async () => {
    routeCalls({
      'supplier.qualification.overview': () => supplierOverview(),
      'supplier.qualification.decisions.list': () => page([]),
    });
    renderPage(<SupplierDecisionsPage />, { ...PATH, permissions: SUPPLIER_VIEW });
    expect(await screen.findByText('No qualification decision yet')).toBeInTheDocument();
    expect(screen.getByText('Current decisions')).toBeInTheDocument();
  });
});
