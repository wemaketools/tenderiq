import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import {
  CONTRIBUTOR,
  HASH,
  SIGNATORY_PERMISSIONS,
  apiError,
  attempt,
  bidDetail,
  readiness,
  receipt,
  receiptSummary,
  routeCalls,
  submissionPreview,
  supplierState,
} from '../test/data';
import SubmitPage from './SubmitPage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  call: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const renderPage = (permissions = SIGNATORY_PERMISSIONS) =>
  renderWithProviders(<SubmitPage />, {
    state: supplierState(permissions, 27),
    route: '/supplier/responses/14/submit',
    path: '/supplier/responses/:bidId/submit',
  });

const attempts = { items: [], total: 0, page: 1, pageSize: 5 };

describe('SubmitPage (SUP-16)', () => {
  it('tells a contributor why they cannot submit and who can, without a submit action (AC-03)', async () => {
    // Arrange
    routeCalls({
      'supplier.bids.get': () => bidDetail(),
      'supplier.bids.submissionPreview': () =>
        submissionPreview({
          authority: {
            canSubmit: false,
            blockReasons: ['SUBMIT_PERMISSION_MISSING'],
            authorizedSubmitters: [{ userId: 27, fullName: 'Motsamai Tsodilo' }],
          },
        }),
      'supplier.bids.attempts': () => attempts,
    });

    // Act
    renderPage(CONTRIBUTOR);

    // Assert
    expect(await screen.findByText('You cannot submit this response')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your capacity in this organization does not include authority to submit responses.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('People who can submit: Motsamai Tsodilo.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit response' })).not.toBeInTheDocument();
  });

  it('never names a contributor as the authorized representative in the declaration (FR-11)', async () => {
    // Arrange
    routeCalls({
      'supplier.bids.get': () => bidDetail(),
      'supplier.bids.submissionPreview': () =>
        submissionPreview({
          representative: null,
          authority: {
            canSubmit: false,
            blockReasons: ['SUBMIT_PERMISSION_MISSING'],
            authorizedSubmitters: [{ userId: 27, fullName: 'Motsamai Tsodilo' }],
          },
        }),
      'supplier.bids.attempts': () => attempts,
    });

    // Act
    renderPage(CONTRIBUTOR);

    // Assert
    expect(
      await screen.findByText('Not you: one of the authorized submitters (Motsamai Tsodilo)'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/represented by one of its authorized submitters \(Motsamai Tsodilo\)/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Ditiro|Technical Contributor/)).not.toBeInTheDocument();
  });

  it('never presents internally approved work as submitted (AC-11)', async () => {
    // Arrange
    routeCalls({
      'supplier.bids.get': () =>
        bidDetail({ workingRevision: { id: 1401, revisionNo: 1, status: 'approved_internally' } }),
      'supplier.bids.submissionPreview': () => submissionPreview(),
      'supplier.bids.attempts': () => attempts,
    });

    // Act
    renderPage();

    // Assert
    expect(await screen.findByText('Not submitted yet')).toBeInTheDocument();
    expect(screen.getByText('Nothing has been submitted')).toBeInTheDocument();
    expect(screen.getAllByText('Not submitted').length).toBeGreaterThan(0);
  });

  it('submits after confirming the context and reports the official receipt through a live region', async () => {
    // Arrange
    const user = userEvent.setup();
    const calls = routeCalls({
      'supplier.bids.get': () => bidDetail(),
      'supplier.bids.submissionPreview': () => submissionPreview(),
      'supplier.bids.attempts': () => attempts,
      'supplier.bids.submit': () => ({
        attempt: attempt({
          outcome: 'succeeded',
          failureReason: null,
          receiptId: 44,
          receiptNo: 'RCPT-2026-000044',
        }),
        receipt: receipt(),
        supersededReceiptId: null,
      }),
    });
    renderPage();

    // Act
    await user.click(await screen.findByRole('button', { name: 'Submit response' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('confirm-context')).toHaveTextContent('Bid Manager');
    await user.click(
      within(dialog).getByRole('checkbox', { name: /accept the final declaration/ }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Submit now' }));

    // Assert
    const progress = screen.getByTestId('submission-progress');
    expect(progress).toHaveAttribute('aria-live', 'polite');
    expect(
      await within(progress).findByText('Submitted: receipt RCPT-2026-000044'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('receipt-result')).toHaveFocus());
    const submit = calls.find((entry) => entry.id === 'supplier.bids.submit');
    expect(submit?.request.body).toEqual({
      revisionId: 1401,
      contentHash: HASH,
      confirmation: { tenantId: 4, capacity: 'Bid Manager' },
      finalDeclarationAccepted: true,
    });
  });

  it('shows only the submitted state after success, never the pre-submission state (AC-11)', async () => {
    // Arrange
    const user = userEvent.setup();
    routeCalls({
      'supplier.bids.get': () =>
        bidDetail({ workingRevision: { id: 1401, revisionNo: 1, status: 'approved_internally' } }),
      'supplier.bids.submissionPreview': () => submissionPreview(),
      'supplier.bids.attempts': () => attempts,
      'supplier.bids.submit': () => ({
        attempt: attempt({
          outcome: 'succeeded',
          failureReason: null,
          receiptId: 44,
          receiptNo: 'RCPT-2026-000044',
        }),
        receipt: receipt({ receivedAt: '2026-09-30T08:15:07Z' }),
        supersededReceiptId: null,
      }),
    });
    renderPage();
    expect(await screen.findByText('Nothing has been submitted')).toBeInTheDocument();

    // Act
    await user.click(screen.getByRole('button', { name: 'Submit response' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('checkbox', { name: /accept the final declaration/ }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Submit now' }));

    // Assert
    expect(await screen.findByText('Submitted: receipt RCPT-2026-000044')).toBeInTheDocument();
    expect(screen.queryByText('Not submitted')).not.toBeInTheDocument();
    expect(screen.queryByText('Nothing has been submitted')).not.toBeInTheDocument();
    expect(screen.queryByText('Not submitted yet')).not.toBeInTheDocument();
    expect(screen.queryByText('What would be submitted')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit response' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Submitted').length).toBeGreaterThan(0);
    expect(screen.getByText('Effective offer: RCPT-2026-000044')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'None: your effective receipt stands' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Submitted documents' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Receipts and history' })).toHaveAttribute(
      'href',
      '/supplier/responses/14/receipts',
    );
    expect(
      screen.getAllByText('30 Sep 2026, 10:15:07 (UTC+02:00) Africa/Gaborone').length,
    ).toBeGreaterThan(0);
  });

  it('keeps the earlier receipt effective when a replacement is rejected as late (AC-12, AC-13)', async () => {
    // Arrange
    const user = userEvent.setup();
    const effective = receiptSummary();
    routeCalls({
      'supplier.bids.get': () =>
        bidDetail({ effectiveReceipt: effective, submissionState: 'submitted' }),
      'supplier.bids.submissionPreview': () =>
        submissionPreview({
          isReplacement: true,
          effectiveOffer: {
            explanation: 'replacement_in_preparation',
            receipt: effective,
            lastUnsuccessfulAttempt: null,
            withdrawal: null,
          },
        }),
      'supplier.bids.attempts': () => attempts,
      'supplier.bids.submit': () => apiError(409, 'SUBMISSION_LATE'),
    });
    renderPage();

    // Act
    await user.click(await screen.findByRole('button', { name: 'Submit replacement' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('checkbox', {
        name: /superseded only when this replacement succeeds/,
      }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Submit now' }));

    // Assert
    const progress = screen.getByTestId('submission-progress');
    expect(
      await within(progress).findByText('The submission was rejected as late'),
    ).toBeInTheDocument();
    expect(
      within(progress).getByText(
        'No new receipt was issued. RCPT-2026-000021 remains your effective offer.',
      ),
    ).toBeInTheDocument();
    expect(within(progress).queryByText(/Submitted: receipt/)).not.toBeInTheDocument();
  });

  it('blocks submission while readiness has blocking errors', async () => {
    // Arrange
    routeCalls({
      'supplier.bids.get': () => bidDetail(),
      'supplier.bids.submissionPreview': () => submissionPreview({ readiness: readiness() }),
      'supplier.bids.attempts': () => attempts,
    });

    // Act
    renderPage();

    // Assert
    expect(await screen.findByText('Submission is blocked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit response' })).not.toBeInTheDocument();
  });
});
