/**
 * Projections of the clarifications fixtures onto the contract shapes, per audience. Buyer projections carry the
 * questioner identity; supplier projections only the supplier's own records plus sanitized shared answers; public
 * projections only released public material (PRD §4.3, FR-10).
 */
import type {
  AcknowledgmentTally,
  AddendumBlockingIssue,
  AddendumRecipient,
  BuyerAddendumDetail,
  BuyerAddendumRow,
  BuyerClarificationTender,
  BuyerQuestionDetail,
  BuyerQuestionRow,
  BuyerSessionDetail,
  BuyerSessionRegistration,
  BuyerSessionRow,
  ClarificationHistoryEntry,
  DocumentRef,
  LotRef,
  OrganizationRef,
  QuestionSubjectType,
  RequirementChange,
  RequirementRef,
  SharedAnswer,
  SupplierAddendumDetail,
  SupplierAddendumDue,
  SupplierAddendumRow,
  SupplierClarificationTender,
  SupplierOwnRegistration,
  SupplierQuestionDetail,
  SupplierQuestionRow,
  SupplierSessionDetail,
  SupplierSessionRow,
  TenderRef,
} from '../../../contracts/clarifications.js';
import type { OfficialDeadline, PersonRef } from '../../../contracts/common.js';
import type { QuestionsStatus } from '../../../contracts/enums.js';
import {
  ADDENDA,
  AMENDABLE_TENDER_STATUSES,
  CLARIFICATION_TENDERS,
  CLOSED_QUESTION_STATUSES,
  QUESTIONS,
  SESSIONS,
  sessionMinutesDocuments,
} from '../../fixtures/clarifications/index.js';
import type {
  AddendumFixture,
  AddendumRecipientFixture,
  ClarificationTenderFixture,
  HistoryFixture,
  QuestionFixture,
  RegistrationFixture,
  SessionFixture,
} from '../../fixtures/clarifications/index.js';
import { findTenantById, personRef } from '../../persona.js';

// ---------------------------------------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------------------------------------

export function tenderById(tenderId: number): ClarificationTenderFixture | undefined {
  return CLARIFICATION_TENDERS.find((tender) => tender.id === tenderId);
}

/** The tender of a fixture row (fixtures reference only known tenders; a test guards it). */
export function tenderOf(tenderId: number): ClarificationTenderFixture {
  const tender = tenderById(tenderId);
  if (tender === undefined) {
    throw new Error(`No clarification tender ${tenderId}.`);
  }
  return tender;
}

export function isAmendable(tender: ClarificationTenderFixture): boolean {
  return AMENDABLE_TENDER_STATUSES.includes(tender.status);
}

export function isParticipant(tender: ClarificationTenderFixture, supplierTenantId: number): boolean {
  return tender.participants.some((participant) => participant.supplierTenantId === supplierTenantId);
}

export function supplierTenders(supplierTenantId: number): ClarificationTenderFixture[] {
  return CLARIFICATION_TENDERS.filter((tender) => isParticipant(tender, supplierTenantId));
}

export function isClosedQuestion(status: QuestionsStatus): boolean {
  return (CLOSED_QUESTION_STATUSES as readonly string[]).includes(status);
}

export function sessionById(sessionId: number): SessionFixture | undefined {
  return SESSIONS.find((session) => session.id === sessionId);
}

export function activeRegistrations(session: SessionFixture): RegistrationFixture[] {
  return session.registrations.filter((registration) => registration.status !== 'cancelled');
}

export function placesAvailable(session: SessionFixture): number {
  return Math.max(0, session.capacity - activeRegistrations(session).length);
}

export function isAttendanceException(session: SessionFixture, registration: RegistrationFixture): boolean {
  return session.mandatory && registration.status === 'absent';
}

// ---------------------------------------------------------------------------------------------------------
// Small projections
// ---------------------------------------------------------------------------------------------------------

export function orgRef(tenantId: number): OrganizationRef {
  const tenant = findTenantById(tenantId);
  if (tenant === undefined) {
    throw new Error(`No fixture tenant ${tenantId}.`);
  }
  return { tenantId: tenant.id, name: tenant.name };
}

