import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SupportCaseRow } from '@contracts/operations';

import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import {
  OPS_ALL,
  STAFF,
  customerRow,
  opsState,
  pageOf,
  supportCase,
  supportGrant,
} from '../testData';
import SupportCasePage from './SupportCasePage';
import SupportCasesPage from './SupportCasesPage';
import SupportGrantsPage from './SupportGrantsPage';

const O = '/api/v1/ops';

function caseRow() {
  const detail = supportCase();
  return SupportCaseRow.parse({
    id: detail.id,
    reference: detail.reference,
    customer: detail.customer,
    openedBy: detail.openedBy,
    category: detail.category,
    subject: detail.subject,
    status: detail.status,
    assignedOperator: detail.assignedOperator,
    routedTo: detail.routedTo,
    activeGrant: detail.activeGrant,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    closedAt: detail.closedAt,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SupportCasesPage (OPS-04)', () => {
  it('lists cases with purpose, customer, assignee, status and whether access is active', async () => {
    installFetch({
      [`GET ${O}/support-cases`]: () => ({ body: pageOf([caseRow()]) }),
      [`GET ${O}/customers`]: () => ({ body: pageOf([customerRow()]) }),
      [`GET ${O}/staff`]: () => ({ body: STAFF }),
    });
    renderWithProviders(<SupportCasesPage />, { state: opsState(), route: '/ops/support' });

    const table = await screen.findByRole('table', { name: 'Case queue' });
    expect(within(table).getByText('SC-2026-0001')).toBeInTheDocument();
    expect(within(table).getByText('Access active')).toBeInTheDocument();
    expect(screen.getByText('Assist within the grant, never impersonate')).toBeInTheDocument();
  });

  it('shows the restricted state when the queue is forbidden', async () => {
    installFetch({
      [`GET ${O}/support-cases`]: () => problem(403, 'Forbidden', { code: 'FORBIDDEN' }),
      [`GET ${O}/customers`]: () => ({ body: pageOf([]) }),
      [`GET ${O}/staff`]: () => ({ body: STAFF }),
    });
    renderWithProviders(<SupportCasesPage />, { state: opsState(), route: '/ops/support' });

    expect(await screen.findAllByText('Restricted', { exact: false })).not.toHaveLength(0);
  });
});

describe('SupportGrantsPage (OPS-04)', () => {
  it('lists grants with customer authorization, permitted records and window, and ends an active grant', async () => {
    const { requests } = installFetch({
      [`GET ${O}/support-access-grants`]: () => ({ body: pageOf([supportGrant()]) }),
      [`GET ${O}/customers`]: () => ({ body: pageOf([customerRow()]) }),
      [`GET ${O}/staff`]: () => ({ body: STAFF }),
      [`POST ${O}/support-access-grants/1/end`]: () => ({
        body: supportGrant({ status: 'revoked' }),
      }),
    });
    renderWithProviders(<SupportGrantsPage />, { state: opsState(), route: '/ops/support/grants' });

    const table = await screen.findByRole('table', { name: 'Access grants' });
    expect(within(table).getByText('Authorized by Lorato Kgosi')).toBeInTheDocument();
    expect(within(table).getByRole('link', { name: 'SC-2026-0001' })).toHaveAttribute(
      'href',
      '/ops/support/cases/1',
    );
    expect(within(table).queryByText('Case 1')).not.toBeInTheDocument();
    await userEvent.click(within(table).getByRole('button', { name: 'End access' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/^Reason/), 'Case resolved.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'End access' }));

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
        reason: 'Case resolved.',
      }),
    );
  });
});

describe('SupportCasePage (OPS-04)', () => {
  function render(extra: Parameters<typeof installFetch>[0] = {}, detail = supportCase()) {
    const fetch = installFetch({
      [`GET ${O}/support-cases/1`]: () => ({ body: detail }),
      [`GET ${O}/staff`]: () => ({ body: STAFF }),
      [`GET ${O}/customers`]: () => ({
        body: pageOf([customerRow({ tenantId: 2, name: 'Kalahari Water Utilities (Pilot)' })]),
      }),
      ...extra,
    });
    renderWithProviders(<SupportCasePage />, {
      state: opsState(),
      route: '/ops/support/cases/1',
      path: '/ops/support/cases/:caseId',
    });
    return fetch;
  }

  it('shows the purpose, messages with internal notes marked, the grant and the activity history', async () => {
    render();

    expect(
      await screen.findAllByText(
        'Kabo sees the tender but the Technical section shows no criteria.',
      ),
    ).toHaveLength(2);
    expect(screen.getAllByText('Internal note').length).toBeGreaterThan(0);
    expect(screen.getByText('Access requested: metadata only, 14 days.')).toBeInTheDocument();
    expect(
      screen.getByText('Check the evaluator assignment metadata of T-2026-0003.'),
    ).toBeInTheDocument();
  });

  it('warns when a reply looks like a bid submission', async () => {
    render();
    const composer = await screen.findByLabelText('Message');

    await userEvent.type(composer, 'Please submit our bid for T-2026-0003.');

    expect(screen.getByText('Support is not a submission channel')).toBeInTheDocument();
  });

  it('explains that a procurement-merits case must be routed to the buyer', async () => {
    render(
      {
        [`POST ${O}/support-cases/1/status`]: () =>
          problem(409, 'Business dispute', { code: 'BUSINESS_DISPUTE_MUST_ROUTE' }),
      },
      supportCase({ category: 'procurement_merits' }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Update status' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText(/^New status/), 'resolved');
    await userEvent.type(within(dialog).getByLabelText(/^Resolution/), 'Deadline extended.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Update status' }));

    expect(
      await within(dialog).findByText(/Route it to the responsible buyer/),
    ).toBeInTheDocument();
  });

  it('refuses to name sealed records in an access request before sending it', async () => {
    const { requests } = render(
      {},
      supportCase({
        capabilities: { canRequestAccess: true, canRouteToBuyer: false, canResolve: true },
      }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Request access' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/^Business need/), 'Check the bid upload.');
    await userEvent.click(within(dialog).getByLabelText(/Specific records/));
    await userEvent.type(within(dialog).getByLabelText(/^Records/), 'bid:801');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send request' }));

    expect(
      await within(dialog).findByText('Sealed or scored records cannot be granted: bid:801'),
    ).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
  });

  it('hides case commands from an oversight-only operator', async () => {
    installFetch({
      [`GET ${O}/support-cases/1`]: () => ({ body: supportCase() }),
      [`GET ${O}/staff`]: () => ({ body: STAFF }),
    });
    renderWithProviders(<SupportCasePage />, {
      state: opsState(OPS_ALL.filter((code) => code !== 'ops.support.manage')),
      route: '/ops/support/cases/1',
      path: '/ops/support/cases/:caseId',
    });

    expect(
      await screen.findByRole('table', { name: 'Customer authorization and access' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update status' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Message')).not.toBeInTheDocument();
  });
});
