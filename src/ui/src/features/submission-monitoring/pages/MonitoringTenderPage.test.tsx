import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import {
  apiError,
  buyerState,
  monitoringDetail,
  monitoringReceipts,
  routeCalls,
} from '../../responses/test/data';
import MonitoringTenderPage from './MonitoringTenderPage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  call: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const renderPage = (
  permissions: Parameters<typeof buyerState>[0] = ['bid.monitor', 'tender.close'],
) =>
  renderWithProviders(<MonitoringTenderPage />, {
    state: buyerState(permissions),
    route: '/buyer/submissions/2',
    path: '/buyer/submissions/:tenderId',
  });

describe('MonitoringTenderPage (BUY-19)', () => {
  it('shows receipt metadata only, the unique supplier count and the service incident', async () => {
    // Arrange
    const calls = routeCalls({
      'buyer.submissions.get': () => monitoringDetail(),
      'buyer.submissions.receipts': () => monitoringReceipts(),
    });

    // Act
    renderPage();

    // Assert
    expect(await screen.findByText('Sealed until opening')).toBeInTheDocument();
    const receipts = await screen.findByRole('table', { name: 'Receipts' });
    expect(
      await within(receipts).findByText('Gaborone Metering Co. (Pty) Ltd'),
    ).toBeInTheDocument();
    expect(screen.getByText('Upload service degradation · Resolved')).toBeInTheDocument();
    expect(screen.getByText(/^High severity · /)).toBeInTheDocument();
    expect(screen.queryByText(/^high · /)).not.toBeInTheDocument();
    expect(calls.every((entry) => entry.id.startsWith('buyer.submissions.'))).toBe(true);
    const receiptQuery = calls.find((entry) => entry.id === 'buyer.submissions.receipts');
    expect((receiptQuery?.request.query as Record<string, unknown>).effectiveOnly).toBe(true);
  });

  it('explains why submissions cannot be closed before the deadline and offers no close action', async () => {
    // Arrange
    routeCalls({
      'buyer.submissions.get': () => monitoringDetail(),
      'buyer.submissions.receipts': () => monitoringReceipts(),
    });

    // Act
    renderPage();

    // Assert
    expect(
      await screen.findByText('The official deadline has not been reached.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close submissions' })).not.toBeInTheDocument();
  });

  it('closes submissions after confirming the context and shows the closing record', async () => {
    // Arrange
    const user = userEvent.setup();
    const detail = monitoringDetail({
      closingStatus: 'deadline_passed',
      canClose: true,
      closeBlockers: [],
    });
    const calls = routeCalls({
      'buyer.submissions.get': () => detail,
      'buyer.submissions.receipts': () => monitoringReceipts(),
      'buyer.submissions.close': () => ({
        tenderId: 2,
        reference: 'T-2026-0002',
        status: 'closed',
        closingStatus: 'closed',
        closedAt: '2026-10-21T10:05:00Z',
        closedBy: { userId: 5, fullName: 'Tebogo Molefe', capacity: 'Procurement Officer' },
        deadline: detail.deadline,
        effectiveSupplierCount: 2,
        lateAttemptCount: 0,
        note: null,
      }),
    });
    renderPage();

    // Act
    await user.click(await screen.findByRole('button', { name: 'Close submissions' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('confirm-context')).toHaveTextContent('Procurement Officer');
    await user.click(
      within(dialog).getByRole('checkbox', { name: /official deadline has passed/ }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Close submissions' }));

    // Assert
    expect(await screen.findByText('Submissions closed for T-2026-0002')).toBeInTheDocument();
    expect(screen.queryByText('Deadline passed, closing not recorded')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close submissions' })).not.toBeInTheDocument();
    const close = calls.find((entry) => entry.id === 'buyer.submissions.close');
    expect(close?.request.body).toEqual({
      confirmation: { tenantId: 2, capacity: 'Procurement Officer' },
    });
  });

  it('offers closing for a tender whose submissions stopped at the deadline and shows late attempts to the second', async () => {
    // Arrange
    const deadline = { at: '2026-09-25T08:00:00Z', timeZone: 'Africa/Gaborone' };
    routeCalls({
      'buyer.submissions.get': () =>
        monitoringDetail({
          tenderId: 8,
          reference: 'T-2026-0008',
          status: 'closed',
          closingStatus: 'deadline_passed',
          closedAt: null,
          deadline,
          canClose: true,
          closeBlockers: [],
          lateAttempts: [
            {
              attemptId: 9,
              supplierTenantId: 5,
              supplierLegalName: 'Chobe Pipe Supplies (Pty) Ltd',
              completedAt: '2026-09-25T08:00:38Z',
              deadlineAtAttempt: deadline,
              lateBySeconds: 38,
              exceptionDecision: null,
            },
          ],
        }),
      'buyer.submissions.receipts': () => monitoringReceipts(),
    });

    // Act
    renderPage();

    // Assert
    expect(await screen.findByText('Deadline passed, closing not recorded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close submissions' })).toBeInTheDocument();
    const late = screen.getByRole('table', { name: 'Late attempts' });
    expect(within(late).getByText('25 Sep 2026, 10:00:38 (UTC+02:00)')).toBeInTheDocument();
    expect(within(late).getByText('38 s after the deadline')).toBeInTheDocument();
  });

  it('shows the business reason when closing is refused', async () => {
    // Arrange
    const user = userEvent.setup();
    routeCalls({
      'buyer.submissions.get': () =>
        monitoringDetail({ closingStatus: 'deadline_passed', canClose: true, closeBlockers: [] }),
      'buyer.submissions.receipts': () => monitoringReceipts(),
      'buyer.submissions.close': () => apiError(409, 'UNRESOLVED_SERVICE_INCIDENT'),
    });
    renderPage();

    // Act
    await user.click(await screen.findByRole('button', { name: 'Close submissions' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('checkbox', { name: /official deadline has passed/ }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Close submissions' }));

    // Assert
    expect(
      await within(dialog).findByText(
        'A service incident is unresolved. Record an accountable decision before closing.',
      ),
    ).toBeInTheDocument();
  });

  it('shows a monitor without closing authority no close action and no role notice', async () => {
    // Arrange
    routeCalls({
      'buyer.submissions.get': () =>
        monitoringDetail({ closingStatus: 'deadline_passed', canClose: true, closeBlockers: [] }),
      'buyer.submissions.receipts': () => monitoringReceipts(),
    });

    // Act
    renderPage(['bid.monitor']);

    // Assert
    expect(await screen.findAllByTestId('official-deadline')).not.toHaveLength(0);
    expect(screen.queryByText(/authority to close/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close submissions' })).not.toBeInTheDocument();
  });
});
