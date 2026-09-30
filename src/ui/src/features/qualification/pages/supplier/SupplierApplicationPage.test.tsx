import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  CANDIDATES,
  SUPPLIER_APPLY,
  businessError,
  infoRequest,
  renderPage,
  routeCalls,
  supplierApplication,
} from '../../test/kit';
import SupplierApplicationPage from './SupplierApplicationPage';

vi.mock('../../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const DRAFT = {
  path: '/supplier/qualification/applications/:applicationId',
  route: '/supplier/qualification/applications/511',
  supplier: true,
};

function draftRoutes(extra: Record<string, (request: Record<string, unknown>) => unknown> = {}) {
  return routeCalls({
    'supplier.qualification.applications.get': () => supplierApplication(),
    'supplier.qualification.applications.evidenceCandidates': () => CANDIDATES,
    ...extra,
  });
}

describe('SupplierApplicationPage (SUP-20)', () => {
  it('shows a draft as saved but not submitted, with blocking readiness items', async () => {
    draftRoutes();
    renderPage(<SupplierApplicationPage />, { ...DRAFT, permissions: SUPPLIER_APPLY });
    expect(await screen.findByText('Draft — saved, not submitted')).toBeInTheDocument();
    expect(screen.getByText('1 criterion is missing mandatory evidence.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Submit application' })[0]).toBeDisabled();
  });

  it('requires a reason for "not applicable" before saving', async () => {
    const calls = draftRoutes();
    renderPage(<SupplierApplicationPage />, { ...DRAFT, permissions: SUPPLIER_APPLY });
    const section = await screen.findByRole('region', { name: 'Professional indemnity insurance' });
    fireEvent.click(within(section).getByLabelText('Not applicable'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Save answers' })[0]!);
    expect(
      await screen.findByText('Explain why this criterion does not apply.'),
    ).toBeInTheDocument();
    expect(
      calls.some((item) => item.id === 'supplier.qualification.applications.saveAnswers'),
    ).toBe(false);
  });

  it('saves answers with evidence and then submits after the declaration', async () => {
    const saved = supplierApplication({
      items: supplierApplication().items.map((item, index) =>
        index === 0
          ? {
              ...item,
              evidenceMissing: false,
              evidence: [
                {
                  evidenceSubmissionId: 1,
                  evidenceItemId: 777,
                  evidenceType: 'certificate',
                  title: 'ISO 9001 certificate',
                  issuer: 'SGS',
                  referenceNumber: null,
                  periodStart: null,
                  periodEnd: null,
                  reportingCurrency: null,
                  isConsolidated: null,
                  coverageAmount: null,
                  validFrom: null,
                  expiresAt: '2029-11-30',
                  verificationStatus: 'supplier_provided',
                  documentId: 1,
                  documentVersionId: 1,
                  fileName: 'iso.pdf',
                  submittedAt: '2026-09-30T08:00:00Z',
                  expiredSinceSubmission: false,
                  replacedSinceSubmission: false,
                },
              ],
            }
          : item,
      ),
    });
    const calls = draftRoutes({
      'supplier.qualification.applications.saveAnswers': () => saved,
      'supplier.qualification.applications.submit': () =>
        supplierApplication({
          reference: 'QA-2026-0010',
          status: 'submitted',
          canEdit: false,
          canSubmit: false,
        }),
    });
    renderPage(<SupplierApplicationPage />, { ...DRAFT, permissions: SUPPLIER_APPLY });
    const section = await screen.findByRole('region', {
      name: 'ISO 9001 quality management certificate',
    });
    fireEvent.click(await within(section).findByLabelText(/ISO 9001 certificate · Certificate/));
    fireEvent.click(screen.getAllByRole('button', { name: 'Save answers' })[0]!);

    expect(
      await screen.findByText('Answers saved. The application is still a draft.'),
    ).toBeInTheDocument();
    expect(
      calls.find((item) => item.id === 'supplier.qualification.applications.saveAnswers')?.request,
    ).toEqual({
      params: { applicationId: 511 },
      body: { answers: [expect.objectContaining({ criterionId: 11201, evidenceItemIds: [777] })] },
    });

    const submit = screen.getAllByRole('button', { name: 'Submit application' })[0]!;
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    const dialog = await screen.findByRole('dialog', { name: 'Submit qualification application' });
    fireEvent.click(within(dialog).getByLabelText(/I confirm the answers are complete/));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Submit application' }));
    expect(await screen.findByText('Application submitted as QA-2026-0010.')).toBeInTheDocument();
    expect(screen.getByText('Submitted — under the buyer’s review')).toBeInTheDocument();
  });

  it('responds to an open information request and shows the business error of a closed one', async () => {
    const application = supplierApplication({
      id: 503,
      reference: 'QA-2026-0006',
      status: 'more_info_required',
      canEdit: false,
      canSubmit: false,
      infoRequests: [infoRequest()],
      nextDueAt: { at: '2026-10-07T15:00:00Z', timeZone: 'Africa/Gaborone' },
    });
    routeCalls({
      'supplier.qualification.applications.get': () => application,
      'supplier.qualification.applications.evidenceCandidates': () => CANDIDATES,
      'supplier.qualification.applications.respondInfoRequest': () => {
        throw businessError(
          'supplier.qualification.applications.respondInfoRequest',
          'INFO_REQUEST_NOT_OPEN',
        );
      },
    });
    renderPage(<SupplierApplicationPage />, {
      ...DRAFT,
      route: '/supplier/qualification/applications/503',
      permissions: SUPPLIER_APPLY,
    });
    expect(await screen.findByText('The buyer needs more information')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Respond' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Your response/), {
      target: { value: 'Letter attached.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Respond' }));
    expect(await within(dialog).findByText('This request is no longer open.')).toBeInTheDocument();
  });

  it('shows "Under review" and drops the more-information banner once the last open request is answered (PRD §8.3)', async () => {
    // Arrange
    const application = supplierApplication({
      id: 503,
      reference: 'QA-2026-0006',
      status: 'more_info_required',
      canEdit: false,
      canSubmit: false,
      openInfoRequestCount: 1,
      infoRequests: [infoRequest()],
      nextDueAt: { at: '2026-10-07T15:00:00Z', timeZone: 'Africa/Gaborone' },
    });
    routeCalls({
      'supplier.qualification.applications.get': () => application,
      'supplier.qualification.applications.evidenceCandidates': () => CANDIDATES,
      'supplier.qualification.applications.respondInfoRequest': () => ({
        infoRequest: infoRequest({
          status: 'answered',
          responseText: 'Letter attached.',
          respondedBy: { userId: 40, fullName: 'Sethunya Makgadi' },
          respondedAt: '2026-09-30T08:00:00Z',
        }),
        applicationStatus: 'under_review',
      }),
    });
    renderPage(<SupplierApplicationPage />, {
      ...DRAFT,
      route: '/supplier/qualification/applications/503',
      permissions: SUPPLIER_APPLY,
    });
    expect(await screen.findByText('The buyer needs more information')).toBeInTheDocument();
    expect(screen.getByText(/Next: answer 1 information request/)).toBeInTheDocument();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Respond' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Your response/), {
      target: { value: 'Letter attached.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Respond' }));

    // Assert
    expect(await screen.findByText('Submitted — under the buyer’s review')).toBeInTheDocument();
    expect(screen.queryByText('The buyer needs more information')).not.toBeInTheDocument();
    expect(screen.getAllByText('Under review').length).toBeGreaterThan(0);
    expect(screen.queryByText('More info required')).not.toBeInTheDocument();
    expect(screen.getByText(/Next: the buyer is reviewing/)).toBeInTheDocument();
    expect(screen.queryByText(/Next: answer/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Respond' })).not.toBeInTheDocument();
  });

  it('withdraws with a reason after confirmation', async () => {
    const calls = draftRoutes({
      'supplier.qualification.applications.withdraw': () =>
        supplierApplication({
          status: 'withdrawn',
          canEdit: false,
          canSubmit: false,
          canWithdraw: false,
          withdrawnReason: 'Not bidding.',
        }),
    });
    renderPage(<SupplierApplicationPage />, { ...DRAFT, permissions: SUPPLIER_APPLY });
    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Reason/), {
      target: { value: 'Not bidding.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Withdraw' }));
    expect(await screen.findByText('Application withdrawn.')).toBeInTheDocument();
    expect(
      calls.find((item) => item.id === 'supplier.qualification.applications.withdraw')?.request,
    ).toEqual({
      params: { applicationId: 511 },
      body: { reason: 'Not bidding.' },
    });
  });

  it('shows a just-created draft from the navigation state (static prototype commands)', async () => {
    routeCalls({
      'supplier.qualification.applications.evidenceCandidates': () => CANDIDATES,
    });
    renderPage(<SupplierApplicationPage />, {
      ...DRAFT,
      route: '/supplier/qualification/applications/900',
      permissions: SUPPLIER_APPLY,
      state: { created: supplierApplication({ id: 900 }) },
    });
    expect(await screen.findByText('Draft — saved, not submitted')).toBeInTheDocument();
    expect(screen.queryByText('Application not found')).not.toBeInTheDocument();
  });
});
