import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { OPS_ALL, STAFF, customerDetail, customerRow, opsState, pageOf } from '../testData';
import CustomersPage from './CustomersPage';

const O = '/api/v1/ops';

const SUPPLIER = customerRow({
  tenantId: 5,
  slug: 'chobe-pipe',
  kind: 'supplier',
  name: 'Chobe Pipe & Valve Supplies',
  legalName: 'Chobe Pipe (Pty) Ltd',
  status: 'active',
  onboardingStage: null,
  planCode: null,
  subscriptionStatus: null,
  serviceOwner: null,
  administrators: [],
});

function routes(rows = [customerRow(), SUPPLIER]) {
  return installFetch({
    [`GET ${O}/customers`]: () => ({ body: pageOf(rows) }),
    [`GET ${O}/staff`]: () => ({ body: STAFF }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CustomersPage (OPS-01)', () => {
  it('lists identity, service owner, onboarding stage, plan, status and administrators', async () => {
    routes();
    renderWithProviders(<CustomersPage />, { state: opsState(), route: '/ops/customers' });

    const table = await screen.findByRole('table', { name: 'Customers' });
    expect(within(table).getByText('Okavango District Council')).toBeInTheDocument();
    expect(within(table).getByText('Naledi Sebego')).toBeInTheDocument();
    expect(within(table).getByText('Wame Olebile')).toBeInTheDocument();
    expect(within(table).getByText('Buyer Standard')).toBeInTheDocument();
    expect(within(table).getByText('Free participation')).toBeInTheDocument();
    expect(within(table).getByText('No administrator')).toBeInTheDocument();
    expect(screen.getByText('Service metadata only')).toBeInTheDocument();
  });

  it('pluralizes the open cases and grants summary by count', async () => {
    routes([
      customerRow({ openSupportCases: 1, activeSupportGrants: 1 }),
      customerRow({ tenantId: 2, slug: 'kwu', openSupportCases: 2, activeSupportGrants: 0 }),
    ]);
    renderWithProviders(<CustomersPage />, { state: opsState(), route: '/ops/customers' });

    const table = await screen.findByRole('table', { name: 'Customers' });

    expect(within(table).getByText('1 case · 1 grant')).toBeInTheDocument();
    expect(within(table).getByText('2 cases · 0 grants')).toBeInTheDocument();
  });

  it('keeps the plan and subscription chips at their own width and splits the legal name from the slug', async () => {
    routes([customerRow({ legalName: 'Okavango District Council (Local Authority)' })]);
    renderWithProviders(<CustomersPage />, { state: opsState(), route: '/ops/customers' });

    const table = await screen.findByRole('table', { name: 'Customers' });
    const planStack = within(table).getByText('Buyer Standard').closest('.tiq-stack');

    expect(planStack).toHaveClass('tiq-stack--start');
    expect(within(table).getByText('Okavango District Council (Local Authority)')).toHaveClass(
      'tiq-cell-sub',
    );
    expect(within(table).getByText('odc')).toHaveClass('tiq-cell-sub');
  });

  it('sends the kind filter to the API when a kind is chosen', async () => {
    const { requests } = routes();
    renderWithProviders(<CustomersPage />, { state: opsState(), route: '/ops/customers' });
    await screen.findByRole('table', { name: 'Customers' });

    await userEvent.selectOptions(screen.getByLabelText('Kind'), 'supplier');

    await waitFor(() =>
      expect(
        requests.some(
          (request) =>
            request.path === `${O}/customers` && request.search.includes('kind=supplier'),
        ),
      ).toBe(true),
    );
  });

  it('validates the new customer with the contract rules, then sends it', async () => {
    const { requests } = installFetch({
      [`GET ${O}/customers`]: () => ({ body: pageOf([]) }),
      [`GET ${O}/staff`]: () => ({ body: STAFF }),
      [`POST ${O}/customers`]: () => ({
        status: 201,
        body: customerDetail({ tenantId: 10, name: 'Gaborone City Council' }),
      }),
    });
    // The top bar's "Add customer" section action opens the dialog through ?new=1 (DD-46).
    renderWithProviders(<CustomersPage />, { state: opsState(), route: '/ops/customers?new=1' });
    const dialog = await screen.findByRole('dialog');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Create customer' }));
    expect(await within(dialog).findByText('The legal name is required.')).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'POST')).toBe(false);

    await userEvent.type(within(dialog).getByLabelText(/^Legal name/), 'Gaborone City Council');
    await userEvent.type(within(dialog).getByLabelText(/^Short name/), 'gcc');
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Plan/), 'buyer_standard');
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Service owner/), '1');
    await userEvent.type(within(dialog).getByLabelText(/^Designated administrator/), 'Mpule Kgari');
    await userEvent.type(
      within(dialog).getByLabelText(/^Administrator e-mail/),
      'mpule@gcc.example',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create customer' }));

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.body).toMatchObject({
        legalName: 'Gaborone City Council',
        slug: 'gcc',
        planCode: 'buyer_standard',
        serviceOwnerUserId: 1,
      }),
    );
  });

  it('explains when no customer matches the filters', async () => {
    routes([]);
    renderWithProviders(<CustomersPage />, { state: opsState(), route: '/ops/customers' });

    expect(await screen.findByText('No customers match these filters')).toBeInTheDocument();
  });

  it('hides the create action without the managing permission and explains a 403', async () => {
    installFetch({
      [`GET ${O}/customers`]: () => problem(403, 'Forbidden', { code: 'FORBIDDEN' }),
      [`GET ${O}/staff`]: () => ({ body: STAFF }),
    });
    renderWithProviders(<CustomersPage />, {
      state: opsState(OPS_ALL.filter((code) => code !== 'ops.customers.manage')),
      route: '/ops/customers',
    });

    expect(await screen.findAllByText('Restricted', { exact: false })).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Add customer' })).not.toBeInTheDocument();
  });
});
