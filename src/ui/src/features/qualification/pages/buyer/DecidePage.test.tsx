import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  ASSESSOR,
  MANAGER,
  applicationDetail,
  decisionDetail,
  options,
  renderPage,
  routeCalls,
} from '../../test/kit';
import DecidePage from './DecidePage';

vi.mock('../../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

function categoryOptionTexts(dialogOrPage: HTMLElement): string[] {
  const select = within(dialogOrPage).getByLabelText(/^Category/);
  return within(select)
    .getAllByRole('option')
    .map((option) => option.textContent ?? '');
}

const PATH = {
  path: '/buyer/qualification/applications/:applicationId/decision',
  route: '/buyer/qualification/applications/509/decision',
};

const RECOMMENDATION = {
  proposedOutcome: 'qualified_with_conditions',
  scopeCategory: {
    categoryId: 32,
    code: 'WTR-PUMP',
    name: 'Pumps and mechanical equipment',
    parentId: 30,
  },
  scopeMaxValue: { amount: '3000000.00', currency: 'BWP' },
  scopeGeography: 'Botswana',
  conditions: 'Supply renewed insurance before 8 Oct 2026.',
  allowedActivities: 'Receive invitations and submit bids.',
  blockedGate: 'award',
  rationale: 'All mandatory criteria are met.',
  recommendedBy: { userId: 8, fullName: 'Neo Mothibi' },
  recommendedAt: '2026-09-25T16:05:00Z',
  approvalRequestId: null,
  approvalStatus: null,
} as const;

function pending() {
  return applicationDetail({
    id: 509,
    reference: 'QA-2026-0007',
    status: 'decision_pending',
    recommendation: RECOMMENDATION,
    actions: {
      canAssign: false,
      canRecordFindings: false,
      canRequestInfo: false,
      canViewFinancialReview: true,
      canRecordFinancialReview: false,
      canRecommend: false,
      canDecide: true,
    },
  });
}

describe('DecidePage (BUY-35)', () => {
  it('starts the decision from the recommendation and records it after confirmation', async () => {
    const calls = routeCalls({
      'buyer.qualification.applications.get': () => pending(),
      'buyer.qualification.options': () => options(),
      'buyer.qualification.applications.decide': () =>
        decisionDetail({ id: 900, applicationReference: 'QA-2026-0007' }),
    });
    renderPage(<DecidePage />, { ...PATH, permissions: MANAGER });

    expect(await screen.findByText('Decision — QA-2026-0007')).toBeInTheDocument();
    expect(screen.getByText('All mandatory criteria are met.')).toBeInTheDocument();
    expect(screen.getByLabelText('Qualified with conditions')).toBeChecked();
    expect(screen.getByLabelText(/^Conditions/)).toHaveValue(
      'Supply renewed insurance before 8 Oct 2026.',
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Review decision' })[0]!);
    expect((await screen.findAllByText('This text is required.')).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText(/^Reasons \(internal\)/), {
      target: { value: 'Criteria met.' },
    });
    fireEvent.change(screen.getByLabelText(/^Explanation to the supplier/), {
      target: { value: 'Qualified with conditions.' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Review decision' })[0]!);

    const confirm = await screen.findByRole('dialog', { name: 'Record qualification decision' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Record decision' }));
    expect(await screen.findByText('Decision recorded — QA-2026-0007')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        calls.find((item) => item.id === 'buyer.qualification.applications.decide')?.request,
      ).toEqual({
        params: { applicationId: 509 },
        body: expect.objectContaining({
          outcome: 'qualified_with_conditions',
          scopeCategoryId: 32,
          scopeMaxValue: { amount: '3000000.00', currency: 'BWP' },
          blockedGate: 'award',
          reasons: 'Criteria met.',
          notifySupplier: true,
        }),
      }),
    );
  });

  it('offers only the program’s covered categories for the decided scope (BR-24)', async () => {
    // Arrange
    routeCalls({
      'buyer.qualification.applications.get': () => pending(),
      'buyer.qualification.options': () => options(),
    });

    // Act
    renderPage(<DecidePage />, { ...PATH, permissions: MANAGER });
    await screen.findByText('Decision — QA-2026-0007');

    // Assert
    const texts = categoryOptionTexts(document.body);
    expect(texts.some((text) => text.includes('WTR-PUMP'))).toBe(true);
    expect(texts.some((text) => text.includes('ICT-SCADA'))).toBe(false);
  });

  it('explains to a decider that only decision-pending applications are decided', async () => {
    routeCalls({
      'buyer.qualification.applications.get': () =>
        applicationDetail({ actions: { ...pending().actions, canDecide: true } }),
      'buyer.qualification.options': () => options(),
    });
    renderPage(<DecidePage />, { ...PATH, permissions: MANAGER });
    expect(await screen.findByText('This application cannot be decided now')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review decision' })).not.toBeInTheDocument();
  });

  it('shows no authority warning and no decision form to a user without decision authority', async () => {
    routeCalls({
      'buyer.qualification.applications.get': () => applicationDetail(),
      'buyer.qualification.options': () => options(),
    });
    renderPage(<DecidePage />, { ...PATH, permissions: ASSESSOR });
    expect(await screen.findByText('Assessor’s recommendation')).toBeInTheDocument();
    expect(screen.queryByText('This application cannot be decided now')).not.toBeInTheDocument();
    expect(screen.queryByText(/decision authority/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review decision' })).not.toBeInTheDocument();
  });

  it('shows the restricted financial review to the decider on request', async () => {
    const calls = routeCalls({
      'buyer.qualification.applications.get': () => pending(),
      'buyer.qualification.options': () => options(),
      'buyer.qualification.applications.financialReview': () => {
        throw new Error('not routed');
      },
    });
    renderPage(<DecidePage />, { ...PATH, permissions: MANAGER });
    fireEvent.click(await screen.findByRole('button', { name: 'Show financial review' }));
    await waitFor(() =>
      expect(
        calls.some((item) => item.id === 'buyer.qualification.applications.financialReview'),
      ).toBe(true),
    );
  });
});
