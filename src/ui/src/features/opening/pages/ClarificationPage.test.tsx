import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { clarification, page, stateFor } from '../test/data';
import ClarificationPage from './ClarificationPage';

const PATH = '/buyer/bid-clarifications/:clarificationId';
const ROUTE = '/buyer/bid-clarifications/4103';

describe('ClarificationPage (EVA-03, BUY-21)', () => {
  it('shows the permitted scope and explains a self-approval refusal', async () => {
    installFetch({
      'GET /api/v1/buyer/opening/clarifications/4103': () => ({ body: clarification() }),
      'GET /api/v1/buyer/opening/clarifications': () => ({ body: page([]) }),
      'POST /api/v1/buyer/opening/clarifications/4103/approve': () =>
        problem(409, 'Conflict', { code: 'SELF_APPROVAL_NOT_PERMITTED', detail: 'Self.' }),
    });
    renderWithProviders(<ClarificationPage />, {
      state: stateFor(['evaluation.chair'], 10),
      path: PATH,
      route: ROUTE,
    });

    expect(await screen.findByText('Clarification CL-4103')).toBeInTheDocument();
    expect(screen.getAllByText(/Confirm the period already offered/).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Approve question' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve question' }));
    expect(
      await within(dialog).findByText('You cannot approve a question you raised.'),
    ).toBeInTheDocument();
  });

  it('records the effect of a response and distributes it to the affected assessors', async () => {
    const responded = clarification({
      status: 'responded',
      approvedBy: { userId: 10, fullName: 'Boitumelo Kgari' },
      responseText: 'The retention period offered is 24 months.',
      respondedBy: { userId: 25, fullName: 'Boago Moremi' },
      respondedAt: '2026-09-25T10:00:00Z',
    });
    const { requests } = installFetch({
      'GET /api/v1/buyer/opening/clarifications/4103': () => ({ body: responded }),
      'POST /api/v1/buyer/opening/clarifications/4103/effect': () => ({
        body: {
          ...responded,
          effect: 'resolved',
          effectNote: 'Matches the proposal.',
          distributedTo: [{ userId: 11, fullName: 'Thato Mokgosi' }],
        },
      }),
    });
    renderWithProviders(<ClarificationPage />, {
      state: stateFor(['compliance.assess', 'evaluation.chair'], 10),
      path: PATH,
      route: ROUTE,
    });

    expect(
      await screen.findByText('The retention period offered is 24 months.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Record effect' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Thato Mokgosi')).toBeChecked();
    await userEvent.type(within(dialog).getByLabelText(/Effect note/), 'Matches the proposal.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record effect' }));

    expect(await screen.findByText('Matches the proposal.')).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      effect: 'resolved',
      effectNote: 'Matches the proposal.',
      distributeToUserIds: [11],
    });
  });
});
