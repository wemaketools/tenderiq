import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ClientModule from '../../../api/client';

import { assignees, contractDetail, performance } from '../test/data';
import { callsTo, renderPage, routeCalls } from '../test/harness';
import PerformancePage from './PerformancePage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof ClientModule>()),
  call: vi.fn(),
}));

const OPTIONS = {
  route: '/buyer/contracts/1/performance',
  path: '/buyer/contracts/:contractId/performance',
} as const;

describe('PerformancePage (CON-07)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows measures, reviews with the supplier response, incidents, scorecard and corrective actions', async () => {
    routeCalls({
      'buyer.contracts.get': contractDetail(),
      'buyer.contracts.performance': performance(),
    });
    renderPage(<PerformancePage />, { ...OPTIONS, permissions: ['contract.view'] });

    expect(await screen.findByText('Fleet availability')).toBeInTheDocument();
    expect(
      screen.getByText('The May figures include vehicles held for parts.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Late return of a tipper truck.')).toBeInTheDocument();
    expect(screen.getByText('Parts buffer stock')).toBeInTheDocument();
    expect(screen.getAllByText('Latest rating').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Finalize' })).not.toBeInTheDocument();
  });

  it('finalizes a disputed review with a final rating and note', async () => {
    const calls = routeCalls({
      'buyer.contracts.get': contractDetail(),
      'buyer.contracts.performance': performance(),
      'buyer.contracts.assignees': assignees(),
      'buyer.contracts.finalizePerformanceReview': {
        ...performance().reviews[0],
        status: 'finalized',
        finalizedBy: { userId: 19, fullName: 'Masego Rakgosi' },
        finalizedAt: '2026-09-30T08:00:00Z',
      },
    });
    const user = userEvent.setup();
    renderPage(<PerformancePage />, {
      ...OPTIONS,
      permissions: ['contract.view', 'contract.manage'],
    });

    await user.click(await screen.findByRole('button', { name: 'Finalize' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/explain how the dispute was considered/)).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText(/Final overall rating/), 'meets');
    await user.type(
      within(dialog).getByLabelText(/Finalization note/),
      'Parts delays accepted as mitigation.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Finalize' }));

    expect(await screen.findByText(/Review .* finalized\./)).toBeInTheDocument();
    expect(callsTo(calls, 'buyer.contracts.finalizePerformanceReview')[0]?.request).toMatchObject({
      params: { contractId: 1, reviewId: 11 },
      body: { overallRating: 'meets', finalizationNote: 'Parts delays accepted as mitigation.' },
    });
  });

  it('validates a new incident before recording it', async () => {
    const calls = routeCalls({
      'buyer.contracts.get': contractDetail(),
      'buyer.contracts.performance': performance(),
      'buyer.contracts.assignees': assignees(),
    });
    const user = userEvent.setup();
    renderPage(<PerformancePage />, {
      ...OPTIONS,
      permissions: ['contract.view', 'contract.manage'],
    });

    await user.click(await screen.findByRole('button', { name: 'Record incident' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Record' }));
    expect(await within(dialog).findByText('Describe the incident.')).toBeInTheDocument();
    expect(callsTo(calls, 'buyer.contracts.recordIncident')).toHaveLength(0);
  });

  it('shows a disputed, unfinalized rating only as a proposal and renders each target once', async () => {
    const base = performance();
    routeCalls({
      'buyer.contracts.get': contractDetail(),
      'buyer.contracts.performance': performance({
        measures: base.measures.map((measure) => ({
          ...measure,
          target: '95% or more',
          unit: '%',
        })),
        scorecard: {
          ...base.scorecard,
          reviewsFinalized: 0,
          latestRating: null,
          latestProposedRating: {
            reviewId: 11,
            rating: 'partially_meets',
            reviewStatus: 'supplier_responded',
            supplierDisputes: true,
          },
        },
      }),
    });
    renderPage(<PerformancePage />, { ...OPTIONS, permissions: ['contract.view'] });

    expect(
      await screen.findByText('Proposed: Partially meets, not final (disputed by the supplier)'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Of the latest finalized review')).not.toBeInTheDocument();
    expect(screen.getAllByText('95% or more').length).toBeGreaterThan(0);
    expect(screen.queryByText('95% or more %')).not.toBeInTheDocument();
  });
});
