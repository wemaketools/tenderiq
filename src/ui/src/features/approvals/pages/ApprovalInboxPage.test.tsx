import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { callsTo, renderPage, routeCalls } from '../../tasks/test/kit';
import { approvalDetail, myApproval, page, taskSummary } from '../../tasks/test/workspaceData';
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
    // The lede counts the approvals the caller can decide now (1 of the 2), from the complete overview.
    expect(await screen.findByText('1 approval waiting for you.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /To review/ })).toHaveTextContent('1');
    expect(screen.getByText('Choose an approval')).toBeInTheDocument();
  });

  it('maps the views onto the supported query parameters only', async () => {
    const calls = routeCalls({
      'me.tasks.summary': () => taskSummary(),
      'me.approvals.list': () => page([myApproval()]),
    });
    renderPage(<ApprovalInboxPage />, PATH);
    await screen.findAllByText('Approve PR-2026-0002 Chlorine analyser replacement');
    const query = (entry: { request: Record<string, unknown> }) =>
      entry.request.query as {
        awaitingMyDecision?: boolean;
        involvement?: string[];
        status?: string[];
      };
    fireEvent.click(screen.getByRole('tab', { name: /To review/ }));
    await waitFor(() =>
      expect(
        callsTo(calls, 'me.approvals.list').some(
          (entry) => query(entry).awaitingMyDecision === true,
        ),
      ).toBe(true),
    );
    fireEvent.click(screen.getByRole('tab', { name: /Sent/ }));
    await waitFor(() =>
      expect(
        callsTo(calls, 'me.approvals.list').some(
          (entry) => query(entry).involvement?.[0] === 'requester',
        ),
      ).toBe(true),
    );
    fireEvent.click(screen.getByRole('tab', { name: /History/ }));
    await waitFor(() =>
      expect(
        callsTo(calls, 'me.approvals.list').some((entry) => {
          const status = query(entry).status;
          return (
            status !== undefined &&
            status.includes('approved') &&
            status.includes('rejected') &&
            !status.includes('pending') &&
            query(entry).awaitingMyDecision === undefined
          );
        }),
      ).toBe(true),
    );
  });

  it('keeps the advanced filters in a disclosure and sends the overdue filter', async () => {
    const calls = routeCalls({
      'me.tasks.summary': () => taskSummary(),
      'me.approvals.list': () => page([myApproval()]),
    });
    renderPage(<ApprovalInboxPage />, PATH);
    await screen.findAllByText('Approve PR-2026-0002 Chlorine analyser replacement');
    expect(screen.queryByRole('checkbox', { name: 'Overdue only' })).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Filters' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Overdue only' }));
    await waitFor(() =>
      expect(
        callsTo(calls, 'me.approvals.list').some(
          (entry) => (entry.request.query as { overdue?: boolean }).overdue === true,
        ),
      ).toBe(true),
    );
  });

  it('marks the routed approval as selected beside its record and keeps the list on a direct link', async () => {
    routeCalls({
      'me.tasks.summary': () => taskSummary(),
      'me.approvals.list': () => page([myApproval(), blocked]),
      'me.approvals.get': () => approvalDetail(),
    });
    renderPage(<ApprovalInboxPage />, {
      path: '/me/approvals/:approvalId',
      route: '/me/approvals/33',
    });
    const selected = await screen.findByRole('listitem', { current: true });
    expect(selected).toHaveTextContent('Approve PR-2026-0002 Chlorine analyser replacement');
    expect(
      await screen.findByRole('heading', { level: 2, name: /Approve PR-2026-0002/ }),
    ).toBeInTheDocument();
    // Outside the buyer shell the plain label is the H1; the shell renders the headline with "Approvals" as eyebrow.
    expect(screen.getByRole('heading', { level: 1, name: 'Approvals' })).toBeInTheDocument();
    expect(
      screen.getByText('Approve PR-2026-0003 Emergency borehole pump spares'),
    ).toBeInTheDocument();
  });

  it('shows one side at a time below the tablet width, with a way back to the list', async () => {
    const original = window.matchMedia;
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      ...original(query),
      matches: query === '(max-width: 1023px)',
    }));
    routeCalls({
      'me.tasks.summary': () => taskSummary(),
      'me.approvals.list': () => page([myApproval()]),
      'me.approvals.get': () => approvalDetail(),
    });
    const { router } = renderPage(<ApprovalInboxPage />, {
      path: '/me/approvals/:approvalId?',
      route: '/me/approvals/33',
    });
    expect(await screen.findByText('Replace two chlorine analysers.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Your approvals' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: /Approve PR-2026-0002/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Back to approvals' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/me/approvals'));
    expect(await screen.findByRole('list', { name: 'Your approvals' })).toBeInTheDocument();
    expect(screen.queryByText('Choose an approval')).not.toBeInTheDocument();
    vi.restoreAllMocks();
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
