/**
 * Clarifications contract: tender questions and answers, addenda and date changes, briefings and site visits, and
 * the public clarification edition (FR-10; BR-13, BR-14, BR-16, BR-41; PRD §14.2; screens BUY-16, BUY-17, BUY-18,
 * SUP-10, SUP-11, PUB-04; acceptance scenario AC-10).
 *
 * Business rules the contract carries (Stage B enforces them with the declared error codes):
 * - Questions: a question submitted after the question deadline needs an explicit late disposition before anything
 *   else happens to it. An owner is assigned, prepares a draft answer and a sanitized question (no questioner
 *   identity, no commercially sensitive wording), a second person reviews confidentiality, and the answer is
 *   published to all participants or the public, answered privately (only a legitimately supplier-specific answer
 *   that does not change the competition), escalated to an addendum, or declined.
 * - Suppliers see their own questions in full; other suppliers' questions only as published sanitized answers; never
 *   another supplier's private case. The public sees only answers published with audience `public`.
 * - Addenda: materiality, change areas, affected lots and requirement changes (before/after), response-time
 *   assessment, optional new submission deadline, the action required of suppliers who already submitted
 *   (acknowledge, supplement or replace), approval (`approval_requests.subject_type = addendum`), and issue with
 *   recipients and the separate delivery, opening and acknowledgment events (BR-41). A deadline changes ONLY through
 *   an issued addendum (BR-13, BR-16). Issuing never touches existing receipts (AC-10).
 * - Sessions: briefing or site visit with capacity, registration deadline, mandatory flag (declared in advance),
 *   alternatives, accessibility needs, attendance and minutes whose material answers are shared with the whole
 *   competition audience.
 *
 * Field names mirror the blueprint (Migration 08: questions, addenda, addendum_lots, addendum_requirement_changes,
 * sessions, session_registrations; Migration 04: notices, notice_recipients). Buyer lists are scoped to the active
 * buyer tenant, supplier lists to the tenders the active supplier participates in, and the public edition to
 * tenders on the public portal (DD-13, DD-22).
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import {
  CalendarDate,
  Id,
  IdParam,
  Instant,
  OfficialDeadline,
  PersonRef,
  QueryBoolean,
  ReasonText,
  Reference,
  Slug,
  TimeZone,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from './common.js';
import { defineEndpoint } from './endpoint.js';
import {
  AddendaExistingSubmissionAction,
  AddendaMateriality,
  AddendaStatus,
  AddendumRequirementChangesChangeType,
  ApprovalRequestsStatus,
  LotsStage,
  NoticeRecipientsDeliveryStatus,
  NoticesNoticeType,
  QuestionsAudience,
  QuestionsLateDisposition,
  QuestionsStatus,
  RequirementsTreatment,
  SessionRegistrationsStatus,
  SessionsSessionType,
  SessionsStatus,
  TendersEventType,
  TendersParticipation,
  TendersStatus,
} from './enums.js';

// ---------------------------------------------------------------------------------------------------------
// Local option lists (request options and derived values; stored columns use the enums.ts lists)
// ---------------------------------------------------------------------------------------------------------

/** What a question is asked against (derived from lot_id, requirement_id and document_id). BUY-16 "category". */
export const QUESTION_SUBJECT_TYPES = ['tender', 'lot', 'requirement', 'document'] as const;
export const QuestionSubjectType = z.enum(QUESTION_SUBJECT_TYPES);
export type QuestionSubjectType = (typeof QUESTION_SUBJECT_TYPES)[number];

/** The shared audiences a published answer can have (`questions.audience` without `private`). */
export const SHARED_ANSWER_AUDIENCES = ['all_participants', 'public'] as const;
export const SharedAnswerAudience = z.enum(SHARED_ANSWER_AUDIENCES);
export type SharedAnswerAudience = (typeof SHARED_ANSWER_AUDIENCES)[number];

/** Outcome of the confidentiality review of a draft answer. */
export const CONFIDENTIALITY_REVIEW_OUTCOMES = ['cleared', 'returned'] as const;
export const ConfidentialityReviewOutcome = z.enum(CONFIDENTIALITY_REVIEW_OUTCOMES);
export type ConfidentialityReviewOutcome = (typeof CONFIDENTIALITY_REVIEW_OUTCOMES)[number];

/** How an attendance exception (absence from a mandatory session) is resolved, the same way for every supplier. */
export const ATTENDANCE_EXCEPTION_RESOLUTIONS = ['offer_alternative', 'confirm_not_met'] as const;
export const AttendanceExceptionResolution = z.enum(ATTENDANCE_EXCEPTION_RESOLUTIONS);
export type AttendanceExceptionResolution = (typeof ATTENDANCE_EXCEPTION_RESOLUTIONS)[number];

/** Attendance values the buyer records (`session_registrations.status` after the session). */
export const ATTENDANCE_OUTCOMES = ['attended', 'absent'] as const;
export const AttendanceOutcome = z.enum(ATTENDANCE_OUTCOMES);
export type AttendanceOutcome = (typeof ATTENDANCE_OUTCOMES)[number];

/**
 * Codes of the checks that block an addendum from moving on (submit for approval or issue). The SPA shows each
 * through its catalog; Stage B computes them.
 */
export const ADDENDUM_BLOCKING_ISSUES = [
  'RESPONSE_TIME_ASSESSMENT_REQUIRED',
  'CHANGE_AREA_REQUIRED',
  'AFFECTED_LOTS_REQUIRED',
  'APPROVAL_PENDING',
  'APPROVAL_REQUIRED',
  'NEW_DEADLINE_IN_PAST',
] as const;
export const AddendumBlockingIssue = z.enum(ADDENDUM_BLOCKING_ISSUES);
export type AddendumBlockingIssue = (typeof ADDENDUM_BLOCKING_ISSUES)[number];

// ---------------------------------------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------------------------------------

/** An organization named on a clarification record (buyer or supplier). */
export const OrganizationRef = z.object({
  tenantId: Id,
  name: z.string().min(1),
});
export type OrganizationRef = z.infer<typeof OrganizationRef>;

/** The tender a clarification record belongs to. */
export const TenderRef = z.object({
  tenderId: Id,
  reference: Reference,
  title: z.string().min(1),
});
export type TenderRef = z.infer<typeof TenderRef>;

/** A lot reference (`lots.lot_no`, `lots.title`). */
export const LotRef = z.object({
  lotId: Id,
  lotNo: z.number().int().positive(),
  title: z.string().min(1),
});
export type LotRef = z.infer<typeof LotRef>;

/** A requirement reference (`requirements.ref_code`). */
export const RequirementRef = z.object({
  requirementId: Id,
  refCode: z.string().min(1),
});
export type RequirementRef = z.infer<typeof RequirementRef>;

/** A tender document a question refers to, or session minutes. */
export const DocumentRef = z.object({
  documentId: Id,
  title: z.string().min(1),
});
export type DocumentRef = z.infer<typeof DocumentRef>;

/** One event in the handling history of a record (from the audit trail). */
export const ClarificationHistoryEntry = z.object({
  at: Instant,
  action: z.string().regex(/^[a-z][a-z_]*$/),
  actor: PersonRef.nullable(),
  note: z.string().nullable(),
});
export type ClarificationHistoryEntry = z.infer<typeof ClarificationHistoryEntry>;

/** One requirement change of an addendum (`addendum_requirement_changes`), before and after. */
export const RequirementChange = z.object({
  id: Id,
  requirementId: Id,
  refCode: z.string().min(1),
  lotId: Id.nullable(),
  changeType: AddendumRequirementChangesChangeType,
  previousText: z.string().nullable(),
  newText: z.string().nullable(),
  previousTreatment: RequirementsTreatment.nullable(),
  newTreatment: RequirementsTreatment.nullable(),
});
export type RequirementChange = z.infer<typeof RequirementChange>;

/** A published, sanitized answer as any eligible participant (or the public) sees it: no questioner identity. */
export const SharedAnswer = z.object({
  questionId: Id,
  sanitizedQuestion: z.string().min(1),
  answerText: z.string().min(1),
  audience: SharedAnswerAudience,
  publishedAt: Instant,
  lot: LotRef.nullable(),
  requirement: RequirementRef.nullable(),
  sessionId: Id.nullable(),
});
export type SharedAnswer = z.infer<typeof SharedAnswer>;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, issue('TEXT_TOO_LONG', `At most ${max} characters.`));

