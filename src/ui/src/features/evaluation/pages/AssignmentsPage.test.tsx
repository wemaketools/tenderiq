import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { assignmentPage, assignmentRow, summaryRow } from '../testing/builders';
import { CHAIR, EVALUATOR, renderPage, routeCalls } from '../testing/kit';
import AssignmentsPage from './AssignmentsPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/buyer/evaluation/assignments', route: '/buyer/evaluation/assignments' };

const pendingRow = assignmentRow({
  assignmentId: 1002,
  tender: {
    ...assignmentRow().tender,
    tenderId: 1,
    reference: 'T-2026-0001',
    title: 'Borehole pump replacement programme',
  },
  lot: { lotId: 1103, lotNumber: 3, title: 'Pump control panels and telemetry' },
  status: 'not_started',
  isOverdue: false,
  acceptedAt: null,
  declarations: {
    undertakingAccepted: false,
    conflictDeclared: false,
    hasConflict: null,
    conflictDisposition: null,
  },
  completion: { scored: 0, total: 3, notScored: 3, complete: false },
  nextAction: 'accept',
});

function routes() {
  return routeCalls({
    'buyer.evaluation.assignments.list': () => assignmentPage([assignmentRow(), pendingRow]),
    'buyer.evaluation.list': () => ({ items: [summaryRow()], total: 1, page: 1, pageSize: 100 }),
  });
}

describe('AssignmentsPage (EVA-01)', () => {
  it('shows each assignment with scope, due date, declarations, completion and the next action', async () => {
    routes();
    renderPage(<AssignmentsPage />, { ...PATH, persona: EVALUATOR });

    const scoring = await screen.findByRole('row', {
      name: /T-2026-0003 assignment of Amantle Segwai/,
    });
    expect(within(scoring).getByText('All 2 bids')).toBeInTheDocument();
    expect(within(scoring).getByText('3 criteria')).toBeInTheDocument();
    expect(within(scoring).getByText('Undertaking signed')).toBeInTheDocument();
    expect(within(scoring).getByText('1 not scored')).toBeInTheDocument();
    expect(within(scoring).getByText('Overdue')).toBeInTheDocument();
    expect(within(scoring).getByRole('link', { name: 'Score' })).toHaveAttribute(
      'href',
      '/buyer/evaluation/assignments/3003/assessment',
    );

    const pending = screen.getByRole('row', { name: /T-2026-0001 assignment/ });
    expect(within(pending).getByText('Undertaking not signed')).toBeInTheDocument();
    expect(within(pending).getByText('Conflict not declared')).toBeInTheDocument();
    expect(within(pending).getByRole('link', { name: 'Accept assignment' })).toHaveAttribute(
      'href',
      '/buyer/evaluation/assignments/1002',
    );
    expect(screen.getByText('Declarations pending')).toBeInTheDocument();
  });

  it('offers the committee scope only to the chair and sends it to the API', async () => {
    const calls = routes();
    renderPage(<AssignmentsPage />, { ...PATH, persona: CHAIR });
    await screen.findByRole('row', { name: /T-2026-0003 assignment/ });

    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'submitted' } });

    await waitFor(() =>
      expect(
        calls.filter((item) => item.id === 'buyer.evaluation.assignments.list').at(-1)?.request,
      ).toEqual({
        query: expect.objectContaining({ scope: 'all', status: ['submitted'] }),
      }),
    );
    expect(await screen.findByRole('columnheader', { name: /Evaluator/ })).toBeInTheDocument();
  });

  it('hides the committee scope from an evaluator', async () => {
    routes();
    renderPage(<AssignmentsPage />, { ...PATH, persona: EVALUATOR });
    await screen.findByRole('row', { name: /T-2026-0003 assignment/ });
    expect(screen.queryByLabelText('Show')).not.toBeInTheDocument();
  });

  it('explains an empty list', async () => {
    routeCalls({
      'buyer.evaluation.assignments.list': () => assignmentPage([]),
      'buyer.evaluation.list': () => ({ items: [], total: 0, page: 1, pageSize: 100 }),
    });
    renderPage(<AssignmentsPage />, { ...PATH, persona: EVALUATOR });
    expect(await screen.findByText('No assignments')).toBeInTheDocument();
  });

  it('offers every tender of the caller’s assignments in the tender filter, recused ones included', async () => {
    const recused = assignmentRow({
      assignmentId: 9002,
      tender: {
        ...assignmentRow().tender,
        tenderId: 9,
        reference: 'T-2026-0009',
        title: 'Acoustic leak detection services',
      },
      status: 'recused',
      isOverdue: false,
      nextAction: 'none',
    });
    routeCalls({
      'buyer.evaluation.assignments.list': () => assignmentPage([assignmentRow(), recused]),
      'buyer.evaluation.list': () => ({ items: [summaryRow()], total: 1, page: 1, pageSize: 100 }),
    });
    renderPage(<AssignmentsPage />, { ...PATH, persona: EVALUATOR });

    await screen.findByRole('row', { name: /T-2026-0009 assignment/ });
    const filter = screen.getByLabelText('Tender');
    await waitFor(() =>
      expect(within(filter).getByRole('option', { name: /T-2026-0009/ })).toBeInTheDocument(),
    );
    expect(within(filter).getByRole('option', { name: /T-2026-0003/ })).toBeInTheDocument();
  });
});
