import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../test/fetchMock';
import { registerPage, registerRow } from '../test/data';
import { renderBuyer } from '../test/render';
import AwardRegisterPage from './AwardRegisterPage';
import CloseoutRegisterPage from './CloseoutRegisterPage';

const LIST = 'GET /api/v1/buyer/awards';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AwardRegisterPage (BUY-26)', () => {
  it('lists award files with lot progress, standstill deadline, holds and the next step', async () => {
    installFetch({ [LIST]: () => ({ body: registerPage() }) });
    renderBuyer(<AwardRegisterPage />, { route: '/buyer/awards', path: '/buyer/awards' });

    expect((await screen.findAllByText('T-2026-0007')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Resolve complaint').length).toBeGreaterThan(0);
    expect(screen.getByText('1 hold')).toBeInTheDocument();
    expect(screen.getAllByTestId('official-deadline').length).toBeGreaterThan(0);
  });

  it('labels a draft or pending value as recommended and never as awarded or decided (BR-31)', async () => {
    const draft = registerRow({
      tender: {
        ...registerRow().tender,
        tenderId: 3,
        reference: 'T-2026-0003',
        status: 'under_assessment',
      },
      lotsWithOutcome: 0,
      lotsWithProposedOutcome: 1,
      latestRecommendation: { recommendationId: 13, version: 1, status: 'draft' },
      value: {
        basis: 'recommended',
        total: { amount: '120000.00', currency: 'BWP' },
        finalAwardedTotal: { amount: '0.00', currency: 'BWP' },
      },
      standstillStatus: null,
      standstillEndsAt: null,
    });
    installFetch({ [LIST]: () => ({ body: registerPage([draft, registerRow()]) }) });
    renderBuyer(<AwardRegisterPage />, { route: '/buyer/awards', path: '/buyer/awards' });

    expect(await screen.findByText('1/1 with a proposed outcome')).toBeInTheDocument();
    expect(screen.getByText('Recommended value (not an award)')).toBeInTheDocument();
    expect(screen.getByText('Intended award (not final)')).toBeInTheDocument();
    expect(screen.getByText('1/1 decided')).toBeInTheDocument();
    expect(screen.queryByText('Awarded total')).not.toBeInTheDocument();
  });

  it('sends the chosen tender status filter to the API', async () => {
    const { requests } = installFetch({ [LIST]: () => ({ body: registerPage() }) });
    renderBuyer(<AwardRegisterPage />, { route: '/buyer/awards', path: '/buyer/awards' });
    await screen.findAllByText('T-2026-0007');

    await userEvent.selectOptions(screen.getByLabelText('Tender status'), 'awarded');

    await waitFor(() =>
      expect(requests.some((request) => request.search.includes('status=awarded'))).toBe(true),
    );
  });

  it('shows the empty state when no tender is at the award stage', async () => {
    installFetch({ [LIST]: () => ({ body: { items: [], total: 0, page: 1, pageSize: 25 } }) });
    renderBuyer(<AwardRegisterPage />, { route: '/buyer/awards', path: '/buyer/awards' });
    expect(await screen.findByText('No tender has reached the award stage')).toBeInTheDocument();
  });
});

describe('CloseoutRegisterPage (BUY-30)', () => {
  it('asks the API only for files whose next step is closing or archiving', async () => {
    const { requests } = installFetch({ [LIST]: () => ({ body: registerPage() }) });
    renderBuyer(<CloseoutRegisterPage />, { route: '/buyer/closeout', path: '/buyer/closeout' });

    expect(await screen.findByRole('heading', { name: 'Event closeout' })).toBeInTheDocument();
    await waitFor(() =>
      expect(requests.some((request) => request.search.includes('nextStep=close_event'))).toBe(
        true,
      ),
    );
    expect((await screen.findAllByText('In progress')).length).toBeGreaterThan(0);
  });
});