export function personOrNull(userId: number | null): PersonRef | null {
  return userId === null ? null : personRef(userId);
}

export function deadline(at: string | null, timeZone: string): OfficialDeadline | null {
  return at === null ? null : { at, timeZone };
}

export function tenderRef(tender: ClarificationTenderFixture): TenderRef {
  return { tenderId: tender.id, reference: tender.reference, title: tender.title };
}

export function lotRef(tender: ClarificationTenderFixture, lotId: number | null): LotRef | null {
  if (lotId === null) {
    return null;
  }
  const lot = tender.lots.find((candidate) => candidate.lotId === lotId);
  return lot === undefined ? null : { lotId: lot.lotId, lotNo: lot.lotNo, title: lot.title };
}

export function requirementRef(tender: ClarificationTenderFixture, requirementId: number | null): RequirementRef | null {
  if (requirementId === null) {
    return null;
  }
  const requirement = tender.requirements.find((candidate) => candidate.requirementId === requirementId);
  return requirement === undefined ? null : { requirementId: requirement.requirementId, refCode: requirement.refCode };
}

export function documentRef(tender: ClarificationTenderFixture, documentId: number | null): DocumentRef | null {
  if (documentId === null) {
    return null;
  }
  const document = tender.documents.find((candidate) => candidate.documentId === documentId);
  return document === undefined ? null : { documentId: document.documentId, title: document.title };
}

export function historyOf(entries: readonly HistoryFixture[]): ClarificationHistoryEntry[] {
  return entries.map((entry) => ({ at: entry.at, action: entry.action, actor: personOrNull(entry.actorUserId), note: entry.note }));
}

function subjectTypeOf(question: Pick<QuestionFixture, 'lotId' | 'requirementId' | 'documentId'>): QuestionSubjectType {
  if (question.requirementId !== null) {
    return 'requirement';
  }
  if (question.documentId !== null) {
    return 'document';
  }
  if (question.lotId !== null) {
    return 'lot';
  }
  return 'tender';
}

// ---------------------------------------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------------------------------------

export function buyerQuestionRow(question: QuestionFixture): BuyerQuestionRow {
  const tender = tenderOf(question.tenderId);
  const addendum = question.addendumId === null ? undefined : ADDENDA.find((row) => row.id === question.addendumId);
  return {
    id: question.id,
    tender: tenderRef(tender),
    supplier: orgRef(question.supplierTenantId),
    askedBy: personRef(question.askedByUserId),
    subjectType: subjectTypeOf(question),
    lot: lotRef(tender, question.lotId),
    requirement: requirementRef(tender, question.requirementId),
    document: documentRef(tender, question.documentId),
    questionText: question.questionText,
    submittedAt: question.submittedAt,
    afterDeadline: question.afterDeadline,
    lateDisposition: question.lateDisposition,
    owner: personOrNull(question.ownerUserId),
    status: question.status,
    audience: question.audience,
    responseDueAt:
      isClosedQuestion(question.status) || question.responseDueAt === null
        ? null
        : { at: question.responseDueAt, timeZone: tender.officialTimeZone },
    publishedAt: question.publishedAt,
    addendumId: question.addendumId,
    addendumNumber: addendum?.number ?? null,
    sessionId: question.sessionId,
  };
}

export function buyerQuestionDetail(question: QuestionFixture): BuyerQuestionDetail {
  const tender = tenderOf(question.tenderId);
  return {
    ...buyerQuestionRow(question),
    lateDispositionReason: question.lateDispositionReason,
    sanitizedQuestion: question.sanitizedQuestion,
    answerText: question.answerText,
    confidentialityReviewedBy: personOrNull(question.confidentialityReviewedBy),
    timeZone: tender.officialTimeZone,
    history: historyOf(question.history),
  };
}

const ANSWERED_STATUSES: readonly QuestionsStatus[] = ['published', 'answered_privately', 'escalated_to_addendum'];

