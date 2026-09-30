import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ClientModule from '../../../api/client';

import { closeout, contractDetail } from '../test/data';
import { businessError, callsTo, renderPage, routeCalls } from '../test/harness';
import CloseoutPage from './CloseoutPage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof ClientModule>()),
  call: vi.fn(),
}));

const OPTIONS = {
  route: '/buyer/contracts/4/closeout',
  path: '/buyer/contracts/:contractId/closeout',
} as const;

const bwpValue = (amount: string) => ({ amount, currency: 'BWP' });

const expired = contractDetail({ id: 4, reference: 'C-2025-0007', status: 'expired' });

describe('CloseoutPage (CON-11)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows reconciliation, checks and the surviving obligations tracked after closure', async () => {
    routeCalls({ 'buyer.contracts.get': expired, 'buyer.contracts.closeout': closeout() });
    renderPage(<CloseoutPage />, { ...OPTIONS, permissions: ['contract.view'] });

    expect(await screen.findByText('1 obligation survives closeout')).toBeInTheDocument();
    expect(screen.getByText('Meter warranty (12 months)')).toBeInTheDocument();
    expect(screen.getByText('BWP 40,000')).toBeInTheDocument();
    expect(screen.getByText('Final acceptance recorded')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close contract' })).not.toBeInTheDocument();
  });

  it('saves the closeout record without closing the contract', async () => {
    const calls = routeCalls({
      'buyer.contracts.get': expired,
      'buyer.contracts.closeout': closeout(),
      'buyer.contracts.saveCloseout': {
        contractId: 4,
        closeoutId: 2,
        status: 'in_progress',
        message: 'Closeout record saved; the contract is not closed.',
      },
    });
    const user = userEvent.setup();
    renderPage(<CloseoutPage />, { ...OPTIONS, permissions: ['contract.view', 'contract.manage'] });

    await user.type(
      await screen.findByLabelText('Lessons learned'),
      'Plan meter reading routes earlier.',
    );
    await user.click(screen.getByRole('button', { name: 'Save closeout record' }));

    expect(
      await screen.findByText('Closeout record saved (contract not closed)'),
    ).toBeInTheDocument();
    expect(callsTo(calls, 'buyer.contracts.saveCloseout')[0]?.request).toMatchObject({
      body: { lessonsLearned: 'Plan meter reading routes earlier.' },
    });
  });

  it('shows the blocking refusal when the contract cannot be closed yet', async () => {
    routeCalls({
      'buyer.contracts.get': expired,
      'buyer.contracts.closeout': closeout(),
      'buyer.contracts.closeContract': businessError('CLOSEOUT_BLOCKED'),
    });
    const user = userEvent.setup();
    renderPage(<CloseoutPage />, { ...OPTIONS, permissions: ['contract.view', 'contract.manage'] });

    await user.click(await screen.findByRole('button', { name: 'Close contract' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('checkbox'));
    await user.click(within(dialog).getByRole('button', { name: 'Close contract' }));
    expect(
      await within(dialog).findByText('Closeout is blocked. Resolve the blocking checks first.'),
    ).toBeInTheDocument();
  });

  it('separates invoiced-unpaid, disputed and not-yet-invoiced amounts in the reconciliation', async () => {
    const base = closeout();
    routeCalls({
      'buyer.contracts.get': expired,
      'buyer.contracts.closeout': closeout({
        reconciliation: {
          ...base.reconciliation,
          invoicedUnpaid: bwpValue('158450.00'),
          disputed: bwpValue('24600.00'),
          notYetInvoiced: bwpValue('1691950.00'),
        },
      }),
    });
    renderPage(<CloseoutPage />, { ...OPTIONS, permissions: ['contract.view'] });

    expect(
      await screen.findByText('Invoiced, not yet paid (excluding disputed)'),
    ).toBeInTheDocument();
    expect(screen.getByText('BWP 158,450')).toBeInTheDocument();
    expect(screen.getByText('Disputed invoices')).toBeInTheDocument();
    expect(
      screen.getByText('Contract value not yet invoiced (not an amount owed)'),
    ).toBeInTheDocument();
    expect(screen.getByText('BWP 1,691,950')).toBeInTheDocument();
    expect(screen.queryByText('Unpaid')).not.toBeInTheDocument();
  });
});