const requiredText = (code: string, label: string, max: number) =>
  z
    .string({ error: issue(code, `${label} is required.`) })
    .trim()
    .min(1, issue(code, `${label} is required.`))
    .max(max, issue('TEXT_TOO_LONG', `At most ${max} characters.`));

// ---------------------------------------------------------------------------------------------------------
// Buyer: tender overview and context
// ---------------------------------------------------------------------------------------------------------

/** One tender of the buyer with its clarification workload (BUY-16..18 tender picker and queue header). */
export const BuyerClarificationTender = TenderRef.extend({
  status: TendersStatus,
  eventType: TendersEventType,
  participation: TendersParticipation,
  officialTimeZone: TimeZone,
  currentVersionNo: z.number().int().min(0),
  questionsDeadline: OfficialDeadline.nullable(),
  submissionDeadline: OfficialDeadline.nullable(),
  owner: PersonRef,
  openQuestions: z.number().int().min(0),
  unassignedQuestions: z.number().int().min(0),
  lateQuestionsAwaitingDisposition: z.number().int().min(0),
  addendaInProgress: z.number().int().min(0),
  issuedAddenda: z.number().int().min(0),
  pendingAcknowledgments: z.number().int().min(0),
  upcomingSessions: z.number().int().min(0),
});
export type BuyerClarificationTender = z.infer<typeof BuyerClarificationTender>;

export const BuyerClarificationTenderQuery = listQueryWithSort(['reference', 'questionsDeadline', 'openQuestions'] as const).extend({
  status: queryList(TendersStatus).optional(),
  withOpenWork: QueryBoolean.optional(),
});
export type BuyerClarificationTenderQuery = z.output<typeof BuyerClarificationTenderQuery>;

/** A requirement as the addendum and question forms list it. */
export const TenderRequirement = z.object({
  requirementId: Id,
  lotId: Id.nullable(),
  section: z.string().min(1),
  refCode: z.string().min(1),
  text: z.string().min(1),
  treatment: RequirementsTreatment,
});
export type TenderRequirement = z.infer<typeof TenderRequirement>;

/** A participant as the clarification screens need it (identity, whether an effective submission exists). */
export const TenderParticipantSummary = z.object({
  supplier: OrganizationRef,
  hasEffectiveSubmission: z.boolean(),
  effectiveReceiptNo: z.string().nullable(),
  receivedAt: Instant.nullable(),
});
export type TenderParticipantSummary = z.infer<typeof TenderParticipantSummary>;

/** Everything the buyer forms need about one tender: lots, requirements, documents, participants and dates. */
export const BuyerTenderContext = BuyerClarificationTender.extend({
  lots: z.array(
    LotRef.extend({
      stage: LotsStage,
      submissionDeadline: OfficialDeadline.nullable(),
    }),
  ),
  requirements: z.array(TenderRequirement),
  documents: z.array(DocumentRef),
  participants: z.array(TenderParticipantSummary),
  /** Addenda can still be issued (tender open or ready, not closed). */
  amendable: z.boolean(),
});
export type BuyerTenderContext = z.infer<typeof BuyerTenderContext>;

/** A buyer user who may own clarification work on the tender (`tender.clarifications.manage`). */
export const ClarificationOwnerCandidate = PersonRef.extend({
  capacity: z.string().nullable(),
  openQuestions: z.number().int().min(0),
});
export type ClarificationOwnerCandidate = z.infer<typeof ClarificationOwnerCandidate>;

export const OwnerCandidatesQuery = z.object({
  tenderId: IdParam.optional(),
});

// ---------------------------------------------------------------------------------------------------------
// Buyer: questions (BUY-16)
// ---------------------------------------------------------------------------------------------------------

/** A question in the buyer's Q&A queue. The buyer sees the questioner's identity; shared answers never do. */
export const BuyerQuestionRow = z.object({
  id: Id,
  tender: TenderRef,
  supplier: OrganizationRef,
  askedBy: PersonRef,
  subjectType: QuestionSubjectType,
  lot: LotRef.nullable(),
  requirement: RequirementRef.nullable(),
  document: DocumentRef.nullable(),
  questionText: z.string().min(1),
  submittedAt: Instant,
  afterDeadline: z.boolean(),
  lateDisposition: QuestionsLateDisposition.nullable(),
  owner: PersonRef.nullable(),
  status: QuestionsStatus,
  audience: QuestionsAudience,
  /** Target date for the answer (question handling policy); `null` once closed. */
  responseDueAt: Instant.nullable(),
  publishedAt: Instant.nullable(),
  addendumId: Id.nullable(),
  addendumNumber: z.number().int().positive().nullable(),
  /** Asked during this briefing or site visit and recorded from its minutes. */
  sessionId: Id.nullable(),
});
export type BuyerQuestionRow = z.infer<typeof BuyerQuestionRow>;

export const BuyerQuestionDetail = BuyerQuestionRow.extend({
  lateDispositionReason: z.string().nullable(),
  sanitizedQuestion: z.string().nullable(),
  answerText: z.string().nullable(),
  confidentialityReviewedBy: PersonRef.nullable(),
  timeZone: TimeZone,
  history: z.array(ClarificationHistoryEntry),
});
export type BuyerQuestionDetail = z.infer<typeof BuyerQuestionDetail>;

export const QUESTION_SORT_FIELDS = ['submittedAt', 'responseDueAt', 'status', 'tenderReference'] as const;

export const BuyerQuestionListQuery = listQueryWithSort(QUESTION_SORT_FIELDS).extend({
  tenderId: IdParam.optional(),
  status: queryList(QuestionsStatus).optional(),
  audience: queryList(QuestionsAudience).optional(),
  ownerUserId: IdParam.optional(),
  supplierTenantId: IdParam.optional(),
  unassigned: QueryBoolean.optional(),
  afterDeadline: QueryBoolean.optional(),
  submittedFrom: CalendarDate.optional(),
  submittedTo: CalendarDate.optional(),
});
export type BuyerQuestionListQuery = z.output<typeof BuyerQuestionListQuery>;

export const QuestionParams = z.object({ questionId: IdParam });

export const AssignQuestionBody = z.object({
  ownerUserId: Id,
  note: optionalText(2000).optional(),
});

export const LateDispositionBody = z.object({
  lateDisposition: QuestionsLateDisposition,
  lateDispositionReason: requiredText('REASON_REQUIRED', 'A reason', 4000),
});

export const SaveAnswerBody = z.object({
  sanitizedQuestion: requiredText('SANITIZED_QUESTION_REQUIRED', 'The shared wording of the question', 4000),
  answerText: requiredText('ANSWER_REQUIRED', 'An answer', 8000),
  audience: QuestionsAudience,
});

export const RequestReviewBody = z.object({
  note: optionalText(2000).optional(),
});

export const ConfidentialityReviewBody = z.object({
  outcome: ConfidentialityReviewOutcome,
  note: optionalText(2000).optional(),
});

export const PublishAnswerBody = z.object({
  audience: SharedAnswerAudience,
});

export const PrivateAnswerBody = z.object({
  answerText: requiredText('ANSWER_REQUIRED', 'An answer', 8000),
  reason: ReasonText,
  /** The owner confirms the answer does not change scope, terms, submission or evaluation (FR-10, BR-14). */
  notMaterialConfirmed: z.literal(true, { error: issue('CONFIRMATION_REQUIRED', 'Confirm the answer is not material.') }),
});

export const EscalateQuestionBody = z.object({
  reason: ReasonText,
  /** An existing draft addendum of the same tender; omitted = a new draft addendum is created. */
  addendumId: Id.optional(),
});

export const DeclineQuestionBody = z.object({
  reason: ReasonText,
});

/** Result of escalating a question: the question and the draft addendum that absorbs it. */
export const EscalateQuestionResult = z.object({
  question: BuyerQuestionDetail,
  addendum: z.object({ id: Id, number: z.number().int().positive(), status: AddendaStatus, title: z.string().min(1) }),
});
export type EscalateQuestionResult = z.infer<typeof EscalateQuestionResult>;

// ---------------------------------------------------------------------------------------------------------
// Buyer: addenda (BUY-17)
// ---------------------------------------------------------------------------------------------------------

/** Acknowledgment tally of an addendum across its recipients. */
export const AcknowledgmentTally = z.object({
  recipients: z.number().int().min(0),
  delivered: z.number().int().min(0),
  failed: z.number().int().min(0),
  acknowledged: z.number().int().min(0),
  actionOutstanding: z.number().int().min(0),
});
export type AcknowledgmentTally = z.infer<typeof AcknowledgmentTally>;

