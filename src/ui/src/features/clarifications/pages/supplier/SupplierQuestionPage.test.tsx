import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../../test/fetchMock';
import { renderWithProviders } from '../../../../test/render';
import { SUPPLIER_ALL, supplierQuestion, supplierState } from '../../testData';
import SupplierQuestionPage from './SupplierQuestionPage';

const S = '/api/v1/supplier/clarifications';

function render(question = supplierQuestion(), extra: Parameters<typeof installFetch>[0] = {}) {
  const fetch = installFetch({
    [`GET ${S}/questions/${question.id}`]: () => ({ body: question }),
    ...extra,
  });
  renderWithProviders(<SupplierQuestionPage />, {
    state: supplierState(SUPPLIER_ALL),
    route: `/supplier/clarifications/questions/${question.id}`,
    path: '/supplier/clarifications/questions/:questionId',
  });
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SupplierQuestionPage (SUP-10)', () => {
  it('shows an unanswered question as awaiting the buyer', async () => {
    render();
    expect(await screen.findByText('Can meters be delivered in two batches?')).toBeInTheDocument();
    expect(screen.getByText('Awaiting the buyer’s reply', { selector: 'p' })).toBeInTheDocument();
  });

  it('shows the published reply with the wording it was shared under', async () => {
    render(
      supplierQuestion({
        status: 'published',
        answerAudience: 'all_participants',
        answerText: 'Yes, in two batches.',
        sanitizedQuestion: 'Are split deliveries allowed?',
        answeredAt: '2026-10-01T09:00:00Z',
      }),
    );
    expect(await screen.findByText('Yes, in two batches.')).toBeInTheDocument();
    expect(screen.getByText('Are split deliveries allowed?')).toBeInTheDocument();
    expect(screen.getByText('Shared with all participants')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Withdraw question' })).not.toBeInTheDocument();
  });

  it('shows the buyer’s late-question decision', async () => {
    render(
      supplierQuestion({
        afterDeadline: true,
        lateDisposition: 'declined',
        lateDispositionReason: 'Received after the deadline.',
        status: 'declined',
      }),
    );
    expect(await screen.findByText('Late question declined by the buyer')).toBeInTheDocument();
    expect(screen.getByText('Received after the deadline.')).toBeInTheDocument();
  });

  it('withdraws an open question after confirmation', async () => {
    const { requests } = render(supplierQuestion(), {
      [`POST ${S}/questions/206/withdraw`]: () => ({
        body: supplierQuestion({ status: 'withdrawn' }),
      }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Withdraw question' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Withdraw question' }));

    await waitFor(() => expect(requests.some((request) => request.method === 'POST')).toBe(true));
    expect(await screen.findByText('Question withdrawn.')).toBeInTheDocument();
  });
});
