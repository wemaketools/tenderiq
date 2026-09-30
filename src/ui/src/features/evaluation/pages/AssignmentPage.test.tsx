import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { assignmentDetail } from '../testing/builders';
import { CHAIR, EVALUATOR, businessError, renderPage, routeCalls } from '../testing/kit';
import AssignmentPage from './AssignmentPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/buyer/evaluation/assignments/:assignmentId',
  route: '/buyer/evaluation/assignments/3003',
};

const notAccepted = assignmentDetail({
  status: 'not_started',
  acceptedAt: null,
  declarations: {
    undertakingAccepted: false,
    conflictDeclared: false,
    hasConflict: null,
    conflictDisposition: null,
  },
  confidentialityUndertaking: null,
  conflictDeclaration: null,
  contentAccess: { allowed: false, blockedReason: 'not_accepted' },
  bids: [],
  nextAction: 'accept',
});

const pendingConflict = assignmentDetail({
  evaluator: { userId: 42, fullName: 'Sam Keitumetse', capacity: 'Evaluator, Engineering' },
  declarations: {
    undertakingAccepted: true,
    conflictDeclared: true,
    hasConflict: true,
    conflictDisposition: 'pending_review',
  },
  conflictDeclaration: {
    declarationId: 30042,
    subjectType: 'tender',
    subjectId: 3,
    hasConflict: true,
    nature: 'bid_preparation',
    supplierTenantId: 4,
    supplierName: 'Tsodilo Engineering',
    details: 'I contributed network drawings to Tsodilo’s response.',
    declaredAt: '2026-09-11T11:20:00Z',
    disposition: 'pending_review',
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
  },
  contentAccess: { allowed: false, blockedReason: 'conflict_pending_review' },
  bids: [],
  nextAction: 'await_conflict_review',
  isOwn: false,
});

