import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { installFetch } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { assessmentRequest, stateFor } from '../test/data';
import AssessmentRequestPage from './AssessmentRequestPage';

const PATH = '/supplier/assessment-requests/:requestId';
const ROUTE = '/supplier/assessment-requests/4109';

describe('AssessmentRequestPage (SUP-18, BR-22)', () => {
  it('requires the no-offer-change confirmation, then submits and shows the response as submitted', async () => {
    const { requests } = installFetch({
      'GET /api/v1/supplier/assessment-requests/4109': () => ({ body: assessmentRequest() }),
      'POST /api/v1/supplier/assessment-requests/4109/response': () => ({
        body: assessmentRequest({
          status: 'responded',
          responseText: 'The enclosure offered is IP65.',
          respondedAt: '2026-09-30T08:00:00Z',
          respondedBy: { userId: 31, fullName: 'Gorata Mphoeng' },
        }),
      }),
    });
    renderWithProviders(<AssessmentRequestPage />, {
      state: stateFor(['supplier.response.submit'], 31, 'supplier'),
      path: PATH,
      route: ROUTE,
    });

    expect(await screen.findByText('Not submitted yet')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Response/), 'The enclosure offered is IP65.');
    await userEvent.click(screen.getByRole('button', { name: 'Submit response' }));
    expect(
      await screen.findByText('Confirm that the response does not change your offer.'),
    ).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'POST')).toBe(false);

    await userEvent.click(screen.getByLabelText(/does not change my submitted offer/));
    await userEvent.click(screen.getByRole('button', { name: 'Submit response' }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('T-2026-0001 · Kalahari Water Utilities (Pilot)'),
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit response' }));

    expect(await screen.findByText('Submitted')).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      responseText: 'The enclosure offered is IP65.',
      attachments: [],
      offerUnchangedConfirmed: true,
    });
  });

  it.each([
    ['a bid manager or contributor without submission authority', ['supplier.response.edit'], 29],
    ['a capacity with read access only', ['supplier.outcomes.view'], 40],
  ] as const)('shows the request read-only to %s (AC-03)', async (_label, permissions, userId) => {
    installFetch({
      'GET /api/v1/supplier/assessment-requests/4109': () => ({ body: assessmentRequest() }),
    });
    renderWithProviders(<AssessmentRequestPage />, {
      state: stateFor([...permissions], userId, 'supplier'),
      path: PATH,
      route: ROUTE,
    });

    expect(await screen.findByText('Your capacity cannot respond')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit response' })).not.toBeInTheDocument();
  });
});
