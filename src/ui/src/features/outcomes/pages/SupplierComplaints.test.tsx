import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../test/fetchMock';
import { complaintTenders, supplierComplaint, supplierComplaintPage } from '../../awards/test/data';
import { renderSupplier } from '../../awards/test/render';
import NewComplaintPage from './NewComplaintPage';
import SupplierComplaintPage from './SupplierComplaintPage';
import SupplierComplaintsPage from './SupplierComplaintsPage';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SupplierComplaintsPage (SUP-22)', () => {
  it('lists the supplier’s own complaints and offers to lodge one', async () => {
    installFetch({ 'GET /api/v1/supplier/complaints': () => ({ body: supplierComplaintPage() }) });
    renderSupplier(<SupplierComplaintsPage />, {
      route: '/supplier/complaints',
      path: '/supplier/complaints',
    });

    expect((await screen.findAllByText('CMP-2026-0002')).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Lodge a complaint/ })).toBeInTheDocument();
  });

  it('hides lodging from a member who may only view outcomes', async () => {
    installFetch({ 'GET /api/v1/supplier/complaints': () => ({ body: supplierComplaintPage() }) });
    renderSupplier(<SupplierComplaintsPage />, {
      route: '/supplier/complaints',
      path: '/supplier/complaints',
      permissions: ['supplier.outcomes.view'],
    });

    await screen.findAllByText('CMP-2026-0002');
    expect(screen.queryByRole('link', { name: /Lodge a complaint/ })).not.toBeInTheDocument();
  });

  it('lays the filters, KPIs and table out in a spaced page', async () => {
    installFetch({ 'GET /api/v1/supplier/complaints': () => ({ body: supplierComplaintPage() }) });
    renderSupplier(<SupplierComplaintsPage />, {
      route: '/supplier/complaints',
      path: '/supplier/complaints',
    });

    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading.closest('.tiq-page')).not.toBeNull();
  });
});

describe('NewComplaintPage (SUP-22)', () => {
  it('validates the form, then lodges the complaint after confirmation', async () => {
    const { requests } = installFetch({
      'GET /api/v1/supplier/complaint-tenders': () => ({ body: complaintTenders() }),
      'POST /api/v1/supplier/complaints': () => ({
        status: 201,
        body: supplierComplaint({
          complaintId: 900,
          reference: 'CMP-2026-0004',
          status: 'received',
          outcome: null,
        }),
      }),
    });
    renderSupplier(<NewComplaintPage />, {
      route: '/supplier/complaints/new?tenderId=7',
      path: '/supplier/complaints/new',
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Review and submit' }));
    expect(await screen.findByText('Choose the subject.')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText(/^Subject/), 'evaluation');
    await userEvent.type(
      screen.getByLabelText(/^Grounds/),
      'The methodology criterion used an unpublished sub-criterion.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Review and submit' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Submit complaint' }),
    );

    await vi.waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
        tenderId: 7,
        subject: 'evaluation',
        grounds: 'The methodology criterion used an unpublished sub-criterion.',
      }),
    );
  });
});

describe('SupplierComplaintPage (SUP-22)', () => {
  const OPTIONS = {
    route: '/supplier/complaints/92',
    path: '/supplier/complaints/:complaintId',
  };

  it('shows the response and lodges an appeal while the route is open', async () => {
    const { requests } = installFetch({
      'GET /api/v1/supplier/complaints/92': () => ({ body: supplierComplaint() }),
      'POST /api/v1/supplier/complaints/92/appeal': () => ({
        body: supplierComplaint({
          status: 'appealed',
          appealAvailable: false,
          appealGrounds: 'Appeal grounds text.',
        }),
      }),
    });
    renderSupplier(<SupplierComplaintPage />, OPTIONS);

    expect(
      await screen.findByText('The sub-criterion was published in section 4.3.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Appeal' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(
      within(dialog).getByLabelText(/^Appeal grounds/),
      'The published plan does not contain the sub-criterion.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Appeal' }));

    expect(await screen.findByText('Appeal lodged.')).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      appealGrounds: 'The published plan does not contain the sub-criterion.',
    });
  });

  it('shows a just-lodged complaint from the router state when the API cannot read it back', async () => {
    const created = supplierComplaint({
      complaintId: 900,
      reference: 'CMP-2026-0004',
      status: 'received',
      outcome: null,
      responseText: null,
      appealAvailable: false,
    });
    installFetch({
      'GET /api/v1/supplier/documents': () => ({
        body: { items: [], total: 0, page: 1, pageSize: 25 },
      }),
    });
    const { router } = renderSupplier(<SupplierComplaintPage />, OPTIONS);
    await act(() => router.navigate('/supplier/complaints/900', { state: { record: created } }));

    expect(await screen.findByRole('heading', { name: /CMP-2026-0004/ })).toBeInTheDocument();
    expect(screen.queryByText('This could not be loaded')).not.toBeInTheDocument();
  });

  it('shows the error state when no record is available at all', async () => {
    installFetch({});
    renderSupplier(<SupplierComplaintPage />, {
      route: '/supplier/complaints/901',
      path: '/supplier/complaints/:complaintId',
    });
    expect(await screen.findByText('This could not be loaded')).toBeInTheDocument();
  });
});
