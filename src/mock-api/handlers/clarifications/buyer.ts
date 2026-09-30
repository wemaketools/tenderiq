/**
 * Buyer handlers of the clarifications contract (BUY-16 questions, BUY-17 addenda, BUY-18 sessions). Every list
 * is scoped to the active buyer tenant; another buyer's record is simply not found. Commands check the business
 * state the fixture implies and return the static outcome; nothing is persisted.
 */
import { clarificationsEndpoints as api } from '../../../contracts/clarifications.js';
import type {

  BuyerQuestionDetail,
  BuyerSessionDetail,
  CreateAddendumBody,
  CreateSessionBody,
  UpdateAddendumBody,
  UpdateSessionBody,
} from '../../../contracts/clarifications.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { ADDENDA, CLARIFICATION_TENDERS, QUESTIONS, SESSIONS, requiredActionFor, sessionMinutesDocuments } from '../../fixtures/clarifications/index.js';
import type {
  AddendumFixture,
  ClarificationTenderFixture,
  QuestionFixture,
  SessionFixture,
} from '../../fixtures/clarifications/index.js';
import { allPersonas, membershipPermissions, personRef } from '../../persona.js';
import {
  activeRegistrations,
  buyerAddendumDetail,
  buyerAddendumRow,
  buyerQuestionDetail,
  buyerQuestionRow,
  buyerSessionDetail,
  buyerSessionRow,
  buyerTenderRow,
  currentRequirements,
  isAmendable,
  isAttendanceException,
  isClosedQuestion,
  isParticipant,
  matchesText,
  orgRef,
  outstandingRecipients,
  placesAvailable,
  sessionById,
  sortBy,
  tenderById,
  tenderOf,
  withinDates,
} from './projections.js';

/** Ids of records created by a static command (foundation-contract §2.3: new ids ≥ 900). */
const NEW_ID = 900;

type Fail = (status: number, code: string, detail?: string) => never;