export const AddendumChangeAreas = z.object({
  changesScope: z.boolean(),
  changesTerms: z.boolean(),
  changesSubmission: z.boolean(),
  changesEvaluation: z.boolean(),
});

export const BuyerAddendumRow = AddendumChangeAreas.extend({
  id: Id,
  tender: TenderRef,
  number: z.number().int().positive(),
  title: z.string().min(1),
  materiality: AddendaMateriality,
  status: AddendaStatus,
  newSubmissionDeadline: OfficialDeadline.nullable(),
  existingSubmissionAction: AddendaExistingSubmissionAction,
  affectedLots: z.array(LotRef),
  issuedAt: Instant.nullable(),
  resultingVersionNo: z.number().int().positive().nullable(),
  approvalRequestId: Id.nullable(),
  approvalStatus: ApprovalRequestsStatus.nullable(),
  acknowledgments: AcknowledgmentTally.nullable(),
  createdAt: Instant,
  createdBy: PersonRef,
});
export type BuyerAddendumRow = z.infer<typeof BuyerAddendumRow>;

/** One recipient organization of an issued addendum notice (notice_recipients + participant_acknowledgments). */
export const AddendumRecipient = z.object({
  supplier: OrganizationRef,
  deliveryStatus: NoticeRecipientsDeliveryStatus,
  deliveredAt: Instant.nullable(),
  openedAt: Instant.nullable(),
  acknowledgedAt: Instant.nullable(),
  acknowledgedBy: PersonRef.nullable(),
  failureReason: z.string().nullable(),
  /** The supplier had an effective submission when the addendum was issued. */
  hadSubmissionAtIssue: z.boolean(),
  /** That submission's receipt; issuing an addendum never alters it (AC-10). */
  priorReceiptNo: z.string().nullable(),
  /** The prior receipt is still the supplier's effective one (false once the supplier's own later submission superseded it). */
  priorReceiptStillEffective: z.boolean(),
  requiredAction: AddendaExistingSubmissionAction,
  requiredActionCompleted: z.boolean(),
});
export type AddendumRecipient = z.infer<typeof AddendumRecipient>;

export const BuyerAddendumDetail = BuyerAddendumRow.extend({
  changeDescription: z.string().min(1),
  reason: z.string().min(1),
  responseTimeAssessment: z.string().nullable(),
  currentSubmissionDeadline: OfficialDeadline.nullable(),
  requirementChanges: z.array(RequirementChange),
  notice: z
    .object({
      noticeId: Id,
      noticeType: NoticesNoticeType,
      title: z.string().min(1),
      issuedAt: Instant,
      requiresAcknowledgment: z.boolean(),
    })
    .nullable(),
  recipients: z.array(AddendumRecipient),
  sourceQuestions: z.array(z.object({ questionId: Id, supplier: OrganizationRef, questionText: z.string().min(1) })),
  blockingIssues: z.array(AddendumBlockingIssue),
  withdrawnReason: z.string().nullable(),
  history: z.array(ClarificationHistoryEntry),
});
export type BuyerAddendumDetail = z.infer<typeof BuyerAddendumDetail>;

export const BuyerAddendumListQuery = listQueryWithSort(['number', 'issuedAt', 'status', 'tenderReference', 'createdAt'] as const).extend({
  tenderId: IdParam.optional(),
  status: queryList(AddendaStatus).optional(),
  materiality: AddendaMateriality.optional(),
  changesDeadline: QueryBoolean.optional(),
  issuedFrom: CalendarDate.optional(),
  issuedTo: CalendarDate.optional(),
});
export type BuyerAddendumListQuery = z.output<typeof BuyerAddendumListQuery>;

export const AddendumParams = z.object({ addendumId: IdParam });

export const RequirementChangeInput = z.object({
  /** Omitted for an `added` requirement (Stage B creates it); required for `modified` and `removed`. */
  requirementId: Id.optional(),
  refCode: requiredText('REF_CODE_REQUIRED', 'A requirement reference', 40),
  lotId: Id.nullable(),
  changeType: AddendumRequirementChangesChangeType,
  newText: optionalText(8000).nullable(),
  newTreatment: RequirementsTreatment.nullable(),
});
export type RequirementChangeInput = z.infer<typeof RequirementChangeInput>;

export const AddendumFields = AddendumChangeAreas.extend({
  title: requiredText('TITLE_REQUIRED', 'A title', 300),
  changeDescription: requiredText('CHANGE_DESCRIPTION_REQUIRED', 'A description of the change', 8000),
  reason: requiredText('REASON_REQUIRED', 'A reason', 4000),
  materiality: AddendaMateriality,
  newSubmissionDeadline: Instant.nullable(),
  responseTimeAssessment: optionalText(4000).nullable(),
  existingSubmissionAction: AddendaExistingSubmissionAction,
  lotIds: z.array(Id).max(50),
  requirementChanges: z.array(RequirementChangeInput).max(100),
});

export const CreateAddendumBody = AddendumFields.extend({
  tenderId: Id,
  sourceQuestionIds: z.array(Id).max(50),
});
export type CreateAddendumBody = z.infer<typeof CreateAddendumBody>;

export const UpdateAddendumBody = AddendumFields;
export type UpdateAddendumBody = z.infer<typeof UpdateAddendumBody>;

export const SubmitAddendumBody = z.object({
  note: optionalText(2000).optional(),
});

export const IssueAddendumBody = z.object({
  /** COM-02: the issuer confirms the organization, scope and recipients shown in the confirmation. */
  confirmed: z.literal(true, { error: issue('CONFIRMATION_REQUIRED', 'Confirm the issue.') }),
});

export const WithdrawAddendumBody = z.object({
  reason: ReasonText,
});

export const RemindRecipientsBody = z.object({
  /** Recipient organizations to remind; omitted = every recipient with an outstanding action. */
  supplierTenantIds: z.array(Id).max(100).optional(),
});

export const RemindRecipientsResult = z.object({
  addendumId: Id,
  reminded: z.array(OrganizationRef),
  sentAt: Instant,
});
export type RemindRecipientsResult = z.infer<typeof RemindRecipientsResult>;

// ---------------------------------------------------------------------------------------------------------
// Buyer: sessions (BUY-18)
// ---------------------------------------------------------------------------------------------------------

const SessionCore = z.object({
  id: Id,
  tender: TenderRef,
  lot: LotRef.nullable(),
  sessionType: SessionsSessionType,
  title: z.string().min(1),
  startsAt: Instant,
  endsAt: Instant,
  timeZone: TimeZone,
  venue: z.string().min(1),
  instructions: z.string().nullable(),
  capacity: z.number().int().positive(),
  placesAvailable: z.number().int().min(0),
  mandatory: z.boolean(),
  alternativeOf: z.object({ id: Id, title: z.string().min(1), startsAt: Instant }).nullable(),
  alternatives: z.array(z.object({ id: Id, title: z.string().min(1), startsAt: Instant, placesAvailable: z.number().int().min(0) })),
  accessibilityInfo: z.string().nullable(),
  registrationDeadline: OfficialDeadline.nullable(),
  minutesDocument: DocumentRef.nullable(),
  minutesPublishedAt: Instant.nullable(),
  status: SessionsStatus,
});

export const BuyerSessionRow = SessionCore.extend({
  registered: z.number().int().min(0),
  attended: z.number().int().min(0),
  absent: z.number().int().min(0),
  accessibilityRequests: z.number().int().min(0),
  openAttendanceExceptions: z.number().int().min(0),
});
export type BuyerSessionRow = z.infer<typeof BuyerSessionRow>;

export const AttendanceExceptionRecord = z.object({
  resolution: AttendanceExceptionResolution,
  note: z.string().min(1),
  resolvedAt: Instant,
  resolvedBy: PersonRef,
  alternativeSessionId: Id.nullable(),
});
export type AttendanceExceptionRecord = z.infer<typeof AttendanceExceptionRecord>;