export function supplierQuestionRow(question: QuestionFixture): SupplierQuestionRow {
  const tender = tenderOf(question.tenderId);
  const answered = question.status === 'published' || question.status === 'answered_privately';
  const addendum = question.addendumId === null ? undefined : ADDENDA.find((row) => row.id === question.addendumId);
  const addendumIssued = addendum !== undefined && addendum.status === 'issued';
  return {
    id: question.id,
    tender: tenderRef(tender),
    buyer: orgRef(question.tenantId),
    askedBy: personRef(question.askedByUserId),
    subjectType: subjectTypeOf(question),
    lot: lotRef(tender, question.lotId),
    requirement: requirementRef(tender, question.requirementId),
    document: documentRef(tender, question.documentId),
    questionText: question.questionText,
    submittedAt: question.submittedAt,
    afterDeadline: question.afterDeadline,
    lateDisposition: question.lateDisposition,
    status: question.status,
    answerAudience: ANSWERED_STATUSES.includes(question.status) ? question.audience : null,
    answerText: answered ? question.answerText : null,
    sanitizedQuestion: question.status === 'published' ? question.sanitizedQuestion : null,
    answeredAt: answered ? question.publishedAt : null,
    // Only an issued addendum is disclosed to suppliers; a draft addendum stays internal.
    addendumNumber: addendumIssued ? addendum.number : null,
  };
}

export function supplierQuestionDetail(question: QuestionFixture): SupplierQuestionDetail {
  return {
    ...supplierQuestionRow(question),
    lateDispositionReason: question.lateDisposition === null ? null : question.lateDispositionReason,
    timeZone: tenderOf(question.tenderId).officialTimeZone,
  };
}

/** Published shared answers (no questioner identity). */
export function sharedAnswer(question: QuestionFixture): SharedAnswer {
  const tender = tenderOf(question.tenderId);
  if (
    question.status !== 'published' ||
    question.audience === 'private' ||
    question.sanitizedQuestion === null ||
    question.answerText === null ||
    question.publishedAt === null
  ) {
    throw new Error(`Question ${question.id} is not a published shared answer.`);
  }
  return {
    questionId: question.id,
    sanitizedQuestion: question.sanitizedQuestion,
    answerText: question.answerText,
    audience: question.audience,
    publishedAt: question.publishedAt,
    lot: lotRef(tender, question.lotId),
    requirement: requirementRef(tender, question.requirementId),
    sessionId: question.sessionId,
  };
}

export function isSharedAnswer(question: QuestionFixture): boolean {
  return question.status === 'published' && question.audience !== 'private';
}

// ---------------------------------------------------------------------------------------------------------
// Addenda
// ---------------------------------------------------------------------------------------------------------

export function requirementChanges(tender: ClarificationTenderFixture, addendum: AddendumFixture): RequirementChange[] {
  return addendum.requirementChanges.map((change) => {
    const requirement = tender.requirements.find((candidate) => candidate.requirementId === change.requirementId);
    return {
      id: change.id,
      requirementId: change.requirementId,
      refCode: requirement?.refCode ?? `REQ-${change.requirementId}`,
      lotId: requirement?.lotId ?? null,
      changeType: change.changeType,
      previousText: change.previousText,
      newText: change.newText,
      previousTreatment: change.previousTreatment,
      newTreatment: change.newTreatment,
    };
  });
}

export function affectedLots(tender: ClarificationTenderFixture, lotIds: readonly number[]): LotRef[] {
  return lotIds.flatMap((lotId) => {
    const lot = lotRef(tender, lotId);
    return lot === null ? [] : [lot];
  });
}

function acknowledgmentOutstanding(addendum: AddendumFixture, recipient: AddendumRecipientFixture): boolean {
  return addendum.acknowledgmentRequired && recipient.acknowledgedAt === null;
}

/** A supplement or replacement of the existing submission is still due from the recipient (AC-10). */
function submissionActionOutstanding(recipient: AddendumRecipientFixture): boolean {
  return (recipient.requiredAction === 'supplement' || recipient.requiredAction === 'replace') && !recipient.requiredActionCompleted;
}

