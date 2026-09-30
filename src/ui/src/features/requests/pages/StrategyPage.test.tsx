import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { StrategyDetail, StrategyRow } from '@contracts/requests';

import { installFetch, problem } from '../../../test/fetchMock';
import { options, procOptions, strategy } from '../testing/data';
import { EMPTY_DOCUMENTS, renderPage } from '../testing/render';
import StrategiesPage from './StrategiesPage';
import StrategyPage from './StrategyPage';

const rfi: StrategyDetail = {
  ...strategy,
  id: 503,
  title: 'Leak-detection market consultation',
  eventType: 'rfi',
  procedure: 'rfi',
  status: 'approved',
  pendingFairnessReviews: 0,
  fairnessReviews: [],
  allowedActions: [],
  rfiOutcome: {
    rfiTender: {
      id: 4,
      reference: 'T-2026-0004',
      title: 'Leak-detection market consultation',
      status: 'information_collected',
    },
    findingsSummary: 'Acoustic logging is mature and available locally.',
    reviewedBy: { userId: 4, fullName: 'Mpho Dikgang' },
    reviewedAt: '2026-06-22T12:00:00Z',
    nextStepDecision: 'Proceed with a restricted RFP (T-2026-0009).',
    nextEvent: {
      id: 9,
      reference: 'T-2026-0009',
      title: 'Acoustic leak detection services',
      status: 'under_assessment',
    },
    participationNote: 'Taking part in the RFI creates no award entitlement.',
  },
};

function row(detail: StrategyDetail): StrategyRow {
  return {
    id: detail.id,
    title: detail.title,
    project: detail.project,
    request: detail.request,
    revision: detail.revision,
    eventType: detail.eventType,
    procedure: detail.procedure,
    awardModel: detail.awardModel,
    status: detail.status,
    owner: detail.owner,
    category: detail.category,
    estimatedValue: detail.estimatedValue,
    pendingFairnessReviews: detail.pendingFairnessReviews,
    tenders: detail.tenders,
    updatedAt: detail.updatedAt,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function render(detail: StrategyDetail, routes: Parameters<typeof installFetch>[0] = {}) {
  const fetch = installFetch({
    [`GET /api/v1/buyer/strategies/${detail.id}`]: () => ({ body: detail }),
    [`GET /api/v1/buyer/strategies/${detail.id}/procedure-options`]: () => ({
      body: { ...procOptions, strategyId: detail.id },
    }),
    'GET /api/v1/buyer/request-options': () => ({ body: options }),
    ...EMPTY_DOCUMENTS,
    ...routes,
  });
  renderPage(<StrategyPage />, {
    route: `/buyer/strategies/${detail.id}`,
    path: '/buyer/strategies/:strategyId',
  });
  return fetch;
}

describe('StrategiesPage (BUY-06 register)', () => {
  it('lists strategies with procedure, status and pending fairness reviews', async () => {
    const rows = [row(strategy), row(rfi)];
    installFetch({
      'GET /api/v1/buyer/strategies': () => ({
        body: { items: rows, total: 2, page: 1, pageSize: 25 },
      }),
    });
    renderPage(<StrategiesPage />, { route: '/buyer/strategies' });

    const table = await screen.findByRole('table', { name: 'Strategies' });
    expect(within(table).getByText('Leak-detection market consultation')).toBeInTheDocument();
    expect(within(table).getByText('1 fairness review pending')).toBeInTheDocument();
    expect(screen.getByText('Fairness reviews pending').closest('.tiq-kpi')).toHaveTextContent('1');
  });
});

describe('StrategyPage (BUY-06)', () => {
  it('shows the RFI findings and the separately identified next event without an award (AC-39)', async () => {
    render(rfi);

    expect(await screen.findByRole('heading', { name: 'RFI outcome' })).toBeInTheDocument();
    expect(
      screen.getByText('Acoustic logging is mature and available locally.'),
    ).toBeInTheDocument();
    expect(screen.getByText('T-2026-0009')).toBeInTheDocument();
    expect(screen.getByText('None: an information-only event makes no award')).toBeInTheDocument();
  });

  it('marks market research as an unverified estimate or a supplier commitment and compares procedures', async () => {
    render(strategy);

    const research = (await screen.findByRole('table', {
      name: 'Market research and consultations',
    })) as HTMLElement;
    expect(
      within(research).getAllByText(/Unverified estimate|Supplier commitment/).length,
    ).toBeGreaterThan(0);
    const compare = await screen.findByRole('table', { name: 'Compare approaches' });
    expect(within(compare).getByText('Selected')).toBeInTheDocument();
  });

  it('records a fairness review outcome after confirmation', async () => {
    const review = strategy.fairnessReviews[0];
    if (review === undefined) throw new Error('fixture has a pending review');
    const { requests } = render(strategy, {
      [`POST /api/v1/buyer/strategies/506/fairness-reviews/${review.id}/decision`]: () => ({
        body: {
          ...review,
          outcome: 'mitigated',
          note: 'Survey shared with all bidders.',
          decidedAt: '2026-09-30T08:00:00Z',
        },
      }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Decide' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(
      within(dialog).getByLabelText(/Review note/),
      'Survey shared with all bidders.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record outcome' }));

    await waitFor(() =>
      expect(requests.find((item) => item.method === 'POST')?.body).toEqual({
        outcome: 'mitigated',
        note: 'Survey shared with all bidders.',
      }),
    );
    expect(
      await screen.findByText(`Fairness review for ${review.supplier.name} decided.`),
    ).toBeInTheDocument();
  });

  it('requires the supplier before recording a supplier commitment', async () => {
    const { requests } = render(strategy);

    await userEvent.click(
      (await screen.findAllByRole('button', { name: 'Record research' }))[0] as HTMLElement,
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/^Source(?! type)/), 'Supplier day');
    await userEvent.type(within(dialog).getByLabelText(/^Finding/), 'Lead time of twelve weeks.');
    await userEvent.click(within(dialog).getByRole('radio', { name: /Supplier commitment/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record' }));

    expect(
      await within(dialog).findByText(
        'Name the supplier that gave the commitment or was involved.',
      ),
    ).toBeInTheDocument();
    expect(requests.some((item) => item.method === 'POST')).toBe(false);
  });

  it('explains FAIRNESS_REVIEW_PENDING when submission is refused', async () => {
    render(strategy, {
      'POST /api/v1/buyer/strategies/506/submit': () =>
        problem(409, 'Fairness review pending', { code: 'FAIRNESS_REVIEW_PENDING' }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Submit for approval' }));
    const dialog = await screen.findByRole('dialog');
    const ack = within(dialog).queryByRole('checkbox');
    if (ack !== null) await userEvent.click(ack);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit for approval' }));

    expect(
      await within(dialog).findByText('Decide the pending fairness reviews before submitting.'),
    ).toBeInTheDocument();
  });
});
