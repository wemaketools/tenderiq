import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../../test/fetchMock';
import { renderWithProviders } from '../../../../test/render';
import { BUYER_ALL, buyerState, questionDetail } from '../../testData';
import QuestionPage from './QuestionPage';

const B = '/api/v1/buyer/clarifications';

function render(question = questionDetail(), extra: Parameters<typeof installFetch>[0] = {}) {
  const fetch = installFetch({
    [`GET ${B}/questions/${question.id}`]: () => ({ body: question }),
    [`GET ${B}/owner-candidates`]: () => ({
      body: [{ userId: 8, fullName: 'Neo Mothibi', capacity: 'Assessor', openQuestions: 0 }],
    }),
    [`GET ${B}/addenda`]: () => ({ body: { items: [], total: 0, page: 1, pageSize: 50 } }),
    ...extra,
  });
  renderWithProviders(<QuestionPage />, {
    state: buyerState(BUYER_ALL),
    route: `/buyer/clarifications/questions/${question.id}`,
    path: '/buyer/clarifications/questions/:questionId',
  });
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('QuestionPage (BUY-16)', () => {
  it('shows the question, the confidential supplier, the owner and the next required action', async () => {
    render();

    expect(
      await screen.findByText('Is an ISO 9001 certificate from our parent company acceptable?'),
    ).toBeInTheDocument();
    expect(screen.getByText('Gaborone Metering Co.')).toBeInTheDocument();
    expect(screen.getByText('Confidential')).toBeInTheDocument();
    expect(screen.getByText('Request the confidentiality review')).toBeInTheDocument();
    expect(screen.getByText('Draft saved · not published')).toBeInTheDocument();
  });

  it('saves the draft answer with the shared wording and audience', async () => {
    const { requests } = render(questionDetail(), {
      [`PUT ${B}/questions/204/answer`]: (request) => ({
        body: questionDetail({ answerText: (request.body as { answerText: string }).answerText }),
      }),
    });
    const answer = await screen.findByLabelText(/^Answer/);

    await userEvent.clear(answer);
    await userEvent.type(answer, 'Yes, with a scope letter.');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'PUT')?.body).toEqual({
        sanitizedQuestion: 'Is a parent company certificate acceptable?',
        answerText: 'Yes, with a scope letter.',
        audience: 'all_participants',
      }),
    );
    expect(await screen.findByText('Draft saved. It is not published.')).toBeInTheDocument();
  });

  it('asks for a late-question disposition before any other handling', async () => {
    const { requests } = render(
      questionDetail({ afterDeadline: true, status: 'received', owner: null }),
      {
        [`POST ${B}/questions/204/late-disposition`]: () => ({
          body: questionDetail({
            afterDeadline: true,
            lateDisposition: 'accepted',
            lateDispositionReason: 'Relevant to all bidders',
            status: 'received',
            owner: null,
          }),
        }),
      },
    );

    expect(await screen.findByText('Asked after the question deadline')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Assign owner' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Record late disposition' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Relevant to all bidders');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record disposition' }));

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
        lateDisposition: 'accepted',
        lateDispositionReason: 'Relevant to all bidders',
      }),
    );
    expect(await screen.findByRole('button', { name: 'Assign owner' })).toBeInTheDocument();
  });

  it('confirms the organization, scope and result before requesting the review', async () => {
    render(questionDetail(), {
      [`POST ${B}/questions/204/review-request`]: () => ({
        body: questionDetail({ status: 'in_review' }),
      }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Request review' }));
    const dialog = await screen.findByRole('dialog');
    const context = within(dialog).getByTestId('confirm-context');
    expect(context).toHaveTextContent('Kalahari Water Utilities (Pilot)');
    expect(context).toHaveTextContent('Question Q-204 on T-2026-0002');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Request review' }));
    expect(await screen.findByText('Sent to confidentiality review.')).toBeInTheDocument();
  });

  it('explains a business error code returned by the confidentiality review', async () => {
    render(questionDetail({ status: 'in_review' }), {
      [`POST ${B}/questions/204/confidentiality-review`]: () =>
        problem(409, 'Conflict', { code: 'SELF_REVIEW_NOT_ALLOWED', detail: 'raw detail' }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Confidentiality review' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record review' }));

    expect(
      await within(dialog).findByText(
        'The confidentiality review must be done by someone other than the owner.',
      ),
    ).toBeInTheDocument();
  });

  it('publishes a cleared answer to the chosen audience', async () => {
    const { requests } = render(
      questionDetail({
        status: 'in_review',
        confidentialityReviewedBy: { userId: 4, fullName: 'Mpho Dikgang' },
      }),
      {
        [`POST ${B}/questions/204/publish`]: () => ({
          body: questionDetail({
            status: 'published',
            publishedAt: '2026-10-01T09:00:00Z',
            responseDueAt: null,
            confidentialityReviewedBy: { userId: 4, fullName: 'Mpho Dikgang' },
          }),
        }),
      },
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Publish answer' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Publish answer' }));

    await waitFor(() =>
      expect(requests.find((request) => request.path.endsWith('/publish'))?.body).toEqual({
        audience: 'all_participants',
      }),
    );
    expect(await screen.findByText('Answer published', { selector: 'p' })).toBeInTheDocument();
  });

  it('shows not found for an invalid question id', () => {
    installFetch({});
    renderWithProviders(<QuestionPage />, {
      state: buyerState(BUYER_ALL),
      route: '/buyer/clarifications/questions/abc',
      path: '/buyer/clarifications/questions/:questionId',
    });
    expect(screen.getAllByText('Question not found').length).toBeGreaterThan(0);
  });
});
