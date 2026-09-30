import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { summaryRow } from '../testing/builders';
import { EVALUATOR, businessError, renderPage, routeCalls } from '../testing/kit';
import EvaluationsPage from './EvaluationsPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/buyer/evaluation', route: '/buyer/evaluation' };

function page(items = [summaryRow()]) {
  return { items, total: items.length, page: 1, pageSize: 25 };
}

describe('EvaluationsPage (evaluation entry)', () => {
  it('lists each evaluation with stage, role, chair, progress, gate and report status', async () => {
    routeCalls({ 'buyer.evaluation.list': () => page() });
    renderPage(<EvaluationsPage />, PATH);

    const row = await screen.findByRole('row', { name: /T-2026-0003 SCADA telemetry upgrade/ });
    expect(within(row).getByText('Ranking')).toBeInTheDocument();
    expect(within(row).getByText('Chair')).toBeInTheDocument();
    expect(within(row).getByText('Boitumelo Kgari')).toBeInTheDocument();
    expect(within(row).getByText('2 of 5')).toBeInTheDocument();
    expect(within(row).getByText('3 assessments incomplete')).toBeInTheDocument();
    expect(within(row).getByText('Prices released')).toBeInTheDocument();
    expect(within(row).getByText('2 overdue')).toBeInTheDocument();
    expect(screen.getByText('Conflicts awaiting review')).toBeInTheDocument();
  });

  it('sends the stage and overdue filters to the API', async () => {
    const calls = routeCalls({ 'buyer.evaluation.list': () => page() });
    renderPage(<EvaluationsPage />, PATH);
    await screen.findByRole('row', { name: /T-2026-0003/ });

    fireEvent.change(screen.getByLabelText('Stage'), { target: { value: 'moderation' } });
    fireEvent.click(screen.getByLabelText('Overdue work only'));

    await waitFor(() =>
      expect(calls.at(-1)?.request).toEqual({
        query: expect.objectContaining({ stage: ['moderation'], overdue: true, page: 1 }),
      }),
    );
  });

  it('opens the evaluation workspace when a row is chosen', async () => {
    routeCalls({ 'buyer.evaluation.list': () => page() });
    const { router } = renderPage(<EvaluationsPage />, PATH);
    fireEvent.click(await screen.findByText('SCADA telemetry upgrade'));
    expect(router.state.location.pathname).toBe('/buyer/evaluation/tenders/3');
  });

  it('explains an empty list to an evaluator without evaluations', async () => {
    routeCalls({ 'buyer.evaluation.list': () => page([]) });
    renderPage(<EvaluationsPage />, { ...PATH, persona: EVALUATOR });
    expect(await screen.findByText('No evaluations yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My assignments' })).toBeInTheDocument();
  });

  it('shows the restricted state when the API refuses access', async () => {
    routeCalls({
      'buyer.evaluation.list': () => {
        throw businessError('buyer.evaluation.list', 'FORBIDDEN', 403);
      },
    });
    renderPage(<EvaluationsPage />, PATH);
    expect((await screen.findAllByText('Restricted')).length).toBeGreaterThan(0);
  });
});
