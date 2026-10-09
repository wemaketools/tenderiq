import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SubscriptionRow } from '@contracts/operations';

import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { opsState, pageOf, planCatalog, subscriptionDetail } from '../testData';
import SubscriptionPage from './SubscriptionPage';
import SubscriptionsPage from './SubscriptionsPage';

const O = '/api/v1/ops';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SubscriptionsPage (OPS-03)', () => {
  it('shows the plan catalog, free supplier access and the subscription register', async () => {
    const detail = subscriptionDetail();
    installFetch({
      [`GET ${O}/plans`]: () => ({ body: planCatalog() }),
      [`GET ${O}/subscriptions`]: () => ({
        body: pageOf([
          SubscriptionRow.parse({
            id: detail.id,
            customer: detail.customer,
            planCode: detail.planCode,
            status: detail.status,
            startsAt: detail.startsAt,
            renewsAt: detail.renewsAt,
            commercialContact: detail.commercialContact,
            commercialContactEmail: detail.commercialContactEmail,
            openServiceActions: detail.openServiceActions,
            disputedInvoices: detail.disputedInvoices,
          }),
        ]),
      }),
    });
    renderWithProviders(<SubscriptionsPage />, { state: opsState(), route: '/ops/subscriptions' });

    expect(
      await screen.findByText('Suppliers never pay to view notices or take part.'),
    ).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Subscriptions' });
    expect(within(table).getByText('Kalahari Water Utilities (Pilot)')).toBeInTheDocument();
    expect(within(table).getByText('1 open service action')).toBeInTheDocument();
  });

  it('leaves out the plan catalog, without requesting it, for a member who may not read plans', async () => {
    const { requests } = installFetch({
      [`GET ${O}/plans`]: () => ({ body: planCatalog() }),
      [`GET ${O}/subscriptions`]: () => ({ body: pageOf([]) }),
    });
    renderWithProviders(<SubscriptionsPage />, {
      state: opsState(['ops.support.manage']),
      route: '/ops/subscriptions',
    });

    expect(await screen.findByText('No subscriptions match')).toBeInTheDocument();
    expect(
      screen.queryByText('Suppliers never pay to view notices or take part.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Not available in your role')).not.toBeInTheDocument();
    expect(requests.some((request) => request.path === `${O}/plans`)).toBe(false);
  });

  it('explains when no subscription matches', async () => {
    installFetch({
      [`GET ${O}/plans`]: () => ({ body: planCatalog() }),
      [`GET ${O}/subscriptions`]: () => ({ body: pageOf([]) }),
    });
    renderWithProviders(<SubscriptionsPage />, { state: opsState(), route: '/ops/subscriptions' });

    expect(await screen.findByText('No subscriptions match')).toBeInTheDocument();
  });
});

describe('SubscriptionPage (OPS-03)', () => {
  function render(extra: Parameters<typeof installFetch>[0] = {}) {
    const fetch = installFetch({
      [`GET ${O}/subscriptions/1`]: () => ({ body: subscriptionDetail() }),
      ...extra,
    });
    renderWithProviders(<SubscriptionPage />, {
      state: opsState(),
      route: '/ops/subscriptions/1',
      path: '/ops/subscriptions/:subscriptionId',
    });
    return fetch;
  }

  it('shows the reached limit and the service action that never blocks a supplier submission', async () => {
    render();

    expect(await screen.findByText('Limit reached')).toBeInTheDocument();
    expect(screen.getByText('Published events exceeded the pilot limit.')).toBeInTheDocument();
    expect(screen.getByText('Never blocks a supplier submission')).toBeInTheDocument();
    expect(screen.getByText('INV-2026-0007')).toBeInTheDocument();
  });

  it('changes an entitlement limit with a reason', async () => {
    const detail = subscriptionDetail();
    const { requests } = render({
      [`PUT ${O}/subscriptions/1/entitlements/published_events_per_year`]: () => ({
        body: {
          subscriptionId: 1,
          entitlement: { ...detail.entitlements[0], limitValue: 20, limitReached: false },
          serviceAction: null,
        },
      }),
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Change the limit of Published events per year' }),
    );
    const dialog = await screen.findByRole('dialog');
    const limit = within(dialog).getByLabelText(/^Agreed limit/);
    await userEvent.clear(limit);
    await userEvent.type(limit, '20');
    await userEvent.type(within(dialog).getByLabelText(/^Reason/), 'Pilot extended.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save limit' }));

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'PUT')?.body).toEqual({
        limitValue: 20,
        reason: 'Pilot extended.',
      }),
    );
  });

  it('explains when the service action was already resolved elsewhere', async () => {
    render({
      [`POST ${O}/service-actions/41/resolve`]: () =>
        problem(409, 'Already resolved', { code: 'SERVICE_ACTION_RESOLVED' }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Resolve' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/^Resolution/), 'Pilot extended.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Resolve' }));

    expect(
      await within(dialog).findByText('This service action is already resolved.'),
    ).toBeInTheDocument();
  });
});
