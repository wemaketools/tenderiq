/**
 * Supplier handlers of the clarifications contract (SUP-10 questions and addenda, SUP-11 sessions). A supplier sees
 * only tenders it participates in, its OWN questions, published shared answers without identities, issued addenda
 * addressed to it and its OWN registrations. Another supplier's private case is simply not found (PRD §4.3).
 */
import { clarificationsEndpoints as api } from '../../../contracts/clarifications.js';
import type { SupplierSessionDetail } from '../../../contracts/clarifications.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { ADDENDA, QUESTIONS, SESSIONS } from '../../fixtures/clarifications/index.js';
import type { QuestionFixture, RegistrationFixture, SessionFixture } from '../../fixtures/clarifications/index.js';
import { personRef } from '../../persona.js';
import {
  currentRequirements,
  isParticipant,
  isSharedAnswer,
  lotRef,
  matchesText,
  ownRegistration,
  placesAvailable,
  registrationOpen,
  sharedAnswer,
  sortBy,
  supplierAddendumDetail,
  supplierAddendumRow,
  supplierQuestionDetail,
  supplierQuestionRow,
  supplierRecipient,
  supplierSessionDetail,
  supplierSessionRow,
  supplierTenderRow,
  supplierTenders,
  tenderById,
  tenderOf,
} from './projections.js';

const NEW_ID = 900;

