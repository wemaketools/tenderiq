import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { callsTo, renderPage, routeCalls } from '../../tasks/test/kit';
import { myApproval, page, taskSummary } from '../../tasks/test/workspaceData';
import ApprovalInboxPage from './ApprovalInboxPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/me/approvals', route: '/me/approvals' };

const blocked = myApproval({
  id: 32,
  title: 'Approve PR-2026-0003 Emergency borehole pump spares',
  subjectReference: 'PR-2026-0003',
  myStep: {
    stepId: 321,
    sequence: 1,
    status: 'skipped',
    requiredDecisionType: 'request_approval',
    actingFor: null,
    canDecide: false,
    blockers: ['authority_insufficient'],
  },
});

describe('ApprovalInboxPage (COM-04 approvals)', () => {
  it('lists approvals with the caller’s part and what blocks them', async () => {
    routeCalls({
      'me.tasks.summary': () => taskSummary(),
      'me.approvals.list': () => page([myApproval(), blocked]),
    });
    renderPage(<ApprovalInboxPage />, PATH);
    expect(
      await screen.findByText('Approve PR-2026-0003 Emergency borehole pump spares'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Your decision').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Blocked').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Awaiting my decision', { selector: '.tiq-kpi-label' }),
    ).toBeInTheDocument();
  });

  it('filters to approvals awaiting the caller’s decision', async () => {
    const calls = routeCalls({
      'me.tasks.summary': () => taskSummary(),
      'me.approvals.list': () => page([myApproval()]),
    });
    renderPage(<ApprovalInboxPage />, PATH);
    await screen.findAllByText('Approve PR-2026-0002 Chlorine analyser replacement');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Awaiting my decision' }));
    await waitFor(() =>
      expect(
        callsTo(calls, 'me.approvals.list').some(
          (entry) =>
            (entry.request.query as { awaitingMyDecision?: boolean }).awaitingMyDecision === true,
        ),
      ).toBe(true),
    );
  });

  it('opens the decision screen from a row', async () => {
    routeCalls({
      'me.tasks.summary': () => taskSummary(),
      'me.approvals.list': () => page([myApproval()]),
    });
    const { router } = renderPage(<ApprovalInboxPage />, PATH);
    fireEvent.click(await screen.findByText('Approve PR-2026-0002 Chlorine analyser replacement'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/me/approvals/33'));
  });

  it('shows short record codes as references and wraps anything longer as normal text', async () => {
    routeCalls({
      'me.tasks.summary': () => taskSummary(),
      'me.approvals.list': () =>
        page([
          myApproval({
            id: 40,
            subjectReference: 'T-2026-0009',
            subjectLinkPath: '/buyer/tenders/9',
          }),
          myApproval({
            id: 41,
            title: 'Approve the procurement strategy',
            subjectReference: 'Leak-detection market consultation',
            subjectLinkPath: null,
          }),
          myApproval({
            id: 42,
            title: 'Approve the strategy without a request',
            subjectReference: null,
            subjectLinkPath: '/buyer/strategies/504',
          }),
        ]),
    });
    renderPage(<ApprovalInboxPage />, PATH);
    const code = await screen.findByRole('link', { name: 'T-2026-0009' });
    expect(code).toHaveClass('tiq-ref');
    const label = screen.getByText('Leak-detection market consultation');
    expect(label).not.toHaveClass('tiq-ref');
    expect(label.closest('a')).toBeNull();
    expect(screen.getByRole('link', { name: 'Open the record' })).toHaveAttribute(
      'href',
      '/buyer/strategies/504',
    );
  });

  it('shows an empty state without approvals', async () => {
    routeCalls({ 'me.tasks.summary': () => taskSummary(), 'me.approvals.list': () => page([]) });
    renderPage(<ApprovalInboxPage />, PATH);
    expect(await screen.findByText('No approval involves you yet.')).toBeInTheDocument();
  });
});
