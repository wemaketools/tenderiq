import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { STAFF, customerDetail, opsState } from '../testData';
import CustomerPage from './CustomerPage';

const O = '/api/v1/ops';

function render(extra: Parameters<typeof installFetch>[0] = {}) {
  const fetch = installFetch({
    [`GET ${O}/customers/3`]: () => ({ body: customerDetail() }),
    [`GET ${O}/staff`]: () => ({ body: STAFF }),
    ...extra,
  });
  renderWithProviders(<CustomerPage />, {
    state: opsState(),
    route: '/ops/customers/3',
    path: '/ops/customers/:customerTenantId',
  });
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CustomerPage (OPS-01, OPS-02)', () => {
  it('shows identity, relationship, counts-only usage and the live obligations with official deadlines', async () => {
    render();

    expect(
      await screen.findByText(
        'Operators see service metadata only; tender content stays with the customer.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('BW-LG-0031')).toBeInTheDocument();
    expect(screen.getByText('T-2026-0011')).toBeInTheDocument();
    expect(screen.getByText('C-2026-0001')).toBeInTheDocument();
    expect(screen.getAllByTestId('official-deadline').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Open offboarding plan/ })).toHaveAttribute(
      'href',
      '/ops/offboarding/1',
    );
  });

  it('withholds the title of a non-public event and the title and supplier of a contract from the operator', async () => {
    render();

    const event = (await screen.findByText('T-2026-0006')).closest('tr');
    const contract = screen.getByText('C-2026-0001').closest('tr');

    expect(screen.getByText('Maun road resurfacing')).toBeInTheDocument();
    expect(event).not.toBeNull();
    expect(within(event as HTMLElement).getByText('Title withheld')).toBeInTheDocument();
    expect(
      within(event as HTMLElement).getByText(
        /operators see its reference, status and deadline only/,
      ),
    ).toBeInTheDocument();
    expect(within(event as HTMLElement).getByTestId('official-deadline')).toBeInTheDocument();
    expect(contract).not.toBeNull();
    expect(within(contract as HTMLElement).getByText('Title withheld')).toBeInTheDocument();
    expect(within(contract as HTMLElement).getByText('Withheld')).toBeInTheDocument();
    expect(
      within(contract as HTMLElement).getByText(/customer-authorized support grant/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Invitation-only, restricted and unreleased events/),
    ).toBeInTheDocument();
  });

  it('explains the continuity rule when a status change is refused for live obligations', async () => {
    render({
      [`POST ${O}/customers/3/status`]: () =>
        problem(409, 'Continuity plan required', {
          code: 'CONTINUITY_PLAN_REQUIRED',
          detail: 'T-2026-0011 and C-2025-0004 are live.',
        }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Change account status' }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText('TenderIQ Platform Operations')).toBeInTheDocument();
    await userEvent.selectOptions(within(dialog).getByLabelText(/^New status/), 'closed');
    await userEvent.type(within(dialog).getByLabelText(/^Reason/), 'Contract ended.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change status' }));

    expect(
      await within(dialog).findByText(/Agree a continuity \(offboarding\) plan/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('T-2026-0011 and C-2025-0004 are live.')).toBeInTheDocument();
  });

  it('changes the service owner through the confirmation dialog', async () => {
    const { requests } = render({
      [`PATCH ${O}/customers/3`]: () => ({
        body: customerDetail({ serviceOwner: { userId: 2, fullName: 'Kitso Ramotswa' } }),
      }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Change service owner' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Service owner/), '2');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change owner' }));

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'PATCH')?.body).toEqual({
        serviceOwnerUserId: 2,
      }),
    );
  });

  it('shows an error state with retry when the customer cannot be loaded', async () => {
    installFetch({
      [`GET ${O}/customers/3`]: () => problem(500, 'Server error'),
      [`GET ${O}/staff`]: () => ({ body: STAFF }),
    });
    renderWithProviders(<CustomerPage />, {
      state: opsState(),
      route: '/ops/customers/3',
      path: '/ops/customers/:customerTenantId',
    });

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
