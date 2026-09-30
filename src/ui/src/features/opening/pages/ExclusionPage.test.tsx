import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { installFetch } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { exclusion, stateFor } from '../test/data';
import ExclusionPage from './ExclusionPage';

const PATH = '/buyer/compliance/exclusions/:exclusionId';
const ROUTE = '/buyer/compliance/exclusions/5101';

describe('ExclusionPage (BUY-21, AC-17)', () => {
  it('shows the grounds, cited evidence, challenge route and the pending effect on ranking', async () => {
    installFetch({ 'GET /api/v1/buyer/opening/exclusions/5101': () => ({ body: exclusion() }) });
    renderWithProviders(<ExclusionPage />, {
      state: stateFor(['compliance.assess']),
      path: PATH,
      route: ROUTE,
    });

    expect(
      await screen.findByText('Exclusion of Makgadikgadi Civil Works (Pty) Ltd'),
    ).toBeInTheDocument();
    expect(screen.getByText('Exclusion pending')).toBeInTheDocument();
    expect(screen.getByText(/Procurement Review Panel/)).toBeInTheDocument();
    const checks = screen.getByRole('table', { name: 'Failed checks cited' });
    expect(within(checks).getByText('ISO9001-Makgadikgadi.pdf')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Issue exclusion notice' }),
    ).not.toBeInTheDocument();
  });

  it('withdraws only with a reason and shows the returned state', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/opening/exclusions/5101': () => ({ body: exclusion() }),
      'POST /api/v1/buyer/opening/exclusions/5101/withdraw': () => ({
        body: exclusion({
          status: 'withdrawn',
          approvalStatus: 'withdrawn',
          withdrawnReason: 'Cured by clarification.',
        }),
      }),
    });
    renderWithProviders(<ExclusionPage />, {
      state: stateFor(['compliance.assess']),
      path: PATH,
      route: ROUTE,
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Withdraw exclusion' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Withdraw' });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Cured by clarification.');
    await userEvent.click(confirm);

    expect(await screen.findByText('Cured by clarification.')).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      reason: 'Cured by clarification.',
    });
  });

  it('offers the notice with the challenge route once the exclusion is approved', async () => {
    installFetch({
      'GET /api/v1/buyer/opening/exclusions/5101': () => ({
        body: exclusion({
          status: 'approved',
          approvalStatus: 'approved',
          approval: {
            approvalRequestId: 37,
            status: 'approved',
            decidedAt: '2026-10-01T08:00:00Z',
            decidedBy: { userId: 4, fullName: 'Mpho Dikgang' },
          },
        }),
      }),
    });
    renderWithProviders(<ExclusionPage />, {
      state: stateFor(['compliance.assess', 'notice.issue']),
      path: PATH,
      route: ROUTE,
    });

    expect(await screen.findByText('Excluded: not ranked')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Issue exclusion notice' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Procurement Review Panel/)).toBeInTheDocument();
  });
});