export const BuyerSessionRegistration = z.object({
  id: Id,
  supplier: OrganizationRef,
  registeredBy: PersonRef,
  attendeeNames: z.array(z.string().min(1)),
  accessibilityNeeds: z.string().nullable(),
  status: SessionRegistrationsStatus,
  attendanceRecordedBy: PersonRef.nullable(),
  attendanceRecordedAt: Instant.nullable(),
  createdAt: Instant,
  /** Absent from a mandatory session: resolved the same way for every supplier. */
  attendanceException: z.boolean(),
  exceptionResolution: AttendanceExceptionRecord.nullable(),
});
export type BuyerSessionRegistration = z.infer<typeof BuyerSessionRegistration>;

export const BuyerSessionDetail = BuyerSessionRow.extend({
  registrations: z.array(BuyerSessionRegistration),
  /** Documents related to this session that can be issued as its official minutes (documents domain, DD-12). */
  minutesDocumentOptions: z.array(DocumentRef),
  sharedAnswers: z.array(SharedAnswer),
  cancellationReason: z.string().nullable(),
  history: z.array(ClarificationHistoryEntry),
});
export type BuyerSessionDetail = z.infer<typeof BuyerSessionDetail>;

export const BuyerSessionListQuery = listQueryWithSort(['startsAt', 'title', 'tenderReference', 'status'] as const).extend({
  tenderId: IdParam.optional(),
  sessionType: SessionsSessionType.optional(),
  status: queryList(SessionsStatus).optional(),
  mandatory: QueryBoolean.optional(),
  startsFrom: CalendarDate.optional(),
  startsTo: CalendarDate.optional(),
});
export type BuyerSessionListQuery = z.output<typeof BuyerSessionListQuery>;

export const SessionParams = z.object({ sessionId: IdParam });

export const SessionFields = z.object({
  lotId: Id.nullable(),
  sessionType: SessionsSessionType,
  title: requiredText('TITLE_REQUIRED', 'A title', 300),
  startsAt: Instant,
  endsAt: Instant,
  venue: requiredText('VENUE_REQUIRED', 'A venue or joining instructions', 1000),
  instructions: optionalText(4000).nullable(),
  capacity: z
    .number({ error: issue('CAPACITY_REQUIRED', 'Enter the number of places.') })
    .int(issue('CAPACITY_INVALID', 'Use a whole number.'))
    .min(1, issue('CAPACITY_INVALID', 'At least one place.'))
    .max(1000, issue('CAPACITY_INVALID', 'At most 1000 places.')),
  mandatory: z.boolean(),
  alternativeOfId: Id.nullable(),
  accessibilityInfo: optionalText(4000).nullable(),
  registrationDeadline: Instant.nullable(),
});

export const CreateSessionBody = SessionFields.extend({ tenderId: Id });
export type CreateSessionBody = z.infer<typeof CreateSessionBody>;
export const UpdateSessionBody = SessionFields;
export type UpdateSessionBody = z.infer<typeof UpdateSessionBody>;

export const CancelSessionBody = z.object({ reason: ReasonText });

export const RecordAttendanceBody = z.object({
  entries: z
    .array(z.object({ registrationId: Id, status: AttendanceOutcome }))
    .min(1, issue('ATTENDANCE_REQUIRED', 'Record at least one attendance.'))
    .max(200),
});

export const SharedAnswerInput = z.object({
  /** The supplier whose question was raised at the session (kept private; never shown to others). */
  supplierTenantId: Id,
  sanitizedQuestion: requiredText('SANITIZED_QUESTION_REQUIRED', 'The shared wording of the question', 4000),
  answerText: requiredText('ANSWER_REQUIRED', 'An answer', 8000),
});

export const PublishMinutesBody = z.object({
  /** The official minutes file (a document related to the session); null = the shared answers are the minutes record. */
  minutesDocumentId: Id.nullable(),
  audience: SharedAnswerAudience,
  sharedAnswers: z.array(SharedAnswerInput).max(100),
});

export const ResolveAttendanceExceptionParams = z.object({ sessionId: IdParam, registrationId: IdParam });

export const ResolveAttendanceExceptionBody = z.object({
  resolution: AttendanceExceptionResolution,
  alternativeSessionId: Id.nullable(),
  note: ReasonText,
});

// ---------------------------------------------------------------------------------------------------------
// Supplier (SUP-10, SUP-11)
// ---------------------------------------------------------------------------------------------------------

/** What an issued addendum still requires of the supplier, and by when (the tender's current submission deadline). */
export const SupplierAddendumDue = z.object({
  addendumId: Id,
  number: z.number().int().positive(),
  requiredAction: AddendaExistingSubmissionAction,
  acknowledgmentOutstanding: z.boolean(),
  /** A supplement or replacement of the existing submission is still due. */
  submissionActionOutstanding: z.boolean(),
  dueBy: OfficialDeadline.nullable(),
});
export type SupplierAddendumDue = z.infer<typeof SupplierAddendumDue>;

/** A tender the supplier participates in, with its clarification status for this supplier. */
export const SupplierClarificationTender = TenderRef.extend({
  buyer: OrganizationRef,
  status: TendersStatus,
  officialTimeZone: TimeZone,
  currentVersionNo: z.number().int().min(0),
  questionsDeadline: OfficialDeadline.nullable(),
  submissionDeadline: OfficialDeadline.nullable(),
  /** Questions are accepted now (the tender is open; a late question is still recorded and flagged). */
  acceptingQuestions: z.boolean(),
  ownQuestions: z.number().int().min(0),
  awaitingAnswer: z.number().int().min(0),
  publishedAnswers: z.number().int().min(0),
  addendaToAcknowledge: z.number().int().min(0),
  /** Issued addenda still requiring something of this supplier: an acknowledgment or a supplement/replacement (AC-10). */
  addendaActionOutstanding: z.number().int().min(0),
  /** The most urgent outstanding addendum action (a supplement or replacement before an acknowledgment), or null. */
  nextAddendumAction: SupplierAddendumDue.nullable(),
  upcomingSessions: z.number().int().min(0),
});
export type SupplierClarificationTender = z.infer<typeof SupplierClarificationTender>;

export const SupplierTenderQuery = listQueryWithSort(['reference', 'questionsDeadline', 'submissionDeadline'] as const).extend({
  status: queryList(TendersStatus).optional(),
});

export const TenderParams = z.object({ tenderId: IdParam });

/** The package the question form needs: lots, requirements and documents of the current version. */
export const SupplierTenderContext = SupplierClarificationTender.extend({
  lots: z.array(LotRef),
  requirements: z.array(TenderRequirement),
  documents: z.array(DocumentRef),
});
export type SupplierTenderContext = z.infer<typeof SupplierTenderContext>;

/** The supplier's own question. The answer shows once published or answered privately. */
export const SupplierQuestionRow = z.object({
  id: Id,
  tender: TenderRef,
  buyer: OrganizationRef,
  askedBy: PersonRef,
  subjectType: QuestionSubjectType,
  lot: LotRef.nullable(),
  requirement: RequirementRef.nullable(),
  document: DocumentRef.nullable(),
  questionText: z.string().min(1),
  submittedAt: Instant,
  afterDeadline: z.boolean(),
  lateDisposition: QuestionsLateDisposition.nullable(),
  status: QuestionsStatus,
  /** Audience of the reply once answered; `null` while the buyer is still handling it. */
  answerAudience: QuestionsAudience.nullable(),
  answerText: z.string().nullable(),
  /** The wording under which the question was shared with others (identity removed). */
  sanitizedQuestion: z.string().nullable(),
  answeredAt: Instant.nullable(),
  addendumNumber: z.number().int().positive().nullable(),
});
export type SupplierQuestionRow = z.infer<typeof SupplierQuestionRow>;

export const SupplierQuestionDetail = SupplierQuestionRow.extend({
  lateDispositionReason: z.string().nullable(),
  timeZone: TimeZone,
});
export type SupplierQuestionDetail = z.infer<typeof SupplierQuestionDetail>;

export const SupplierQuestionListQuery = listQueryWithSort(['submittedAt', 'status', 'tenderReference'] as const).extend({
  tenderId: IdParam.optional(),
  status: queryList(QuestionsStatus).optional(),
  answered: QueryBoolean.optional(),
});
export type SupplierQuestionListQuery = z.output<typeof SupplierQuestionListQuery>;

export const AskQuestionBody = z.object({
  tenderId: Id,
  lotId: Id.nullable(),
  requirementId: Id.nullable(),
  documentId: Id.nullable(),
  questionText: requiredText('QUESTION_REQUIRED', 'A question', 4000),
});
export type AskQuestionBody = z.infer<typeof AskQuestionBody>;

