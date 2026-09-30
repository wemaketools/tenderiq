import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OffboardingPlanRow } from '@contracts/operations';

import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { STAFF, offboardingPlan, opsState, pageOf } from '../testData';
import OffboardingPlanPage from './OffboardingPlanPage';
import OffboardingPlansPage from './OffboardingPlansPage';

const O = '/api/v1/ops';

function row() {
  const detail = offboardingPlan();
  return OffboardingPlanRow.parse({
    id: detail.id,
    customer: detail.customer,
    status: detail.status,
    activeEventsCount: detail.activeEventsCount,
    activeContractsCount: detail.activeContractsCount,
    serviceEndDate: detail.serviceEndDate,
    agreedByCustomerAt: detail.agreedByCustomerAt,
    owner: detail.owner,
    updatedAt: detail.updatedAt,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OffboardingPlansPage (OPS-02)', () => {
  it('lists exit plans with their live obligations, service end date and customer agreement', async () => {
    installFetch({
      [`GET ${O}/offboarding-plans`]: () => ({ body: pageOf([row()]) }),
      [`GET ${O}/staff`]: () => ({ body: STAFF }),
    });
    renderWithProviders(<OffboardingPlansPage />, { state: opsState(), route: '/ops/offboarding' });

    const table = await screen.findByRole('table', { name: 'Offboarding plans' });
    expect(within(table).getByText('Okavango District Council')).toBeInTheDocument();
    expect(within(table).getByText('1 events · 1 contracts')).toBeInTheDocument();
    expect(within(table).getByText('Awaiting customer agreement')).toBeInTheDocument();
  });

  it('explains when no plan exists', async () => {
    installFetch({
      [`GET ${O}/offboarding-plans`]: () => ({ body: pageOf([]) }),
      [`GET ${O}/staff`]: () => ({ body: STAFF }),
    });
    renderWithProviders(<OffboardingPlansPage />, { state: opsState(), route: '/ops/offboarding' });

    expect(await screen.findByText('No offboarding plans match')).toBeInTheDocument();
  });
});

describe('OffboardingPlanPage (OPS-02, AC-36)', () => {
  function render(extra: Parameters<typeof installFetch>[0] = {}) {
    const fetch = installFetch({
      [`GET ${O}/offboarding-plans/1`]: () => ({ body: offboardingPlan() }),
      [`GET ${O}/staff`]: () => ({ body: STAFF }),
      ...extra,
    });
    renderWithProviders(<OffboardingPlanPage />, {
      state: opsState(),
      route: '/ops/offboarding/1',
      path: '/ops/offboarding/:planId',
    });
    return fetch;
  }

  it('shows the live tender and contract, the export manifest and blocking readiness before the customer agrees', async () => {
    render();

    expect(await screen.findByText('Leaving never abandons live procurements')).toBeInTheDocument();
    expect(screen.getByText('T-2026-0011')).toBeInTheDocument();
    expect(screen.getByText('C-2025-0004')).toBeInTheDocument();
    expect(screen.getByText('Unopened sealed bids')).toBeInTheDocument();
    expect(screen.getByText('Customer agreement recorded')).toBeInTheDocument();
    expect(screen.getAllByText('Customer agreement').length).toBeGreaterThan(0);
  });

  it('saves the continuity arrangements separately from agreement and completion', async () => {
    const { requests } = render({
      [`PATCH ${O}/offboarding-plans/1`]: () => ({ body: offboardingPlan() }),
    });
    const field = await screen.findByLabelText(/^Continuity plan/);
    await userEvent.type(field, ' C-2025-0004 transfers to the regional service.');
    expect(screen.getAllByText('Unsaved changes').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Save plan' }));

    await waitFor(() =>
      expect(
        (requests.find((request) => request.method === 'PATCH')?.body as { continuityPlan: string })
          .continuityPlan,
      ).toContain('transfers to the regional service'),
    );
  });

  it('explains that the customer must agree before the plan moves on', async () => {
    render({
      [`POST ${O}/offboarding-plans/1/transition`]: () =>
        problem(409, 'Customer agreement required', { code: 'CUSTOMER_AGREEMENT_REQUIRED' }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Move to Agreed' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Move plan' }));

    expect(
      await within(dialog).findByText(/The customer has not agreed the plan yet/),
    ).toBeInTheDocument();
  });
});