/** The recipient still owes an acknowledgment or the required action. */
export function recipientOutstanding(addendum: AddendumFixture, recipient: AddendumRecipientFixture): boolean {
  return !recipient.requiredActionCompleted || acknowledgmentOutstanding(addendum, recipient);
}

export function outstandingRecipients(addendum: AddendumFixture): AddendumRecipientFixture[] {
  return addendum.recipients.filter((recipient) => recipientOutstanding(addendum, recipient));
}

function tally(addendum: AddendumFixture): AcknowledgmentTally | null {
  if (addendum.status !== 'issued') {
    return null;
  }
  return {
    recipients: addendum.recipients.length,
    delivered: addendum.recipients.filter((recipient) => recipient.deliveryStatus === 'delivered').length,
    failed: addendum.recipients.filter((recipient) => recipient.deliveryStatus === 'failed').length,
    acknowledged: addendum.recipients.filter((recipient) => recipient.acknowledgedAt !== null).length,
    actionOutstanding: outstandingRecipients(addendum).length,
  };
}

export function buyerAddendumRow(addendum: AddendumFixture): BuyerAddendumRow {
  const tender = tenderOf(addendum.tenderId);
  return {
    id: addendum.id,
    tender: tenderRef(tender),
    number: addendum.number,
    title: addendum.title,
    materiality: addendum.materiality,
    status: addendum.status,
    changesScope: addendum.changesScope,
    changesTerms: addendum.changesTerms,
    changesSubmission: addendum.changesSubmission,
    changesEvaluation: addendum.changesEvaluation,
    newSubmissionDeadline: deadline(addendum.newSubmissionDeadline, tender.officialTimeZone),
    existingSubmissionAction: addendum.existingSubmissionAction,
    affectedLots: affectedLots(tender, addendum.lotIds),
    issuedAt: addendum.issuedAt,
    resultingVersionNo: addendum.resultingVersionNo,
    approvalRequestId: addendum.approvalRequestId,
    approvalStatus: addendum.approvalStatus,
    acknowledgments: tally(addendum),
    createdAt: addendum.createdAt,
    createdBy: personRef(addendum.createdBy),
  };
}

export function blockingIssues(addendum: AddendumFixture, now: Date): AddendumBlockingIssue[] {
  if (addendum.status === 'issued' || addendum.status === 'withdrawn') {
    return [];
  }
  const tender = tenderOf(addendum.tenderId);
  const issues: AddendumBlockingIssue[] = [];
  const anyArea = addendum.changesScope || addendum.changesTerms || addendum.changesSubmission || addendum.changesEvaluation;
  if (addendum.materiality === 'material' && addendum.responseTimeAssessment === null) {
    issues.push('RESPONSE_TIME_ASSESSMENT_REQUIRED');
  }
  if (addendum.materiality === 'material' && !anyArea) {
    issues.push('CHANGE_AREA_REQUIRED');
  }
  if (tender.lots.length > 0 && addendum.lotIds.length === 0) {
    issues.push('AFFECTED_LOTS_REQUIRED');
  }
  if (addendum.newSubmissionDeadline !== null && Date.parse(addendum.newSubmissionDeadline) <= now.getTime()) {
    issues.push('NEW_DEADLINE_IN_PAST');
  }
  if (addendum.status === 'draft') {
    issues.push('APPROVAL_REQUIRED');
  }
  if (addendum.status === 'awaiting_approval') {
    issues.push('APPROVAL_PENDING');
  }
  return issues;
}

export function addendumRecipient(recipient: AddendumRecipientFixture): AddendumRecipient {
  return {
    supplier: orgRef(recipient.supplierTenantId),
    deliveryStatus: recipient.deliveryStatus,
    deliveredAt: recipient.deliveredAt,
    openedAt: recipient.openedAt,
    acknowledgedAt: recipient.acknowledgedAt,
    acknowledgedBy: personOrNull(recipient.acknowledgedBy),
    failureReason: recipient.failureReason,
    hadSubmissionAtIssue: recipient.hadSubmissionAtIssue,
    priorReceiptNo: recipient.priorReceiptNo,
    priorReceiptStillEffective: recipient.priorReceiptStillEffective,
    requiredAction: recipient.requiredAction,
    requiredActionCompleted: recipient.requiredActionCompleted,
  };
}

