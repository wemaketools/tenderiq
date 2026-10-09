import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import {
  BID_MANAGER,
  CONTRIBUTOR,
  answerDetail,
  apiError,
  bidDetail,
  declarations,
  routeCalls,
  supplierState,
} from '../test/data';
import AnswerPage from './AnswerPage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  call: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const renderPage = (permissions = BID_MANAGER, userId = 25) =>
  renderWithProviders(<AnswerPage />, {
    state: supplierState(permissions, userId),
    route: '/supplier/responses/14/answers/6001',
    path: '/supplier/responses/:bidId/answers/:requirementId',
  });

describe('AnswerPage (SUP-12 answer)', () => {
  it('saves the answer and reports the internal approvals the change invalidated (BR-10)', async () => {
    // Arrange
    const user = userEvent.setup();
    const calls = routeCalls({
      'supplier.bids.get': () => bidDetail(),
      'supplier.bids.getAnswer': () => answerDetail(),
      'supplier.bids.declarations': () => declarations(),
      'supplier.bids.saveAnswer': () => ({
        answer: answerDetail({ progress: 'complete' }),
        contentHash: 'c'.repeat(64),
        invalidatedApprovalIds: [3],
      }),
    });
    renderPage();
    const field = await screen.findByLabelText('Answer');

    // Act
    await user.clear(field);
    await user.type(field, 'Closed-loop control with two analysers.');
    await user.selectOptions(screen.getByLabelText(/^Progress/), 'complete');
    await user.click(screen.getByRole('button', { name: 'Save answer' }));

    // Assert
    const save = calls.find((entry) => entry.id === 'supplier.bids.saveAnswer');
    expect(save?.request.body).toMatchObject({
      revisionId: 1401,
      answerText: 'Closed-loop control with two analysers.',
      progress: 'complete',
      isDeviation: false,
    });
    expect(
      await screen.findByText('This change invalidated 1 internal approval'),
    ).toBeInTheDocument();
  });

  it('shows an evidence expiry as a calendar date in the official time zone, without a time of day', async () => {
    // Arrange
    routeCalls({
      'supplier.bids.get': () => bidDetail(),
      'supplier.bids.getAnswer': () => answerDetail(),
      'supplier.bids.declarations': () =>
        declarations({
          evidenceOptions: [
            {
              evidenceItemId: 31,
              title: 'ISO 9001:2015 certificate',
              evidenceType: 'certificate',
              expiresAt: '2027-03-30T22:00:00Z',
              status: 'current',
              attached: false,
            },
          ],
        }),
    });

    // Act
    renderPage();

    // Assert
    const option = await screen.findByRole('option', { name: /ISO 9001:2015 certificate/ });
    expect(option.textContent).toBe('ISO 9001:2015 certificate (expires 31 Mar 2027)');
  });

  it('requires an explanation before a deviation is saved', async () => {
    // Arrange
    const user = userEvent.setup();
    const calls = routeCalls({
      'supplier.bids.get': () => bidDetail(),
      'supplier.bids.getAnswer': () => answerDetail(),
      'supplier.bids.declarations': () => declarations(),
    });
    renderPage();

    // Act
    await user.click(
      await screen.findByRole('checkbox', { name: /deviates from the requirement/ }),
    );
    await user.click(screen.getByRole('button', { name: 'Save answer' }));

    // Assert
    expect(await screen.findByText('Explain the deviation.')).toBeInTheDocument();
    expect(calls.some((entry) => entry.id === 'supplier.bids.saveAnswer')).toBe(false);
  });

  it('keeps an answer assigned to someone else read-only for a contributor (AC-03)', async () => {
    // Arrange
    routeCalls({
      'supplier.bids.get': () =>
        bidDetail({
          viewer: {
            canEditResponse: true,
            canViewPricing: false,
            canEditPricing: false,
            canAssign: false,
            canComment: true,
            canApprove: false,
            canSubmit: false,
          },
        }),
      'supplier.bids.getAnswer': () => answerDetail(),
      'supplier.bids.declarations': () => declarations(),
    });

    // Act
    renderPage(CONTRIBUTOR, 26);

    // Assert
    expect(
      await screen.findByText(
        'This answer is assigned to Boago Moremi. Ask the bid manager to reassign it.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save answer' })).not.toBeInTheDocument();
  });

  it('shows no read-only notice to a viewer whose capacity cannot edit an editable answer', async () => {
    // Arrange
    routeCalls({
      'supplier.bids.get': () =>
        bidDetail({
          viewer: {
            canEditResponse: false,
            canViewPricing: true,
            canEditPricing: false,
            canAssign: false,
            canComment: true,
            canApprove: true,
            canSubmit: false,
          },
        }),
      'supplier.bids.getAnswer': () => answerDetail(),
      'supplier.bids.declarations': () => declarations(),
    });

    // Act
    renderPage();

    // Assert
    expect(await screen.findAllByText(answerDetail().text)).not.toHaveLength(0);
    expect(screen.queryByText('Read only')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save answer' })).not.toBeInTheDocument();
  });

  it('flags reused content for review before it counts as complete (FR-11)', async () => {
    // Arrange
    routeCalls({
      'supplier.bids.get': () => bidDetail(),
      'supplier.bids.getAnswer': () =>
        answerDetail({
          reuse: {
            sourceAnswerId: 99,
            tenderReference: 'T-2026-0001',
            tenderTitle: 'Bulk water meters',
            revisionNo: 1,
            submittedAt: '2026-07-20T08:00:00Z',
            reusedAt: '2026-09-27T08:00:00Z',
            reusedBy: { userId: 25, fullName: 'Boago Moremi' },
            reviewedAt: null,
            reviewedBy: null,
          },
        }),
      'supplier.bids.declarations': () => declarations(),
    });

    // Act
    renderPage();

    // Assert
    expect(await screen.findByText('Reused content awaits review')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /reviewed the reused content for relevance/ }),
    ).toBeInTheDocument();
  });

  it('explains a business rejection of the save in words', async () => {
    // Arrange
    const user = userEvent.setup();
    routeCalls({
      'supplier.bids.get': () => bidDetail(),
      'supplier.bids.getAnswer': () => answerDetail(),
      'supplier.bids.declarations': () => declarations(),
      'supplier.bids.saveAnswer': () => apiError(409, 'REVISION_NOT_EDITABLE'),
    });
    renderPage();
    const field = await screen.findByLabelText('Answer');

    // Act
    await user.type(field, ' More.');
    await user.click(screen.getByRole('button', { name: 'Save answer' }));

    // Assert
    expect(
      await screen.findByText(
        'This revision can no longer be changed. Prepare a replacement to change the offer.',
      ),
    ).toBeInTheDocument();
  });
});