export const WithdrawQuestionBody = z.object({
  reason: optionalText(2000).optional(),
});

export const PublishedAnswersQuery = listQueryWithSort(['publishedAt'] as const).extend({
  lotId: IdParam.optional(),
  requirementId: IdParam.optional(),
});

/** An issued addendum as the supplier sees it, with what it requires of this supplier (AC-10). */
export const SupplierAddendumRow = AddendumChangeAreas.extend({
  id: Id,
  tender: TenderRef,
  buyer: OrganizationRef,
  number: z.number().int().positive(),
  title: z.string().min(1),
  materiality: AddendaMateriality,
  issuedAt: Instant,
  resultingVersionNo: z.number().int().positive(),
  newSubmissionDeadline: OfficialDeadline.nullable(),
  affectedLots: z.array(LotRef),
  acknowledgmentRequired: z.boolean(),
  requiredAction: AddendaExistingSubmissionAction,
  requiredActionCompleted: z.boolean(),
  /** An acknowledgment or the required supplement/replacement is still outstanding for this supplier. */
  actionOutstanding: z.boolean(),
  deliveredAt: Instant.nullable(),
  openedAt: Instant.nullable(),
  acknowledgedAt: Instant.nullable(),
  acknowledgedBy: PersonRef.nullable(),
  /** The supplier's effective submission when the addendum was issued; its receipt stays valid (AC-10). */
  priorSubmission: z
    .object({ receiptNo: z.string().min(1), receivedAt: Instant, remainsValid: z.boolean() })
    .nullable(),
});
export type SupplierAddendumRow = z.infer<typeof SupplierAddendumRow>;

export const SupplierAddendumDetail = SupplierAddendumRow.extend({
  changeDescription: z.string().min(1),
  reason: z.string().min(1),
  existingSubmissionAction: AddendaExistingSubmissionAction,
  previousSubmissionDeadline: OfficialDeadline.nullable(),
  requirementChanges: z.array(RequirementChange),
});
export type SupplierAddendumDetail = z.infer<typeof SupplierAddendumDetail>;

export const SupplierAddendumListQuery = listQueryWithSort(['issuedAt', 'number', 'tenderReference'] as const).extend({
  tenderId: IdParam.optional(),
  acknowledged: QueryBoolean.optional(),
  /** true = addenda still requiring an acknowledgment or a supplement/replacement of this supplier. */
  actionOutstanding: QueryBoolean.optional(),
});
export type SupplierAddendumListQuery = z.output<typeof SupplierAddendumListQuery>;

export const AcknowledgeAddendumBody = z.object({
  confirmed: z.literal(true, { error: issue('CONFIRMATION_REQUIRED', 'Confirm the acknowledgment.') }),
});

export const AcknowledgmentResult = z.object({
  addendumId: Id,
  acknowledgedAt: Instant,
  acknowledgedBy: PersonRef,
  requiredAction: AddendaExistingSubmissionAction,
  requiredActionCompleted: z.boolean(),
  priorSubmission: SupplierAddendumRow.shape.priorSubmission,
});
export type AcknowledgmentResult = z.infer<typeof AcknowledgmentResult>;

export const SupplierOwnRegistration = z.object({
  id: Id,
  status: SessionRegistrationsStatus,
  attendeeNames: z.array(z.string().min(1)),
  accessibilityNeeds: z.string().nullable(),
  registeredBy: PersonRef,
  createdAt: Instant,
  attendanceRecordedAt: Instant.nullable(),
});
export type SupplierOwnRegistration = z.infer<typeof SupplierOwnRegistration>;

export const SupplierSessionRow = SessionCore.extend({
  buyer: OrganizationRef,
  ownRegistration: SupplierOwnRegistration.nullable(),
  registrationOpen: z.boolean(),
});
export type SupplierSessionRow = z.infer<typeof SupplierSessionRow>;

export const SupplierSessionDetail = SupplierSessionRow.extend({
  sharedAnswers: z.array(SharedAnswer),
});
export type SupplierSessionDetail = z.infer<typeof SupplierSessionDetail>;

export const SupplierSessionListQuery = listQueryWithSort(['startsAt', 'tenderReference'] as const).extend({
  tenderId: IdParam.optional(),
  sessionType: SessionsSessionType.optional(),
  status: queryList(SessionsStatus).optional(),
  registered: QueryBoolean.optional(),
});
export type SupplierSessionListQuery = z.output<typeof SupplierSessionListQuery>;

const AttendeeNames = z
  .array(requiredText('ATTENDEE_NAME_REQUIRED', 'An attendee name', 200))
  .min(1, issue('ATTENDEE_REQUIRED', 'Name at least one attendee.'))
  .max(20, issue('TOO_MANY_ATTENDEES', 'At most 20 attendees.'));

export const RegisterSessionBody = z.object({
  attendeeNames: AttendeeNames,
  accessibilityNeeds: optionalText(2000).nullable(),
});
export const UpdateRegistrationBody = RegisterSessionBody;

export const RegistrationParams = z.object({ registrationId: IdParam });

export const CancelRegistrationBody = z.object({
  reason: optionalText(2000).optional(),
});

// ---------------------------------------------------------------------------------------------------------
// Public edition (PUB-04)
// ---------------------------------------------------------------------------------------------------------

export const PublicAddendum = AddendumChangeAreas.extend({
  addendumId: Id,
  number: z.number().int().positive(),
  title: z.string().min(1),
  changeDescription: z.string().min(1),
  materiality: AddendaMateriality,
  issuedAt: Instant,
  resultingVersionNo: z.number().int().positive(),
  newSubmissionDeadline: OfficialDeadline.nullable(),
  affectedLots: z.array(LotRef),
  requirementChanges: z.array(RequirementChange.omit({ id: true, requirementId: true })),
});
export type PublicAddendum = z.infer<typeof PublicAddendum>;

export const PublicClarifications = z.object({
  tender: z.object({
    reference: Reference,
    title: z.string().min(1),
    buyer: z.object({ slug: Slug, name: z.string().min(1) }),
    status: TendersStatus,
    officialTimeZone: TimeZone,
    currentVersionNo: z.number().int().min(0),
    submissionDeadline: OfficialDeadline.nullable(),
    lots: z.array(LotRef),
  }),
  questions: z.array(SharedAnswer),
  addenda: z.array(PublicAddendum),
  /** Instant of the latest released item: the edition date of a download. */
  editionAt: Instant.nullable(),
});
export type PublicClarifications = z.infer<typeof PublicClarifications>;

export const PublicClarificationsParams = z.object({ buyerSlug: Slug, ref: Reference });
export const PublicClarificationsQuery = z.object({
  q: z.string().trim().max(200, issue('QUERY_TOO_LONG', 'At most 200 characters.')).optional(),
  lotId: IdParam.optional(),
});

// ---------------------------------------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------------------------------------

const B = '/api/v1/buyer/clarifications';
const S = '/api/v1/supplier/clarifications';

const QUESTION_READ = 'tender.clarifications.manage' as const;
const ADDENDUM_READ = ['tender.clarifications.manage', 'tender.addenda.approve'] as const;
const SUPPLIER_READ = 'supplier.opportunities.view' as const;
const SUPPLIER_PARTICIPATE = ['supplier.pursuit.manage', 'supplier.response.edit'] as const;

