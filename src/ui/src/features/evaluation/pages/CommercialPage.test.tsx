import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { closedCommercial, commercial, overview } from '../testing/builders';
import { CHAIR, COMMERCIAL, businessError, renderPage, routeCalls } from '../testing/kit';
import CommercialPage from './CommercialPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/buyer/evaluation/tenders/:tenderId/commercial',
  route: '/buyer/evaluation/tenders/3/commercial',
};

describe('CommercialPage (EVA-04)', () => {
  it('shows submitted, corrected and evaluated cost with the FX basis and affordability apart from rank', async () => {
    routeCalls({
      'buyer.evaluation.commercial.get': () => commercial(),
      'buyer.evaluation.get': () => overview(),
    });
    renderPage(<CommercialPage />, { ...PATH, persona: COMMERCIAL });

    const table = await screen.findByRole('table', { name: 'Offers on the issued basis' });
    const a = within(table).getByRole('row', { name: 'Supplier A (Serowe ICT Solutions)' });
    expect(within(a).getByText('BWP 99,550.00')).toBeInTheDocument();
    expect(within(a).getByText('BWP 450.00')).toBeInTheDocument();
    expect(within(a).getAllByText('BWP 100,000.00').length).toBeGreaterThan(0);
    expect(within(a).getByText('30.00')).toBeInTheDocument();

    const b = within(table).getByRole('row', { name: 'Supplier B (Tsodilo Engineering)' });
    expect(within(b).getByText('ZAR 160,000.00')).toBeInTheDocument();
    expect(within(b).getByText('Corrected: ZAR 160,000.00')).toBeInTheDocument();
    expect(within(b).getByText('ZAR → BWP at 0.75')).toBeInTheDocument();
    expect(within(b).getByText('BWP 120,000.00')).toBeInTheDocument();
    expect(within(b).getByText('25.00')).toBeInTheDocument();
    expect(within(b).getByText('Exceeds budget')).toBeInTheDocument();
    expect(screen.getByText('Supplier B exceeds the budget')).toBeInTheDocument();
  });

  it('withholds every price while the price gate is closed (AC-16)', async () => {
    routeCalls({
      'buyer.evaluation.commercial.get': () => closedCommercial(),
      'buyer.evaluation.get': () => overview(),
    });
    renderPage(<CommercialPage />, { ...PATH, persona: CHAIR });
    expect(await screen.findByText('Prices are unavailable')).toBeInTheDocument();
    expect(
      screen.queryByRole('table', { name: 'Offers on the issued basis' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Release price gate' })).toBeInTheDocument();
  });

  it('lets the chair release the price gate and shows the refusal while moderation is open', async () => {
    routeCalls({
      'buyer.evaluation.commercial.get': () => closedCommercial(),
      'buyer.evaluation.get': () => overview(),
      'buyer.evaluation.priceGate.release': () => {
        throw businessError('buyer.evaluation.priceGate.release', 'NON_PRICE_MODERATION_OPEN');
      },
    });
    renderPage(<CommercialPage />, { ...PATH, persona: CHAIR });
    fireEvent.click(await screen.findByRole('button', { name: 'Release price gate' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(
      within(dialog).getByLabelText(/non-price assessment and moderation are complete/),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Release price gate' }));
    expect(
      await within(dialog).findByText(
        'Finalize the non-price moderation before releasing the price gate.',
      ),
    ).toBeInTheDocument();
  });

  it('approves the comparison on the issued basis after confirming the assumptions', async () => {
    const calls = routeCalls({
      'buyer.evaluation.commercial.get': () => commercial(),
      'buyer.evaluation.get': () => overview(),
      'buyer.evaluation.commercial.approve': () =>
        commercial({
          status: 'approved',
          approvedAt: '2026-09-30T09:00:00Z',
          approvedBy: { userId: 14, fullName: 'Refilwe Motsumi' },
        }),
    });
    renderPage(<CommercialPage />, { ...PATH, persona: COMMERCIAL });
    fireEvent.click(await screen.findByRole('button', { name: 'Approve comparison' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByLabelText(/I confirm the comparison basis/));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve comparison' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Approve comparison' })).not.toBeInTheDocument(),
    );
    expect(
      calls.find((item) => item.id === 'buyer.evaluation.commercial.approve')?.request,
    ).toEqual({
      params: { tenderId: 3 },
      body: { assumptionsConfirmed: true },
    });
  });

  it('runs a private scenario that never changes the official scores', async () => {
    const calls = routeCalls({
      'buyer.evaluation.commercial.get': () => commercial(),
      'buyer.evaluation.get': () => overview(),
      'buyer.evaluation.commercial.scenario': () => ({
        label: 'ZAR at 0.70',
        official: false,
        generatedAt: '2026-09-30T09:00:00Z',
        basisNote: 'Private sensitivity scenario; official scores are unchanged.',
        rows: [
          {
            bidId: 3002,
            label: 'Supplier B',
            evaluatedCost: { amount: '112000.00', currency: 'BWP' },
            priceScore: '26.7857',
            nonPriceScore: '63.0000',
            totalScore: '89.7857',
            rank: 1,
            officialRank: 1,
          },
        ],
        excludedBidIds: [],
      }),
    });
    renderPage(<CommercialPage />, { ...PATH, persona: COMMERCIAL });
    fireEvent.click(await screen.findByRole('button', { name: 'Private scenario' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Scenario name/), {
      target: { value: 'ZAR at 0.70' },
    });
    fireEvent.change(within(dialog).getByLabelText('ZAR → BWP rate'), {
      target: { value: '0.70' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Run scenario' }));

    expect(
      await within(dialog).findByText('Private scenario: official scores are unchanged'),
    ).toBeInTheDocument();
    expect(calls.at(-1)?.request).toMatchObject({
      params: { tenderId: 3 },
      body: { label: 'ZAR at 0.70', fxRateOverrides: [{ fromCurrency: 'ZAR', rate: '0.70' }] },
    });
  });

  it('shows who proposed a correction and never lets the proposer approve it', async () => {
    const base = commercial();
    const [first, ...rest] = base.rows;
    if (first === undefined) throw new Error('fixture');
    routeCalls({
      'buyer.evaluation.commercial.get': () =>
        commercial({
          rows: [
            {
              ...first,
              correctionStatus: 'pending_approval',
              correctionApprovedBy: null,
              correctionProposedBy: { userId: 14, fullName: 'Refilwe Motsumi' },
              correctionProposedAt: '2026-09-29T08:00:00Z',
            },
            ...rest,
          ],
        }),
      'buyer.evaluation.get': () => overview(),
    });
    renderPage(<CommercialPage />, { ...PATH, persona: COMMERCIAL });

    expect(await screen.findByText('Correction proposed by')).toBeInTheDocument();
    expect(screen.getByText(/^Refilwe Motsumi · 29 Sep 2026/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Supplier A' }));
    expect(await screen.findByRole('menuitem', { name: 'Approve correction' })).toBeDisabled();
    expect(
      screen.getByText('You proposed this correction: another commercial reviewer approves it.'),
    ).toBeInTheDocument();
  });
});
