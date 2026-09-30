import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../../test/fetchMock';
import { finalOfferDetail, page, processDecision } from '../../testing/data';
import { OFFICER, renderSelection } from '../../testing/render';
import FinalOfferPage from './FinalOfferPage';

afterEach(() => vi.unstubAllGlobals());

const PATH = '/buyer/selection/final-offers/:roundId';
const ROUTE = '/buyer/selection/final-offers/1';

describe('FinalOfferPage', () => {
  it('keeps the round blocked with every reason and the official deadline (AC-23)', async () => {
    installFetch({
      'GET /api/v1/buyer/selection/final-offer-rounds/1': () => ({ body: finalOfferDetail() }),
      'GET /api/v1/buyer/selection/process-decisions': () => ({
        body: page([
          processDecision(),
          processDecision({ processDecisionId: 3, status: 'rejected', decisionType: 'other' }),
        ]),
      }),
    });
    renderSelection(<FinalOfferPage />, { path: PATH, route: ROUTE, permissions: OFFICER });
    expect(await screen.findByText('Final offers are blocked')).toBeInTheDocument();
    expect(document.querySelector('[data-code="PROCESS_DECISION_REQUIRED"]')).not.toBeNull();
    expect(screen.queryByText(/PROCESS_DECISION_REQUIRED/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Issue round' })).toBeDisabled();
    expect(screen.getAllByText(/Africa\/Gaborone/).length).toBeGreaterThan(0);
    expect(await screen.findByText('Rejected', { selector: '.tiq-chip' })).toBeInTheDocument();
  });

  it('issues a permitted round after the acknowledgement', async () => {
    const open = finalOfferDetail({ issueGate: { allowed: true, blockers: [] } });
    const { requests } = installFetch({
      'GET /api/v1/buyer/selection/final-offer-rounds/1': () => ({ body: open }),
      'GET /api/v1/buyer/selection/process-decisions': () => ({ body: page([]) }),
      'POST /api/v1/buyer/selection/final-offer-rounds/1/issue': () => ({
        body: finalOfferDetail({ status: 'issued', issueGate: { allowed: true, blockers: [] } }),
      }),
    });
    renderSelection(<FinalOfferPage />, { path: PATH, route: ROUTE, permissions: OFFICER });
    fireEvent.click(await screen.findByRole('button', { name: 'Issue round' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Issue round' }));
    expect(await screen.findByText('Final-offer round issued.')).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      confirmed: true,
    });
  });
});
