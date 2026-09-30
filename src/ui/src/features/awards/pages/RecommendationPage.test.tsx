import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../test/fetchMock';
import { overview, recommendation } from '../test/data';
import { renderBuyer } from '../test/render';
import RecommendationPage from './RecommendationPage';

const OPTIONS = {
  route: '/buyer/awards/7/recommendations/14',
  path: '/buyer/awards/:tenderId/recommendations/:recommendationId',
};
const BASE = '/api/v1/buyer/award-recommendations/14';

afterEach(() => {
  vi.unstubAllGlobals();
});

function routes(detail = recommendation()) {
  return {
    'GET /api/v1/buyer/awards/7': () => ({ body: overview() }),
    [`GET ${BASE}`]: () => ({ body: detail }),
  };
}

describe('RecommendationPage (BUY-26)', () => {
  it('shows a saved draft as not submitted, with evaluation, funding and lot outcomes', async () => {
    installFetch(routes());
    renderBuyer(<RecommendationPage />, OPTIONS);

    expect(await screen.findByText('Saved draft — not submitted')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Final evaluation and commercial comparison' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Funding and affordability' })).toBeInTheDocument();
    expect(screen.getByText('83.60')).toBeInTheDocument();
  });

  it('submits the draft for approval and shows it as awaiting a decision', async () => {
    const { requests } = installFetch({
      ...routes(),
      [`POST ${BASE}/submit`]: () => ({ body: recommendation({ status: 'awaiting_approval' }) }),
    });
    renderBuyer(<RecommendationPage />, OPTIONS);

    await userEvent.click(await screen.findByRole('button', { name: 'Submit for approval' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit for approval' }));

    expect(
      await screen.findByText('Submitted — awaiting the approval decision'),
    ).toBeInTheDocument();
    expect(requests.some((request) => request.path.endsWith('/submit'))).toBe(true);
  });

  it('lets an approver return the recommendation with a required rationale', async () => {
    const { requests } = installFetch({
      ...routes(recommendation({ status: 'awaiting_approval' })),
      [`POST ${BASE}/decision`]: () => ({ body: recommendation({ status: 'returned' }) }),
    });
    renderBuyer(<RecommendationPage />, OPTIONS);

    await userEvent.click(await screen.findByRole('button', { name: 'Record decision' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('radio', { name: /Return for changes/ }));
    const confirm = within(dialog).getByRole('button', { name: 'Return for changes' });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/Rationale/), 'Explain the price gap.');
    await userEvent.click(confirm);

    expect(await screen.findByText('Returned for changes')).toBeInTheDocument();
    expect(requests.find((request) => request.path.endsWith('/decision'))?.body).toEqual({
      decision: 'return',
      rationale: 'Explain the price gap.',
    });
  });

  it('opens the editor and blocks saving a no-award lot without a reason', async () => {
    const { requests } = installFetch(routes());
    renderBuyer(<RecommendationPage />, OPTIONS);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit draft' }));
    await userEvent.selectOptions(screen.getByLabelText(/^Outcome/), 'no_award');
    await userEvent.clear(screen.getByLabelText(/^Reason/));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() =>
      expect(
        screen.getByText('Explain why the lot has no award or is cancelled.'),
      ).toBeInTheDocument(),
    );
    expect(requests.some((request) => request.method === 'PUT')).toBe(false);
  });
});
