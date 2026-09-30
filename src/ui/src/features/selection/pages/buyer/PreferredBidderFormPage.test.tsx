import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../../test/fetchMock';
import { page, preferredDetail, tenderRow, tenderSummary } from '../../testing/data';
import { renderSelection } from '../../testing/render';
import PreferredBidderFormPage from './PreferredBidderFormPage';

afterEach(() => vi.unstubAllGlobals());

const PATH = '/buyer/selection/preferred-bidders/new';

function fill(): void {
  fireEvent.change(screen.getByLabelText(/Preferred candidate/), { target: { value: '907' } });
  fireEvent.change(screen.getByLabelText(/Proposed value/), { target: { value: '2780000' } });
  fireEvent.change(screen.getByLabelText(/^Scope/), {
    target: { value: 'Surveys for 36 months.' },
  });
  fireEvent.change(screen.getByLabelText(/Comparative rationale/), {
    target: { value: 'Highest total.' },
  });
  fireEvent.change(screen.getByLabelText(/Remaining checks/), {
    target: { value: 'Financial position.' },
  });
  fireEvent.change(screen.getByLabelText(/Authorized negotiation topics/), {
    target: { value: 'Service credits\nData ownership' },
  });
  fireEvent.change(screen.getByLabelText(/Decision owner/), { target: { value: '4' } });
  fireEvent.change(screen.getByLabelText(/^Contingency/), {
    target: { value: 'Approach rank two.' },
  });
  fireEvent.change(screen.getByLabelText(/Fallback candidate/), { target: { value: '908' } });
}

describe('PreferredBidderFormPage', () => {
  it('states that preferred status is conditional and recommends with contingency and fallback', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/selection/tenders': () => ({ body: page([tenderRow()]) }),
      'GET /api/v1/buyer/selection/tenders/9': () => ({ body: tenderSummary() }),
      'POST /api/v1/buyer/selection/preferred-bidders': () => ({
        status: 201,
        body: preferredDetail({ preferredBidderId: 9001, status: 'proposed' }),
      }),
    });
    const { router } = renderSelection(<PreferredBidderFormPage />, {
      path: PATH,
      route: `${PATH}?tenderId=9`,
    });
    expect(screen.getByText('Preferred status is conditional')).toBeInTheDocument();
    await screen.findByRole('table', { name: 'Comparison' });
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Save recommendation' }));
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe('/buyer/selection/preferred-bidders/9001'),
    );
    expect(requests.find((request) => request.method === 'POST')?.body).toMatchObject({
      bidId: 907,
      fallbackBidId: 908,
      negotiationTopics: ['Service credits', 'Data ownership'],
      decisionOwnerUserId: 4,
    });
  });

  it('explains an existing active preferred bidder refusal', async () => {
    installFetch({
      'GET /api/v1/buyer/selection/tenders': () => ({ body: page([tenderRow()]) }),
      'GET /api/v1/buyer/selection/tenders/9': () => ({ body: tenderSummary() }),
      'POST /api/v1/buyer/selection/preferred-bidders': () =>
        problem(409, 'Conflict', { code: 'PREFERRED_BIDDER_ACTIVE' }),
    });
    renderSelection(<PreferredBidderFormPage />, { path: PATH, route: `${PATH}?tenderId=9` });
    await screen.findByRole('table', { name: 'Comparison' });
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Save recommendation' }));
    expect(
      await screen.findByText('An active preferred bidder already exists for this tender and lot.'),
    ).toBeInTheDocument();
  });
});