export function buyerAddendumDetail(addendum: AddendumFixture, now: Date): BuyerAddendumDetail {
  const tender = tenderOf(addendum.tenderId);
  const sourceQuestions = QUESTIONS.filter((question) => question.addendumId === addendum.id && question.tenantId === addendum.tenantId);
  return {
    ...buyerAddendumRow(addendum),
    changeDescription: addendum.changeDescription,
    reason: addendum.reason,
    responseTimeAssessment: addendum.responseTimeAssessment,
    currentSubmissionDeadline: deadline(addendum.previousSubmissionDeadline, tender.officialTimeZone),
    requirementChanges: requirementChanges(tender, addendum),
    notice:
      addendum.notice === null || addendum.issuedAt === null
        ? null
        : {
            noticeId: addendum.notice.noticeId,
            noticeType: addendum.notice.noticeType,
            title: addendum.notice.title,
            issuedAt: addendum.issuedAt,
            requiresAcknowledgment: addendum.acknowledgmentRequired,
          },
    recipients: addendum.recipients.map(addendumRecipient),
    sourceQuestions: sourceQuestions.map((question) => ({
      questionId: question.id,
      supplier: orgRef(question.supplierTenantId),
      questionText: question.questionText,
    })),
    blockingIssues: blockingIssues(addendum, now),
    withdrawnReason: addendum.withdrawnReason,
    history: historyOf(addendum.history),
  };
}

export function supplierRecipient(addendum: AddendumFixture, supplierTenantId: number): AddendumRecipientFixture | undefined {
  if (addendum.status !== 'issued') {
    return undefined;
  }
  return addendum.recipients.find((recipient) => recipient.supplierTenantId === supplierTenantId);
}

export function supplierAddendumRow(addendum: AddendumFixture, recipient: AddendumRecipientFixture): SupplierAddendumRow {
  const tender = tenderOf(addendum.tenderId);
  if (addendum.issuedAt === null || addendum.resultingVersionNo === null) {
    throw new Error(`Addendum ${addendum.id} is not issued.`);
  }
  return {
    id: addendum.id,
    tender: tenderRef(tender),
    buyer: orgRef(addendum.tenantId),
    number: addendum.number,
    title: addendum.title,
    materiality: addendum.materiality,
    changesScope: addendum.changesScope,
    changesTerms: addendum.changesTerms,
    changesSubmission: addendum.changesSubmission,
    changesEvaluation: addendum.changesEvaluation,
    issuedAt: addendum.issuedAt,
    resultingVersionNo: addendum.resultingVersionNo,
    newSubmissionDeadline: deadline(addendum.newSubmissionDeadline, tender.officialTimeZone),
    affectedLots: affectedLots(tender, addendum.lotIds),
    acknowledgmentRequired: addendum.acknowledgmentRequired,
    requiredAction: recipient.requiredAction,
    requiredActionCompleted: recipient.requiredActionCompleted,
    actionOutstanding: recipientOutstanding(addendum, recipient),
    deliveredAt: recipient.deliveredAt,
    openedAt: recipient.openedAt,
    acknowledgedAt: recipient.acknowledgedAt,
    acknowledgedBy: personOrNull(recipient.acknowledgedBy),
    // The addendum never invalidates a receipt; only the supplier's own later submission supersedes it (AC-10).
    priorSubmission:
      recipient.priorReceiptNo === null || recipient.priorReceivedAt === null
        ? null
        : { receiptNo: recipient.priorReceiptNo, receivedAt: recipient.priorReceivedAt, remainsValid: recipient.priorReceiptStillEffective },
  };
}

