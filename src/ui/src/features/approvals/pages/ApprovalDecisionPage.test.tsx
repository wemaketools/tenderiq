import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { businessError, callsTo, renderPage, routeCalls } from '../../tasks/test/kit';
import { approvalDetail } from '../../tasks/test/workspaceData';
import ApprovalDecisionPage from './ApprovalDecisionPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/me/approvals/:approvalId', route: '/me/approvals/33' };

describe('ApprovalDecisionPage (COM-05)', () => {
  it('shows the exact version, amount, scope, justification, evidence and authority', async () => {
    routeCalls({
      'me.approvals.get': () => approvalDetail(),
      'buyer.audit.entityHistory': () => ({ items: [], total: 0, page: 1, pageSize: 10 }),
    });
    renderPage(<ApprovalDecisionPage />, PATH);
    expect(
      await screen.findByRole('heading', { name: /Approve PR-2026-0002 Chlorine analyser/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Replace two chlorine analysers.')).toBeInTheDocument();
    expect(screen.getByText('The analysers are beyond repair.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Business case' })).toHaveAttribute(
      'href',
      '/me/documents/204?version=2041',
    );
    expect(screen.getByText('Version 1 — the version under this approval')).toBeInTheDocument();
    expect(screen.getByText('Version 2 is now the latest')).toBeInTheDocument();
    expect(screen.getByText('Exact version under approval')).toBeInTheDocument();
    expect(screen.getByText('Sufficient')).toBeInTheDocument();
    expect(screen.getByText('request.approve')).toBeInTheDocument();
  });

  it('states that the amount exceeds the manager’s authority and where it was routed (AC-05)', async () => {
    routeCalls({
      'me.approvals.get': () =>
        approvalDetail({
          allowedDecisions: [],
          routing: {
            reason: 'authority_exceeded',
            skipped: { userId: 4, fullName: 'Mpho Dikgang' },
            skippedCapacity: 'Procurement Manager',
            skippedLimit: { amount: '2000000.00', currency: 'BWP' },
            routedTo: { userId: 18, fullName: 'Keabetswe Nkwe' },
            routedToCapacity: 'Chief Executive',
            routedToLimit: { amount: '10000000.00', currency: 'BWP' },
            routedAt: '2026-09-30T07:30:00Z',
            note: null,
          },
          myStep: {
            stepId: 321,
            sequence: 1,
            status: 'skipped',
            requiredDecisionType: 'request_approval',
            actingFor: null,
            canDecide: false,
            blockers: ['authority_insufficient', 'not_current_step'],
          },
        }),
    });
    renderPage(<ApprovalDecisionPage />, PATH);
    expect(
      await screen.findByText('Exceeds the authority of Mpho Dikgang — routed to Keabetswe Nkwe'),
    ).toBeInTheDocument();
    expect(screen.getByText('Keabetswe Nkwe (Chief Executive)')).toBeInTheDocument();
    expect(screen.getAllByText(/The amount exceeds your authority/).length).toBeGreaterThan(0);
    expect(
      screen.getByText('No decision is available to you on this approval.'),
    ).toBeInTheDocument();
  });

  it('shows the invalidated approval with what changed between versions (AC-06)', async () => {
    routeCalls({
      'me.approvals.get': () =>
        approvalDetail({
          status: 'invalidated',
          currentSubjectVersion: 2,
          allowedDecisions: [],
          invalidation: {
            changedAt: '2026-10-02T13:10:00Z',
            changedBy: { userId: 5, fullName: 'Tebogo Molefe' },
            fromVersion: 1,
            toVersion: 2,
            changes: [
              {
                key: 'estimatedValue',
                label: 'Estimated value',
                before: 'BWP 420,000.00',
                after: 'BWP 610,000.00',
              },
            ],
            replacementApprovalId: null,
          },
        }),
    });
    renderPage(<ApprovalDecisionPage />, PATH);
    expect(await screen.findByText('Invalidated by a change')).toBeInTheDocument();
    expect(screen.getByText('BWP 610,000.00')).toBeInTheDocument();
    expect(
      screen.getByText(/No approval has been requested for version 2 yet/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the changed record' })).toHaveAttribute(
      'href',
      '/buyer/requests/2',
    );
  });

  it('approves with conditions for the exact version in the approval’s organization', async () => {
    const calls = routeCalls({
      'me.approvals.get': () => approvalDetail(),
      'buyer.audit.entityHistory': () => ({ items: [], total: 0, page: 1, pageSize: 10 }),
      'me.approvals.decide': () =>
        approvalDetail({ status: 'approved_with_conditions', allowedDecisions: [] }),
    });
    renderPage(<ApprovalDecisionPage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve with conditions' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Reason for this decision/), {
      target: { value: 'Within budget' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve with conditions' }));
    expect(
      await within(dialog).findByText('State the conditions of the approval.'),
    ).toBeInTheDocument();
    expect(callsTo(calls, 'me.approvals.decide')).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText(/Conditions of the approval/), {
      target: { value: 'Three quotations' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve with conditions' }));
    await waitFor(() => expect(callsTo(calls, 'me.approvals.decide')).toHaveLength(1));
    const [sent] = callsTo(calls, 'me.approvals.decide');
    expect(sent?.request).toMatchObject({
      body: {
        decision: 'approve_with_conditions',
        subjectVersion: 1,
        contentHash: 'a'.repeat(64),
        reason: 'Within budget',
        conditions: 'Three quotations',
      },
    });
    expect(sent?.options).toMatchObject({ tenantId: 2 });
    expect(
      await screen.findByText(/Your decision is recorded for this exact version/),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('decision-recorded')).toHaveFocus());
  });

  it('requires a reason to reject and explains a version that changed meanwhile', async () => {
    routeCalls({
      'me.approvals.get': () => approvalDetail(),
      'buyer.audit.entityHistory': () => ({ items: [], total: 0, page: 1, pageSize: 10 }),
      'me.approvals.decide': () => {
        throw businessError('me.approvals.decide', 'APPROVAL_VERSION_MISMATCH');
      },
    });
    renderPage(<ApprovalDecisionPage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Reject' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Reason for this decision/), {
      target: { value: 'Not justified' },
    });
    fireEvent.click(confirm);
    expect(
      await within(dialog).findByText(/The record changed while you were reviewing it/),
    ).toBeInTheDocument();
  });

  it('blocks the decision while a gate of the subject is open and says which one (AC-24)', async () => {
    const detail = approvalDetail();
    routeCalls({
      'me.approvals.get': () =>
        approvalDetail({
          subjectType: 'award',
          subjectReference: 'T-2026-0009',
          subjectLinkPath: null,
          allowedDecisions: [],
          myStep:
            detail.myStep === null
              ? null
              : { ...detail.myStep, canDecide: false, blockers: ['subject_gate_blocked'] },
          subjectGates: [
            { code: 'diligence', detail: 'One award-blocking due-diligence finding is open.' },
          ],
        }),
      'buyer.audit.entityHistory': () => ({ items: [], total: 0, page: 1, pageSize: 10 }),
    });
    renderPage(<ApprovalDecisionPage />, PATH);
    expect(
      await screen.findByText('One award-blocking due-diligence finding is open.'),
    ).toBeInTheDocument();
    expect(screen.getByText('The record is not ready for a decision')).toBeInTheDocument();
    const approve = screen.queryByRole('button', { name: 'Approve' });
    expect(approve === null || approve.hasAttribute('disabled')).toBe(true);
    // No link is offered when the caller may not open the subject's screen.
    expect(screen.queryByRole('link', { name: 'T-2026-0009' })).toBeNull();
    expect(screen.getAllByText('T-2026-0009').length).toBeGreaterThan(0);
  });

  it('leaves the decider cards out for a requester who is not a decider (DD-49)', async () => {
    routeCalls({
      'me.approvals.get': () =>
        approvalDetail({ allowedDecisions: [], myStep: null, authority: null }),
      'buyer.audit.entityHistory': () => ({ items: [], total: 0, page: 1, pageSize: 10 }),
    });
    renderPage(<ApprovalDecisionPage />, PATH);
    expect(
      await screen.findByRole('heading', { name: /Approve PR-2026-0002 Chlorine analyser/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your decision' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your authority' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Conflicts and independence' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/No decision is available to you/)).not.toBeInTheDocument();
  });

  it('shows the decider cards to a decider of the approval', async () => {
    routeCalls({
      'me.approvals.get': () => approvalDetail(),
      'buyer.audit.entityHistory': () => ({ items: [], total: 0, page: 1, pageSize: 10 }),
    });
    renderPage(<ApprovalDecisionPage />, PATH);
    expect(await screen.findByRole('heading', { name: 'Your decision' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your authority' })).toBeInTheDocument();
  });

  it('shows the not-found state for an unknown approval', async () => {
    routeCalls({});
    renderPage(<ApprovalDecisionPage />, PATH);
    expect(await screen.findByText('This could not be loaded')).toBeInTheDocument();
  });
});
