import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../../test/fetchMock';
import { page, processDecision, tenderSummary } from '../../testing/data';
import { AUDITOR, OFFICER, renderSelection } from '../../testing/render';
import TenderSelectionPage from './TenderSelectionPage';

afterEach(() => vi.unstubAllGlobals());

const PATH = '/buyer/selection/tenders/:tenderId';
const ROUTE = '/buyer/selection/tenders/9';

function routes() {
  return {
    'GET /api/v1/buyer/selection/tenders/9': () => ({ body: tenderSummary() }),
    'GET /api/v1/buyer/selection/process-decisions': () => ({ body: page([processDecision()]) }),
    'POST /api/v1/buyer/selection/process-decisions': () => ({
      status: 201,
      body: processDecision({ processDecisionId: 9001, decisionType: 'new_competition_required' }),
    }),
  };
}

describe('TenderSelectionPage', () => {
  it('explains every blocked gate in words, keeps reason codes out of the text and shows the issued conditions', async () => {
    installFetch(routes());
    renderSelection(<TenderSelectionPage />, { path: PATH, route: ROUTE });

    expect(await screen.findByText('Final offers are blocked')).toBeInTheDocument();
    expect(document.querySelector('[data-code="BAFO_NOT_PERMITTED"]')).not.toBeNull();
    expect(screen.queryByText(/BAFO_NOT_PERMITTED/)).not.toBeInTheDocument();
    expect(screen.getByText('The award is blocked')).toBeInTheDocument();
    expect(screen.getByText('Best and final offers').closest('div')).toHaveTextContent(
      'Not permitted',
    );
    expect(screen.getByText('Next: complete due diligence')).toBeInTheDocument();
    expect(await screen.findByText('Seek authority for a final-offer round.')).toBeInTheDocument();
  });

  it('records a proposed process decision after the confirmation dialog', async () => {
    const { requests } = installFetch(routes());
    renderSelection(<TenderSelectionPage />, { path: PATH, route: ROUTE, permissions: OFFICER });

    fireEvent.click(await screen.findByRole('button', { name: 'Propose process decision' }));
    fireEvent.change(screen.getByLabelText(/Decision/, { selector: 'select' }), {
      target: { value: 'new_competition_required' },
    });
    fireEvent.change(screen.getByLabelText(/Reason and procedural basis/), {
      target: { value: 'The conditions do not permit a final offer.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Propose decision' }));

    expect(await screen.findByText('Process decision proposed.')).toBeInTheDocument();
    const post = requests.find((request) => request.method === 'POST');
    expect(post?.body).toMatchObject({ tenderId: 9, decisionType: 'new_competition_required' });
  });

  it('hides the propose action for a read-only auditor', async () => {
    installFetch(routes());
    renderSelection(<TenderSelectionPage />, { path: PATH, route: ROUTE, permissions: AUDITOR });
    await screen.findByText('Final offers are blocked');
    expect(
      screen.queryByRole('button', { name: 'Propose process decision' }),
    ).not.toBeInTheDocument();
  });
});