export function supplierAddendumDetail(addendum: AddendumFixture, recipient: AddendumRecipientFixture): SupplierAddendumDetail {
  const tender = tenderOf(addendum.tenderId);
  return {
    ...supplierAddendumRow(addendum, recipient),
    changeDescription: addendum.changeDescription,
    reason: addendum.reason,
    existingSubmissionAction: addendum.existingSubmissionAction,
    previousSubmissionDeadline:
      addendum.newSubmissionDeadline === null ? null : deadline(addendum.previousSubmissionDeadline, tender.officialTimeZone),
    requirementChanges: requirementChanges(tender, addendum),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------------------------------------

function sessionCore(session: SessionFixture) {
  const tender = tenderOf(session.tenderId);
  const parent = session.alternativeOfId === null ? undefined : sessionById(session.alternativeOfId);
  return {
    id: session.id,
    tender: tenderRef(tender),
    lot: lotRef(tender, session.lotId),
    sessionType: session.sessionType,
    title: session.title,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    timeZone: tender.officialTimeZone,
    venue: session.venue,
    instructions: session.instructions,
    capacity: session.capacity,
    placesAvailable: placesAvailable(session),
    mandatory: session.mandatory,
    alternativeOf: parent === undefined ? null : { id: parent.id, title: parent.title, startsAt: parent.startsAt },
    alternatives: SESSIONS.filter((candidate) => candidate.alternativeOfId === session.id).map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      startsAt: candidate.startsAt,
      placesAvailable: placesAvailable(candidate),
    })),
    accessibilityInfo: session.accessibilityInfo,
    registrationDeadline: deadline(session.registrationDeadline, tender.officialTimeZone),
    minutesDocument: session.minutesPublishedAt === null ? null : (sessionMinutesDocuments(session.id)[0] ?? null),
    minutesPublishedAt: session.minutesPublishedAt,
    status: session.status,
  };
}

export function sessionSharedAnswers(session: SessionFixture): SharedAnswer[] {
  return QUESTIONS.filter((question) => question.sessionId === session.id && isSharedAnswer(question)).map(sharedAnswer);
}

export function buyerSessionRow(session: SessionFixture): BuyerSessionRow {
  return {
    ...sessionCore(session),
    registered: activeRegistrations(session).length,
    attended: session.registrations.filter((registration) => registration.status === 'attended').length,
    absent: session.registrations.filter((registration) => registration.status === 'absent').length,
    accessibilityRequests: activeRegistrations(session).filter((registration) => registration.accessibilityNeeds !== null).length,
    openAttendanceExceptions: session.registrations.filter(
      (registration) => isAttendanceException(session, registration) && registration.exceptionResolution === null,
    ).length,
  };
}

export function buyerRegistration(session: SessionFixture, registration: RegistrationFixture): BuyerSessionRegistration {
  const resolution = registration.exceptionResolution;
  return {
    id: registration.id,
    supplier: orgRef(registration.supplierTenantId),
    registeredBy: personRef(registration.registeredBy),
    attendeeNames: [...registration.attendeeNames],
    accessibilityNeeds: registration.accessibilityNeeds,
    status: registration.status,
    attendanceRecordedBy: personOrNull(registration.attendanceRecordedBy),
    attendanceRecordedAt: registration.attendanceRecordedAt,
    createdAt: registration.createdAt,
    attendanceException: isAttendanceException(session, registration),
    exceptionResolution:
      resolution === null
        ? null
        : {
            resolution: resolution.resolution,
            note: resolution.note,
            resolvedAt: resolution.resolvedAt,
            resolvedBy: personRef(resolution.resolvedBy),
            alternativeSessionId: resolution.alternativeSessionId,
          },
  };
}

export function buyerSessionDetail(session: SessionFixture): BuyerSessionDetail {
  return {
    ...buyerSessionRow(session),
    registrations: session.registrations.map((registration) => buyerRegistration(session, registration)),
    minutesDocumentOptions: sessionMinutesDocuments(session.id),
    sharedAnswers: sessionSharedAnswers(session),
    cancellationReason: session.cancellationReason,
    history: historyOf(session.history),
  };
}

export function registrationOpen(session: SessionFixture, now: Date): boolean {
  if (session.status !== 'scheduled' || placesAvailable(session) === 0) {
    return false;
  }
  if (Date.parse(session.startsAt) <= now.getTime()) {
    return false;
  }
  return session.registrationDeadline === null || Date.parse(session.registrationDeadline) > now.getTime();
}

