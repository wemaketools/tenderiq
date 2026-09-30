/**
 * Draft state of the individual assessment (EVA-02). The form keeps only the cells the evaluator changed; every other
 * cell shows the saved value. A cell without a rating and not marked "not applicable" is NOT SCORED: it is sent as
 * `null`, listed as missing, and never read as zero (AC-18).
 */
import type { Assessment, ScoreCell, ScoreInput } from '@contracts/evaluation';

import { cellKey, orderedCriteria, parseEvidenceRefs } from './scores';

export interface CellDraft {
  readonly score: string;
  readonly isNotApplicable: boolean;
  readonly rationale: string;
  readonly evidence: string;
  readonly clarificationNeeded: boolean;
  readonly clarificationQuestion: string;
}

export function draftOf(cell: ScoreCell | undefined): CellDraft {
  return {
    score: cell?.score ?? '',
    isNotApplicable: cell?.isNotApplicable ?? false,
    rationale: cell?.rationale ?? '',
    evidence: (cell?.evidenceRefs ?? []).join('\n'),
    clarificationNeeded: cell?.clarificationNeeded ?? false,
    clarificationQuestion: cell?.clarificationQuestion ?? '',
  };
}

/** The contract input of one cell. */
export function inputOf(bidId: number, criterionId: number, draft: CellDraft): ScoreInput {
  const rationale = draft.rationale.trim();
  const question = draft.clarificationQuestion.trim();
  return {
    bidId,
    criterionId,
    score: draft.isNotApplicable || draft.score === '' ? null : draft.score,
    isNotApplicable: draft.isNotApplicable,
    rationale: rationale === '' ? null : rationale,
    evidenceRefs: parseEvidenceRefs(draft.evidence),
    clarificationNeeded: draft.clarificationNeeded,
    clarificationQuestion: draft.clarificationNeeded && question !== '' ? question : null,
  };
}

/** Parses a draft key back into its bid and criterion. */
export function splitKey(key: string): { readonly bidId: number; readonly criterionId: number } {
  const [bid, criterion] = key.split(':');
  return { bidId: Number(bid), criterionId: Number(criterion) };
}

export interface CellCheck {
  readonly key: string;
  readonly bidId: number;
  readonly criterionId: number;
  readonly status: 'not_scored' | 'rationale_missing' | 'clarification' | 'ok';
}

/** Checks every cell in scope against the effective (saved + unsaved) values, in bid and plan order. */
export function checkCells(
  assessment: Assessment,
  effective: (key: string) => CellDraft,
): readonly CellCheck[] {
  const criteria = orderedCriteria(assessment.plan, assessment.criterionIds);
  const checks: CellCheck[] = [];
  for (const bid of assessment.bids) {
    for (const criterion of criteria) {
      const key = cellKey(bid.bidId, criterion.criterionId);
      const draft = effective(key);
      const scored = draft.isNotApplicable || draft.score !== '';
      const status = !scored
        ? 'not_scored'
        : !draft.isNotApplicable && draft.rationale.trim() === ''
          ? 'rationale_missing'
          : draft.clarificationNeeded
            ? 'clarification'
            : 'ok';
      checks.push({ key, bidId: bid.bidId, criterionId: criterion.criterionId, status });
    }
  }
  return checks;
}

/** Replaces one cell of an assessment (after a correction) and returns the new assessment. */
export function withCell(assessment: Assessment, cell: ScoreCell): Assessment {
  return {
    ...assessment,
    scores: assessment.scores.map((existing) =>
      existing.bidId === cell.bidId && existing.criterionId === cell.criterionId ? cell : existing,
    ),
  };
}
