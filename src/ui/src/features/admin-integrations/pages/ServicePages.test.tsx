import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import { LocationProbe, renderWithProviders } from '../../../test/render';
import { ADMIN, buyerState, buyerSubscription, customerGrant, pageOf } from '../testData';
import ServiceIndexPage from './ServiceIndexPage';
import SubscriptionPage from './SubscriptionPage';
import SupportAccessPage from './SupportAccessPage';
import SupportGrantPage from './SupportGrantPage';

const B = '/api/v1/buyer';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ServiceIndexPage', () => {
  it('opens the first screen the membership may use', async () => {
    renderWithProviders(<ServiceIndexPage />, {
      state: buyerState(['tender.publish']),
      route: '/buyer/admin/service',
      path: '/buyer/admin/service',
      routes: [
        { path: '/buyer/admin/service/exceptions', element: <LocationProbe label="exceptions" /> },
      ],
    });

    expect(await screen.findByTestId('location-probe')).toHaveTextContent('exceptions');
  });

  it('explains the forbidden page with its heading when no service screen is available', () => {
    renderWithProviders(<ServiceIndexPage />, { state: buyerState(['tender.view']) });

    expect(
      screen.getByRole('heading', { level: 1, name: 'Not available in your role' }),
    ).toBeInTheDocument();
  });
});

describe('SubscriptionPage (ADM-17, AC-36)', () => {
  function render(extra: Parameters<typeof installFetch>[0] = {}, view = buyerSubscription()) {
    const fetch = installFetch({ [`GET ${B}/subscription`]: () => ({ body: view }), ...extra });
    renderWithProviders(<SubscriptionPage />, {
      state: buyerState(),
      route: '/buyer/admin/service/subscription',
    });
    return fetch;
  }

  it('shows entitlements, contacts, live obligations, the export and the closure plan awaiting agreement', async () => {
    render();

    expect(
      await screen.findByText('Usage limits never block an invited supplier’s submission.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Wame Olebile')).toBeInTheDocument();
    expect(screen.getByText('T-2026-0011')).toBeInTheDocument();
    expect(
      screen.getByText('Council moves procurement to a regional shared service.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Agree the closure plan/)).toBeInTheDocument();
  });

  it('shows contact e-mails or a dash, the start as a date and entitlement units in the right plural form', async () => {
    const base = buyerSubscription();
    render(
      {},
      buyerSubscription({
        contacts: [
          ...base.contacts,
          {
            role: 'Commercial contact',
            person: null,
            name: 'Council Treasurer, Okavango District Council',
            email: 'treasury@odc.example',
          },
        ],
        entitlements: [
          {
            featureCode: 'legal_entities',
            label: 'Legal entities',
            unit: 'entities',
            limitValue: 2,
            usageValue: 1,
            limitReached: false,
          },
        ],
      }),
    );

    const contacts = await screen.findByRole('table', { name: 'Service contacts' });
    expect(within(contacts).getByText('treasury@odc.example')).toBeInTheDocument();
    expect(
      within(contacts).getByText('Council Treasurer, Okavango District Council'),
    ).toBeInTheDocument();
    expect(within(contacts).getByText('—')).toBeInTheDocument();
    expect(within(contacts).queryByText('None')).not.toBeInTheDocument();
    expect(screen.getByText('1 Apr 2026')).toBeInTheDocument();
    expect(screen.queryByText(/1 Apr 2026, 02:00/)).not.toBeInTheDocument();
    expect(screen.getByText('1 entity')).toBeInTheDocument();
    expect(screen.getByText('2 entities')).toBeInTheDocument();
  });

  it('agrees the plan only after the acknowledgement is ticked', async () => {
    const { requests } = render({
      [`POST ${B}/subscription/offboarding-plan/agree`]: () => ({ body: buyerSubscription() }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Agree the plan' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Agree the plan' });
    expect(confirm).toBeDisabled();
    await userEvent.click(within(dialog).getByLabelText(/I confirm the organization agrees/));
    await userEvent.click(confirm);

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
        acknowledgement: true,
      }),
    );
  });

  it('explains an incomplete plan', async () => {
    render({
      [`POST ${B}/subscription/offboarding-plan/agree`]: () =>
        problem(409, 'Not ready', { code: 'OFFBOARDING_PLAN_NOT_READY' }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Agree the plan' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText(/I confirm the organization agrees/));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Agree the plan' }));

    expect(await within(dialog).findByText(/The plan is not complete yet/)).toBeInTheDocument();
  });

  it('hides the closure commands from a member who may only view the subscription', async () => {
    installFetch({ [`GET ${B}/subscription`]: () => ({ body: buyerSubscription() }) });
    renderWithProviders(<SubscriptionPage />, {
      state: buyerState(['org.subscription.view']),
      route: '/buyer/admin/service/subscription',
    });

    expect(await screen.findByText('Closure plan')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agree the plan' })).not.toBeInTheDocument();
  });
});

describe('SupportAccessPage and SupportGrantPage (customer authorization)', () => {
  it('lists access requests awaiting a decision', async () => {
    installFetch({
      [`GET ${B}/support-access-grants`]: () => ({ body: pageOf([customerGrant()]) }),
    });
    renderWithProviders(<SupportAccessPage />, {
      state: buyerState(),
      route: '/buyer/admin/service/support-access',
    });

    const table = await screen.findByRole('table', { name: 'Access requests and grants' });
    expect(within(table).getByText('SC-2026-0001')).toBeInTheDocument();
    expect(within(table).getByText('7 days requested')).toBeInTheDocument();
  });

  it('authorizes a request narrowed to metadata only with an expiry', async () => {
    const { requests } = installFetch({
      [`GET ${B}/support-access-grants/1`]: () => ({ body: customerGrant() }),
      [`POST ${B}/support-access-grants/1/authorize`]: () => ({
        body: customerGrant({ status: 'active' }),
      }),
    });
    renderWithProviders(<SupportGrantPage />, {
      state: buyerState(ADMIN),
      route: '/buyer/admin/service/support-access/1',
      path: '/buyer/admin/service/support-access/:grantId',
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Authorize access' }));
    const dialog = await screen.findByRole('dialog');
    const group = within(dialog).getByRole('group', { name: /Access ends/ });
    fireEvent.change(within(group).getByLabelText('Date'), { target: { value: '2026-10-05' } });
    fireEvent.change(within(group).getByLabelText('Time'), { target: { value: '17:00' } });
    await userEvent.click(within(dialog).getByLabelText('Limit to metadata only'));
    await userEvent.click(within(dialog).getByLabelText(/I confirm support may read/));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Authorize access' }));

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
        expiresAt: '2026-10-05T15:00:00Z',
        acknowledgement: true,
        scope: 'metadata_only',
      }),
    );
  });
});
