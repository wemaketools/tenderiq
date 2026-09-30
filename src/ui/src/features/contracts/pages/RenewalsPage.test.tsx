import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ClientModule from '../../../api/client';

import { contractDetail, renewals } from '../test/data';
import { callsTo, renderPage, routeCalls } from '../test/harness';
import RenewalsPage from './RenewalsPage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof ClientModule>()),
  call: vi.fn(),
}));

const OPTIONS = {
  route: '/buyer/contracts/1/renewals',
  path: '/buyer/contracts/:contractId/renewals',
} as const;

describe('RenewalsPage (CON-10)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('states that nothing renews automatically and alerts on an open window without a decision (AC-32)', async () => {
    routeCalls({ 'buyer.contracts.get': contractDetail(), 'buyer.contracts.renewals': renewals() });
    renderPage(<RenewalsPage />, { ...OPTIONS, permissions: ['contract.view'] });

    expect(await screen.findByText('No automatic renewal')).toBeInTheDocument();
    expect(screen.getByText('1 notice window is open without a decision')).toBeInTheDocument();
    expect(screen.getByText(/Alerts go to: Tebogo Molefe, Masego Rakgosi/)).toBeInTheDocument();
    expect(screen.getByText('Window open')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Decide' })).not.toBeInTheDocument();
  });

  it('requires funding confirmation before a renewal is recorded', async () => {
    const calls = routeCalls({
      'buyer.contracts.get': contractDetail(),
      'buyer.contracts.renewals': renewals(),
    });
    const user = userEvent.setup();
    renderPage(<RenewalsPage />, {
      ...OPTIONS,
      permissions: ['contract.view', 'contract.renewal.decide'],
    });

    await user.click(await screen.findByRole('button', { name: 'Decide' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Business justification/), 'Good value.');
    await user.type(
      within(dialog).getByLabelText(/Performance basis/),
      'Meets targets since July.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Record decision' }));

    expect(
      await within(dialog).findByText('Confirm funding before renewing or extending (BR-36).'),
    ).toBeInTheDocument();
    expect(callsTo(calls, 'buyer.contracts.decideRenewal')).toHaveLength(0);
  });

  it('records an explicit decision to recompete without funding confirmation', async () => {
    const calls = routeCalls({
      'buyer.contracts.get': contractDetail(),
      'buyer.contracts.renewals': renewals(),
      'buyer.contracts.decideRenewal': {
        option: { ...renewals().options[0], status: 'under_review', decision: 'recompete' },
        approvalRequired: true,
        supplierConsentRequired: false,
        message: 'Decision recorded; renewal approval requested. Nothing is renewed automatically.',
      },
    });
    const user = userEvent.setup();
    renderPage(<RenewalsPage />, {
      ...OPTIONS,
      permissions: ['contract.view', 'contract.renewal.decide'],
    });

    await user.click(await screen.findByRole('button', { name: 'Decide' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByLabelText('Recompete'));
    await user.type(within(dialog).getByLabelText(/Business justification/), 'Market has changed.');
    await user.type(within(dialog).getByLabelText(/Performance basis/), 'Disputed reviews.');
    await user.click(within(dialog).getByRole('button', { name: 'Record decision' }));

    expect(
      await screen.findByText(/Decision recorded; renewal approval requested/),
    ).toBeInTheDocument();
    expect(callsTo(calls, 'buyer.contracts.decideRenewal')[0]?.request).toMatchObject({
      params: { contractId: 1, optionId: 21 },
      body: { decision: 'recompete', fundingConfirmed: false },
    });
  });

  it('labels an unfinalized rating as proposed, never as the performance basis', async () => {
    const base = renewals();
    routeCalls({
      'buyer.contracts.get': contractDetail(),
      'buyer.contracts.renewals': renewals({
        performance: {
          ...base.performance,
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
    renderPage(<RenewalsPage />, { ...OPTIONS, permissions: ['contract.view'] });

    expect(await screen.findByText('Proposed rating (not final)')).toBeInTheDocument();
    expect(
      screen.getByText('Proposed: Partially meets, not final (disputed by the supplier)'),
    ).toBeInTheDocument();
  });
});
