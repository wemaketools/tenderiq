import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { STAFF, customerDetail, onboardingView, opsState } from '../testData';
import OnboardingPage from './OnboardingPage';

const O = '/api/v1/ops';

function render(extra: Parameters<typeof installFetch>[0] = {}) {
  const fetch = installFetch({
    [`GET ${O}/customers/2/onboarding`]: () => ({ body: onboardingView() }),
    [`GET ${O}/customers/2`]: () => ({
      body: customerDetail({ tenantId: 2, offboardingPlanId: null }),
    }),
    [`GET ${O}/staff`]: () => ({ body: STAFF }),
    ...extra,
  });
  renderWithProviders(<OnboardingPage />, {
    state: opsState(),
    route: '/ops/customers/2/onboarding',
    path: '/ops/customers/:customerTenantId/onboarding',
  });
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OnboardingPage (OPS-02)', () => {
  it('shows the checklist by area, blocking items, readiness and the next required action', async () => {
    render();

    const table = await screen.findByRole('table', { name: 'Onboarding checklist' });
    expect(within(table).getByText('Service agreement signed')).toBeInTheDocument();
    expect(within(table).getByText('Unresolved issue')).toBeInTheDocument();
    expect(within(table).getAllByText('Blocks the next stage')).toHaveLength(1);
    expect(screen.getByText('Blocking checklist items done')).toBeInTheDocument();
    expect(screen.getByText(/Complete 1 blocking item/)).toBeInTheDocument();
  });

  it('explains open blocking items when advancing the stage is refused', async () => {
    render({
      [`POST ${O}/customers/2/onboarding/advance`]: () =>
        problem(409, 'Onboarding items open', { code: 'ONBOARDING_ITEMS_OPEN' }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Move to Live' }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('Publication portal connection unconfirmed'),
    ).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Advance stage' }));

    expect(
      await within(dialog).findByText(/Blocking checklist items are still open/),
    ).toBeInTheDocument();
  });

  it('updates a checklist item with its status and note', async () => {
    const { requests } = render({
      [`POST ${O}/customers/2/onboarding/items/32`]: () => ({ body: onboardingView().items[1] }),
    });
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Update Publication portal connection unconfirmed',
      }),
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Status/), 'done');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save item' }));

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.body).toMatchObject({
        status: 'done',
      }),
    );
  });
});
