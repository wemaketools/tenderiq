import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IncidentRow } from '@contracts/operations';

import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { customerRow, incidentDetail, opsState, pageOf } from '../testData';
import IncidentPage from './IncidentPage';
import IncidentsPage from './IncidentsPage';

const O = '/api/v1/ops';

function row() {
  const detail = incidentDetail();
  return IncidentRow.parse({
    id: detail.id,
    reference: detail.reference,
    title: detail.title,
    severity: detail.severity,
    status: detail.status,
    startedAt: detail.startedAt,
    resolvedAt: detail.resolvedAt,
    affectedCustomers: detail.affectedCustomers,
    affectedEvents: detail.affectedEvents,
    pendingBuyerDecisions: detail.pendingBuyerDecisions,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('IncidentsPage (OPS-05)', () => {
  it('lists incidents with severity, recovery, impact and pending buyer decisions', async () => {
    installFetch({
      [`GET ${O}/incidents`]: () => ({ body: pageOf([row()]) }),
      [`GET ${O}/customers`]: () => ({ body: pageOf([customerRow()]) }),
    });
    renderWithProviders(<IncidentsPage />, { state: opsState(), route: '/ops/incidents' });

    const table = await screen.findByRole('table', { name: 'Incidents' });
    expect(within(table).getByText('INC-2026-007')).toBeInTheDocument();
    expect(within(table).getByText('High')).toBeInTheDocument();
    expect(within(table).getByText('1 decision pending')).toBeInTheDocument();
    expect(screen.getByText('The buyer decides deadlines')).toBeInTheDocument();
  });

  it('offers the affected-customer filter to a member who may list customers', async () => {
    installFetch({
      [`GET ${O}/incidents`]: () => ({ body: pageOf([row()]) }),
      [`GET ${O}/customers`]: () => ({ body: pageOf([customerRow()]) }),
    });
    renderWithProviders(<IncidentsPage />, { state: opsState(), route: '/ops/incidents' });

    await screen.findByRole('table', { name: 'Incidents' });
    expect(screen.getByLabelText('Affected customer')).toBeInTheDocument();
  });

  it('leaves out the affected-customer filter, without listing customers, for a member who may not list them', async () => {
    const { requests } = installFetch({
      [`GET ${O}/incidents`]: () => ({ body: pageOf([row()]) }),
      [`GET ${O}/customers`]: () => ({ body: pageOf([customerRow()]) }),
    });
    renderWithProviders(<IncidentsPage />, {
      state: opsState(['ops.incidents.manage']),
      route: '/ops/incidents',
    });

    await screen.findByRole('table', { name: 'Incidents' });
    expect(screen.queryByLabelText('Affected customer')).not.toBeInTheDocument();
    expect(requests.some((request) => request.path === `${O}/customers`)).toBe(false);
  });

  it('refuses to declare an incident without its title, severity and start', async () => {
    const { requests } = installFetch({
      [`GET ${O}/incidents`]: () => ({ body: pageOf([]) }),
      [`GET ${O}/customers`]: () => ({ body: pageOf([]) }),
    });
    // The top bar's section action opens the dialog through ?new=1 (DD-46).
    renderWithProviders(<IncidentsPage />, { state: opsState(), route: '/ops/incidents?new=1' });
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Declare incident' }));

    expect(await within(dialog).findByText('At least 3 characters.')).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
  });
});

describe('IncidentPage (OPS-05)', () => {
  function render(extra: Parameters<typeof installFetch>[0] = {}, detail = incidentDetail()) {
    const fetch = installFetch({
      [`GET ${O}/incidents/1`]: () => ({ body: detail }),
      [`GET ${O}/customers`]: () => ({ body: pageOf([customerRow()]) }),
      ...extra,
    });
    renderWithProviders(<IncidentPage />, {
      state: opsState(),
      route: '/ops/incidents/1',
      path: '/ops/incidents/:incidentId',
    });
    return fetch;
  }

  it('shows the affected customers and events with each buyer decision, and the timing evidence', async () => {
    render();

    expect(await screen.findByText('Deadline kept: all bids arrived on time.')).toBeInTheDocument();
    expect(screen.getByText('Buyer decision pending')).toBeInTheDocument();
    expect(screen.getByText('T-2026-0002')).toBeInTheDocument();
    expect(
      screen.getByText('Upload latency alerts; investigating the storage tier.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('The responsible buyer decides any deadline extension or restart.'),
    ).toBeInTheDocument();
  });

  it('posts a status update with a revised customer notice', async () => {
    const ongoing = incidentDetail({ status: 'identified', resolvedAt: null });
    const { requests } = render(
      { [`POST ${O}/incidents/1/updates`]: () => ({ body: ongoing }) },
      ongoing,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Post update' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Recovery status/), 'monitoring');
    await userEvent.type(within(dialog).getByLabelText(/^Update note/), 'Queue draining.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Post update' }));

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.body).toMatchObject({
        status: 'monitoring',
        note: 'Queue draining.',
      }),
    );
  });

  it('explains a duplicate impact', async () => {
    render({
      [`POST ${O}/incidents/1/impacts`]: () =>
        problem(409, 'Duplicate', { code: 'IMPACT_DUPLICATE' }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Add affected customer' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Customer/), '3');
    await userEvent.type(within(dialog).getByLabelText(/^Impact/), 'Uploads delayed.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add affected customer' }));

    expect(
      await within(dialog).findByText('This customer or event is already recorded as affected.'),
    ).toBeInTheDocument();
  });
});
