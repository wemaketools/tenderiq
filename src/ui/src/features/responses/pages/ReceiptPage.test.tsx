import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadBlob } from '../../../lib/download';
import { renderWithProviders } from '../../../test/render';
import { BID_MANAGER, receipt, routeCalls, supplierState } from '../test/data';
import ReceiptPage from './ReceiptPage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  call: vi.fn(),
}));
vi.mock('../../../lib/download', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  downloadBlob: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const renderPage = (permissions = BID_MANAGER) =>
  renderWithProviders(<ReceiptPage />, {
    state: supplierState(permissions),
    route: '/supplier/receipts/44',
    path: '/supplier/receipts/:receiptId',
  });

describe('ReceiptPage (FR-12 receipt)', () => {
  it('shows the official receipt time, inventory and that a receipt is not a compliance decision', async () => {
    // Arrange
    routeCalls({ 'supplier.receipts.get': () => receipt() });

    // Act
    renderPage();

    // Assert
    expect(await screen.findByText('Receipt details')).toBeInTheDocument();
    expect(screen.getAllByText(/does not confirm compliance/).length).toBeGreaterThan(0);
    const inventory = screen.getByRole('table', { name: 'Submitted documents' });
    expect(within(inventory).getByText('technical-proposal.pdf')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Response history' })).toHaveAttribute(
      'href',
      '/supplier/responses/14/receipts',
    );
  });

  it('shows a late-rejected receipt with its true time to the second, how late it was and why (AC-13)', async () => {
    // Arrange
    const deadline = { at: '2026-09-25T08:00:00Z', timeZone: 'Africa/Gaborone' };
    routeCalls({
      'supplier.receipts.get': () =>
        receipt({
          status: 'late_rejected',
          isEffective: false,
          receivedAt: '2026-09-25T08:00:38Z',
          deadline,
          lateRejection: {
            attemptId: 9,
            deadlineAtAttempt: deadline,
            lateBySeconds: 38,
            reason: 'Completed after the official deadline.',
          },
        }),
    });

    // Act
    renderPage();

    // Assert
    expect(
      await screen.findByText('Rejected as late: received 38 s after the deadline'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /completed on 25 Sep 2026, 10:00:38 \(UTC\+02:00\) Africa\/Gaborone, 38 seconds after the deadline of 25 Sep 2026, 10:00:00/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Recorded reason: Completed after the official deadline.'),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('25 Sep 2026, 10:00:38 (UTC+02:00) Africa/Gaborone').length,
    ).toBeGreaterThan(0);
  });

  it('shows no lateness on a receipt received on time', async () => {
    // Arrange
    routeCalls({ 'supplier.receipts.get': () => receipt() });

    // Act
    renderPage();

    // Assert
    expect(await screen.findByText('Receipt details')).toBeInTheDocument();
    expect(screen.queryByText(/Rejected as late/)).not.toBeInTheDocument();
  });

  it('downloads the printable receipt through the receipts client', async () => {
    // Arrange
    const user = userEvent.setup();
    routeCalls({
      'supplier.receipts.get': () => receipt(),
      'supplier.receipts.download': () => ({
        fileName: 'RCPT-2026-000044.txt',
        contentType: 'text/plain',
        content: 'Official receipt RCPT-2026-000044',
      }),
    });
    renderPage();

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Download receipt RCPT-2026-000044' }),
    );

    // Assert
    await vi.waitFor(() =>
      expect(vi.mocked(downloadBlob)).toHaveBeenCalledWith(
        expect.any(Blob),
        'RCPT-2026-000044.txt',
      ),
    );
  });

  it('hides the response workspace link from a supplier administrator without response access', async () => {
    // Arrange
    routeCalls({ 'supplier.receipts.get': () => receipt() });

    // Act
    renderPage(['supplier.outcomes.view']);

    // Assert
    expect(await screen.findByText('Receipt details')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Response history' })).not.toBeInTheDocument();
  });
});
