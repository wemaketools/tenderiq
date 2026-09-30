import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PlanItemDetail } from '@contracts/requests';

import { installFetch, problem } from '../../../test/fetchMock';
import { options } from '../../requests/testing/data';
import { renderPage } from '../../requests/testing/render';
import { planItem } from '../testing/data';
import PlanItemFormPage from './PlanItemFormPage';
import PlanItemPage from './PlanItemPage';

const planned: PlanItemDetail = {
  ...planItem,
  status: 'planned',
  plannedReleaseDate: null,
  allowedActions: ['edit', 'schedule', 'defer', 'cancel'],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderItem(detail: PlanItemDetail, routes: Parameters<typeof installFetch>[0] = {}) {
  const fetch = installFetch({
    [`GET /api/v1/buyer/plan-items/${detail.id}`]: () => ({ body: detail }),
    ...routes,
  });
  renderPage(<PlanItemPage />, {
    route: `/buyer/planning/items/${detail.id}`,
    path: '/buyer/planning/items/:planItemId',
  });
  return fetch;
}

describe('PlanItemPage (BUY-05)', () => {
  it('shows the dependency, the owner and the next action when loaded', async () => {
    renderItem(planItem);

    expect(await screen.findByRole('heading', { name: planItem.title })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dependencies' })).toBeInTheDocument();
    expect(screen.getByText(/Next action/)).toBeInTheDocument();
  });

  it('defers the item with its full plan after confirmation', async () => {
    const { requests } = renderItem(planItem, {
      [`PUT /api/v1/buyer/plan-items/${planItem.id}`]: () => ({
        body: { ...planItem, status: 'deferred' },
      }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Defer' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Defer' }));

    await waitFor(() => expect(requests.find((item) => item.method === 'PUT')).toBeDefined());
    const body = requests.find((item) => item.method === 'PUT')?.body as Record<string, unknown>;
    expect(body).toMatchObject({
      status: 'deferred',
      title: planItem.title,
      budgetPeriod: planItem.budgetPeriod,
    });
    expect(await screen.findByText(`${planItem.title} deferred.`)).toBeInTheDocument();
  });

  it('explains SCHEDULE_DATE_REQUIRED when an item without a release date is scheduled', async () => {
    renderItem(planned, {
      [`PUT /api/v1/buyer/plan-items/${planned.id}`]: () =>
        problem(422, 'Schedule date required', { code: 'SCHEDULE_DATE_REQUIRED', errors: [] }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Schedule' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Schedule' }));

    expect(
      await within(dialog).findAllByText('Set a planned release date before scheduling.'),
    ).not.toHaveLength(0);
  });
});

describe('PlanItemFormPage (BUY-05 form)', () => {
  it('refuses an award date before the release date', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/request-options': () => ({ body: options }),
      'GET /api/v1/buyer/plan-items': () => ({
        body: { items: [], total: 0, page: 1, pageSize: 100 },
      }),
      'GET /api/v1/buyer/requests': () => ({
        body: { items: [], total: 0, page: 1, pageSize: 100 },
      }),
    });
    renderPage(<PlanItemFormPage />, {
      route: '/buyer/planning/items/new',
      path: '/buyer/planning/items/new',
    });

    await userEvent.type(await screen.findByLabelText(/^Title/), 'Meter reading devices');
    await userEvent.type(screen.getByLabelText(/^Planned release/), '2027-03-01');
    await userEvent.type(screen.getByLabelText(/^Planned award/), '2027-01-01');
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Save plan item' })[0] as HTMLElement,
    );

    expect(
      await screen.findByText('The planned award cannot precede the planned release.'),
    ).toBeInTheDocument();
    expect(requests.some((item) => item.method === 'POST')).toBe(false);
  });

  it('creates a plan item with the chosen owner and demand', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/request-options': () => ({ body: options }),
      'GET /api/v1/buyer/plan-items': () => ({
        body: { items: [], total: 0, page: 1, pageSize: 100 },
      }),
      'GET /api/v1/buyer/requests': () => ({
        body: { items: [], total: 0, page: 1, pageSize: 100 },
      }),
      'POST /api/v1/buyer/plan-items': () => ({
        status: 201,
        body: { ...planned, id: 900, title: 'Meter reading devices' },
      }),
    });
    renderPage(<PlanItemFormPage />, {
      route: '/buyer/planning/items/new',
      path: '/buyer/planning/items/new',
    });

    await userEvent.type(await screen.findByLabelText(/^Title/), 'Meter reading devices');
    await userEvent.selectOptions(screen.getByLabelText(/^Owner/), '5');
    await userEvent.type(screen.getByLabelText(/^Resource demand/), '12');
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Save plan item' })[0] as HTMLElement,
    );

    await waitFor(() => expect(requests.find((item) => item.method === 'POST')).toBeDefined());
    expect(requests.find((item) => item.method === 'POST')?.body).toMatchObject({
      title: 'Meter reading devices',
      ownerUserId: 5,
      resourceDemandDays: 12,
    });
    expect(await screen.findByText('Plan item saved')).toBeInTheDocument();
  });
});
