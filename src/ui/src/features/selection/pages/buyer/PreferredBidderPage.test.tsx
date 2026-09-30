import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../../test/fetchMock';
import { preferredDetail, processDecision } from '../../testing/data';
import { AUDITOR, OFFICER, renderSelection } from '../../testing/render';
import PreferredBidderPage from './PreferredBidderPage';

afterEach(() => vi.unstubAllGlobals());

const PATH = '/buyer/selection/preferred-bidders/:preferredBidderId';
const ROUTE = '/buyer/selection/preferred-bidders/1';

describe('PreferredBidderPage', () => {
  it('blocks the award after failed diligence and records the fallback decision (AC-24)', async () => {
    const recorded = preferredDetail({
      fallbackGate: {
        allowed: false,
        blockers: [
          { code: 'FALLBACK_ALREADY_RECORDED', message: 'Fallback decision 9001 is recorded.' },
        ],
      },
      processDecisions: [
        processDecision({ processDecisionId: 9001, decisionType: 'fallback_to_next_bidder' }),
      ],
    });
    const { requests } = installFetch({
      'GET /api/v1/buyer/selection/preferred-bidders/1': () => ({ body: preferredDetail() }),
      'POST /api/v1/buyer/selection/preferred-bidders/1/fallback': () => ({
        status: 201,
        body: { processDecision: recorded.processDecisions[0], preferredBidder: recorded },
      }),
    });
    renderSelection(<PreferredBidderPage />, { path: PATH, route: ROUTE, permissions: OFFICER });

    expect(await screen.findByText('The award is blocked')).toBeInTheDocument();
    expect(screen.getByText('A fallback decision is required')).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Record fallback decision' })[0] as HTMLElement,
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Reason/), {
      target: { value: 'Failed financial diligence.' },
    });
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record fallback' }));

    expect(
      await screen.findByText('The fallback decision is recorded (see the process decisions)'),
    ).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      reason: 'Failed financial diligence.',
      fallbackBidId: 908,
      contingencyFollowed: true,
    });
  });

  it('shows the conditional recommendation read-only to an auditor', async () => {
    installFetch({
      'GET /api/v1/buyer/selection/preferred-bidders/1': () => ({
        body: preferredDetail({
          status: 'approved',
          statusReason: null,
          fallbackGate: { allowed: false, blockers: [] },
        }),
      }),
    });
    renderSelection(<PreferredBidderPage />, { path: PATH, route: ROUTE, permissions: AUDITOR });
    expect(await screen.findByText('Preferred status is conditional')).toBeInTheDocument();
    expect(screen.getByText('Mobilisation schedule')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Withdraw preferred status' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Record fallback decision' }),
    ).not.toBeInTheDocument();
  });
});
