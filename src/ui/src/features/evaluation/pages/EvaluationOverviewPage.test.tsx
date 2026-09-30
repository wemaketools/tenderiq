import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { overview } from '../testing/builders';
import { CHAIR, EVALUATOR, OFFICER, businessError, renderPage, routeCalls } from '../testing/kit';
import EvaluationOverviewPage from './EvaluationOverviewPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/buyer/evaluation/tenders/:tenderId', route: '/buyer/evaluation/tenders/3' };

describe('EvaluationOverviewPage (evaluation workspace)', () => {
  it('shows the record context, plan, committee, bids and timeline', async () => {
    routeCalls({ 'buyer.evaluation.get': () => overview() });
    renderPage(<EvaluationOverviewPage />, { ...PATH, persona: CHAIR });

    expect(await screen.findByRole('link', { name: 'T-2026-0003' })).toHaveAttribute(
      'href',
      '/buyer/tenders/3',
    );
    expect(screen.getByText('Kalahari Water Utilities (Pilot)')).toBeInTheDocument();
    expect(
      screen.getByText('Validate the ranking and submit the report for sign-off.'),
    ).toBeInTheDocument();

    const committee = screen.getByRole('table', { name: 'Committee' });
    const amantle = within(committee).getByRole('row', { name: 'Amantle Segwai' });
    expect(within(amantle).getByText('1 not scored')).toBeInTheDocument();

    expect(screen.getByRole('table', { name: 'Criteria and weights' })).toBeInTheDocument();
    expect(screen.getByText('C1 Solution quality')).toBeInTheDocument();
    expect(screen.getByText('Submission deadline passed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Commercial comparison' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Moderation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ranking and report' })).toBeInTheDocument();
  });

  it('opens a committee member’s assignment for the chair', async () => {
    routeCalls({ 'buyer.evaluation.get': () => overview() });
    const { router } = renderPage(<EvaluationOverviewPage />, { ...PATH, persona: CHAIR });
    fireEvent.click(await screen.findByText('Thato Mokgosi'));
    expect(router.state.location.pathname).toBe('/buyer/evaluation/assignments/3001');
  });

  it('offers the award team only the overview and the results tabs', async () => {
    routeCalls({ 'buyer.evaluation.get': () => overview() });
    renderPage(<EvaluationOverviewPage />, { ...PATH, persona: OFFICER });
    expect(await screen.findByRole('link', { name: 'Ranking and report' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Moderation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Commercial comparison' })).not.toBeInTheDocument();
  });

  it('says so when the evaluation is not visible to the caller', async () => {
    routeCalls({
      'buyer.evaluation.get': () => {
        throw businessError('buyer.evaluation.get', 'NOT_FOUND', 404);
      },
    });
    renderPage(<EvaluationOverviewPage />, { ...PATH, persona: CHAIR });
    expect(
      await screen.findByText('This evaluation does not exist or you are not part of it.'),
    ).toBeInTheDocument();
  });

  it('shows the caller’s own next action and none for an observer', async () => {
    routeCalls({
      'buyer.evaluation.get': () => ({
        ...overview(),
        myRole: 'evaluator',
        myNextAction: 'score_assessment',
      }),
    });
    const { unmount } = renderPage(<EvaluationOverviewPage />, { ...PATH, persona: EVALUATOR });

    expect(await screen.findByText('Score every cell of your assessment.')).toBeInTheDocument();
    expect(
      screen.queryByText('Validate the ranking and submit the report for sign-off.'),
    ).not.toBeInTheDocument();
    unmount();

    routeCalls({
      'buyer.evaluation.get': () => ({ ...overview(), myRole: 'observer', myNextAction: 'none' }),
    });
    renderPage(<EvaluationOverviewPage />, { ...PATH, persona: OFFICER });
    expect(await screen.findByText('Chair: Boitumelo Kgari')).toBeInTheDocument();
    expect(screen.queryByText('Next action:')).not.toBeInTheDocument();
  });
});