function iso(at: Date): string {
  return at.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function historyEntry(at: Date, action: string, actorUserId: number, note: string | null) {
  return { at: iso(at), action, actor: personRef(actorUserId), note };
}

// ---------------------------------------------------------------------------------------------------------
// Question command helpers
// ---------------------------------------------------------------------------------------------------------

function ensureOpen(question: QuestionFixture, fail: Fail): void {
  if (isClosedQuestion(question.status)) {
    return fail(409, 'QUESTION_CLOSED', `The question is already ${question.status.replace(/_/g, ' ')}.`);
  }
}

function ensureLateDisposition(question: QuestionFixture, fail: Fail): void {
  if (question.afterDeadline && question.lateDisposition === null) {
    return fail(409, 'LATE_DISPOSITION_REQUIRED', 'Record whether the late question is accepted or declined first.');
  }
}

function withQuestion(
  question: QuestionFixture,
  changes: Partial<BuyerQuestionDetail>,
  entry: ReturnType<typeof historyEntry>,
): BuyerQuestionDetail {
  const detail = buyerQuestionDetail(question);
  return { ...detail, ...changes, history: [...detail.history, entry] };
}

function namesSupplier(question: QuestionFixture, text: string | null): boolean {
  if (text === null) {
    return false;
  }
  const supplier = orgRef(question.supplierTenantId).name.toLowerCase();
  const firstWord = supplier.split(/\s+/)[0] ?? supplier;
  const lower = text.toLowerCase();
  return lower.includes(supplier) || (firstWord.length > 3 && lower.includes(firstWord));
}

function canOwnClarifications(tenantId: number, userId: number): boolean {
  return allPersonas().some(
    (persona) =>
      persona.userId === userId &&
      persona.status === 'active' &&
      persona.memberships.some(
        (membership) =>
          membership.tenantId === tenantId &&
          membership.status === 'active' &&
          membershipPermissions(membership).includes('tender.clarifications.manage'),
      ),
  );
}

// ---------------------------------------------------------------------------------------------------------
// Addendum command helpers
// ---------------------------------------------------------------------------------------------------------

function validateAddendumFields(
  tender: ClarificationTenderFixture,
  body: UpdateAddendumBody,
  now: Date,
  fail: Fail,
): void {
  const anyArea = body.changesScope || body.changesTerms || body.changesSubmission || body.changesEvaluation;
  if (body.materiality === 'material' && !anyArea) {
    return fail(422, 'CHANGE_AREA_REQUIRED', 'A material addendum changes scope, terms, submission or evaluation.');
  }
  if (body.newSubmissionDeadline !== null) {
    if (Date.parse(body.newSubmissionDeadline) <= now.getTime()) {
      return fail(422, 'NEW_DEADLINE_IN_PAST', 'The new submission deadline must be in the future.');
    }
    if (!body.changesSubmission) {
      return fail(422, 'NEW_DEADLINE_WITHOUT_SUBMISSION_CHANGE', 'A deadline change is a change to submission requirements.');
    }
  }
  for (const lotId of body.lotIds) {
    if (!tender.lots.some((lot) => lot.lotId === lotId)) {
      return fail(422, 'LOT_NOT_IN_TENDER', `Lot ${lotId} is not part of ${tender.reference}.`);
    }
  }
  for (const change of body.requirementChanges) {
    if (change.changeType !== 'added' && change.requirementId === undefined) {
      return fail(422, 'REQUIREMENT_NOT_IN_TENDER', `Name the requirement that is ${change.changeType}.`);
    }
    if (change.requirementId !== undefined && !tender.requirements.some((row) => row.requirementId === change.requirementId)) {
      return fail(422, 'REQUIREMENT_NOT_IN_TENDER', `Requirement ${change.requirementId} is not part of ${tender.reference}.`);
    }
    if (change.lotId !== null && !tender.lots.some((lot) => lot.lotId === change.lotId)) {
      return fail(422, 'LOT_NOT_IN_TENDER', `Lot ${change.lotId} is not part of ${tender.reference}.`);
    }
  }
}

function addendumFromBody(
  base: AddendumFixture | null,
  tender: ClarificationTenderFixture,
  body: UpdateAddendumBody,
  id: number,
  number: number,
  actorUserId: number,
  now: Date,
  sourceQuestionIds: readonly number[],
): AddendumFixture {
  return {
    id,
    tenantId: tender.tenantId,
    tenderId: tender.id,
    number,
    title: body.title,
    changeDescription: body.changeDescription,
    reason: body.reason,
    materiality: body.materiality,
    changesScope: body.changesScope,
    changesTerms: body.changesTerms,
    changesSubmission: body.changesSubmission,
    changesEvaluation: body.changesEvaluation,
    newSubmissionDeadline: body.newSubmissionDeadline,
    previousSubmissionDeadline: tender.submissionDeadline,
    responseTimeAssessment: body.responseTimeAssessment === null || body.responseTimeAssessment === '' ? null : body.responseTimeAssessment,
    existingSubmissionAction: body.existingSubmissionAction,
    status: 'draft',
    approvalRequestId: null,
    approvalStatus: null,
    issuedAt: null,
    resultingVersionNo: null,
    notice: null,
    acknowledgmentRequired: body.materiality === 'material' || body.existingSubmissionAction !== 'none',
    lotIds: [...body.lotIds],
    requirementChanges: body.requirementChanges.map((change, index) => {
      const existing = tender.requirements.find((row) => row.requirementId === change.requirementId);
      return {
        id: NEW_ID + index,
        requirementId: change.requirementId ?? NEW_ID + index,
        changeType: change.changeType,
        previousText: change.changeType === 'added' ? null : (existing?.text ?? null),
        newText: change.changeType === 'removed' ? null : change.newText,
        previousTreatment: change.changeType === 'added' ? null : (existing?.treatment ?? null),
        newTreatment: change.changeType === 'removed' ? null : change.newTreatment,
      };
    }),
    recipients: [],
    withdrawnReason: null,
    createdAt: base?.createdAt ?? iso(now),
    createdBy: base?.createdBy ?? actorUserId,
    history: [
      ...(base?.history ?? []),
      {
        at: iso(now),
        action: base === null ? 'drafted' : 'edited',
        actorUserId,
        note: sourceQuestionIds.length > 0 ? `From question ${sourceQuestionIds.join(', ')}.` : null,
      },
    ],
  };
}

// ---------------------------------------------------------------------------------------------------------
// Session command helpers
// ---------------------------------------------------------------------------------------------------------

function validateSessionFields(
  tender: ClarificationTenderFixture,
  body: UpdateSessionBody,
  now: Date,
  fail: Fail,
  current: SessionFixture | null,
): void {
  if (Date.parse(body.endsAt) <= Date.parse(body.startsAt)) {
    return fail(422, 'SESSION_END_BEFORE_START', 'The session must end after it starts.');
  }
  if (current === null && Date.parse(body.startsAt) <= now.getTime()) {
    return fail(422, 'SESSION_IN_PAST', 'Schedule the session in the future.');
  }
  if (body.registrationDeadline !== null && Date.parse(body.registrationDeadline) >= Date.parse(body.startsAt)) {
    return fail(422, 'REGISTRATION_DEADLINE_AFTER_START', 'Registration must close before the session starts.');
  }
  if (body.lotId !== null && !tender.lots.some((lot) => lot.lotId === body.lotId)) {
    return fail(422, 'LOT_NOT_IN_TENDER', `The lot is not part of ${tender.reference}.`);
  }
  if (body.alternativeOfId !== null) {
    const parent = sessionById(body.alternativeOfId);
    if (parent === undefined || parent.tenderId !== tender.id || parent.id === current?.id) {
      return fail(422, 'ALTERNATIVE_NOT_IN_TENDER', 'An alternative must be another session of the same tender.');
    }
  }
  const released = tender.status !== 'draft' && tender.status !== 'awaiting_release_approval' && tender.status !== 'ready';
  const newlyMandatory = body.mandatory && (current === null || !current.mandatory);
  if (released && newlyMandatory && body.alternativeOfId === null) {
    return fail(
      409,
      'MANDATORY_REQUIRES_ADDENDUM',
      'Mandatory attendance must be declared in advance; after release it is added through an addendum.',
    );
  }
}

function sessionFromBody(
  base: SessionFixture | null,
  tender: ClarificationTenderFixture,
  body: UpdateSessionBody,
  id: number,
  actorUserId: number,
  now: Date,
): SessionFixture {
  return {
    id,
    tenantId: tender.tenantId,
    tenderId: tender.id,
    lotId: body.lotId,
    sessionType: body.sessionType,
    title: body.title,
    startsAt: body.startsAt,
    endsAt: body.endsAt,
    venue: body.venue,
    instructions: body.instructions === '' ? null : body.instructions,
    capacity: body.capacity,
    mandatory: body.mandatory,
    alternativeOfId: body.alternativeOfId,
    accessibilityInfo: body.accessibilityInfo === '' ? null : body.accessibilityInfo,
    registrationDeadline: body.registrationDeadline,
    minutesPublishedAt: base?.minutesPublishedAt ?? null,
    status: 'scheduled',
    cancellationReason: null,
    registrations: base?.registrations ?? [],
    history: [...(base?.history ?? []), { at: iso(now), action: base === null ? 'scheduled' : 'edited', actorUserId, note: null }],
  };
}

function sessionDetailWith(session: SessionFixture, changes: Partial<SessionFixture>): BuyerSessionDetail {
  return buyerSessionDetail({ ...session, ...changes });
}

// ---------------------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------------------

export function registerBuyer(app: MockApp): void {
  // Overview and context ------------------------------------------------------------------------------
  mockRoute(app, api.buyerTenders, ({ requireTenant, query, fixtures, now }) => {
    const { tenant } = requireTenant();
    let rows = CLARIFICATION_TENDERS.filter((tender) => tender.tenantId === tenant.id)
      .filter((tender) => query.status === undefined || query.status.includes(tender.status))
      .filter((tender) => matchesText(query.q, tender.reference, tender.title))
      .map((tender) => buyerTenderRow(tender, now));
    if (query.withOpenWork === true) {
      rows = rows.filter((row) => row.openQuestions + row.addendaInProgress + row.pendingAcknowledgments + row.upcomingSessions > 0);
    }
    const sorted =
      query.sort === 'questionsDeadline'
        ? sortBy(rows, (row) => row.questionsDeadline?.at ?? null, query.dir)
        : query.sort === 'openQuestions'
          ? sortBy(rows, (row) => row.openQuestions, query.dir)
          : sortBy(rows, (row) => row.reference, query.sort === undefined ? 'desc' : query.dir);
    return fixtures.page(sorted);
  });

  mockRoute(app, api.buyerTenderContext, ({ requireTenant, params, notFound, now }) => {
    const { tenant } = requireTenant();
    const tender = tenderById(params.tenderId);
    if (tender === undefined || tender.tenantId !== tenant.id) {
      return notFound();
    }
    return {
      ...buyerTenderRow(tender, now),
      lots: tender.lots.map((lot) => ({
        lotId: lot.lotId,
        lotNo: lot.lotNo,
        title: lot.title,
        stage: lot.stage,
        submissionDeadline: lot.submissionDeadline === null ? null : { at: lot.submissionDeadline, timeZone: tender.officialTimeZone },
      })),
      requirements: currentRequirements(tender),
      documents: tender.documents.map((document) => ({ ...document })),
      participants: tender.participants.map((participant) => ({
        supplier: orgRef(participant.supplierTenantId),
        hasEffectiveSubmission: participant.hasEffectiveSubmission,
        effectiveReceiptNo: participant.effectiveReceiptNo,
        receivedAt: participant.receivedAt,
      })),
      amendable: isAmendable(tender),
    };
  });

  mockRoute(app, api.ownerCandidates, ({ requireTenant, query, notFound }) => {
    const { tenant } = requireTenant();
    if (query.tenderId !== undefined) {
      const tender = tenderById(query.tenderId);
      if (tender === undefined || tender.tenantId !== tenant.id) {
        return notFound();
      }
    }
    return allPersonas()
      .filter((persona) => persona.status === 'active' && canOwnClarifications(tenant.id, persona.userId))
      .map((persona) => {
        const membership = persona.memberships.find((candidate) => candidate.tenantId === tenant.id);
        return {
          userId: persona.userId,
          fullName: persona.fullName,
          capacity: membership?.capacity ?? null,
          openQuestions: QUESTIONS.filter(
            (question) =>
              question.tenantId === tenant.id &&
              question.ownerUserId === persona.userId &&
              !isClosedQuestion(question.status) &&
              (query.tenderId === undefined || question.tenderId === query.tenderId),
          ).length,
        };
      });
  });

  // Questions ---------------------------------------------------------------------------------------------
  mockRoute(app, api.questionsList, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = QUESTIONS.filter((question) => question.tenantId === tenant.id)
      .filter((question) => query.tenderId === undefined || question.tenderId === query.tenderId)
      .filter((question) => query.status === undefined || query.status.includes(question.status))
      .filter((question) => query.audience === undefined || query.audience.includes(question.audience))
      .filter((question) => query.ownerUserId === undefined || question.ownerUserId === query.ownerUserId)
      .filter((question) => query.supplierTenantId === undefined || question.supplierTenantId === query.supplierTenantId)
      .filter((question) => query.unassigned !== true || question.ownerUserId === null)
      .filter((question) => query.afterDeadline === undefined || question.afterDeadline === query.afterDeadline)
      .filter((question) =>
        withinDates(question.submittedAt, tenderOf(question.tenderId).officialTimeZone, query.submittedFrom, query.submittedTo),
      )
      .map(buyerQuestionRow)
      .filter((row) =>
        matchesText(query.q, row.questionText, row.tender.reference, row.tender.title, row.supplier.name, row.requirement?.refCode),
      );
    const sorted =
      query.sort === 'responseDueAt'
        ? sortBy(rows, (row) => row.responseDueAt, query.dir)
        : query.sort === 'status'
          ? sortBy(rows, (row) => row.status, query.dir)
          : query.sort === 'tenderReference'
            ? sortBy(rows, (row) => row.tender.reference, query.dir)
            : sortBy(rows, (row) => row.submittedAt, query.sort === undefined ? 'desc' : query.dir);
    return fixtures.page(sorted);
  });

  function buyerQuestion(tenantId: number, questionId: number, notFound: (detail?: string) => never): QuestionFixture {
    const question = QUESTIONS.find((row) => row.id === questionId && row.tenantId === tenantId);
    if (question === undefined) {
      return notFound();
    }
    return question;
  }

  mockRoute(app, api.questionsGet, ({ requireTenant, params, notFound }) => {
    return buyerQuestionDetail(buyerQuestion(requireTenant().tenant.id, params.questionId, notFound));
  });

  mockRoute(app, api.questionsAssign, ({ requireTenant, requirePersona, params, body, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const question = buyerQuestion(tenant.id, params.questionId, notFound);
    ensureOpen(question, fail);
    ensureLateDisposition(question, fail);
    if (!canOwnClarifications(tenant.id, body.ownerUserId)) {
      return fail(422, 'OWNER_NOT_ELIGIBLE', 'The owner must be an active member with clarification rights.');
    }
    return withQuestion(
      question,
      { owner: personRef(body.ownerUserId), status: question.status === 'received' ? 'assigned' : question.status },
      historyEntry(now, 'assigned', requirePersona().userId, body.note ?? null),
    );
  });

  mockRoute(app, api.questionsLateDisposition, ({ requireTenant, requirePersona, params, body, notFound, fail, now }) => {
    const question = buyerQuestion(requireTenant().tenant.id, params.questionId, notFound);
    if (!question.afterDeadline) {
      return fail(409, 'QUESTION_NOT_LATE', 'The question was submitted before the question deadline.');
    }
    if (question.lateDisposition !== null) {
      return fail(409, 'LATE_DISPOSITION_ALREADY_RECORDED', 'A late disposition is already recorded.');
    }
    ensureOpen(question, fail);
    return withQuestion(
      question,
      {
        lateDisposition: body.lateDisposition,
        lateDispositionReason: body.lateDispositionReason,
        status: body.lateDisposition === 'declined' ? 'declined' : question.status,
        responseDueAt: body.lateDisposition === 'declined' ? null : question.responseDueAt,
      },
      historyEntry(now, body.lateDisposition === 'declined' ? 'late_declined' : 'late_accepted', requirePersona().userId, body.lateDispositionReason),
    );
  });

  mockRoute(app, api.questionsSaveAnswer, ({ requireTenant, requirePersona, params, body, notFound, fail, now }) => {
    const question = buyerQuestion(requireTenant().tenant.id, params.questionId, notFound);
    ensureOpen(question, fail);
    ensureLateDisposition(question, fail);
    if (question.ownerUserId === null) {
      return fail(409, 'OWNER_REQUIRED', 'Assign an owner before drafting the answer.');
    }
    if (body.audience === 'public' && !tenderOf(question.tenderId).onPublicPortal) {
      return fail(422, 'PUBLIC_AUDIENCE_NOT_PERMITTED', 'The tender is not on the public portal; share with participants only.');
    }
    return withQuestion(
      question,
      {
        sanitizedQuestion: body.sanitizedQuestion,
        answerText: body.answerText,
        audience: body.audience,
        status: 'draft_answer',
        confidentialityReviewedBy: null,
      },
      historyEntry(now, 'answer_drafted', requirePersona().userId, null),
    );
  });

  mockRoute(app, api.questionsRequestReview, ({ requireTenant, requirePersona, params, body, notFound, fail, now }) => {
    const question = buyerQuestion(requireTenant().tenant.id, params.questionId, notFound);
    ensureOpen(question, fail);
    if (question.answerText === null || (question.audience !== 'private' && question.sanitizedQuestion === null)) {
      return fail(422, 'ANSWER_REQUIRED', 'Draft the answer and the shared wording first.');
    }
    return withQuestion(question, { status: 'in_review' }, historyEntry(now, 'review_requested', requirePersona().userId, body.note ?? null));
  });

  mockRoute(app, api.questionsReview, ({ requireTenant, requirePersona, params, body, notFound, fail, now }) => {
    const question = buyerQuestion(requireTenant().tenant.id, params.questionId, notFound);
    const persona = requirePersona();
    if (question.status !== 'in_review') {
      return fail(409, 'QUESTION_NOT_IN_REVIEW', 'Only a draft sent for review can be reviewed.');
    }
    if (question.ownerUserId === persona.userId) {
      return fail(409, 'SELF_REVIEW_NOT_ALLOWED', 'The confidentiality review is done by someone other than the answer owner.');
    }
    if (body.outcome === 'cleared' && namesSupplier(question, question.sanitizedQuestion)) {
      return fail(422, 'SANITIZED_TEXT_NAMES_SUPPLIER', 'The shared wording still identifies the questioner.');
    }
    return withQuestion(
      question,
      body.outcome === 'cleared'
        ? { confidentialityReviewedBy: personRef(persona.userId) }
        : { status: 'draft_answer', confidentialityReviewedBy: null },
      historyEntry(now, body.outcome === 'cleared' ? 'review_cleared' : 'review_returned', persona.userId, body.note ?? null),
    );
  });

  mockRoute(app, api.questionsPublish, ({ requireTenant, requirePersona, params, body, notFound, fail, now }) => {
    const question = buyerQuestion(requireTenant().tenant.id, params.questionId, notFound);
    ensureOpen(question, fail);
    if (question.status !== 'in_review' || question.confidentialityReviewedBy === null) {
      return fail(409, 'CONFIDENTIALITY_REVIEW_REQUIRED', 'A cleared confidentiality review is required before publication.');
    }
    if (body.audience === 'public' && !tenderOf(question.tenderId).onPublicPortal) {
      return fail(422, 'PUBLIC_AUDIENCE_NOT_PERMITTED', 'The tender is not on the public portal; share with participants only.');
    }
    return withQuestion(
      question,
      { status: 'published', audience: body.audience, publishedAt: iso(now), responseDueAt: null },
      historyEntry(now, 'published', requirePersona().userId, `Audience: ${body.audience.replace('_', ' ')}.`),
    );
  });

  mockRoute(app, api.questionsAnswerPrivately, ({ requireTenant, requirePersona, params, body, notFound, fail, now }) => {
    const question = buyerQuestion(requireTenant().tenant.id, params.questionId, notFound);
    ensureOpen(question, fail);
    ensureLateDisposition(question, fail);
    if (question.ownerUserId === null) {
      return fail(409, 'OWNER_REQUIRED', 'Assign an owner before answering.');
    }
    return withQuestion(
      question,
      { status: 'answered_privately', audience: 'private', answerText: body.answerText, publishedAt: iso(now), responseDueAt: null },
      historyEntry(now, 'answered_privately', requirePersona().userId, body.reason),
    );
  });

  mockRoute(app, api.questionsEscalate, ({ requireTenant, requirePersona, params, body, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const question = buyerQuestion(tenant.id, params.questionId, notFound);
    ensureOpen(question, fail);
    ensureLateDisposition(question, fail);
    const tender = tenderOf(question.tenderId);
    if (!isAmendable(tender)) {
      return fail(409, 'TENDER_NOT_AMENDABLE', `${tender.reference} can no longer be amended.`);
    }
    let addendum: { id: number; number: number; status: 'draft'; title: string };
    if (body.addendumId !== undefined) {
      const existing = ADDENDA.find((row) => row.id === body.addendumId && row.tenantId === tenant.id && row.tenderId === tender.id);
      if (existing === undefined) {
        return notFound('The addendum is not part of this tender.');
      }
      if (existing.status !== 'draft') {
        return fail(409, 'ADDENDUM_NOT_DRAFT', 'Only a draft addendum can absorb a question.');
      }
      addendum = { id: existing.id, number: existing.number, status: 'draft', title: existing.title };
    } else {
      const number = Math.max(0, ...ADDENDA.filter((row) => row.tenderId === tender.id).map((row) => row.number)) + 1;
      addendum = { id: NEW_ID, number, status: 'draft', title: `Change arising from question ${question.id}` };
    }
    return {
      question: withQuestion(
        question,
        { status: 'escalated_to_addendum', addendumId: addendum.id, addendumNumber: addendum.number, responseDueAt: null },
        historyEntry(now, 'escalated_to_addendum', requirePersona().userId, body.reason),
      ),
      addendum,
    };
  });

  mockRoute(app, api.questionsDecline, ({ requireTenant, requirePersona, params, body, notFound, fail, now }) => {
    const question = buyerQuestion(requireTenant().tenant.id, params.questionId, notFound);
    ensureOpen(question, fail);
    return withQuestion(question, { status: 'declined', responseDueAt: null }, historyEntry(now, 'declined', requirePersona().userId, body.reason));
  });

  // Addenda -----------------------------------------------------------------------------------------------
  mockRoute(app, api.addendaList, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = ADDENDA.filter((addendum) => addendum.tenantId === tenant.id)
      .filter((addendum) => query.tenderId === undefined || addendum.tenderId === query.tenderId)
      .filter((addendum) => query.status === undefined || query.status.includes(addendum.status))
      .filter((addendum) => query.materiality === undefined || addendum.materiality === query.materiality)
      .filter((addendum) => query.changesDeadline === undefined || (addendum.newSubmissionDeadline !== null) === query.changesDeadline)
      .filter((addendum) => withinDates(addendum.issuedAt, tenderOf(addendum.tenderId).officialTimeZone, query.issuedFrom, query.issuedTo))
      .filter((addendum) => matchesText(query.q, addendum.title, addendum.changeDescription, tenderOf(addendum.tenderId).reference))
      .map(buyerAddendumRow);
    const sorted =
      query.sort === 'number'
        ? sortBy(rows, (row) => row.number, query.dir)
        : query.sort === 'issuedAt'
          ? sortBy(rows, (row) => row.issuedAt, query.dir)
          : query.sort === 'status'
            ? sortBy(rows, (row) => row.status, query.dir)
            : query.sort === 'tenderReference'
              ? sortBy(rows, (row) => `${row.tender.reference}#${String(row.number).padStart(3, '0')}`, query.dir)
              : sortBy(rows, (row) => row.createdAt, query.sort === undefined ? 'desc' : query.dir);
    return fixtures.page(sorted);
  });

  function buyerAddendum(tenantId: number, addendumId: number, notFound: (detail?: string) => never): AddendumFixture {
    const addendum = ADDENDA.find((row) => row.id === addendumId && row.tenantId === tenantId);
    if (addendum === undefined) {
      return notFound();
    }
    return addendum;
  }

  mockRoute(app, api.addendaGet, ({ requireTenant, params, notFound, now }) => {
    return buyerAddendumDetail(buyerAddendum(requireTenant().tenant.id, params.addendumId, notFound), now);
  });

  mockRoute(app, api.addendaCreate, ({ requireTenant, requirePersona, body, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const input: CreateAddendumBody = body;
    const tender = tenderById(input.tenderId);
    if (tender === undefined || tender.tenantId !== tenant.id) {
      return notFound('The tender does not exist in this organization.');
    }
    if (!isAmendable(tender)) {
      return fail(409, 'TENDER_NOT_AMENDABLE', `${tender.reference} is ${tender.status.replace(/_/g, ' ')} and can no longer be amended.`);
    }
    validateAddendumFields(tender, input, now, fail);
    for (const questionId of input.sourceQuestionIds) {
      if (!QUESTIONS.some((question) => question.id === questionId && question.tenderId === tender.id && question.tenantId === tenant.id)) {
        return fail(422, 'QUESTION_NOT_IN_TENDER', `Question ${questionId} is not a question on ${tender.reference}.`);
      }
    }
    const number = Math.max(0, ...ADDENDA.filter((row) => row.tenderId === tender.id).map((row) => row.number)) + 1;
    const created = addendumFromBody(null, tender, input, NEW_ID, number, requirePersona().userId, now, input.sourceQuestionIds);
    const detail = buyerAddendumDetail(created, now);
    return {
      ...detail,
      sourceQuestions: QUESTIONS.filter((question) => input.sourceQuestionIds.includes(question.id)).map((question) => ({
        questionId: question.id,
        supplier: orgRef(question.supplierTenantId),
        questionText: question.questionText,
      })),
    };
  });

  mockRoute(app, api.addendaUpdate, ({ requireTenant, requirePersona, params, body, notFound, fail, now }) => {
    const addendum = buyerAddendum(requireTenant().tenant.id, params.addendumId, notFound);
    if (addendum.status !== 'draft') {
      return fail(409, 'ADDENDUM_NOT_EDITABLE', `The addendum is ${addendum.status.replace(/_/g, ' ')}; only a draft can be edited.`);
    }
    const tender = tenderOf(addendum.tenderId);
    validateAddendumFields(tender, body, now, fail);
    const updated = addendumFromBody(addendum, tender, body, addendum.id, addendum.number, requirePersona().userId, now, []);
    return buyerAddendumDetail(updated, now);
  });

  mockRoute(app, api.addendaSubmit, ({ requireTenant, requirePersona, params, body, notFound, fail, now }) => {
    const addendum = buyerAddendum(requireTenant().tenant.id, params.addendumId, notFound);
    if (addendum.status !== 'draft') {
      return fail(409, 'ADDENDUM_NOT_EDITABLE', `The addendum is ${addendum.status.replace(/_/g, ' ')}.`);
    }
    const issues = buyerAddendumDetail(addendum, now).blockingIssues;
    if (issues.includes('RESPONSE_TIME_ASSESSMENT_REQUIRED')) {
      return fail(422, 'RESPONSE_TIME_ASSESSMENT_REQUIRED', 'A material addendum needs a response-time assessment (BR-16).');
    }
    if (issues.includes('CHANGE_AREA_REQUIRED')) {
      return fail(422, 'CHANGE_AREA_REQUIRED', 'A material addendum changes scope, terms, submission or evaluation.');
    }
    if (issues.includes('AFFECTED_LOTS_REQUIRED')) {
      return fail(422, 'AFFECTED_LOTS_REQUIRED', 'Name the affected lots.');
    }
    const submitted: AddendumFixture = {
      ...addendum,
      status: 'awaiting_approval',
      approvalRequestId: NEW_ID,
      approvalStatus: 'pending',
      history: [...addendum.history, { at: iso(now), action: 'approval_requested', actorUserId: requirePersona().userId, note: body.note ?? null }],
    };
    return buyerAddendumDetail(submitted, now);
  });

  mockRoute(app, api.addendaIssue, ({ requireTenant, requirePersona, params, notFound, fail, now }) => {
    const addendum = buyerAddendum(requireTenant().tenant.id, params.addendumId, notFound);
    if (addendum.status === 'issued') {
      return fail(409, 'ADDENDUM_ALREADY_ISSUED', 'The addendum is already issued.');
    }
    if (addendum.status !== 'approved') {
      return fail(409, 'ADDENDUM_NOT_APPROVED', 'Only an approved addendum can be issued.');
    }
    const tender = tenderOf(addendum.tenderId);
    if (!isAmendable(tender)) {
      return fail(409, 'TENDER_NOT_AMENDABLE', `${tender.reference} can no longer be amended.`);
    }
    if (addendum.newSubmissionDeadline !== null && Date.parse(addendum.newSubmissionDeadline) <= now.getTime()) {
      return fail(409, 'NEW_DEADLINE_IN_PAST', 'The new deadline has passed; revise the addendum.');
    }
    const issuedAt = iso(now);
    const issued: AddendumFixture = {
      ...addendum,
      status: 'issued',
      issuedAt,
      resultingVersionNo: tender.currentVersionNo + 1,
      notice: {
        noticeId: NEW_ID,
        noticeType: addendum.newSubmissionDeadline === null ? 'addendum' : 'deadline_change',
        title: `${tender.reference} Addendum ${addendum.number}: ${addendum.title}`,
      },
      recipients: tender.participants.map((participant) => ({
        supplierTenantId: participant.supplierTenantId,
        deliveryStatus: 'pending',
        deliveredAt: null,
        openedAt: null,
        acknowledgedAt: null,
        acknowledgedBy: null,
        failureReason: null,
        hadSubmissionAtIssue: participant.hasEffectiveSubmission,
        // The prior receipt is left exactly as it was (AC-10).
        priorReceiptNo: participant.effectiveReceiptNo,
        priorReceivedAt: participant.receivedAt,
        priorReceiptStillEffective: participant.hasEffectiveSubmission,
        requiredAction: requiredActionFor(addendum, participant.hasEffectiveSubmission),
        requiredActionCompleted: requiredActionFor(addendum, participant.hasEffectiveSubmission) === 'none',
      })),
      history: [
        ...addendum.history,
        { at: issuedAt, action: 'issued', actorUserId: requirePersona().userId, note: `Tender version ${tender.currentVersionNo + 1}.` },
      ],
    };
    return buyerAddendumDetail(issued, now);
  });

  mockRoute(app, api.addendaWithdraw, ({ requireTenant, requirePersona, params, body, notFound, fail, now }) => {
    const addendum = buyerAddendum(requireTenant().tenant.id, params.addendumId, notFound);
    if (addendum.status === 'issued') {
      return fail(409, 'ADDENDUM_ALREADY_ISSUED', 'An issued addendum is corrected only by a further addendum.');
    }
    if (addendum.status === 'withdrawn') {
      return fail(409, 'ADDENDUM_ALREADY_WITHDRAWN', 'The addendum is already withdrawn.');
    }
    const withdrawn: AddendumFixture = {
      ...addendum,
      status: 'withdrawn',
      approvalStatus: addendum.approvalStatus === 'pending' ? 'withdrawn' : addendum.approvalStatus,
      withdrawnReason: body.reason,
      history: [...addendum.history, { at: iso(now), action: 'withdrawn', actorUserId: requirePersona().userId, note: body.reason }],
    };
    return buyerAddendumDetail(withdrawn, now);
  });

  mockRoute(app, api.addendaRemind, ({ requireTenant, params, body, notFound, fail, now }) => {
    const addendum = buyerAddendum(requireTenant().tenant.id, params.addendumId, notFound);
    if (addendum.status !== 'issued') {
      return fail(409, 'ADDENDUM_NOT_ISSUED', 'Only an issued addendum has recipients to remind.');
    }
    const targets = outstandingRecipients(addendum).filter(
      (recipient) => body.supplierTenantIds === undefined || body.supplierTenantIds.includes(recipient.supplierTenantId),
    );
    if (targets.length === 0) {
      return fail(409, 'NO_OUTSTANDING_ACKNOWLEDGMENTS', 'Every selected recipient has acknowledged and completed the required action.');
    }
    return { addendumId: addendum.id, reminded: targets.map((recipient) => orgRef(recipient.supplierTenantId)), sentAt: iso(now) };
  });

  // Sessions ----------------------------------------------------------------------------------------------
  mockRoute(app, api.sessionsList, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = SESSIONS.filter((session) => session.tenantId === tenant.id)
      .filter((session) => query.tenderId === undefined || session.tenderId === query.tenderId)
      .filter((session) => query.sessionType === undefined || session.sessionType === query.sessionType)
      .filter((session) => query.status === undefined || query.status.includes(session.status))
      .filter((session) => query.mandatory === undefined || session.mandatory === query.mandatory)
      .filter((session) => withinDates(session.startsAt, tenderOf(session.tenderId).officialTimeZone, query.startsFrom, query.startsTo))
      .filter((session) => matchesText(query.q, session.title, session.venue, tenderOf(session.tenderId).reference))
      .map(buyerSessionRow);
    const sorted =
      query.sort === 'title'
        ? sortBy(rows, (row) => row.title, query.dir)
        : query.sort === 'tenderReference'
          ? sortBy(rows, (row) => row.tender.reference, query.dir)
          : query.sort === 'status'
            ? sortBy(rows, (row) => row.status, query.dir)
            : sortBy(rows, (row) => row.startsAt, query.sort === undefined ? 'desc' : query.dir);
    return fixtures.page(sorted);
  });

  function buyerSession(tenantId: number, sessionId: number, notFound: (detail?: string) => never): SessionFixture {
    const session = SESSIONS.find((row) => row.id === sessionId && row.tenantId === tenantId);
    if (session === undefined) {
      return notFound();
    }
    return session;
  }

  mockRoute(app, api.sessionsGet, ({ requireTenant, params, notFound }) => {
    return buyerSessionDetail(buyerSession(requireTenant().tenant.id, params.sessionId, notFound));
  });

  mockRoute(app, api.sessionsCreate, ({ requireTenant, requirePersona, body, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const input: CreateSessionBody = body;
    const tender = tenderById(input.tenderId);
    if (tender === undefined || tender.tenantId !== tenant.id) {
      return notFound('The tender does not exist in this organization.');
    }
    if (!isAmendable(tender)) {
      return fail(409, 'TENDER_NOT_AMENDABLE', `${tender.reference} is ${tender.status.replace(/_/g, ' ')}.`);
    }
    validateSessionFields(tender, input, now, fail, null);
    return buyerSessionDetail(sessionFromBody(null, tender, input, NEW_ID, requirePersona().userId, now));
  });

  mockRoute(app, api.sessionsUpdate, ({ requireTenant, requirePersona, params, body, notFound, fail, now }) => {
    const session = buyerSession(requireTenant().tenant.id, params.sessionId, notFound);
    if (session.status !== 'scheduled') {
      return fail(409, 'SESSION_NOT_EDITABLE', `The session is ${session.status}.`);
    }
    const tender = tenderOf(session.tenderId);
    validateSessionFields(tender, body, now, fail, session);
    if (body.capacity < activeRegistrations(session).length) {
      return fail(422, 'CAPACITY_BELOW_REGISTRATIONS', `${activeRegistrations(session).length} suppliers are already registered.`);
    }
    return buyerSessionDetail(sessionFromBody(session, tender, body, session.id, requirePersona().userId, now));
  });

  mockRoute(app, api.sessionsCancel, ({ requireTenant, requirePersona, params, body, notFound, fail, now }) => {
    const session = buyerSession(requireTenant().tenant.id, params.sessionId, notFound);
    if (session.status !== 'scheduled') {
      return fail(409, 'SESSION_NOT_EDITABLE', `The session is ${session.status}.`);
    }
    if (session.mandatory) {
      const alternatives = SESSIONS.filter(
        (candidate) =>
          candidate.id !== session.id &&
          candidate.status === 'scheduled' &&
          (candidate.alternativeOfId === session.id || candidate.id === session.alternativeOfId),
      );
      if (alternatives.length === 0) {
        return fail(
          409,
          'MANDATORY_SESSION_NEEDS_ALTERNATIVE',
          'Cancelling the only date of a mandatory session changes a participation condition: schedule an alternative or issue an addendum first.',
        );
      }
    }
    return sessionDetailWith(session, {
      status: 'cancelled',
      cancellationReason: body.reason,
      registrations: session.registrations.map((registration) =>
        registration.status === 'registered' ? { ...registration, status: 'cancelled' } : registration,
      ),
      history: [...session.history, { at: iso(now), action: 'cancelled', actorUserId: requirePersona().userId, note: body.reason }],
    });
  });

  mockRoute(app, api.sessionsRecordAttendance, ({ requireTenant, requirePersona, params, body, notFound, fail, now }) => {
    const session = buyerSession(requireTenant().tenant.id, params.sessionId, notFound);
    if (session.status === 'cancelled') {
      return fail(409, 'SESSION_CANCELLED', 'The session was cancelled.');
    }
    if (Date.parse(session.startsAt) > now.getTime()) {
      return fail(409, 'SESSION_NOT_STARTED', 'Attendance is recorded once the session has started.');
    }
    const updates = new Map(body.entries.map((entry) => [entry.registrationId, entry.status]));
    for (const registrationId of updates.keys()) {
      const registration = session.registrations.find((row) => row.id === registrationId);
      if (registration === undefined || registration.status === 'cancelled') {
        return fail(422, 'REGISTRATION_NOT_IN_SESSION', `Registration ${registrationId} is not an active registration of this session.`);
      }
    }
    const actorUserId = requirePersona().userId;
    return sessionDetailWith(session, {
      status: 'completed',
      registrations: session.registrations.map((registration) => {
        const status = updates.get(registration.id);
        return status === undefined
          ? registration
          : { ...registration, status, attendanceRecordedBy: actorUserId, attendanceRecordedAt: iso(now) };
      }),
      history: [...session.history, { at: iso(now), action: 'attendance_recorded', actorUserId, note: null }],
    });
  });

  mockRoute(app, api.sessionsPublishMinutes, ({ requireTenant, requirePersona, params, body, notFound, fail, now }) => {
    const session = buyerSession(requireTenant().tenant.id, params.sessionId, notFound);
    const tender = tenderOf(session.tenderId);
    if (session.status === 'cancelled' || Date.parse(session.startsAt) > now.getTime()) {
      return fail(409, 'SESSION_NOT_HELD', 'Minutes are published after the session has taken place.');
    }
    if (session.minutesPublishedAt !== null) {
      return fail(409, 'MINUTES_ALREADY_PUBLISHED', 'The minutes are already published; issue corrections as a new clarification.');
    }
    if (body.audience === 'public' && !tender.onPublicPortal) {
      return fail(422, 'PUBLIC_AUDIENCE_NOT_PERMITTED', 'The tender is not on the public portal; share with participants only.');
    }
    const minutesDocument =
      body.minutesDocumentId === null ? null : sessionMinutesDocuments(session.id).find((row) => row.documentId === body.minutesDocumentId);
    if (minutesDocument === undefined) {
      return fail(422, 'MINUTES_DOCUMENT_NOT_OF_SESSION', 'The minutes document must be a published document of this session.');
    }
    for (const answer of body.sharedAnswers) {
      if (!isParticipant(tender, answer.supplierTenantId)) {
        return fail(422, 'SUPPLIER_NOT_PARTICIPANT', 'Shared answers record questions of participating suppliers only.');
      }
    }
    const publishedAt = iso(now);
    const detail = sessionDetailWith(session, {
      minutesPublishedAt: publishedAt,
      history: [
        ...session.history,
        { at: publishedAt, action: 'minutes_published', actorUserId: requirePersona().userId, note: `${body.sharedAnswers.length} shared answers.` },
      ],
    });
    return {
      ...detail,
      minutesDocument,
      sharedAnswers: [
        ...detail.sharedAnswers,
        ...body.sharedAnswers.map((answer, index) => ({
          questionId: NEW_ID + index,
          sanitizedQuestion: answer.sanitizedQuestion,
          answerText: answer.answerText,
          audience: body.audience,
          publishedAt,
          lot: null,
          requirement: null,
          sessionId: session.id,
        })),
      ],
    };
  });

  mockRoute(app, api.sessionsResolveException, ({ requireTenant, requirePersona, params, body, notFound, fail, now }) => {
    const session = buyerSession(requireTenant().tenant.id, params.sessionId, notFound);
    const registration = session.registrations.find((row) => row.id === params.registrationId);
    if (registration === undefined) {
      return notFound();
    }
    if (!isAttendanceException(session, registration)) {
      return fail(409, 'NOT_AN_ATTENDANCE_EXCEPTION', 'Only an absence from a mandatory session is an attendance exception.');
    }
    if (registration.exceptionResolution !== null) {
      return fail(409, 'EXCEPTION_ALREADY_RESOLVED', 'The exception is already resolved.');
    }
    let alternativeSessionId: number | null = null;
    if (body.resolution === 'offer_alternative') {
      if (body.alternativeSessionId === null) {
        return fail(422, 'ALTERNATIVE_SESSION_REQUIRED', 'Choose the alternative session to offer.');
      }
      const alternative = sessionById(body.alternativeSessionId);
      if (alternative === undefined || alternative.tenderId !== session.tenderId || alternative.id === session.id) {
        return fail(422, 'ALTERNATIVE_NOT_IN_TENDER', 'The alternative must be another session of the same tender.');
      }
      if (alternative.status !== 'scheduled' || placesAvailable(alternative) === 0 || Date.parse(alternative.startsAt) <= now.getTime()) {
        return fail(409, 'ALTERNATIVE_SESSION_FULL', 'The alternative session has no place left or has already taken place.');
      }
      alternativeSessionId = alternative.id;
    }
    const actorUserId = requirePersona().userId;
    return sessionDetailWith(session, {
      registrations: session.registrations.map((row) =>
        row.id === registration.id
          ? {
              ...row,
              exceptionResolution: {
                resolution: body.resolution,
                note: body.note,
                resolvedAt: iso(now),
                resolvedBy: actorUserId,
                alternativeSessionId,
              },
            }
          : row,
      ),
      history: [
        ...session.history,
        { at: iso(now), action: 'attendance_exception_resolved', actorUserId, note: `${orgRef(registration.supplierTenantId).name}: ${body.note}` },
      ],
    });
  });
}
