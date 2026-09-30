import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  SUPPLIER_APPLY,
  businessError,
  renderPage,
  routeCalls,
  supplierApplication,
  supplierProgram,
} from '../../test/kit';
import SupplierProgramPage from './SupplierProgramPage';

vi.mock('../../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/supplier/qualification/programs/:programId',
  route: '/supplier/qualification/programs/11',
  supplier: true,
};

describe('SupplierProgramPage (SUP-20)', () => {
  it('shows categories, thresholds, questions and the supplier status', async () => {
    routeCalls({ 'supplier.qualification.programs.get': () => supplierProgram() });
    renderPage(<SupplierProgramPage />, { ...PATH, permissions: SUPPLIER_APPLY });
    expect(await screen.findByText('ISO 9001 quality management certificate')).toBeInTheDocument();
    expect(screen.getByText('A current certificate')).toBeInTheDocument();
    expect(
      screen.getByText('Registered — not qualified for WTR-INFRA, WTR-PUMP, WTR-PIPE'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Kalahari Water Utilities \(Pilot\) · version 2/)).toBeInTheDocument();
  });

  it('applies for a covered category and opens the new draft', async () => {
    const calls = routeCalls({
      'supplier.qualification.programs.get': () => supplierProgram(),
      'supplier.qualification.applications.create': () => supplierApplication({ id: 900 }),
    });
    const { router } = renderPage(<SupplierProgramPage />, {
      ...PATH,
      permissions: SUPPLIER_APPLY,
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Apply' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Category/), { target: { value: '32' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start application' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/supplier/qualification/applications/900'),
    );
    expect(
      calls.find((item) => item.id === 'supplier.qualification.applications.create')?.request,
    ).toEqual({
      body: {
        programId: 11,
        scopeCategoryId: 32,
        scopeMaxValue: null,
        scopeGeography: 'Botswana',
        renewalOfDecisionId: null,
      },
    });
  });

  it('shows why an application cannot start', async () => {
    routeCalls({
      'supplier.qualification.programs.get': () => supplierProgram(),
      'supplier.qualification.applications.create': () => {
        throw businessError(
          'supplier.qualification.applications.create',
          'APPLICATION_ALREADY_OPEN',
        );
      },
    });
    renderPage(<SupplierProgramPage />, { ...PATH, permissions: SUPPLIER_APPLY });
    fireEvent.click(await screen.findByRole('button', { name: 'Apply' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start application' }));
    expect(
      await within(dialog).findByText('You already have an open application for this program.'),
    ).toBeInTheDocument();
  });

  it('continues an application in progress instead of starting another', async () => {
    routeCalls({
      'supplier.qualification.programs.get': () =>
        supplierProgram({
          myApplicationInProgress: {
            applicationId: 503,
            reference: 'QA-2026-0006',
            status: 'more_info_required',
          },
        }),
    });
    renderPage(<SupplierProgramPage />, { ...PATH, permissions: SUPPLIER_APPLY });
    expect(await screen.findByRole('link', { name: 'Continue application' })).toHaveAttribute(
      'href',
      '/supplier/qualification/applications/503',
    );
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
  });
});
