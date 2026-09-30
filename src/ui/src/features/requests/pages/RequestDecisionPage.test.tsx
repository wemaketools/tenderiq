import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RequestDecisionView } from '@contracts/requests';

import { installFetch, problem } from '../../../test/fetchMock';
import { decision, options } from '../testing/data';
import { renderPage } from '../testing/render';
import RequestDecisionPage from './RequestDecisionPage';

const deciding: RequestDecisionView = {
  ...decision,
  allowedActions: ['decide', 'escalate', 'request_info', 'comment'],
};

const withinAuthority: RequestDecisionView = {
  ...deciding,
  callerAuthority:
    deciding.callerAuthority === null
      ? null
      : {
          ...deciding.callerAuthority,
          sufficient: true,
          limit: { amount: '10000000.00', currency: 'BWP' },
        },
  routedToNextLevel: false,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function render(view: RequestDecisionView, routes: Parameters<typeof installFetch>[0] = {}) {
  const fetch = installFetch({
    'GET /api/v1/buyer/requests/3/decision': () => ({ body: view }),
    'GET /api/v1/buyer/request-options': () => ({ body: options }),
    ...routes,
  });
  renderPage(<RequestDecisionPage />, {
    route: '/buyer/requests/3/decision',
    path: '/buyer/requests/:requestId/decision',
  });
  return fetch;
}

describe('RequestDecisionPage (BUY-04)', () => {
  it('names the higher approval route and disables approval when the value exceeds the authority (AC-05)', async () => {
    render(deciding);

    expect(await screen.findByText('Above your delegated authority')).toBeInTheDocument();
    expect(screen.getByText(/exceeds your limit of BWP 2,000,000/)).toBeInTheDocument();
    expect(screen.getByText(/Approval route: Keabetswe Nkwe/)).toBeInTheDocument();
    expect(
      screen.getByText(
        'Total contemplated commitment (options, renewals and associated purchases)',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/The approval value BWP 5,120,000/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Record decision' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('radio', { name: /^Approve(?! with)/ })).toBeDisabled();
    expect(within(dialog).getByRole('radio', { name: /Return for changes/ })).toBeChecked();
  });

  it('escalates to the higher authority after confirmation when the authority is insufficient', async () => {
    const { requests } = render(deciding, {
      'POST /api/v1/buyer/requests/3/decision/escalate': () => ({
        body: { ...deciding, allowedActions: ['comment'] },
      }),
    });

    await userEvent.click(
      await screen.findByRole('button', { name: 'Escalate to higher authority' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/routed to Keabetswe Nkwe/)).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Above my BWP 2M limit.');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Escalate to higher authority' }),
    );

    await waitFor(() =>
      expect(requests.find((item) => item.method === 'POST')?.body).toEqual({
        reason: 'Above my BWP 2M limit.',
      }),
    );
    expect(
      await screen.findByText('PR-2026-0003 was escalated to the higher authority.'),
    ).toBeInTheDocument();
  });

  it('approves the shown revision with conditions when the authority covers the value', async () => {
    const { requests } = render(withinAuthority, {
      'POST /api/v1/buyer/requests/3/decision': () => ({
        body: {
          ...withinAuthority,
          request: { ...withinAuthority.request, status: 'approved' },
          allowedActions: [],
        },
      }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Record decision' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('radio', { name: /Approve with conditions/ }));
    await userEvent.type(within(dialog).getByLabelText(/^Conditions/), 'Phase the works.');
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Within budget.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve with conditions' }));

    await waitFor(() =>
      expect(requests.find((item) => item.method === 'POST')?.body).toEqual({
        decision: 'approve_with_conditions',
        reason: 'Within budget.',
        conditions: 'Phase the works.',
        subjectRevision: 1,
      }),
    );
    expect(await screen.findByText('PR-2026-0003 approved with conditions.')).toBeInTheDocument();
  });

  it('explains AUTHORITY_EXCEEDED when the API refuses the decision', async () => {
    render(withinAuthority, {
      'POST /api/v1/buyer/requests/3/decision': () =>
        problem(403, 'Authority exceeded', { code: 'AUTHORITY_EXCEEDED' }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Record decision' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Approve.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));

    expect(await within(dialog).findByText(/exceeds your delegated authority/)).toBeInTheDocument();
  });

  it('shows the funding confirmation, review comments and decision history', async () => {
    render(deciding);

    expect(
      await screen.findByRole('heading', { name: 'Funding confirmation' }),
    ).toBeInTheDocument();
    expect(screen.getByText('CAPEX-2026/NET/PIPE-07')).toBeInTheDocument();
    expect(screen.getByText(/Scope and estimate reviewed/)).toBeInTheDocument();
    expect(screen.getByText('Escalated')).toBeInTheDocument();
  });
});
