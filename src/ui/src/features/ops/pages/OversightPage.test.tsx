import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { accessReview, conductCase, opsState, oversightSummary, pageOf } from '../testData';
import OversightPage from './OversightPage';

const O = '/api/v1/ops';

function render(extra: Parameters<typeof installFetch>[0] = {}) {
  const fetch = installFetch({
    [`GET ${O}/oversight`]: () => ({ body: oversightSummary() }),
    [`GET ${O}/privileged-access-reviews`]: () => ({ body: pageOf([accessReview()]) }),
    [`GET ${O}/conduct-cases`]: () => ({ body: pageOf([conductCase()]) }),
    ...extra,
  });
  renderWithProviders(<OversightPage />, { state: opsState(), route: '/ops/oversight' });
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OversightPage (OPS-06)', () => {
  it('shows aggregate usage counts only, with the confidentiality statement', async () => {
    render();

    expect(
      await screen.findByText(
        'Oversight shows counts only; never tender, bid or evaluation content.',
      ),
    ).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Aggregate usage' });
    expect(within(table).getByText('37')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Active support grants' })).toHaveTextContent('1');
  });

  it('explains that nobody can review their own privileged access', async () => {
    render({
      [`POST ${O}/privileged-access-reviews/1/complete`]: () =>
        problem(409, 'Self review', { code: 'SELF_REVIEW_BLOCKED' }),
    });
    await userEvent.click(await screen.findByRole('tab', { name: /Privileged-access reviews/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Complete review' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText('Retain access'));
    await userEvent.type(within(dialog).getByLabelText(/^Review note/), 'Grant use proportionate.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Complete review' }));

    expect(
      await within(dialog).findByText(/You cannot review your own privileged access/),
    ).toBeInTheDocument();
  });

  it('takes a service complaint under review', async () => {
    const { requests } = render({
      [`POST ${O}/conduct-cases/1/review`]: () => ({
        body: conductCase({ status: 'under_review' }),
      }),
    });
    await userEvent.click(
      await screen.findByRole('tab', { name: /Service complaints and misuse/ }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Review' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Review' }));

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
        status: 'under_review',
      }),
    );
  });

  it('shows the restricted state when oversight is forbidden', async () => {
    installFetch({
      [`GET ${O}/oversight`]: () => problem(403, 'Forbidden', { code: 'FORBIDDEN' }),
    });
    renderWithProviders(<OversightPage />, { state: opsState(), route: '/ops/oversight' });

    expect(await screen.findAllByText('Restricted', { exact: false })).not.toHaveLength(0);
  });
});
