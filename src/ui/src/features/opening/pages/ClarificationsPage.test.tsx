import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { installFetch } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { clarification, clarificationRow, page, stateFor } from '../test/data';
import ClarificationsPage from './ClarificationsPage';

const DRAFTS = [
  clarificationRow(),
  clarificationRow({
    id: 4104,
    raisedBy: { userId: 12, fullName: 'Kabo Ntsima' },
    question: 'How long does the historian keep raw telemetry?',
  }),
];

describe('ClarificationsPage (EVA-03)', () => {
  it('tells an evaluator that only their own questions and distributed answers are shown', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/opening/clarifications': () => ({ body: page([DRAFTS[0]]) }),
    });
    renderWithProviders(<ClarificationsPage />, { state: stateFor(['evaluation.score'], 11) });

    expect(await screen.findByText('Your questions only')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Select all/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Raised by me'));
    expect(requests.some((request) => request.search.includes('raisedBy=11'))).toBe(true);
  });

  it('lets the chair merge selected duplicate drafts into one question', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/opening/clarifications': () => ({ body: page(DRAFTS) }),
      'POST /api/v1/buyer/opening/clarifications/4103/consolidate': () => ({
        body: clarification({ consolidatedCount: 1 }),
      }),
    });
    renderWithProviders(<ClarificationsPage />, { state: stateFor(['evaluation.chair'], 10) });

    const table = await screen.findByRole('table', { name: 'Bid clarifications' });
    await userEvent.click(within(table).getByLabelText('Select CL-4103'));
    await userEvent.click(within(table).getByLabelText('Select CL-4104'));
    await userEvent.click(screen.getByRole('button', { name: 'Merge duplicates' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Merge questions' }));

    expect(await screen.findByText('Merged 1 question into CL-4103.')).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      clarificationIds: [4104],
    });
  });
});
