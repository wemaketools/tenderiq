import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import {
  BID_MANAGER,
  HASH,
  SIGNATORY_PERMISSIONS,
  bidDetail,
  internalReview,
  routeCalls,
  supplierState,
} from '../test/data';
import ReviewPage from './ReviewPage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  call: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const approverViewer = {
  canEditResponse: false,
  canViewPricing: true,
  canEditPricing: false,
  canAssign: false,
  canComment: true,
  canApprove: true,
  canSubmit: true,
};

describe('ReviewPage (SUP-15)', () => {
  it('shows that a material change invalidated the earlier approval and reopens the review (BR-10)', async () => {
    // Arrange
    routeCalls({
      'supplier.bids.get': () => bidDetail(),
      'supplier.bids.review': () => internalReview(),
    });

    // Act
    renderWithProviders(<ReviewPage />, {
      state: supplierState(BID_MANAGER),
      route: '/supplier/responses/14/review',
      path: '/supplier/responses/:bidId/review',
    });

    // Assert
    expect(await screen.findByText('The content changed after approval')).toBeInTheDocument();
    expect(screen.getByText('Invalidated by a change')).toBeInTheDocument();
    expect(screen.getByText('BWP 57,000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request approval' })).toBeInTheDocument();
  });

  it('lets the assigned approver approve the exact content after confirming the context (COM-02)', async () => {
    // Arrange
    const user = userEvent.setup();
    const calls = routeCalls({
      'supplier.bids.get': () => bidDetail({ viewer: approverViewer }),
      'supplier.bids.review': () => internalReview({ viewer: approverViewer }),
      'supplier.bids.decideApproval': () =>
        internalReview({ viewer: approverViewer, materialChangeSinceApproval: false }),
    });
    renderWithProviders(<ReviewPage />, {
      state: supplierState(SIGNATORY_PERMISSIONS, 27),
      route: '/supplier/responses/14/review',
      path: '/supplier/responses/:bidId/review',
    });
    const approvals = await screen.findByRole('table', { name: 'Approvals of this revision' });

    // Act
    await user.click(within(approvals).getByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('confirm-context')).toHaveTextContent('Tsodilo Engineering');
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));

    // Assert
    const decide = calls.find((entry) => entry.id === 'supplier.bids.decideApproval');
    expect(decide?.request).toMatchObject({
      params: { bidId: 14, approvalId: 4 },
      body: { decision: 'approve', contentHash: HASH },
    });
    expect(await screen.findByText('Approved. The response is not submitted.')).toBeInTheDocument();
  });

  it('hides the pricing exposure from a reviewer who may not see prices', async () => {
    // Arrange
    routeCalls({
      'supplier.bids.get': () => bidDetail(),
      'supplier.bids.review': () =>
        internalReview({
          commercialExposure: {
            visible: false,
            totalOneTime: null,
            recurring: [],
            validityDays: null,
            exceptionCount: 1,
            deviationCount: 0,
            subcontractedSharePercent: '0',
          },
        }),
    });

    // Act
    renderWithProviders(<ReviewPage />, {
      state: supplierState(BID_MANAGER),
      route: '/supplier/responses/14/review',
      path: '/supplier/responses/:bidId/review',
    });

    // Assert
    expect(
      await screen.findByText('Prices are restricted to pricing contributors and approvers.'),
    ).toBeInTheDocument();
  });
});