export function ownRegistration(session: SessionFixture, supplierTenantId: number): RegistrationFixture | undefined {
  const own = session.registrations.filter((registration) => registration.supplierTenantId === supplierTenantId);
  return own.find((registration) => registration.status !== 'cancelled') ?? own[own.length - 1];
}

export function supplierOwnRegistration(registration: RegistrationFixture): SupplierOwnRegistration {
  return {
    id: registration.id,
    status: registration.status,
    attendeeNames: [...registration.attendeeNames],
    accessibilityNeeds: registration.accessibilityNeeds,
    registeredBy: personRef(registration.registeredBy),
    createdAt: registration.createdAt,
    attendanceRecordedAt: registration.attendanceRecordedAt,
  };
}

export function supplierSessionRow(session: SessionFixture, supplierTenantId: number, now: Date): SupplierSessionRow {
  const own = ownRegistration(session, supplierTenantId);
  return {
    ...sessionCore(session),
    buyer: orgRef(session.tenantId),
    ownRegistration: own === undefined ? null : supplierOwnRegistration(own),
    registrationOpen: registrationOpen(session, now),
  };
}

export function supplierSessionDetail(session: SessionFixture, supplierTenantId: number, now: Date): SupplierSessionDetail {
  return { ...supplierSessionRow(session, supplierTenantId, now), sharedAnswers: sessionSharedAnswers(session) };
}

// ---------------------------------------------------------------------------------------------------------
// Tender overviews
// ---------------------------------------------------------------------------------------------------------

export function buyerTenderRow(tender: ClarificationTenderFixture, now: Date): BuyerClarificationTender {
  const questions = QUESTIONS.filter((question) => question.tenderId === tender.id);
  const addenda = ADDENDA.filter((addendum) => addendum.tenderId === tender.id);
  const open = questions.filter((question) => !isClosedQuestion(question.status));
  return {
    ...tenderRef(tender),
    status: tender.status,
    eventType: tender.eventType,
    participation: tender.participation,
    officialTimeZone: tender.officialTimeZone,
    currentVersionNo: tender.currentVersionNo,
    questionsDeadline: deadline(tender.questionsDeadline, tender.officialTimeZone),
    submissionDeadline: deadline(tender.submissionDeadline, tender.officialTimeZone),
    owner: personRef(tender.ownerUserId),
    openQuestions: open.length,
    unassignedQuestions: open.filter((question) => question.ownerUserId === null).length,
    lateQuestionsAwaitingDisposition: open.filter((question) => question.afterDeadline && question.lateDisposition === null).length,
    addendaInProgress: addenda.filter((addendum) => ['draft', 'awaiting_approval', 'approved'].includes(addendum.status)).length,
    issuedAddenda: addenda.filter((addendum) => addendum.status === 'issued').length,
    pendingAcknowledgments: addenda
      .filter((addendum) => addendum.status === 'issued' && addendum.acknowledgmentRequired)
      .reduce((count, addendum) => count + addendum.recipients.filter((recipient) => recipient.acknowledgedAt === null).length, 0),
    upcomingSessions: SESSIONS.filter(
      (session) => session.tenderId === tender.id && session.status === 'scheduled' && Date.parse(session.startsAt) > now.getTime(),
    ).length,
  };
}

