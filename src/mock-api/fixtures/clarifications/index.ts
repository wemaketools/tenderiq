/**
 * Static fixtures of the clarifications domain (questions, addenda, sessions and the tender projections they
 * need), built from docs/plan/demo-storyline.md. Nothing is persisted; commands return static outcomes.
 */
export { ADDENDA, requiredActionFor } from './addenda.js';
export type { AddendumFixture, AddendumRecipientFixture, RequirementChangeFixture } from './addenda.js';
export { CLOSED_QUESTION_STATUSES, QUESTIONS } from './questions.js';
export type { HistoryFixture, QuestionFixture } from './questions.js';
export { SESSIONS } from './sessions.js';
export type { RegistrationFixture, SessionFixture } from './sessions.js';
export {
  AMENDABLE_TENDER_STATUSES,
  CLARIFICATION_TENDERS,
  clarificationTender,
  currentEffectiveReceipt,
  effectiveReceiptAt,
  receiptStillEffective,
  sessionMinutesDocuments,
  supplierReceipts,
} from './tenders.js';
export type {
  ClarificationLotFixture,
  ClarificationParticipantFixture,
  ClarificationReceiptFact,
  ClarificationRequirementFixture,
  ClarificationTenderFixture,
} from './tenders.js';
