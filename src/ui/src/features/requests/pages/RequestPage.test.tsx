import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RequestDetail } from '@contracts/requests';

import { installFetch, problem } from '../../../test/fetchMock';
import { request } from '../testing/data';
import { EMPTY_DOCUMENTS, OFFICER, renderPage } from '../testing/render';
import RequestPage from './RequestPage';

const draft: RequestDetail = {
  ...request,
  id: 7,
  reference: 'PR-2026-0007',
  status: 'draft',
  submittedAt: null,
  allowedActions: ['edit', 'submit', 'withdraw'],
  submissionReadiness: [
    {
      id: 'estimatedValue',
      label: 'Estimated value and currency',
      status: 'blocking',
      detail: 'Enter the estimate.',
    },
    { id: 'risks', label: 'Risks', status: 'warning', detail: null },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function render(detail: RequestDetail, routes: Parameters<typeof installFetch>[0] = {}) {
  const fetch = installFetch({
    [`GET /api/v1/buyer/requests/${detail.id}`]: () => ({ body: detail }),
    ...EMPTY_DOCUMENTS,
    ...routes,
  });
  renderPage(<RequestPage />, {
    route: `/buyer/requests/${detail.id}`,
    path: '/buyer/requests/:requestId',
    permissions: OFFICER,
  });
  return fetch;
}

describe('RequestPage (BUY-03)', () => {
  it('shows every business case section with the funding distinction when loaded', async () => {
    render(request);

    expect(
      await screen.findByRole('heading', { name: 'Northern wellfield pipeline extension' }),
    ).toBeInTheDocument();
    const need = screen.getByRole('heading', { name: 'Need' }).closest('section') as HTMLElement;
    expect(within(need).getByText('Problem or opportunity')).toBeInTheDocument();
    const scope = screen
      .getByRole('heading', { name: 'Scope and delivery' })
      .closest('section') as HTMLElement;
    expect(within(scope).getByText('Quantities or service volumes')).toBeInTheDocument();
    expect(within(scope).getByText('Delivery locations')).toBeInTheDocument();
    expect(within(scope).getByText('Stakeholders')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Supporting evidence' })).toBeInTheDocument();
    expect(
      screen.getByText(/Approved budget: the amount is in an approved budget line/),
    ).toBeInTheDocument();
    expect(screen.getByText('Submitted, not yet approved')).toBeInTheDocument();
    expect(screen.getByText(/Next action/)).toBeInTheDocument();
  });

  it('separates blocking items from warnings and submits the shown revision after confirmation', async () => {
    const { requests } = render(draft, {
      'POST /api/v1/buyer/requests/7/submit': () => ({ body: { ...draft, status: 'submitted' } }),
    });
    await screen.findByText('Saved draft, not submitted');
    expect(screen.getByText('1 blocking · 1 warnings')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Submit request' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Submit' })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('checkbox'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit' }));

    await waitFor(() =>
      expect(requests.find((item) => item.method === 'POST')?.body).toEqual({
        expectedRevision: 1,
      }),
    );
    expect(await screen.findByText('PR-2026-0007 submitted.')).toBeInTheDocument();
  });

  it('explains a business error code returned by the API when submission is refused', async () => {
    render(draft, {
      'POST /api/v1/buyer/requests/7/submit': () =>
        problem(422, 'Request incomplete', { code: 'REQUEST_INCOMPLETE', errors: [] }),
    });
    await screen.findByText('Saved draft, not submitted');

    await userEvent.click(screen.getByRole('button', { name: 'Submit request' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('checkbox'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit' }));

    expect(
      await within(dialog).findByText(
        'The business case has blocking items. Complete them before submitting.',
      ),
    ).toBeInTheDocument();
  });

  it('shows re-approval required when an approved request changed materially', async () => {
    render({
      ...request,
      reapprovalRequired: true,
      materialChange: {
        approvedRevision: 1,
        currentRevision: 2,
        changedFields: ['estimatedValue'],
        detectedAt: '2026-09-25T08:00:00Z',
        approvalInvalidated: true,
      },
    });

    expect(await screen.findByText('Re-approval required')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Revision 2 changes material fields approved in revision 1 \(Estimated value\)/,
      ),
    ).toBeInTheDocument();
  });

  it('links an approved request to tender creation from the request', async () => {
    render({
      ...request,
      status: 'approved',
      allowedActions: ['create_tender', 'create_strategy'],
      createTenderPath: '/buyer/tenders/new?fromRequest=3',
    });

    expect(await screen.findByRole('link', { name: 'Create tender' })).toHaveAttribute(
      'href',
      '/buyer/tenders/new?fromRequest=3',
    );
    expect(screen.getByRole('link', { name: 'Create strategy' })).toHaveAttribute(
      'href',
      '/buyer/strategies/new?requestId=3',
    );
  });

  it('withholds tender creation and links the strategy while the request’s strategy is still a draft', async () => {
    render({
      ...request,
      id: 5,
      reference: 'PR-2026-0005',
      status: 'approved',
      strategy: { id: 506, revision: 1, procedure: 'open', status: 'draft' },
      allowedActions: [],
      createTenderPath: null,
    });

    expect(await screen.findByRole('link', { name: 'Open the strategy' })).toHaveAttribute(
      'href',
      '/buyer/strategies/506',
    );
    expect(screen.queryByRole('link', { name: 'Create tender' })).not.toBeInTheDocument();
    expect(screen.getByText('Tender waits for the strategy approval')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Next action: Have the procurement strategy approved before creating the tender/,
      ),
    ).toBeInTheDocument();
  });

  it('shows an escalation as the last decision and the total commitment as the approval basis', async () => {
    render(request);

    expect(
      await screen.findByText(/Escalated by Mpho Dikgang on .* · Total commitment BWP 5,120,000/),
    ).toBeInTheDocument();
    expect(screen.getByText(/approved on its total contemplated commitment/)).toBeInTheDocument();
  });

  it('shows the not-found state when the request belongs to no visible record', async () => {
    installFetch({
      'GET /api/v1/buyer/requests/99': () => problem(404, 'Not Found', { code: 'NOT_FOUND' }),
    });
    renderPage(<RequestPage />, {
      route: '/buyer/requests/99',
      path: '/buyer/requests/:requestId',
    });

    expect(await screen.findByRole('heading', { name: 'Request' })).toBeInTheDocument();
    expect(
      await screen.findByText('This record does not exist or is not available to you.'),
    ).toBeInTheDocument();
  });
});
