import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import {
  SIGNATORY_PERMISSIONS,
  attempt,
  bidDetail,
  receiptSummary,
  revision,
  routeCalls,
  supplierState,
  withdrawal,
} from '../test/data';
import ResponseHistoryPage from './ResponseHistoryPage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  call: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const page = <T,>(items: T[]) => ({ items, total: items.length, page: 1, pageSize: 100 });
const signatoryViewer = {
  canEditResponse: false,
  canViewPricing: true,
  canEditPricing: false,
  canAssign: false,
  canComment: true,
  canApprove: true,
  canSubmit: true,
};

const renderPage = () =>
  renderWithProviders(<ResponseHistoryPage />, {
    state: supplierState(SIGNATORY_PERMISSIONS, 27),
    route: '/supplier/responses/14/receipts',
    path: '/supplier/responses/:bidId/receipts',
  });

describe('ResponseHistoryPage (SUP-17)', () => {
  it('explains that a failed replacement left the earlier receipt effective (AC-12)', async () => {
    // Arrange
    const effective = receiptSummary();
    const failed = attempt();
    routeCalls({
      'supplier.bids.get': () =>
        bidDetail({
          submissionState: 'submitted',
          effectiveReceipt: effective,
          workingRevision: { id: 1402, revisionNo: 2, status: 'submission_failed' },
          effectiveOffer: {
            explanation: 'replacement_failed_earlier_effective',
            receipt: effective,
            lastUnsuccessfulAttempt: failed,
            withdrawal: null,
          },
        }),
      'supplier.bids.receipts': () => page([effective]),
      'supplier.bids.revisions': () =>
        page([
          revision({ id: 1402, revisionNo: 2, status: 'submission_failed', isWorking: true }),
          revision({
            status: 'submitted',
            isEffective: true,
            isWorking: false,
            receiptNo: 'RCPT-2026-000021',
          }),
        ]),
      'supplier.bids.attempts': () => page([failed]),
      'supplier.bids.withdrawals': () => page([]),
    });

    // Act
    renderPage();

    // Assert
    expect(
      await screen.findByText(
        'Effective offer: RCPT-2026-000021 (replacement failed)',
        {},
        { timeout: 4000 },
      ),
    ).toBeInTheDocument();
    const attempts = await screen.findByRole(
      'table',
      { name: 'Submission attempts' },
      { timeout: 4000 },
    );
    expect(await within(attempts).findByText('Failed (service error)')).toBeInTheDocument();
    expect(within(attempts).getByText('No receipt')).toBeInTheDocument();
  });

  it('withdraws explicitly after a reason and acknowledgement and shows the confirmation number (AC-14)', async () => {
    // Arrange
    const user = userEvent.setup();
    const effective = receiptSummary();
    const calls = routeCalls({
      'supplier.bids.get': () =>
        bidDetail({
          submissionState: 'submitted',
          effectiveReceipt: effective,
          workingRevision: null,
          viewer: signatoryViewer,
          effectiveOffer: {
            explanation: 'effective_receipt',
            receipt: effective,
            lastUnsuccessfulAttempt: null,
            withdrawal: null,
          },
        }),
      'supplier.bids.receipts': () => page([effective]),
      'supplier.bids.revisions': () =>
        page([revision({ status: 'submitted', isEffective: true, isWorking: false })]),
      'supplier.bids.attempts': () => page([]),
      'supplier.bids.withdrawals': () => page([]),
      'supplier.bids.withdraw': () => ({
        withdrawal: withdrawal(),
        receipt: receiptSummary({ status: 'withdrawn', isEffective: false }),
        submissionState: 'withdrawn',
      }),
    });
    renderPage();

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Withdraw response' }, { timeout: 4000 }),
    );
    const dialog = await screen.findByRole('dialog');
    await user.type(
      within(dialog).getByLabelText(/Reason for withdrawal/),
      'Capacity committed elsewhere',
    );
    await user.click(
      within(dialog).getByRole('checkbox', { name: /understand the effect of withdrawal/ }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Withdraw' }));

    // Assert
    expect(await screen.findByText('Withdrawn: confirmation WDR-2026-000002')).toBeInTheDocument();
    const withdraw = calls.find((entry) => entry.id === 'supplier.bids.withdraw');
    expect(withdraw?.request.body).toEqual({
      receiptId: 21,
      reason: 'Capacity committed elsewhere',
      confirmation: { tenantId: 4, capacity: 'Bid Manager' },
      effectUnderstood: true,
    });
  });

  it('shows only the withdrawn state after a withdrawal: nothing still reads as effective (AC-14)', async () => {
    // Arrange
    const user = userEvent.setup();
    const effective = receiptSummary();
    routeCalls({
      'supplier.bids.get': () =>
        bidDetail({
          submissionState: 'submitted',
          effectiveReceipt: effective,
          workingRevision: { id: 1402, revisionNo: 2, status: 'draft' },
          viewer: signatoryViewer,
          effectiveOffer: {
            explanation: 'replacement_in_preparation',
            receipt: effective,
            lastUnsuccessfulAttempt: null,
            withdrawal: null,
          },
        }),
      'supplier.bids.receipts': () => page([effective]),
      'supplier.bids.revisions': () =>
        page([
          revision({ id: 1402, revisionNo: 2, status: 'draft', isWorking: true }),
          revision({ status: 'submitted', isEffective: true, isWorking: false }),
        ]),
      'supplier.bids.attempts': () => page([]),
      'supplier.bids.withdrawals': () => page([]),
      'supplier.bids.withdraw': () => ({
        withdrawal: withdrawal(),
        receipt: receiptSummary({ status: 'withdrawn', isEffective: false }),
        submissionState: 'withdrawn',
      }),
    });
    renderPage();
    expect(await screen.findByText(/stays effective/, {}, { timeout: 4000 })).toBeInTheDocument();

    // Act
    await user.click(await screen.findByRole('button', { name: 'Withdraw response' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Reason for withdrawal/), 'Capacity committed');
    await user.click(
      within(dialog).getByRole('checkbox', { name: /understand the effect of withdrawal/ }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Withdraw' }));

    // Assert
    expect(await screen.findByText('Withdrawn: confirmation WDR-2026-000002')).toBeInTheDocument();
    expect(screen.queryByText(/stays effective/)).not.toBeInTheDocument();
    expect(screen.queryByText('Effective')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Effective offer/)).not.toBeInTheDocument();
    expect(screen.getByText('Withdrawn (WDR-2026-000002)')).toBeInTheDocument();
    expect(screen.getByText('No receipt is effective')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'None: the response was withdrawn' }),
    ).toBeInTheDocument();
    const withdrawals = screen.getByRole('table', { name: 'Withdrawals' });
    expect(within(withdrawals).getByText('WDR-2026-000002')).toBeInTheDocument();
    const receipts = screen.getByRole('table', { name: 'Official receipts' });
    expect(within(receipts).getByText('Withdrawn')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Withdraw response' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Prepare replacement' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Submit (authorized signatory)' }),
    ).not.toBeInTheDocument();
  });

  it('keeps an earlier withdrawal in the history with its confirmation number', async () => {
    // Arrange
    routeCalls({
      'supplier.bids.get': () =>
        bidDetail({
          submissionState: 'withdrawn',
          workingRevision: null,
          submissionWindowOpen: false,
          effectiveOffer: {
            explanation: 'withdrawn',
            receipt: null,
            lastUnsuccessfulAttempt: null,
            withdrawal: withdrawal({ confirmationNo: 'WDR-2026-000001' }),
          },
        }),
      'supplier.bids.receipts': () =>
        page([receiptSummary({ status: 'withdrawn', isEffective: false })]),
      'supplier.bids.revisions': () => page([revision({ status: 'withdrawn', isWorking: false })]),
      'supplier.bids.attempts': () => page([]),
      'supplier.bids.withdrawals': () => page([withdrawal({ confirmationNo: 'WDR-2026-000001' })]),
    });

    // Act
    renderPage();

    // Assert
    const table = await screen.findByRole('table', { name: 'Withdrawals' }, { timeout: 4000 });
    expect(await within(table).findByText('WDR-2026-000001')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Withdraw response' })).not.toBeInTheDocument();
    expect(screen.getByText('Submissions are closed')).toBeInTheDocument();
  });
});
