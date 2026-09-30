/**
 * SUP-20 answer drafts: one editable answer per criterion (applicability, N/A reason, the typed answer and the cited
 * evidence items), seeded from the saved application and mapped to the `saveAnswers` body. Only answers the
 * supplier has started are sent.
 */
import type { AnswerInput, SupplierApplicationItem } from '@contracts/qualification';
import type { QualificationAnswersApplicability } from '@contracts/enums';

import { textOrNull } from './validation';

export interface AnswerDraft {
  readonly criterionId: number;
  readonly applicability: QualificationAnswersApplicability;
  readonly naReason: string;
  readonly text: string;
  readonly number: string;
  readonly date: string;
  /** `''` unanswered, `'yes'`, `'no'`. */
  readonly bool: string;
  readonly evidenceItemIds: readonly string[];
}

export function answerDraftOf(item: SupplierApplicationItem): AnswerDraft {
  const answer = item.answer;
  return {
    criterionId: item.criterion.id,
    applicability: answer?.applicability ?? 'applicable',
    naReason: answer?.naReason ?? '',
    text: answer?.answerText ?? '',
    number: answer?.answerNumber ?? '',
    date: answer?.answerDate ?? '',
    bool:
      answer?.answerBool === null || answer?.answerBool === undefined
        ? ''
        : answer.answerBool
          ? 'yes'
          : 'no',
    evidenceItemIds: item.evidence.map((evidence) => String(evidence.evidenceItemId)),
  };
}

export function isStarted(draft: AnswerDraft): boolean {
  return (
    draft.applicability === 'not_applicable' ||
    draft.text.trim() !== '' ||
    draft.number.trim() !== '' ||
    draft.date !== '' ||
    draft.bool !== '' ||
    draft.evidenceItemIds.length > 0
  );
}

export function answerInput(draft: AnswerDraft): AnswerInput {
  const applicable = draft.applicability === 'applicable';
  return {
    criterionId: draft.criterionId,
    applicability: draft.applicability,
    naReason: applicable ? null : textOrNull(draft.naReason),
    answerText: applicable ? textOrNull(draft.text) : null,
    answerNumber: applicable ? textOrNull(draft.number) : null,
    answerDate: applicable && draft.date !== '' ? draft.date : null,
    answerBool: applicable && draft.bool !== '' ? draft.bool === 'yes' : null,
    evidenceItemIds: applicable ? draft.evidenceItemIds.map(Number) : [],
  };
}

export function answersBody(drafts: readonly AnswerDraft[]): { answers: AnswerInput[] } {
  return { answers: drafts.filter(isStarted).map(answerInput) };
}
