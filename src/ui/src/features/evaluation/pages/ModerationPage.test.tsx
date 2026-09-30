import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { moderation, overview } from '../testing/builders';
import { CHAIR, OFFICER, businessError, renderPage, routeCalls } from '../testing/kit';
import ModerationPage from './ModerationPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/buyer/evaluation/tenders/:tenderId/moderation',
  route: '/buyer/evaluation/tenders/3/moderation',
};

describe('ModerationPage (EVA-05)', () => {
  it('shows submitted scores side by side, the divergence, and an unsubmitted assessment as "Not submitted"', async () => {
    routeCalls({
      'buyer.evaluation.moderation.get': () => moderation(),
      'buyer.evaluation.get': () => overview(),
    });
    renderPage(<ModerationPage />, { ...PATH, persona: CHAIR });

    const grid = await screen.findByRole('table', { name: 'Assessments side by side' });
    const row = within(grid).getByRole('row', { name: /C1 Solution quality/ });
    expect(within(row).getByText('Kabo Ntsima')).toBeInTheDocument();
    expect(within(row).getByText('Amantle Segwai')).toBeInTheDocument();
    expect(within(row).getByText('Not submitted')).toBeInTheDocument();
    expect(within(row).queryByText('Not scored')).not.toBeInTheDocument();
    expect(within(row).getByText('Divergent')).toBeInTheDocument();
    expect(within(row).getByText('Incomplete: 1 score missing')).toBeInTheDocument();
    expect(within(row).getByText('4 (28.00 points)')).toBeInTheDocument();
    expect(within(row).getByText(/1 superseded/)).toBeInTheDocument();
  });

  it('keeps the original assessments and the superseded agreed score on record (AC-20)', async () => {
    routeCalls({
      'buyer.evaluation.moderation.get': () => moderation(),
      'buyer.evaluation.get': () => overview(),
    });
    renderPage(<ModerationPage />, { ...PATH, persona: CHAIR });
    fireEvent.click(await screen.findByRole('row', { name: /C1 Solution quality Supplier A/ }));

    expect(await screen.findByText('Rationale of Kabo Ntsima.')).toBeInTheDocument();
    expect(
      screen.getByText('Committee agreed 4 after reviewing drawing rev C.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Superseded agreed scores')).toBeInTheDocument();
    expect(screen.getByText('3.5 (Consensus), superseded')).toBeInTheDocument();
    expect(screen.getByText('Provisional midpoint before discussion.')).toBeInTheDocument();
  });

  it('records an agreed score with the method and reasons', async () => {
    const calls = routeCalls({
      'buyer.evaluation.moderation.get': () => moderation(),
      'buyer.evaluation.get': () => overview(),
      'buyer.evaluation.moderation.recordScore': () => {
        const cell = moderation().cells[0];
        if (cell === undefined || cell.current === null) throw new Error('fixture');
        return {
          sessionId: 3501,
          bidId: 3001,
          criterionId: 301,
          current: {
            ...cell.current,
            moderatedScoreId: 901,
            finalScore: '5',
            weightedPoints: '35.0000',
            reasons: 'Exceeds TS-4.1.',
          },
          superseded: { ...cell.current, supersededById: 901 },
        };
      },
    });
    renderPage(<ModerationPage />, { ...PATH, persona: CHAIR });
    fireEvent.click(await screen.findByRole('row', { name: /C1 Solution quality Supplier A/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Record agreed score' }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/The current agreed score 4 is superseded/),
    ).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Agreed rating/), { target: { value: '5' } });
    fireEvent.change(within(dialog).getByLabelText(/^Reasons/), {
      target: { value: 'Exceeds TS-4.1.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record agreed score' }));

    await waitFor(() =>
      expect(
        calls.find((item) => item.id === 'buyer.evaluation.moderation.recordScore')?.request,
      ).toEqual({
        params: { sessionId: 3501 },
        body: {
          bidId: 3001,
          criterionId: 301,
          finalScore: '5',
          method: 'consensus',
          reasons: 'Exceeds TS-4.1.',
        },
      }),
    );
    expect(await screen.findByText('2 superseded', { exact: false })).toBeInTheDocument();
  });

  it('returns a submitted assessment to its evaluator with a reason', async () => {
    const calls = routeCalls({
      'buyer.evaluation.moderation.get': () => moderation(),
      'buyer.evaluation.get': () => overview(),
      'buyer.evaluation.moderation.returnAssessment': () => ({
        assignmentId: 3001,
        status: 'returned',
        returnedAt: '2026-09-30T09:00:00Z',
        returnedBy: { userId: 10, fullName: 'Boitumelo Kgari' },
        reason: 'Rationale does not cite the drawing.',
      }),
    });
    renderPage(<ModerationPage />, { ...PATH, persona: CHAIR });
    fireEvent.click(await screen.findByRole('button', { name: 'Return assessment' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Reason/), {
      target: { value: 'Rationale does not cite the drawing.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Return assessment' }));

    expect(await screen.findByText('Returned for correction')).toBeInTheDocument();
    expect(calls.at(-1)?.request).toEqual({
      params: { assignmentId: 3001 },
      body: { reason: 'Rationale does not cite the drawing.', criterionIds: [], bidIds: [] },
    });
  });

  it('shows why finalization is refused while assessments are incomplete', async () => {
    routeCalls({
      'buyer.evaluation.moderation.get': () => moderation(),
      'buyer.evaluation.get': () => overview(),
      'buyer.evaluation.moderation.finalize': () => {
        throw businessError('buyer.evaluation.moderation.finalize', 'ASSESSMENTS_INCOMPLETE');
      },
    });
    renderPage(<ModerationPage />, { ...PATH, persona: CHAIR });
    fireEvent.click(await screen.findByRole('button', { name: 'Finalize moderation' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Amantle Segwai: 1 cell not scored')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByLabelText(/I confirm the agreed scores/));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Finalize moderation' }));
    expect(
      await within(dialog).findByText('Individual assessments are still incomplete.'),
    ).toBeInTheDocument();
  });

  it('saves the discussion notes', async () => {
    const calls = routeCalls({
      'buyer.evaluation.moderation.get': () => moderation(),
      'buyer.evaluation.get': () => overview(),
      'buyer.evaluation.moderation.updateNotes': () => ({
        sessionId: 3501,
        notes: 'Meeting 22 September. Agreed C1.',
        updatedAt: '2026-09-30T09:00:00Z',
        updatedBy: { userId: 10, fullName: 'Boitumelo Kgari' },
      }),
    });
    renderPage(<ModerationPage />, { ...PATH, persona: CHAIR });
    fireEvent.change(await screen.findByLabelText('Notes of the committee discussion'), {
      target: { value: 'Meeting 22 September. Agreed C1.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save notes' }));
    expect(await screen.findByText(/Saved by Boitumelo Kgari/)).toBeInTheDocument();
    expect(calls.at(-1)?.request).toEqual({
      params: { sessionId: 3501 },
      body: { notes: 'Meeting 22 September. Agreed C1.' },
    });
  });

  it('explains when no moderation session exists yet', async () => {
    routeCalls({
      'buyer.evaluation.get': () => overview(),
      'buyer.evaluation.moderation.get': () => {
        throw businessError('buyer.evaluation.moderation.get', 'MODERATION_NOT_FOUND', 404);
      },
    });
    renderPage(<ModerationPage />, { ...PATH, persona: OFFICER });
    expect(await screen.findByText('No moderation session yet')).toBeInTheDocument();
  });
});
