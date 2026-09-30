import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { assessment } from '../testing/builders';
import { CHAIR, EVALUATOR, businessError, renderPage, routeCalls } from '../testing/kit';
import AssessmentPage from './AssessmentPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/buyer/evaluation/assignments/:assignmentId/assessment',
  route: '/buyer/evaluation/assignments/3003/assessment',
};

describe('AssessmentPage (EVA-02)', () => {
  it('shows the requirement, response, evidence and scoring guide, and a missing score as "Not scored" (AC-18)', async () => {
    routeCalls({ 'buyer.evaluation.assessment.get': () => assessment() });
    renderPage(<AssessmentPage />, { ...PATH, persona: EVALUATOR });

    expect(await screen.findByText('Describe the telemetry architecture.')).toBeInTheDocument();
    expect(screen.getByText('Dual-path licensed UHF radio.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Technical proposal' })).toHaveAttribute(
      'href',
      '/me/documents/73101',
    );
    expect(screen.getAllByText('Guide for Relevant experience.').length).toBeGreaterThan(0);

    const missing = screen.getByText('C3 Relevant experience').closest('section') ?? document.body;
    expect(within(missing as HTMLElement).getAllByText('Not scored').length).toBeGreaterThan(0);
    expect(screen.getByText('Score the 1 remaining cell, then submit.')).toBeInTheDocument();
    expect(
      screen.getByText(/Other assessors’ scores are hidden until you submit your own assessment/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Prices are never part of the individual assessment/),
    ).toBeInTheDocument();
  });

  it('names the criterion and bid in every score field so identical fields are distinguishable (WCAG 2.4.6)', async () => {
    routeCalls({ 'buyer.evaluation.assessment.get': () => assessment() });
    renderPage(<AssessmentPage />, { ...PATH, persona: EVALUATOR });
    await screen.findByText('Describe the telemetry architecture.');

    const literal = (text: string) => text.replace(/[()]/g, '\\$&');
    const bid = literal('Supplier A (Serowe ICT Solutions)');
    for (const criterion of [
      'C1 Solution quality',
      'C2 Delivery approach',
      'C3 Relevant experience',
    ]) {
      expect(
        screen.getByRole('group', { name: new RegExp(`^Score for ${criterion}, ${bid}$`) }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('combobox', {
          name: new RegExp(`^${literal('Rating (0–5)')} for ${criterion}, ${bid}`),
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('textbox', { name: new RegExp(`^Rationale for ${criterion}, ${bid}`) }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('checkbox', {
          name: new RegExp(`^Request clarification for ${criterion}, ${bid}`),
        }),
      ).toBeInTheDocument();
    }
  });

  it('sends a flagged clarification to the chair as a draft bid clarification (EVA-02 → EVA-03)', async () => {
    const QUESTION =
      'Please confirm whether the Francistown project included analyser integration.';
    const base = assessment();
    const flagged = base.scores.map((item) =>
      item.criterionId === 303
        ? { ...item, clarificationNeeded: true, clarificationQuestion: QUESTION }
        : item,
    );
    const calls = routeCalls({
      'buyer.evaluation.assessment.get': () => ({ ...base, scores: flagged }),
      'buyer.opening.raiseClarification': (request) => {
        const body = (request as { body: Record<string, string> }).body;
        return {
          id: 900,
          tenderId: 3,
          tenderReference: 'T-2026-0003',
          bidId: 3001,
          supplier: { tenantId: 21, name: 'Serowe ICT Solutions' },
          source: 'evaluation',
          question: body.question,
          permittedScope: body.permittedScope,
          dueAt: { at: body.dueAt, timeZone: 'Africa/Gaborone' },
          status: 'draft',
          raisedBy: { userId: 13, fullName: 'Amantle Segwai' },
          raisedAt: '2026-09-30T08:00:00Z',
          approvedBy: null,
          consolidatedIntoId: null,
          consolidatedCount: 0,
          respondedAt: null,
          effect: null,
          responseText: null,
          respondedBy: null,
          effectNote: null,
          attachments: [],
          consolidated: [],
          distributedTo: [],
        };
      },
    });
    renderPage(<AssessmentPage />, { ...PATH, persona: EVALUATOR });

    fireEvent.click(
      await screen.findByRole('button', {
        name: /^Send to the chair for C3 Relevant experience, Supplier A/,
      }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/^Question to the supplier/)).toHaveValue(QUESTION);
    fireEvent.change(within(dialog).getByLabelText(/^Permitted scope/), {
      target: { value: 'Confirmation of the project scope only; no change to the offer.' },
    });
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: '2026-10-20' } });
    fireEvent.change(within(dialog).getByLabelText('Time'), { target: { value: '12:00' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create draft for the chair' }));

    expect(
      (await screen.findAllByText('Draft clarification CL-900 sent to the chair.')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Open bid clarifications' })).toHaveAttribute(
      'href',
      '/buyer/bid-clarifications',
    );
    expect(calls.at(-1)).toEqual({
      id: 'buyer.opening.raiseClarification',
      request: {
        body: {
          bidId: 3001,
          source: 'evaluation',
          question: QUESTION,
          permittedScope: 'Confirmation of the project scope only; no change to the offer.',
          dueAt: '2026-10-20T10:00:00Z',
        },
      },
    });
  });

  it('refuses to send a clarification without a permitted scope and keeps the dialog open', async () => {
    const base = assessment();
    const flagged = base.scores.map((item) =>
      item.criterionId === 303
        ? { ...item, clarificationNeeded: true, clarificationQuestion: 'Please confirm the scope.' }
        : item,
    );
    const calls = routeCalls({
      'buyer.evaluation.assessment.get': () => ({ ...base, scores: flagged }),
    });
    renderPage(<AssessmentPage />, { ...PATH, persona: EVALUATOR });

    fireEvent.click(await screen.findByRole('button', { name: /^Send to the chair for C3/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create draft for the chair' }));

    expect(
      await within(dialog).findByText('State what the supplier may clarify (BR-22).'),
    ).toBeInTheDocument();
    expect(calls.some((item) => item.id === 'buyer.opening.raiseClarification')).toBe(false);
  });

  it('saves only the changed cells as a draft', async () => {
    const calls = routeCalls({
      'buyer.evaluation.assessment.get': () => assessment(),
      'buyer.evaluation.assessment.saveScores': () => assessment(),
    });
    renderPage(<AssessmentPage />, { ...PATH, persona: EVALUATOR });
    await screen.findByText('Describe the telemetry architecture.');

    const ratings = screen.getAllByLabelText(/Rating \(0–5\)/);
    fireEvent.change(ratings[2] as HTMLElement, { target: { value: '4' } });
    const rationales = screen.getAllByLabelText(/^Rationale/);
    fireEvent.change(rationales[2] as HTMLElement, {
      target: { value: 'Three comparable utility projects.' },
    });
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() =>
      expect(
        calls.find((item) => item.id === 'buyer.evaluation.assessment.saveScores')?.request,
      ).toEqual({
        params: { assignmentId: 3003 },
        body: {
          scores: [
            {
              bidId: 3001,
              criterionId: 303,
              score: '4',
              isNotApplicable: false,
              rationale: 'Three comparable utility projects.',
              evidenceRefs: [],
              clarificationNeeded: false,
              clarificationQuestion: null,
            },
          ],
        },
      }),
    );
  });

  it('lists the missing cell as blocking and shows the refusal when submitting an incomplete assessment', async () => {
    routeCalls({
      'buyer.evaluation.assessment.get': () => assessment(),
      'buyer.evaluation.assessment.submit': () => {
        throw businessError(
          'buyer.evaluation.assessment.submit',
          'ASSESSMENT_INCOMPLETE',
          409,
          '1 cell(s) not scored: Relevant experience for Supplier A.',
        );
      },
    });
    renderPage(<AssessmentPage />, { ...PATH, persona: EVALUATOR });

    fireEvent.click(await screen.findByRole('button', { name: 'Submit assessment' }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(
        'Not scored: C3 Relevant experience for Supplier A (Serowe ICT Solutions)',
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByLabelText('I confirm that this assessment is my own independent work.'),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Submit assessment' }));

    expect(
      await within(dialog).findByText(
        /The assessment is incomplete. A missing score is never counted as zero./,
      ),
    ).toBeInTheDocument();
  });

  it('submits with the confirmation and the unsaved cells, then shows the submitted record', async () => {
    const calls = routeCalls({
      'buyer.evaluation.assessment.get': () => assessment(),
      'buyer.evaluation.assessment.submit': () =>
        assessment({
          status: 'submitted',
          submittedAt: '2026-09-30T09:00:00Z',
          peerScores: {
            visibility: 'visible',
            items: [
              {
                evaluator: { userId: 11, fullName: 'Thato Mokgosi' },
                bidId: 3001,
                criterionId: 301,
                score: '4',
                isNotApplicable: false,
                status: 'submitted',
              },
            ],
          },
        }),
    });
    renderPage(<AssessmentPage />, { ...PATH, persona: EVALUATOR });
    await screen.findByText('Describe the telemetry architecture.');
    fireEvent.change(screen.getAllByLabelText(/Rating \(0–5\)/)[2] as HTMLElement, {
      target: { value: '4' },
    });
    fireEvent.change(screen.getAllByLabelText(/^Rationale/)[2] as HTMLElement, {
      target: { value: 'Comparable projects.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Submit assessment' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(
      within(dialog).getByLabelText('I confirm that this assessment is my own independent work.'),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Submit assessment' }));

    expect(await screen.findByText('Assessment submitted')).toBeInTheDocument();
    const submitted = calls.find((item) => item.id === 'buyer.evaluation.assessment.submit');
    expect(submitted?.request).toMatchObject({
      params: { assignmentId: 3003 },
      body: { confirmIndependent: true, scores: [{ bidId: 3001, criterionId: 303, score: '4' }] },
    });
    expect(screen.getByText('Thato Mokgosi')).toBeInTheDocument();
  });

  it('shows the chair a read-only assessment without commands', async () => {
    routeCalls({ 'buyer.evaluation.assessment.get': () => assessment({ readOnly: true }) });
    renderPage(<AssessmentPage />, { ...PATH, persona: CHAIR });
    expect(await screen.findByText('Read-only oversight')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit assessment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
  });

  it('corrects a submitted score with a reason and keeps the history', async () => {
    const base = assessment({ status: 'submitted', submittedAt: '2026-09-18T09:00:00Z' });
    const submittedCells = base.scores.map((item) => ({
      ...item,
      score: item.score ?? '3',
      scoreId: item.bidId * 100 + item.criterionId,
      rationale: item.rationale ?? 'Evidence reviewed.',
      status: 'submitted' as const,
    }));
    const calls = routeCalls({
      'buyer.evaluation.assessment.get': () => ({ ...base, scores: submittedCells }),
      'buyer.evaluation.assessment.correctScore': () => ({
        ...submittedCells[0],
        score: '5',
        version: 2,
        corrections: [
          {
            correctionId: 901,
            previousScore: '4',
            newScore: '5',
            previousRationale: 'Evidence reviewed.',
            reason: 'Misread the redundancy drawing.',
            correctedBy: { userId: 13, fullName: 'Amantle Segwai' },
            correctedAt: '2026-09-30T09:00:00Z',
            returnedByChair: false,
          },
        ],
      }),
    });
    renderPage(<AssessmentPage />, { ...PATH, persona: EVALUATOR });

    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Correct score' }))[0] as HTMLElement,
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(
      within(dialog).getByRole('combobox', {
        name: /^Corrected rating for C1 Solution quality, Supplier A/,
      }),
      { target: { value: '5' } },
    );
    fireEvent.change(within(dialog).getByLabelText(/Reason for the correction/), {
      target: { value: 'Misread the redundancy drawing.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Correct score' }));

    expect(await screen.findByText('Correction history')).toBeInTheDocument();
    expect(calls.at(-1)?.request).toEqual({
      params: { assignmentId: 3003, scoreId: 300401 },
      body: {
        newScore: '5',
        newRationale: 'Evidence reviewed.',
        reason: 'Misread the redundancy drawing.',
      },
    });
  });

  it('explains blocked content and links back to the assignment', async () => {
    routeCalls({
      'buyer.evaluation.assessment.get': () => {
        throw businessError(
          'buyer.evaluation.assessment.get',
          'ASSESSMENT_CONTENT_BLOCKED',
          409,
          'A declared conflict awaits review.',
        );
      },
    });
    renderPage(<AssessmentPage />, { ...PATH, persona: EVALUATOR });
    expect(await screen.findByText('Response content is not available yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the assignment' })).toHaveAttribute(
      'href',
      '/buyer/evaluation/assignments/3003',
    );
  });

  it('explains chair oversight instead of saying independent evaluation does not apply', async () => {
    routeCalls({
      'buyer.evaluation.assessment.get': () =>
        assessment({ readOnly: true, peerScores: { visibility: 'oversight', items: [] } }),
    });
    renderPage(<AssessmentPage />, { ...PATH, persona: CHAIR });

    expect(
      await screen.findByText('Chair oversight: committee scores are reviewed in moderation.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Independent evaluation does not apply to this event.'),
    ).not.toBeInTheDocument();
  });

  it('offers no score correction once moderation is finalized, and says why', async () => {
    const base = assessment({
      status: 'submitted',
      submittedAt: '2026-09-18T09:00:00Z',
      correctionsOpen: false,
    });
    const submittedCells = base.scores.map((item) => ({
      ...item,
      score: item.score ?? '3',
      scoreId: item.bidId * 100 + item.criterionId,
      rationale: item.rationale ?? 'Evidence reviewed.',
      status: 'submitted' as const,
    }));
    routeCalls({ 'buyer.evaluation.assessment.get': () => ({ ...base, scores: submittedCells }) });
    renderPage(<AssessmentPage />, { ...PATH, persona: EVALUATOR });

    expect(
      await screen.findByText(
        /Moderation is finalized: the agreed scores are part of the evaluation record/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Correct score' })).not.toBeInTheDocument();
  });
});