export const clarificationsEndpoints = {
  // Buyer: overview and context --------------------------------------------------------------------------
  buyerTenders: defineEndpoint({
    id: 'buyer.clarifications.tenders',
    method: 'GET',
    path: `${B}/tenders`,
    audience: 'buyer',
    permission: ['tender.clarifications.manage', 'tender.addenda.approve', 'tender.sessions.manage'],
    query: BuyerClarificationTenderQuery,
    response: pageOf(BuyerClarificationTender),
    errors: [],
    screens: ['BUY-16', 'BUY-17', 'BUY-18'],
    summary: 'Tenders of the buyer with their clarification workload.',
  }),
  buyerTenderContext: defineEndpoint({
    id: 'buyer.clarifications.tenderContext',
    method: 'GET',
    path: `${B}/tenders/:tenderId`,
    audience: 'buyer',
    permission: ['tender.clarifications.manage', 'tender.addenda.approve', 'tender.sessions.manage'],
    params: TenderParams,
    response: BuyerTenderContext,
    errors: [],
    screens: ['BUY-16', 'BUY-17', 'BUY-18'],
    summary: 'Lots, requirements, documents, participants and dates of one tender for the clarification forms.',
  }),
  ownerCandidates: defineEndpoint({
    id: 'buyer.clarifications.ownerCandidates',
    method: 'GET',
    path: `${B}/owner-candidates`,
    audience: 'buyer',
    permission: QUESTION_READ,
    query: OwnerCandidatesQuery,
    response: z.array(ClarificationOwnerCandidate),
    errors: [],
    screens: ['BUY-16'],
    summary: 'Buyer users who may own clarification work.',
  }),

  // Buyer: questions (BUY-16) ----------------------------------------------------------------------------
  questionsList: defineEndpoint({
    id: 'buyer.clarifications.questionsList',
    method: 'GET',
    path: `${B}/questions`,
    audience: 'buyer',
    permission: QUESTION_READ,
    query: BuyerQuestionListQuery,
    response: pageOf(BuyerQuestionRow),
    errors: [],
    screens: ['BUY-16'],
    summary: 'Question queue with search, filters, sorting and pagination.',
  }),
  questionsGet: defineEndpoint({
    id: 'buyer.clarifications.questionsGet',
    method: 'GET',
    path: `${B}/questions/:questionId`,
    audience: 'buyer',
    permission: QUESTION_READ,
    params: QuestionParams,
    response: BuyerQuestionDetail,
    errors: [],
    screens: ['BUY-16'],
  }),
  questionsAssign: defineEndpoint({
    id: 'buyer.clarifications.questionsAssign',
    method: 'POST',
    path: `${B}/questions/:questionId/assign`,
    audience: 'buyer',
    permission: QUESTION_READ,
    params: QuestionParams,
    body: AssignQuestionBody,
    response: BuyerQuestionDetail,
    errors: ['QUESTION_CLOSED', 'LATE_DISPOSITION_REQUIRED', 'OWNER_NOT_ELIGIBLE'],
    screens: ['BUY-16'],
    summary: 'Assigns (or reassigns) the buyer owner of a question.',
  }),
  questionsLateDisposition: defineEndpoint({
    id: 'buyer.clarifications.questionsLateDisposition',
    method: 'POST',
    path: `${B}/questions/:questionId/late-disposition`,
    audience: 'buyer',
    permission: QUESTION_READ,
    params: QuestionParams,
    body: LateDispositionBody,
    response: BuyerQuestionDetail,
    errors: ['QUESTION_NOT_LATE', 'LATE_DISPOSITION_ALREADY_RECORDED', 'QUESTION_CLOSED'],
    screens: ['BUY-16'],
    summary: 'Records the explicit disposition of a question submitted after the question deadline.',
  }),
  questionsSaveAnswer: defineEndpoint({
    id: 'buyer.clarifications.questionsSaveAnswer',
    method: 'PUT',
    path: `${B}/questions/:questionId/answer`,
    audience: 'buyer',
    permission: QUESTION_READ,
    params: QuestionParams,
    body: SaveAnswerBody,
    response: BuyerQuestionDetail,
    errors: ['QUESTION_CLOSED', 'LATE_DISPOSITION_REQUIRED', 'OWNER_REQUIRED', 'PUBLIC_AUDIENCE_NOT_PERMITTED'],
    screens: ['BUY-16'],
    summary: 'Saves the draft answer, the sanitized question and the intended audience.',
  }),
  questionsRequestReview: defineEndpoint({
    id: 'buyer.clarifications.questionsRequestReview',
    method: 'POST',
    path: `${B}/questions/:questionId/review-request`,
    audience: 'buyer',
    permission: QUESTION_READ,
    params: QuestionParams,
    body: RequestReviewBody,
    response: BuyerQuestionDetail,
    errors: ['QUESTION_CLOSED', 'ANSWER_REQUIRED'],
    screens: ['BUY-16'],
    summary: 'Sends the draft answer to confidentiality review.',
  }),
  questionsReview: defineEndpoint({
    id: 'buyer.clarifications.questionsReview',
    method: 'POST',
    path: `${B}/questions/:questionId/confidentiality-review`,
    audience: 'buyer',
    permission: QUESTION_READ,
    params: QuestionParams,
    body: ConfidentialityReviewBody,
    response: BuyerQuestionDetail,
    errors: ['QUESTION_NOT_IN_REVIEW', 'SELF_REVIEW_NOT_ALLOWED', 'SANITIZED_TEXT_NAMES_SUPPLIER'],
    screens: ['BUY-16'],
    summary: 'Clears or returns the draft after checking it omits identity and commercially sensitive wording.',
  }),
  questionsPublish: defineEndpoint({
    id: 'buyer.clarifications.questionsPublish',
    method: 'POST',
    path: `${B}/questions/:questionId/publish`,
    audience: 'buyer',
    permission: QUESTION_READ,
    params: QuestionParams,
    body: PublishAnswerBody,
    response: BuyerQuestionDetail,
    errors: ['CONFIDENTIALITY_REVIEW_REQUIRED', 'QUESTION_CLOSED', 'PUBLIC_AUDIENCE_NOT_PERMITTED'],
    screens: ['BUY-16'],
    summary: 'Publishes the sanitized answer to all participants or the public (BR-14).',
  }),
  questionsAnswerPrivately: defineEndpoint({
    id: 'buyer.clarifications.questionsAnswerPrivately',
    method: 'POST',
    path: `${B}/questions/:questionId/private-answer`,
    audience: 'buyer',
    permission: QUESTION_READ,
    params: QuestionParams,
    body: PrivateAnswerBody,
    response: BuyerQuestionDetail,
    errors: ['QUESTION_CLOSED', 'LATE_DISPOSITION_REQUIRED', 'OWNER_REQUIRED'],
    screens: ['BUY-16'],
    summary: 'Answers a legitimately supplier-specific question privately.',
  }),
  questionsEscalate: defineEndpoint({
    id: 'buyer.clarifications.questionsEscalate',
    method: 'POST',
    path: `${B}/questions/:questionId/escalate`,
    audience: 'buyer',
    permission: QUESTION_READ,
    params: QuestionParams,
    body: EscalateQuestionBody,
    response: EscalateQuestionResult,
    errors: ['QUESTION_CLOSED', 'LATE_DISPOSITION_REQUIRED', 'ADDENDUM_NOT_DRAFT', 'TENDER_NOT_AMENDABLE'],
    screens: ['BUY-16', 'BUY-17'],
    summary: 'Escalates a material answer to a (new or existing draft) addendum.',
  }),
  questionsDecline: defineEndpoint({
    id: 'buyer.clarifications.questionsDecline',
    method: 'POST',
    path: `${B}/questions/:questionId/decline`,
    audience: 'buyer',
    permission: QUESTION_READ,
    params: QuestionParams,
    body: DeclineQuestionBody,
    response: BuyerQuestionDetail,
    errors: ['QUESTION_CLOSED'],
    screens: ['BUY-16'],
  }),

  // Buyer: addenda (BUY-17) ------------------------------------------------------------------------------
  addendaList: defineEndpoint({
    id: 'buyer.clarifications.addendaList',
    method: 'GET',
    path: `${B}/addenda`,
    audience: 'buyer',
    permission: ADDENDUM_READ,
    query: BuyerAddendumListQuery,
    response: pageOf(BuyerAddendumRow),
    errors: [],
    screens: ['BUY-17'],
  }),
  addendaGet: defineEndpoint({
    id: 'buyer.clarifications.addendaGet',
    method: 'GET',
    path: `${B}/addenda/:addendumId`,
    audience: 'buyer',
    permission: ADDENDUM_READ,
    params: AddendumParams,
    response: BuyerAddendumDetail,
    errors: [],
    screens: ['BUY-17'],
  }),
  addendaCreate: defineEndpoint({
    id: 'buyer.clarifications.addendaCreate',
    method: 'POST',
    path: `${B}/addenda`,
    audience: 'buyer',
    permission: 'tender.clarifications.manage',
    body: CreateAddendumBody,
    response: BuyerAddendumDetail,
    errors: [
      'TENDER_NOT_AMENDABLE',
      'CHANGE_AREA_REQUIRED',
      'NEW_DEADLINE_IN_PAST',
      'NEW_DEADLINE_WITHOUT_SUBMISSION_CHANGE',
      'LOT_NOT_IN_TENDER',
      'REQUIREMENT_NOT_IN_TENDER',
      'QUESTION_NOT_IN_TENDER',
    ],
    screens: ['BUY-17'],
    idempotent: true,
    summary: 'Drafts an addendum (the only route to change a deadline, BR-13/BR-16).',
  }),
  addendaUpdate: defineEndpoint({
    id: 'buyer.clarifications.addendaUpdate',
    method: 'PUT',
    path: `${B}/addenda/:addendumId`,
    audience: 'buyer',
    permission: 'tender.clarifications.manage',
    params: AddendumParams,
    body: UpdateAddendumBody,
    response: BuyerAddendumDetail,
    errors: [
      'ADDENDUM_NOT_EDITABLE',
      'CHANGE_AREA_REQUIRED',
      'NEW_DEADLINE_IN_PAST',
      'NEW_DEADLINE_WITHOUT_SUBMISSION_CHANGE',
      'LOT_NOT_IN_TENDER',
      'REQUIREMENT_NOT_IN_TENDER',
    ],
    screens: ['BUY-17'],
    summary: 'Edits a draft addendum; editing a returned one sends it back to draft.',
  }),
  addendaSubmit: defineEndpoint({
    id: 'buyer.clarifications.addendaSubmit',
    method: 'POST',
    path: `${B}/addenda/:addendumId/submit`,
    audience: 'buyer',
    permission: 'tender.clarifications.manage',
    params: AddendumParams,
    body: SubmitAddendumBody,
    response: BuyerAddendumDetail,
    errors: ['ADDENDUM_NOT_EDITABLE', 'RESPONSE_TIME_ASSESSMENT_REQUIRED', 'CHANGE_AREA_REQUIRED', 'AFFECTED_LOTS_REQUIRED'],
    screens: ['BUY-17'],
    summary: 'Requests approval of the exact addendum (approval subject type addendum).',
  }),
  addendaIssue: defineEndpoint({
    id: 'buyer.clarifications.addendaIssue',
    method: 'POST',
    path: `${B}/addenda/:addendumId/issue`,
    audience: 'buyer',
    permission: 'tender.publish',
    params: AddendumParams,
    body: IssueAddendumBody,
    response: BuyerAddendumDetail,
    errors: ['ADDENDUM_NOT_APPROVED', 'ADDENDUM_ALREADY_ISSUED', 'NEW_DEADLINE_IN_PAST', 'TENDER_NOT_AMENDABLE'],
    screens: ['BUY-17'],
    summary: 'Issues the approved addendum: new tender version, formal notice to every affected eligible participant.',
  }),
  addendaWithdraw: defineEndpoint({
    id: 'buyer.clarifications.addendaWithdraw',
    method: 'POST',
    path: `${B}/addenda/:addendumId/withdraw`,
    audience: 'buyer',
    permission: 'tender.clarifications.manage',
    params: AddendumParams,
    body: WithdrawAddendumBody,
    response: BuyerAddendumDetail,
    errors: ['ADDENDUM_ALREADY_ISSUED', 'ADDENDUM_ALREADY_WITHDRAWN'],
    screens: ['BUY-17'],
    summary: 'Withdraws an unissued addendum. An issued addendum is corrected only by a further addendum.',
  }),
  addendaRemind: defineEndpoint({
    id: 'buyer.clarifications.addendaRemind',
    method: 'POST',
    path: `${B}/addenda/:addendumId/reminders`,
    audience: 'buyer',
    permission: 'tender.clarifications.manage',
    params: AddendumParams,
    body: RemindRecipientsBody,
    response: RemindRecipientsResult,
    errors: ['ADDENDUM_NOT_ISSUED', 'NO_OUTSTANDING_ACKNOWLEDGMENTS'],
    screens: ['BUY-17'],
    summary: 'Reminds recipients that have not acknowledged or completed the required action.',
  }),

  // Buyer: sessions (BUY-18) -----------------------------------------------------------------------------
  sessionsList: defineEndpoint({
    id: 'buyer.clarifications.sessionsList',
    method: 'GET',
    path: `${B}/sessions`,
    audience: 'buyer',
    permission: 'tender.sessions.manage',
    query: BuyerSessionListQuery,
    response: pageOf(BuyerSessionRow),
    errors: [],
    screens: ['BUY-18'],
  }),
  sessionsGet: defineEndpoint({
    id: 'buyer.clarifications.sessionsGet',
    method: 'GET',
    path: `${B}/sessions/:sessionId`,
    audience: 'buyer',
    permission: 'tender.sessions.manage',
    params: SessionParams,
    response: BuyerSessionDetail,
    errors: [],
    screens: ['BUY-18'],
  }),
  sessionsCreate: defineEndpoint({
    id: 'buyer.clarifications.sessionsCreate',
    method: 'POST',
    path: `${B}/sessions`,
    audience: 'buyer',
    permission: 'tender.sessions.manage',
    body: CreateSessionBody,
    response: BuyerSessionDetail,
    errors: [
      'TENDER_NOT_AMENDABLE',
      'SESSION_END_BEFORE_START',
      'SESSION_IN_PAST',
      'REGISTRATION_DEADLINE_AFTER_START',
      'MANDATORY_REQUIRES_ADDENDUM',
      'ALTERNATIVE_NOT_IN_TENDER',
      'LOT_NOT_IN_TENDER',
    ],
    screens: ['BUY-18'],
    idempotent: true,
    summary: 'Schedules a briefing or site visit. Mandatory attendance after release needs an addendum.',
  }),
  sessionsUpdate: defineEndpoint({
    id: 'buyer.clarifications.sessionsUpdate',
    method: 'PUT',
    path: `${B}/sessions/:sessionId`,
    audience: 'buyer',
    permission: 'tender.sessions.manage',
    params: SessionParams,
    body: UpdateSessionBody,
    response: BuyerSessionDetail,
    errors: [
      'SESSION_NOT_EDITABLE',
      'SESSION_END_BEFORE_START',
      'REGISTRATION_DEADLINE_AFTER_START',
      'CAPACITY_BELOW_REGISTRATIONS',
      'MANDATORY_REQUIRES_ADDENDUM',
      'ALTERNATIVE_NOT_IN_TENDER',
      'LOT_NOT_IN_TENDER',
    ],
    screens: ['BUY-18'],
  }),
  sessionsCancel: defineEndpoint({
    id: 'buyer.clarifications.sessionsCancel',
    method: 'POST',
    path: `${B}/sessions/:sessionId/cancel`,
    audience: 'buyer',
    permission: 'tender.sessions.manage',
    params: SessionParams,
    body: CancelSessionBody,
    response: BuyerSessionDetail,
    errors: ['SESSION_NOT_EDITABLE', 'MANDATORY_SESSION_NEEDS_ALTERNATIVE'],
    screens: ['BUY-18'],
    summary: 'Cancels a scheduled session and notifies registered suppliers.',
  }),
  sessionsRecordAttendance: defineEndpoint({
    id: 'buyer.clarifications.sessionsRecordAttendance',
    method: 'POST',
    path: `${B}/sessions/:sessionId/attendance`,
    audience: 'buyer',
    permission: 'tender.sessions.manage',
    params: SessionParams,
    body: RecordAttendanceBody,
    response: BuyerSessionDetail,
    errors: ['SESSION_NOT_STARTED', 'SESSION_CANCELLED', 'REGISTRATION_NOT_IN_SESSION'],
    screens: ['BUY-18'],
  }),
  sessionsPublishMinutes: defineEndpoint({
    id: 'buyer.clarifications.sessionsPublishMinutes',
    method: 'POST',
    path: `${B}/sessions/:sessionId/minutes`,
    audience: 'buyer',
    permission: 'tender.sessions.manage',
    params: SessionParams,
    body: PublishMinutesBody,
    response: BuyerSessionDetail,
    errors: [
      'SESSION_NOT_HELD',
      'MINUTES_ALREADY_PUBLISHED',
      'MINUTES_DOCUMENT_NOT_OF_SESSION',
      'PUBLIC_AUDIENCE_NOT_PERMITTED',
      'SUPPLIER_NOT_PARTICIPANT',
    ],
    screens: ['BUY-18'],
    summary: 'Publishes the official minutes and shares material answers given at the session (FR-10).',
  }),
  sessionsResolveException: defineEndpoint({
    id: 'buyer.clarifications.sessionsResolveException',
    method: 'POST',
    path: `${B}/sessions/:sessionId/registrations/:registrationId/exception`,
    audience: 'buyer',
    permission: 'tender.sessions.manage',
    params: ResolveAttendanceExceptionParams,
    body: ResolveAttendanceExceptionBody,
    response: BuyerSessionDetail,
    errors: [
      'NOT_AN_ATTENDANCE_EXCEPTION',
      'EXCEPTION_ALREADY_RESOLVED',
      'ALTERNATIVE_SESSION_REQUIRED',
      'ALTERNATIVE_SESSION_FULL',
      'ALTERNATIVE_NOT_IN_TENDER',
    ],
    screens: ['BUY-18'],
    summary: 'Resolves an absence from a mandatory session consistently: offer the alternative or confirm not met.',
  }),

  // Supplier (SUP-10, SUP-11) ----------------------------------------------------------------------------
  supplierTenders: defineEndpoint({
    id: 'supplier.clarifications.tenders',
    method: 'GET',
    path: `${S}/tenders`,
    audience: 'supplier',
    permission: SUPPLIER_READ,
    query: SupplierTenderQuery,
    response: pageOf(SupplierClarificationTender),
    errors: [],
    screens: ['SUP-10', 'SUP-11'],
  }),
  supplierTenderContext: defineEndpoint({
    id: 'supplier.clarifications.tenderContext',
    method: 'GET',
    path: `${S}/tenders/:tenderId`,
    audience: 'supplier',
    permission: SUPPLIER_READ,
    params: TenderParams,
    response: SupplierTenderContext,
    errors: [],
    screens: ['SUP-10'],
  }),
  supplierPublishedAnswers: defineEndpoint({
    id: 'supplier.clarifications.publishedAnswers',
    method: 'GET',
    path: `${S}/tenders/:tenderId/answers`,
    audience: 'supplier',
    permission: SUPPLIER_READ,
    params: TenderParams,
    query: PublishedAnswersQuery,
    response: pageOf(SharedAnswer),
    errors: [],
    screens: ['SUP-10'],
    summary: 'Published sanitized answers of the tender (every participant sees the same set, BR-14).',
  }),
  supplierQuestionsList: defineEndpoint({
    id: 'supplier.clarifications.questionsList',
    method: 'GET',
    path: `${S}/questions`,
    audience: 'supplier',
    permission: SUPPLIER_READ,
    query: SupplierQuestionListQuery,
    response: pageOf(SupplierQuestionRow),
    errors: [],
    screens: ['SUP-10'],
    summary: "The supplier's own questions only.",
  }),
  supplierQuestionsGet: defineEndpoint({
    id: 'supplier.clarifications.questionsGet',
    method: 'GET',
    path: `${S}/questions/:questionId`,
    audience: 'supplier',
    permission: SUPPLIER_READ,
    params: QuestionParams,
    response: SupplierQuestionDetail,
    errors: [],
    screens: ['SUP-10'],
  }),
  supplierQuestionsAsk: defineEndpoint({
    id: 'supplier.clarifications.questionsAsk',
    method: 'POST',
    path: `${S}/questions`,
    audience: 'supplier',
    permission: SUPPLIER_PARTICIPATE,
    body: AskQuestionBody,
    response: SupplierQuestionDetail,
    errors: ['TENDER_NOT_ACCEPTING_QUESTIONS', 'LOT_NOT_IN_TENDER', 'REQUIREMENT_NOT_IN_TENDER', 'DOCUMENT_NOT_IN_TENDER'],
    screens: ['SUP-10'],
    idempotent: true,
    summary: 'Asks a question; one after the question deadline is recorded and flagged for a buyer disposition.',
  }),
  supplierQuestionsWithdraw: defineEndpoint({
    id: 'supplier.clarifications.questionsWithdraw',
    method: 'POST',
    path: `${S}/questions/:questionId/withdraw`,
    audience: 'supplier',
    permission: SUPPLIER_PARTICIPATE,
    params: QuestionParams,
    body: WithdrawQuestionBody,
    response: SupplierQuestionDetail,
    errors: ['QUESTION_ALREADY_ANSWERED', 'QUESTION_CLOSED'],
    screens: ['SUP-10'],
  }),
  supplierAddendaList: defineEndpoint({
    id: 'supplier.clarifications.addendaList',
    method: 'GET',
    path: `${S}/addenda`,
    audience: 'supplier',
    permission: SUPPLIER_READ,
    query: SupplierAddendumListQuery,
    response: pageOf(SupplierAddendumRow),
    errors: [],
    screens: ['SUP-10', 'SUP-08'],
  }),
  supplierAddendaGet: defineEndpoint({
    id: 'supplier.clarifications.addendaGet',
    method: 'GET',
    path: `${S}/addenda/:addendumId`,
    audience: 'supplier',
    permission: SUPPLIER_READ,
    params: AddendumParams,
    response: SupplierAddendumDetail,
    errors: [],
    screens: ['SUP-10', 'SUP-08'],
  }),
  supplierAddendaAcknowledge: defineEndpoint({
    id: 'supplier.clarifications.addendaAcknowledge',
    method: 'POST',
    path: `${S}/addenda/:addendumId/acknowledge`,
    audience: 'supplier',
    permission: 'supplier.notices.acknowledge',
    params: AddendumParams,
    body: AcknowledgeAddendumBody,
    response: AcknowledgmentResult,
    errors: ['ALREADY_ACKNOWLEDGED', 'ACKNOWLEDGMENT_NOT_REQUIRED'],
    screens: ['SUP-10', 'SUP-08'],
    idempotent: true,
    summary: 'Acknowledges an issued addendum (participant_acknowledgments, authoritative for readiness, DD-42).',
  }),
  supplierSessionsList: defineEndpoint({
    id: 'supplier.clarifications.sessionsList',
    method: 'GET',
    path: `${S}/sessions`,
    audience: 'supplier',
    permission: SUPPLIER_READ,
    query: SupplierSessionListQuery,
    response: pageOf(SupplierSessionRow),
    errors: [],
    screens: ['SUP-11'],
  }),
  supplierSessionsGet: defineEndpoint({
    id: 'supplier.clarifications.sessionsGet',
    method: 'GET',
    path: `${S}/sessions/:sessionId`,
    audience: 'supplier',
    permission: SUPPLIER_READ,
    params: SessionParams,
    response: SupplierSessionDetail,
    errors: [],
    screens: ['SUP-11'],
  }),
  supplierSessionsRegister: defineEndpoint({
    id: 'supplier.clarifications.sessionsRegister',
    method: 'POST',
    path: `${S}/sessions/:sessionId/registrations`,
    audience: 'supplier',
    permission: SUPPLIER_PARTICIPATE,
    params: SessionParams,
    body: RegisterSessionBody,
    response: SupplierSessionDetail,
    errors: ['SESSION_FULL', 'REGISTRATION_CLOSED', 'ALREADY_REGISTERED', 'SESSION_CANCELLED'],
    screens: ['SUP-11'],
    idempotent: true,
  }),
  supplierRegistrationUpdate: defineEndpoint({
    id: 'supplier.clarifications.registrationUpdate',
    method: 'PUT',
    path: `${S}/registrations/:registrationId`,
    audience: 'supplier',
    permission: SUPPLIER_PARTICIPATE,
    params: RegistrationParams,
    body: UpdateRegistrationBody,
    response: SupplierSessionDetail,
    errors: ['REGISTRATION_NOT_ACTIVE', 'REGISTRATION_CLOSED'],
    screens: ['SUP-11'],
    summary: 'Changes attendees or requests an accommodation.',
  }),
  supplierRegistrationCancel: defineEndpoint({
    id: 'supplier.clarifications.registrationCancel',
    method: 'POST',
    path: `${S}/registrations/:registrationId/cancel`,
    audience: 'supplier',
    permission: SUPPLIER_PARTICIPATE,
    params: RegistrationParams,
    body: CancelRegistrationBody,
    response: SupplierSessionDetail,
    errors: ['REGISTRATION_NOT_ACTIVE', 'SESSION_ALREADY_HELD'],
    screens: ['SUP-11'],
  }),

  // Public (PUB-04) --------------------------------------------------------------------------------------
  publicEdition: defineEndpoint({
    id: 'public.clarifications.edition',
    method: 'GET',
    path: '/api/v1/public/clarifications/:buyerSlug/:ref',
    audience: 'public',
    params: PublicClarificationsParams,
    query: PublicClarificationsQuery,
    response: PublicClarifications,
    errors: [],
    screens: ['PUB-04'],
    summary: 'Public edition: released public answers and issued addenda of a public tender, without identities.',
  }),
};
