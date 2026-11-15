import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { syncServerClock } from '../../../../lib/clock';

import { installFetch, problem } from '../../../../test/fetchMock';
import { renderWithProviders } from '../../../../test/render';
import { BUYER_ALL, buyerState, buyerTender, pageOf, questionDetail } from '../../testData';
import QuestionsPage from './QuestionsPage';

const B = '/api/v1/buyer/clarifications';

function routes(
  questions = [
    questionDetail(),
    questionDetail({
      id: 206,
      owner: null,
      status: 'received',
      afterDeadline: true,
      responseDueAt: { at: '2026-09-01T10:00:00Z', timeZone: 'Africa/Gaborone' },
    }),
  ],
) {
  return installFetch({
    [`GET ${B}/tenders`]: () => ({ body: pageOf([buyerTender()]) }),
    [`GET ${B}/owner-candidates`]: () => ({
      body: [
        { userId: 5, fullName: 'Tebogo Molefe', capacity: 'Procurement Officer', openQuestions: 2 },
      ],
    }),
    [`GET ${B}/questions`]: () => ({ body: pageOf(questions) }),
  });
}

function render() {
  return renderWithProviders(<QuestionsPage />, {
    state: buyerState(BUYER_ALL),
    route: '/buyer/clarifications/questions',
  });
}

beforeEach(() => {
  // The application clock at the session's server time, so "overdue" is judged on the fixtures' dates, not today's.
  syncServerClock('2026-09-29T08:00:00Z');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('QuestionsPage (BUY-16)', () => {
  it('labels a private reply as answered privately, never as published', async () => {
    routes([
      questionDetail({
        id: 203,
        status: 'answered_privately',
        audience: 'private',
        publishedAt: '2026-09-17T10:30:00Z',
        responseDueAt: null,
      }),
      questionDetail({
        id: 201,
        status: 'published',
        audience: 'public',
        publishedAt: '2026-09-18T12:00:00Z',
        responseDueAt: null,
      }),
    ]);
    render();

    const table = await screen.findByRole('table', { name: 'Question queue' });
    expect(await within(table).findByText(/^Answered privately /)).toBeInTheDocument();
    expect(within(table).getAllByText(/^Published /)).toHaveLength(1);
  });

  it('lists questions with category, supplier confidentiality, owner, response deadline and publication status', async () => {
    routes();
    render();

    const table = await screen.findByRole('table', { name: 'Question queue' });
    expect(await within(table).findByText('Q-204')).toBeInTheDocument();
    expect(within(table).getAllByText('Gaborone Metering Co.')).toHaveLength(2);
    expect(
      screen.getByText(
        'Supplier identities stay with the buyer team and are never shown in shared answers.',
      ),
    ).toBeInTheDocument();
    expect(within(table).getByText('Unassigned')).toBeInTheDocument();
    expect(within(table).getByText('Late · disposition needed')).toBeInTheDocument();
    expect(within(table).getAllByText('Not published')).toHaveLength(2);
    expect(within(table).getByText('Overdue')).toBeInTheDocument();
  });

  it('shows the workload KPIs from the tender overview', async () => {
    routes();
    render();

    expect(await screen.findByRole('region', { name: 'Open questions' })).toHaveTextContent('4');
    expect(screen.getByRole('region', { name: 'Late, disposition needed' })).toHaveTextContent('1');
  });

  it('sends the chosen status filter to the API', async () => {
    const { requests } = routes();
    render();
    await screen.findByText('Q-204');

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'in_review');

    await waitFor(() =>
      expect(
        requests.some(
          (request) =>
            request.path === `${B}/questions` && request.search.includes('status=in_review'),
        ),
      ).toBe(true),
    );
  });

  it('shows the official deadlines of the selected tender in the header', async () => {
    routes();
    render();
    await screen.findByText('Q-204');

    await userEvent.selectOptions(screen.getByLabelText('Tender'), '2');

    expect(await screen.findByText('Question deadline')).toBeInTheDocument();
    expect(screen.getAllByTestId('official-deadline').length).toBeGreaterThan(0);
  });

  it('explains when no question matches', async () => {
    routes([]);
    render();

    expect(await screen.findByText('No questions match these filters')).toBeInTheDocument();
  });

  it('shows the restricted state when the queue is forbidden', async () => {
    installFetch({
      [`GET ${B}/tenders`]: () => ({ body: pageOf([]) }),
      [`GET ${B}/owner-candidates`]: () => ({ body: [] }),
      [`GET ${B}/questions`]: () => problem(403, 'Forbidden', { code: 'FORBIDDEN' }),
    });
    render();

    expect(await screen.findByText('Restricted', { exact: false })).toBeInTheDocument();
  });
});