function iso(at: Date): string {
  return at.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function withRegistration(
  session: SessionFixture,
  supplierTenantId: number,
  registration: RegistrationFixture,
  now: Date,
): SupplierSessionDetail {
  const others = session.registrations.filter((row) => row.id !== registration.id);
  const updated: SessionFixture = { ...session, registrations: [...others, registration] };
  return supplierSessionDetail(updated, supplierTenantId, now);
}

export function registerSupplier(app: MockApp): void {
  mockRoute(app, api.supplierTenders, ({ requireTenant, query, fixtures, now }) => {
    const { tenant } = requireTenant();
    const rows = supplierTenders(tenant.id)
      .filter((tender) => query.status === undefined || query.status.includes(tender.status))
      .filter((tender) => matchesText(query.q, tender.reference, tender.title))
      .map((tender) => supplierTenderRow(tender, tenant.id, now));
    const sorted =
      query.sort === 'questionsDeadline'
        ? sortBy(rows, (row) => row.questionsDeadline?.at ?? null, query.dir)
        : query.sort === 'submissionDeadline'
          ? sortBy(rows, (row) => row.submissionDeadline?.at ?? null, query.dir)
          : sortBy(rows, (row) => row.reference, query.sort === undefined ? 'desc' : query.dir);
    return fixtures.page(sorted);
  });

  function accessibleTender(supplierTenantId: number, tenderId: number, notFound: (detail?: string) => never) {
    const tender = tenderById(tenderId);
    if (tender === undefined || !isParticipant(tender, supplierTenantId)) {
      return notFound();
    }
    return tender;
  }

  mockRoute(app, api.supplierTenderContext, ({ requireTenant, params, notFound, now }) => {
    const { tenant } = requireTenant();
    const tender = accessibleTender(tenant.id, params.tenderId, notFound);
    return {
      ...supplierTenderRow(tender, tenant.id, now),
      lots: tender.lots.map((lot) => ({ lotId: lot.lotId, lotNo: lot.lotNo, title: lot.title })),
      requirements: currentRequirements(tender),
      documents: tender.documents.map((document) => ({ ...document })),
    };
  });

  mockRoute(app, api.supplierPublishedAnswers, ({ requireTenant, params, query, notFound, fixtures }) => {
    const { tenant } = requireTenant();
    const tender = accessibleTender(tenant.id, params.tenderId, notFound);
    const rows = QUESTIONS.filter((question) => question.tenderId === tender.id && isSharedAnswer(question))
      .filter((question) => query.lotId === undefined || question.lotId === query.lotId)
      .filter((question) => query.requirementId === undefined || question.requirementId === query.requirementId)
      .map(sharedAnswer)
      .filter((answer) => matchesText(query.q, answer.sanitizedQuestion, answer.answerText, answer.requirement?.refCode));
    return fixtures.page(sortBy(rows, (row) => row.publishedAt, query.sort === undefined ? 'desc' : query.dir));
  });

  mockRoute(app, api.supplierQuestionsList, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = QUESTIONS.filter((question) => question.supplierTenantId === tenant.id)
      .filter((question) => isParticipant(tenderOf(question.tenderId), tenant.id))
      .filter((question) => query.tenderId === undefined || question.tenderId === query.tenderId)
      .filter((question) => query.status === undefined || query.status.includes(question.status))
      .map(supplierQuestionRow)
      .filter((row) => query.answered === undefined || (row.answerText !== null) === query.answered)
      .filter((row) => matchesText(query.q, row.questionText, row.tender.reference, row.tender.title, row.answerText));
    const sorted =
      query.sort === 'status'
        ? sortBy(rows, (row) => row.status, query.dir)
        : query.sort === 'tenderReference'
          ? sortBy(rows, (row) => row.tender.reference, query.dir)
          : sortBy(rows, (row) => row.submittedAt, query.sort === undefined ? 'desc' : query.dir);
    return fixtures.page(sorted);
  });

  function ownQuestion(supplierTenantId: number, questionId: number, notFound: (detail?: string) => never): QuestionFixture {
    const question = QUESTIONS.find((row) => row.id === questionId && row.supplierTenantId === supplierTenantId);
    if (question === undefined) {
      return notFound();
    }
    return question;
  }

  mockRoute(app, api.supplierQuestionsGet, ({ requireTenant, params, notFound }) => {
    return supplierQuestionDetail(ownQuestion(requireTenant().tenant.id, params.questionId, notFound));
  });

  mockRoute(app, api.supplierQuestionsAsk, ({ requireTenant, requirePersona, body, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const tender = accessibleTender(tenant.id, body.tenderId, notFound);
    if (tender.status !== 'open') {
      return fail(409, 'TENDER_NOT_ACCEPTING_QUESTIONS', `${tender.reference} is ${tender.status.replace(/_/g, ' ')}; questions are closed.`);
    }
    if (body.lotId !== null && lotRef(tender, body.lotId) === null) {
      return fail(422, 'LOT_NOT_IN_TENDER', `The lot is not part of ${tender.reference}.`);
    }
    if (body.requirementId !== null && !currentRequirements(tender).some((row) => row.requirementId === body.requirementId)) {
      return fail(422, 'REQUIREMENT_NOT_IN_TENDER', `The requirement is not part of ${tender.reference}.`);
    }
    if (body.documentId !== null && !tender.documents.some((row) => row.documentId === body.documentId)) {
      return fail(422, 'DOCUMENT_NOT_IN_TENDER', `The document is not part of ${tender.reference}.`);
    }
    const submittedAt = iso(now);
    const afterDeadline = tender.questionsDeadline !== null && now.getTime() > Date.parse(tender.questionsDeadline);
    const created: QuestionFixture = {
      id: NEW_ID,
      tenantId: tender.tenantId,
      tenderId: tender.id,
      supplierTenantId: tenant.id,
      lotId: body.lotId,
      requirementId: body.requirementId,
      documentId: body.documentId,
      askedByUserId: requirePersona().userId,
      questionText: body.questionText,
      submittedAt,
      afterDeadline,
      lateDisposition: null,
      lateDispositionReason: null,
      ownerUserId: null,
      status: 'received',
      audience: 'all_participants',
      sanitizedQuestion: null,
      answerText: null,
      confidentialityReviewedBy: null,
      publishedAt: null,
      addendumId: null,
      sessionId: null,
      responseDueAt: null,
      history: [],
    };
    return supplierQuestionDetail(created);
  });

  mockRoute(app, api.supplierQuestionsWithdraw, ({ requireTenant, params, notFound, fail }) => {
    const question = ownQuestion(requireTenant().tenant.id, params.questionId, notFound);
    if (question.status === 'published' || question.status === 'answered_privately' || question.status === 'escalated_to_addendum') {
      return fail(409, 'QUESTION_ALREADY_ANSWERED', 'An answered question stays on record and cannot be withdrawn.');
    }
    if (question.status === 'declined' || question.status === 'withdrawn') {
      return fail(409, 'QUESTION_CLOSED', `The question is already ${question.status}.`);
    }
    return supplierQuestionDetail({ ...question, status: 'withdrawn' });
  });

  // Addenda -----------------------------------------------------------------------------------------------
  mockRoute(app, api.supplierAddendaList, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = ADDENDA.flatMap((addendum) => {
      const recipient = supplierRecipient(addendum, tenant.id);
      return recipient === undefined ? [] : [supplierAddendumRow(addendum, recipient)];
    })
      .filter((row) => query.tenderId === undefined || row.tender.tenderId === query.tenderId)
      .filter((row) => query.acknowledged === undefined || (row.acknowledgedAt !== null) === query.acknowledged)
      .filter((row) => query.actionOutstanding === undefined || row.actionOutstanding === query.actionOutstanding)
      .filter((row) => matchesText(query.q, row.title, row.tender.reference, row.tender.title));
    const sorted =
      query.sort === 'number'
        ? sortBy(rows, (row) => row.number, query.dir)
        : query.sort === 'tenderReference'
          ? sortBy(rows, (row) => `${row.tender.reference}#${String(row.number).padStart(3, '0')}`, query.dir)
          : sortBy(rows, (row) => row.issuedAt, query.sort === undefined ? 'desc' : query.dir);
    return fixtures.page(sorted);
  });

  function ownAddendum(supplierTenantId: number, addendumId: number, notFound: (detail?: string) => never) {
    const addendum = ADDENDA.find((row) => row.id === addendumId);
    const recipient = addendum === undefined ? undefined : supplierRecipient(addendum, supplierTenantId);
    if (addendum === undefined || recipient === undefined) {
      return notFound();
    }
    return { addendum, recipient };
  }

  mockRoute(app, api.supplierAddendaGet, ({ requireTenant, params, notFound }) => {
    const { addendum, recipient } = ownAddendum(requireTenant().tenant.id, params.addendumId, notFound);
    return supplierAddendumDetail(addendum, recipient);
  });

  mockRoute(app, api.supplierAddendaAcknowledge, ({ requireTenant, requirePersona, params, notFound, fail, now }) => {
    const { addendum, recipient } = ownAddendum(requireTenant().tenant.id, params.addendumId, notFound);
    if (!addendum.acknowledgmentRequired) {
      return fail(409, 'ACKNOWLEDGMENT_NOT_REQUIRED', 'This addendum does not require an acknowledgment.');
    }
    if (recipient.acknowledgedAt !== null) {
      return fail(409, 'ALREADY_ACKNOWLEDGED', 'Your organization has already acknowledged this addendum.');
    }
    const persona = requirePersona();
    const row = supplierAddendumRow(addendum, recipient);
    return {
      addendumId: addendum.id,
      acknowledgedAt: iso(now),
      acknowledgedBy: personRef(persona.userId),
      requiredAction: recipient.requiredAction,
      // Acknowledging completes an acknowledge-only action; a supplement or replacement is still due (AC-10).
      requiredActionCompleted: recipient.requiredAction === 'acknowledge' || recipient.requiredAction === 'none' || recipient.requiredActionCompleted,
      priorSubmission: row.priorSubmission,
    };
  });

  // Sessions ----------------------------------------------------------------------------------------------
  mockRoute(app, api.supplierSessionsList, ({ requireTenant, query, fixtures, now }) => {
    const { tenant } = requireTenant();
    const rows = SESSIONS.filter((session) => isParticipant(tenderOf(session.tenderId), tenant.id))
      .filter((session) => query.tenderId === undefined || session.tenderId === query.tenderId)
      .filter((session) => query.sessionType === undefined || session.sessionType === query.sessionType)
      .filter((session) => query.status === undefined || query.status.includes(session.status))
      .map((session) => supplierSessionRow(session, tenant.id, now))
      .filter((row) => query.registered === undefined || (row.ownRegistration !== null && row.ownRegistration.status !== 'cancelled') === query.registered)
      .filter((row) => matchesText(query.q, row.title, row.venue, row.tender.reference, row.tender.title));
    const sorted =
      query.sort === 'tenderReference'
        ? sortBy(rows, (row) => row.tender.reference, query.dir)
        : sortBy(rows, (row) => row.startsAt, query.sort === undefined ? 'desc' : query.dir);
    return fixtures.page(sorted);
  });

  function accessibleSession(supplierTenantId: number, sessionId: number, notFound: (detail?: string) => never): SessionFixture {
    const session = SESSIONS.find((row) => row.id === sessionId);
    if (session === undefined || !isParticipant(tenderOf(session.tenderId), supplierTenantId)) {
      return notFound();
    }
    return session;
  }

  mockRoute(app, api.supplierSessionsGet, ({ requireTenant, params, notFound, now }) => {
    const { tenant } = requireTenant();
    return supplierSessionDetail(accessibleSession(tenant.id, params.sessionId, notFound), tenant.id, now);
  });

  mockRoute(app, api.supplierSessionsRegister, ({ requireTenant, requirePersona, params, body, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const session = accessibleSession(tenant.id, params.sessionId, notFound);
    if (session.status === 'cancelled') {
      return fail(409, 'SESSION_CANCELLED', 'The session was cancelled.');
    }
    const existing = ownRegistration(session, tenant.id);
    if (existing !== undefined && existing.status !== 'cancelled') {
      return fail(409, 'ALREADY_REGISTERED', 'Your organization is already registered; change the booking instead.');
    }
    if (placesAvailable(session) === 0 && session.status === 'scheduled') {
      return fail(409, 'SESSION_FULL', 'No place is left. Choose the alternative session if one is offered.');
    }
    if (!registrationOpen(session, now)) {
      return fail(409, 'REGISTRATION_CLOSED', 'Registration for this session has closed.');
    }
    const registration: RegistrationFixture = {
      id: NEW_ID,
      supplierTenantId: tenant.id,
      registeredBy: requirePersona().userId,
      attendeeNames: body.attendeeNames,
      accessibilityNeeds: body.accessibilityNeeds === '' ? null : body.accessibilityNeeds,
      status: 'registered',
      attendanceRecordedBy: null,
      attendanceRecordedAt: null,
      createdAt: iso(now),
      exceptionResolution: null,
    };
    return withRegistration(session, tenant.id, registration, now);
  });

  function ownRegistrationById(supplierTenantId: number, registrationId: number, notFound: (detail?: string) => never) {
    for (const session of SESSIONS) {
      const registration = session.registrations.find((row) => row.id === registrationId && row.supplierTenantId === supplierTenantId);
      if (registration !== undefined) {
        return { session, registration };
      }
    }
    return notFound();
  }

  mockRoute(app, api.supplierRegistrationUpdate, ({ requireTenant, params, body, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const { session, registration } = ownRegistrationById(tenant.id, params.registrationId, notFound);
    if (registration.status !== 'registered') {
      return fail(409, 'REGISTRATION_NOT_ACTIVE', `The booking is ${registration.status}.`);
    }
    if (session.status !== 'scheduled' || Date.parse(session.startsAt) <= now.getTime()) {
      return fail(409, 'REGISTRATION_CLOSED', 'The session has started; the booking can no longer change.');
    }
    return withRegistration(
      session,
      tenant.id,
      { ...registration, attendeeNames: body.attendeeNames, accessibilityNeeds: body.accessibilityNeeds === '' ? null : body.accessibilityNeeds },
      now,
    );
  });

  mockRoute(app, api.supplierRegistrationCancel, ({ requireTenant, params, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const { session, registration } = ownRegistrationById(tenant.id, params.registrationId, notFound);
    if (registration.status !== 'registered') {
      return fail(409, 'REGISTRATION_NOT_ACTIVE', `The booking is ${registration.status}.`);
    }
    if (Date.parse(session.startsAt) <= now.getTime()) {
      return fail(409, 'SESSION_ALREADY_HELD', 'The session has already taken place.');
    }
    return withRegistration(session, tenant.id, { ...registration, status: 'cancelled' }, now);
  });
}

