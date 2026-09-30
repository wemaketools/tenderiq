import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  ASSESSOR,
  FINANCE,
  applicationDetail,
  businessError,
  financialPanel,
  options,
  renderPage,
  routeCalls,
} from '../../test/kit';
import AssessmentPage from './AssessmentPage';

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
  path: '/buyer/qualification/applications/:applicationId',
  route: '/buyer/qualification/applications/503',
};

describe('AssessmentPage (BUY-34)', () => {
  it('shows criteria, answers, evidence, findings, readiness and "registered — not qualified" (AC-07)', async () => {
    routeCalls({
      'buyer.qualification.applications.get': () => applicationDetail(),
      'buyer.qualification.options': () => options(),
    });
    renderPage(<AssessmentPage />, { ...PATH, permissions: ASSESSOR });

    expect(await screen.findByText('QA-2026-0006 — Makgadikgadi Civil Works')).toBeInTheDocument();
    expect(screen.getByText('Registered — not qualified')).toBeInTheDocument();
    expect(screen.getByText(/not qualified for WTR-PUMP/)).toBeInTheDocument();
    expect(screen.getByText('ISO 9001 quality management certificate')).toBeInTheDocument();
    expect(screen.getByText('Mandatory evidence missing')).toBeInTheDocument();
    expect(screen.getByText('Statements are unaudited group accounts.')).toBeInTheDocument();
    expect(screen.getByText('Group consolidated management accounts FY2025')).toBeInTheDocument();
    expect(screen.getByText('1 criterion without a finding.')).toBeInTheDocument();
    expect(screen.getByText(/Next: wait for the supplier to answer 1 request/)).toBeInTheDocument();
  });

  it('never offers "meets" for a criterion missing mandatory evidence and records the finding', async () => {
    const calls = routeCalls({
      'buyer.qualification.applications.get': () => applicationDetail(),
      'buyer.qualification.options': () => options(),
      'buyer.qualification.applications.recordFinding': () => ({
        id: 900,
        criterionId: 11201,
        finding: 'does_not_meet',
        rationale: 'No certificate provided.',
        evidenceRefs: null,
        flagOnly: false,
        assessor: { userId: 8, fullName: 'Neo Mothibi' },
        recordedAt: '2026-09-30T08:00:00Z',
      }),
    });
    renderPage(<AssessmentPage />, { ...PATH, permissions: ASSESSOR });
    fireEvent.click((await screen.findAllByRole('button', { name: 'Record finding' }))[0]!);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Meets')).toBeDisabled();
    expect(within(dialog).getByText('Mandatory evidence is missing')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByLabelText('Does not meet'));
    fireEvent.change(within(dialog).getByLabelText(/^Rationale/), {
      target: { value: 'No certificate provided.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save finding' }));

    expect(await screen.findByText('Finding recorded: Does not meet.')).toBeInTheDocument();
    expect(
      calls.find((item) => item.id === 'buyer.qualification.applications.recordFinding')?.request,
    ).toEqual({
      params: { applicationId: 503, criterionId: 11201 },
      body: { finding: 'does_not_meet', rationale: 'No certificate provided.', evidenceRefs: null },
    });
  });

  it('explains the restricted financial panel to an assessor without calling the API (AC-08)', async () => {
    const calls = routeCalls({
      'buyer.qualification.applications.get': () => applicationDetail(),
      'buyer.qualification.options': () => options(),
    });
    renderPage(<AssessmentPage />, { ...PATH, permissions: ASSESSOR });
    fireEvent.click(await screen.findByRole('tab', { name: 'Financial review' }));
    expect(await screen.findByText('Restricted financial review')).toBeInTheDocument();
    expect(
      calls.some((item) => item.id === 'buyer.qualification.applications.financialReview'),
    ).toBe(false);
  });

  it('shows the financial reviewer period, currency, consolidation, source and conclusion (AC-08)', async () => {
    routeCalls({
      'buyer.qualification.applications.get': () =>
        applicationDetail({
          actions: {
            canAssign: false,
            canRecordFindings: true,
            canRequestInfo: true,
            canViewFinancialReview: true,
            canRecordFinancialReview: true,
            canRecommend: false,
            canDecide: false,
          },
        }),
      'buyer.qualification.options': () => options(),
      'buyer.qualification.applications.financialReview': () => financialPanel(),
    });
    renderPage(<AssessmentPage />, { ...PATH, permissions: FINANCE });
    fireEvent.click(await screen.findByRole('tab', { name: 'Financial review' }));

    expect(await screen.findByText('Unclear')).toBeInTheDocument();
    expect(screen.getByText('31 Dec 2025')).toBeInTheDocument();
    expect(screen.getByText('Consolidated (group) accounts')).toBeInTheDocument();
    expect(
      screen.getByText('Unaudited group-consolidated management accounts FY2025'),
    ).toBeInTheDocument();
    expect(screen.getByText('BWP 18,750,000.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record review' })).toBeInTheDocument();
  });

  it('requires material qualifications for a non-adequate financial conclusion', async () => {
    const calls = routeCalls({
      'buyer.qualification.applications.get': () =>
        applicationDetail({
          actions: {
            canAssign: false,
            canRecordFindings: true,
            canRequestInfo: true,
            canViewFinancialReview: true,
            canRecordFinancialReview: true,
            canRecommend: false,
            canDecide: false,
          },
        }),
      'buyer.qualification.options': () => options(),
      'buyer.qualification.applications.financialReview': () => financialPanel({ reviews: [] }),
    });
    renderPage(<AssessmentPage />, { ...PATH, permissions: FINANCE });
    fireEvent.click(await screen.findByRole('tab', { name: 'Financial review' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Record review' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Financial period end/), {
      target: { value: '2025-12-31' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Source/), {
      target: { value: 'Group accounts' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Conclusion/), {
      target: { value: 'unclear' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Rationale/), {
      target: { value: 'Not separable.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record review' }));

    expect(
      await within(dialog).findByText('Record the material qualifications behind this conclusion.'),
    ).toBeInTheDocument();
    expect(
      calls.some((item) => item.id === 'buyer.qualification.applications.recordFinancialReview'),
    ).toBe(false);
  });

  it('recommends a conditional outcome only with conditions, allowed activities and a blocked gate', async () => {
    const calls = routeCalls({
      'buyer.qualification.applications.get': () =>
        applicationDetail({ status: 'under_review', infoRequests: [] }),
      'buyer.qualification.options': () => options(),
      'buyer.qualification.applications.recommend': () => {
        throw businessError('buyer.qualification.applications.recommend', 'FINDINGS_INCOMPLETE');
      },
    });
    renderPage(<AssessmentPage />, { ...PATH, permissions: ASSESSOR });
    fireEvent.click(await screen.findByRole('button', { name: 'Recommend outcome' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByLabelText('Qualified with conditions'));
    fireEvent.change(within(dialog).getByLabelText(/^Rationale/), {
      target: { value: 'Pending ISO.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Review and send' }));
    expect(
      await within(dialog).findByText('State the conditions of this outcome.'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'Name the future gate that stays blocked until the condition is met.',
      ),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/^Conditions/), {
      target: { value: 'Deliver ISO 9001.' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Allowed activities/), {
      target: { value: 'Bid.' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Blocked gate/), {
      target: { value: 'award' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Review and send' }));

    const confirm = await screen.findByRole('dialog', { name: 'Send recommendation' });
    expect(within(confirm).getByText(/Kalahari Water Utilities/)).toBeInTheDocument();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Send recommendation' }));
    expect(
      await within(confirm).findByText('Record a finding on every criterion before recommending.'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        calls.find((item) => item.id === 'buyer.qualification.applications.recommend')?.request,
      ).toEqual({
        params: { applicationId: 503 },
        body: expect.objectContaining({
          proposedOutcome: 'qualified_with_conditions',
          blockedGate: 'award',
        }),
      }),
    );
  });

  it('offers only the program’s covered categories in the recommendation (BR-24)', async () => {
    // Arrange
    routeCalls({
      'buyer.qualification.applications.get': () =>
        applicationDetail({ status: 'under_review', infoRequests: [] }),
      'buyer.qualification.options': () => options(),
    });
    renderPage(<AssessmentPage />, { ...PATH, permissions: ASSESSOR });

    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Recommend outcome' }));

    // Assert
    const texts = categoryOptionTexts(await screen.findByRole('dialog'));
    expect(texts.some((text) => text.includes('WTR-PIPE'))).toBe(true);
    expect(texts.some((text) => text.includes('ICT-SCADA'))).toBe(false);
  });

  it('explains an unknown or draft application', async () => {
    routeCalls({ 'buyer.qualification.options': () => options() });
    renderPage(<AssessmentPage />, { ...PATH, permissions: ASSESSOR });
    expect((await screen.findAllByText('Application not found')).length).toBeGreaterThan(0);
  });
});