describe('AssignmentPage (EVA-01)', () => {
  it('requires the undertaking and a conflict declaration before accepting, then records both', async () => {
    const calls = routeCalls({
      'buyer.evaluation.assignments.get': () => notAccepted,
      'buyer.evaluation.assignments.accept': () => assignmentDetail(),
    });
    renderPage(<AssignmentPage />, { ...PATH, persona: EVALUATOR });

    expect(await screen.findByText('Response content is not available')).toBeInTheDocument();
    expect(screen.getByText(/The bids are listed once you have accepted/)).toBeInTheDocument();
    const accept = screen.getByRole('button', { name: 'Accept assignment' });
    expect(accept).toBeDisabled();

    fireEvent.click(screen.getByLabelText('I accept this confidentiality undertaking.'));
    fireEvent.click(screen.getByLabelText('Yes, I have a conflict to declare'));
    fireEvent.change(screen.getByLabelText(/Nature of the conflict/), {
      target: { value: 'personal_relationship' },
    });
    fireEvent.change(screen.getByLabelText(/^Details/), {
      target: { value: 'My cousin works for Supplier B.' },
    });
    expect(accept).toBeEnabled();
    fireEvent.click(accept);

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/Access stays suspended until the chair reviews/),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Accept assignment' }));

    await waitFor(() =>
      expect(
        calls.find((item) => item.id === 'buyer.evaluation.assignments.accept')?.request,
      ).toEqual({
        params: { assignmentId: 3003 },
        body: {
          confidentialityAccepted: true,
          undertakingTextVersion: 'KWU-EVAL-CU-2026.1',
          conflictDeclaration: {
            hasConflict: true,
            nature: 'personal_relationship',
            details: 'My cousin works for Supplier B.',
          },
        },
      }),
    );
    expect(await screen.findByRole('link', { name: 'Open assessment' })).toBeInTheDocument();
  });

  it('shows an accepted assignment with its declarations, bids, criteria and the way into the work', async () => {
    routeCalls({ 'buyer.evaluation.assignments.get': () => assignmentDetail() });
    renderPage(<AssignmentPage />, { ...PATH, persona: EVALUATOR });

    expect(await screen.findByText('Supplier A (Serowe ICT Solutions)')).toBeInTheDocument();
    expect(screen.getByText('C3 Relevant experience')).toBeInTheDocument();
    expect(screen.getByText(/Signed 11 Sep 2026/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open assessment' })).toHaveAttribute(
      'href',
      '/buyer/evaluation/assignments/3003/assessment',
    );
    expect(screen.getByRole('button', { name: 'Disclose a conflict' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review conflict' })).not.toBeInTheDocument();
  });

  it('lets the evaluator request a reassignment with a reason', async () => {
    const calls = routeCalls({
      'buyer.evaluation.assignments.get': () => assignmentDetail(),
      'buyer.evaluation.assignments.requestReassignment': () => ({
        assignmentId: 3003,
        status: 'in_progress',
        requestedAt: '2026-09-30T08:00:00Z',
        routedTo: { userId: 10, fullName: 'Boitumelo Kgari' },
        taskId: 901,
      }),
    });
    renderPage(<AssignmentPage />, { ...PATH, persona: EVALUATOR });

    fireEvent.click(await screen.findByRole('button', { name: 'Request reassignment' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Reason/), {
      target: { value: 'On leave from 1 October.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Request reassignment' }));

    expect(await screen.findByText('Reassignment requested')).toBeInTheDocument();
    expect(calls.at(-1)).toEqual({
      id: 'buyer.evaluation.assignments.requestReassignment',
      request: { params: { assignmentId: 3003 }, body: { reason: 'On leave from 1 October.' } },
    });
  });

  it('lets the chair review a pending conflict declaration while access stays blocked', async () => {
    const calls = routeCalls({
      'buyer.evaluation.assignments.get': () => pendingConflict,
      'buyer.evaluation.conflicts.review': () => ({
        ...pendingConflict.conflictDeclaration,
        disposition: 'recused',
        reviewedBy: { userId: 10, fullName: 'Boitumelo Kgari' },
        reviewedAt: '2026-09-30T08:00:00Z',
        reviewNote: 'Prepared part of a bid: recused.',
      }),
    });
    renderPage(<AssignmentPage />, { ...PATH, persona: CHAIR });

    expect(
      await screen.findByText(/A declared conflict is awaiting the chair’s review/),
    ).toBeInTheDocument();
    expect(screen.getByText('Chair oversight')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review conflict' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Disposition/), {
      target: { value: 'recused' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Review note/), {
      target: { value: 'Prepared part of a bid: recused.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record disposition' }));

    await waitFor(() =>
      expect(
        calls.find((item) => item.id === 'buyer.evaluation.conflicts.review')?.request,
      ).toEqual({
        params: { declarationId: 30042 },
        body: { disposition: 'recused', reviewNote: 'Prepared part of a bid: recused.' },
      }),
    );
  });

  it('shows the business error when the declaration was already reviewed', async () => {
    routeCalls({
      'buyer.evaluation.assignments.get': () => pendingConflict,
      'buyer.evaluation.conflicts.review': () => {
        throw businessError('buyer.evaluation.conflicts.review', 'DECLARATION_ALREADY_REVIEWED');
      },
    });
    renderPage(<AssignmentPage />, { ...PATH, persona: CHAIR });
    fireEvent.click(await screen.findByRole('button', { name: 'Review conflict' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Disposition/), {
      target: { value: 'cleared' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Review note/), {
      target: { value: 'No material link.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record disposition' }));
    expect(
      await within(dialog).findByText('The declaration was already reviewed.'),
    ).toBeInTheDocument();
  });

  it('says so when the assignment is not the caller’s', async () => {
    routeCalls({
      'buyer.evaluation.assignments.get': () => {
        throw businessError('buyer.evaluation.assignments.get', 'NOT_FOUND', 404);
      },
    });
    renderPage(<AssignmentPage />, { ...PATH, persona: EVALUATOR });
    expect(
      await screen.findByText('This assignment does not exist or is not assigned to you.'),
    ).toBeInTheDocument();
  });
});