export function supplierTenderRow(tender: ClarificationTenderFixture, supplierTenantId: number, now: Date): SupplierClarificationTender {
  const own = QUESTIONS.filter((question) => question.tenderId === tender.id && question.supplierTenantId === supplierTenantId);
  const shared = QUESTIONS.filter((question) => question.tenderId === tender.id && isSharedAnswer(question));
  const received = ADDENDA.flatMap((addendum) => {
    const recipient = addendum.tenderId === tender.id ? supplierRecipient(addendum, supplierTenantId) : undefined;
    return recipient === undefined ? [] : [{ addendum, recipient }];
  });
  const toAcknowledge = received.filter(({ addendum, recipient }) => acknowledgmentOutstanding(addendum, recipient));
  const outstanding = received.filter(({ addendum, recipient }) => recipientOutstanding(addendum, recipient));
  return {
    ...tenderRef(tender),
    buyer: orgRef(tender.tenantId),
    status: tender.status,
    officialTimeZone: tender.officialTimeZone,
    currentVersionNo: tender.currentVersionNo,
    questionsDeadline: deadline(tender.questionsDeadline, tender.officialTimeZone),
    submissionDeadline: deadline(tender.submissionDeadline, tender.officialTimeZone),
    acceptingQuestions: tender.status === 'open',
    ownQuestions: own.length,
    awaitingAnswer: own.filter((question) => !isClosedQuestion(question.status)).length,
    publishedAnswers: shared.length,
    addendaToAcknowledge: toAcknowledge.length,
    addendaActionOutstanding: outstanding.length,
    nextAddendumAction: nextAddendumAction(tender, outstanding),
    upcomingSessions: SESSIONS.filter(
      (session) => session.tenderId === tender.id && session.status === 'scheduled' && Date.parse(session.startsAt) > now.getTime(),
    ).length,
  };
}

/**
 * The most urgent outstanding addendum action of a supplier: a supplement or replacement first (it needs a new
 * submission before the deadline), then an acknowledgment; the lowest addendum number first within each.
 */
function nextAddendumAction(
  tender: ClarificationTenderFixture,
  outstanding: readonly { readonly addendum: AddendumFixture; readonly recipient: AddendumRecipientFixture }[],
): SupplierAddendumDue | null {
  const ranked = [...outstanding].sort(
    (left, right) =>
      Number(submissionActionOutstanding(right.recipient)) - Number(submissionActionOutstanding(left.recipient)) ||
      left.addendum.number - right.addendum.number,
  );
  const first = ranked[0];
  if (first === undefined) {
    return null;
  }
  return {
    addendumId: first.addendum.id,
    number: first.addendum.number,
    requiredAction: first.recipient.requiredAction,
    acknowledgmentOutstanding: acknowledgmentOutstanding(first.addendum, first.recipient),
    submissionActionOutstanding: submissionActionOutstanding(first.recipient),
    dueBy: deadline(tender.submissionDeadline, tender.officialTimeZone),
  };
}

/** Requirements visible in the tender's current version (a requirement removed by an issued addendum drops out). */
export function currentRequirements(tender: ClarificationTenderFixture) {
  return tender.requirements
    .filter((requirement) => {
      if (requirement.addedByAddendumId === null) {
        return true;
      }
      const addendum = ADDENDA.find((row) => row.id === requirement.addedByAddendumId);
      return addendum !== undefined && addendum.status === 'issued';
    })
    .map(({ addedByAddendumId: _addedBy, ...requirement }) => requirement);
}

// ---------------------------------------------------------------------------------------------------------
// Sorting and text search
// ---------------------------------------------------------------------------------------------------------

export function sortBy<T>(rows: T[], key: (row: T) => string | number | null, dir: 'asc' | 'desc'): T[] {
  const factor = dir === 'desc' ? -1 : 1;
  return [...rows].sort((left, right) => {
    const a = key(left);
    const b = key(right);
    if (a === b) {
      return 0;
    }
    if (a === null) {
      return 1;
    }
    if (b === null) {
      return -1;
    }
    return (a < b ? -1 : 1) * factor;
  });
}

export function matchesText(q: string | undefined, ...values: ReadonlyArray<string | null | undefined>): boolean {
  if (q === undefined || q === '') {
    return true;
  }
  const needle = q.toLowerCase();
  return values.some((value) => value !== null && value !== undefined && value.toLowerCase().includes(needle));
}

/** `YYYY-MM-DD` of an instant in the given zone. */
export function localDate(at: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
}

export function withinDates(at: string | null, timeZone: string, from: string | undefined, to: string | undefined): boolean {
  if (from === undefined && to === undefined) {
    return true;
  }
  if (at === null) {
    return false;
  }
  const day = localDate(at, timeZone);
  return (from === undefined || day >= from) && (to === undefined || day <= to);
}
