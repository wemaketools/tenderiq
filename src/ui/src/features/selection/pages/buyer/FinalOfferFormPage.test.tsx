import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../../test/fetchMock';
import { page, processDecision, tenderRow, tenderSummary } from '../../testing/data';
import { OFFICER, renderSelection } from '../../testing/render';
import FinalOfferFormPage from './FinalOfferFormPage';

afterEach(() => vi.unstubAllGlobals());

const PATH = '/buyer/selection/final-offers/new';

describe('FinalOfferFormPage', () => {
  it('blocks a final-offer request where the conditions do not permit it and offers a process decision (AC-23)', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/selection/tenders': () => ({ body: page([tenderRow()]) }),
      'GET /api/v1/buyer/selection/tenders/9': () => ({ body: tenderSummary() }),
      'POST /api/v1/buyer/selection/process-decisions': () => ({
        status: 201,
        body: processDecision({ processDecisionId: 9001 }),
      }),
    });
    renderSelection(<FinalOfferFormPage />, {
      path: PATH,
      route: `${PATH}?tenderId=9`,
      permissions: OFFICER,
    });
    expect(await screen.findByText('Final offers are blocked')).toBeInTheDocument();
    expect(
      screen.getByText(/an ordinary clarification can never be used as a hidden negotiation round/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Propose process decision' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText(/^Decision/)).toHaveValue('reopen_round');
    fireEvent.change(within(dialog).getByLabelText(/Reason and procedural basis/), {
      target: { value: 'Authority for a final-offer round.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Propose decision' }));
    expect(await screen.findByText('Process decision proposed.')).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'POST')?.body).toMatchObject({
      decisionType: 'reopen_round',
    });
  });
});
