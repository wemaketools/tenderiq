/**
 * Clarifications client (the `clarifications` contract; FR-10): tender questions and answers (BUY-16, SUP-10),
 * addenda and date changes (BUY-17), briefings and site visits (BUY-18, SUP-11) and the public clarification edition
 * (PUB-04). Pages use the hooks with the contract endpoints directly; these typed wrappers serve code outside hooks.
 */
import { clarificationsEndpoints } from '@contracts/clarifications';
import type { EndpointRequest, EndpointResponse } from '@contracts/endpoint';

import { call } from './client';
import type { CallOptions } from './client';

type Endpoints = typeof clarificationsEndpoints;
/** The request (`params`, `query`, `body`) of a clarifications endpoint. */
export type ClarificationsRequest<K extends keyof Endpoints> = EndpointRequest<Endpoints[K]>;
/** The response of a clarifications endpoint. */
export type ClarificationsResponse<K extends keyof Endpoints> = EndpointResponse<Endpoints[K]>;

function send<K extends keyof Endpoints>(
  key: K,
  request: ClarificationsRequest<K>,
  options?: CallOptions,
): Promise<ClarificationsResponse<K>> {
  return call(clarificationsEndpoints[key], request, options);
}

/** GET /api/v1/buyer/clarifications/tenders (`buyer.clarifications.tenders`). */
export function buyerTenders(
  request: ClarificationsRequest<'buyerTenders'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'buyerTenders'>> {
  return send('buyerTenders', request, options);
}

/** GET /api/v1/buyer/clarifications/tenders/:tenderId (`buyer.clarifications.tenderContext`). */
export function buyerTenderContext(
  request: ClarificationsRequest<'buyerTenderContext'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'buyerTenderContext'>> {
  return send('buyerTenderContext', request, options);
}

/** GET /api/v1/buyer/clarifications/owner-candidates (`buyer.clarifications.ownerCandidates`). */
export function ownerCandidates(
  request: ClarificationsRequest<'ownerCandidates'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'ownerCandidates'>> {
  return send('ownerCandidates', request, options);
}

/** GET /api/v1/buyer/clarifications/questions (`buyer.clarifications.questionsList`). */
export function questionsList(
  request: ClarificationsRequest<'questionsList'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'questionsList'>> {
  return send('questionsList', request, options);
}

/** GET /api/v1/buyer/clarifications/questions/:questionId (`buyer.clarifications.questionsGet`). */
export function questionsGet(
  request: ClarificationsRequest<'questionsGet'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'questionsGet'>> {
  return send('questionsGet', request, options);
}

/** POST /api/v1/buyer/clarifications/questions/:questionId/assign (`buyer.clarifications.questionsAssign`). */
export function questionsAssign(
  request: ClarificationsRequest<'questionsAssign'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'questionsAssign'>> {
  return send('questionsAssign', request, options);
}

/** POST /api/v1/buyer/clarifications/questions/:questionId/late-disposition (`buyer.clarifications.questionsLateDisposition`). */
export function questionsLateDisposition(
  request: ClarificationsRequest<'questionsLateDisposition'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'questionsLateDisposition'>> {
  return send('questionsLateDisposition', request, options);
}

/** PUT /api/v1/buyer/clarifications/questions/:questionId/answer (`buyer.clarifications.questionsSaveAnswer`). */
export function questionsSaveAnswer(
  request: ClarificationsRequest<'questionsSaveAnswer'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'questionsSaveAnswer'>> {
  return send('questionsSaveAnswer', request, options);
}

/** POST /api/v1/buyer/clarifications/questions/:questionId/review-request (`buyer.clarifications.questionsRequestReview`). */
export function questionsRequestReview(
  request: ClarificationsRequest<'questionsRequestReview'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'questionsRequestReview'>> {
  return send('questionsRequestReview', request, options);
}

/** POST /api/v1/buyer/clarifications/questions/:questionId/confidentiality-review (`buyer.clarifications.questionsReview`). */
export function questionsReview(
  request: ClarificationsRequest<'questionsReview'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'questionsReview'>> {
  return send('questionsReview', request, options);
}

/** POST /api/v1/buyer/clarifications/questions/:questionId/publish (`buyer.clarifications.questionsPublish`). */
export function questionsPublish(
  request: ClarificationsRequest<'questionsPublish'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'questionsPublish'>> {
  return send('questionsPublish', request, options);
}

/** POST /api/v1/buyer/clarifications/questions/:questionId/private-answer (`buyer.clarifications.questionsAnswerPrivately`). */
export function questionsAnswerPrivately(
  request: ClarificationsRequest<'questionsAnswerPrivately'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'questionsAnswerPrivately'>> {
  return send('questionsAnswerPrivately', request, options);
}

/** POST /api/v1/buyer/clarifications/questions/:questionId/escalate (`buyer.clarifications.questionsEscalate`). */
export function questionsEscalate(
  request: ClarificationsRequest<'questionsEscalate'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'questionsEscalate'>> {
  return send('questionsEscalate', request, options);
}

/** POST /api/v1/buyer/clarifications/questions/:questionId/decline (`buyer.clarifications.questionsDecline`). */
export function questionsDecline(
  request: ClarificationsRequest<'questionsDecline'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'questionsDecline'>> {
  return send('questionsDecline', request, options);
}

/** GET /api/v1/buyer/clarifications/addenda (`buyer.clarifications.addendaList`). */
export function addendaList(
  request: ClarificationsRequest<'addendaList'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'addendaList'>> {
  return send('addendaList', request, options);
}

/** GET /api/v1/buyer/clarifications/addenda/:addendumId (`buyer.clarifications.addendaGet`). */
export function addendaGet(
  request: ClarificationsRequest<'addendaGet'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'addendaGet'>> {
  return send('addendaGet', request, options);
}

/** POST /api/v1/buyer/clarifications/addenda (`buyer.clarifications.addendaCreate`). */
export function addendaCreate(
  request: ClarificationsRequest<'addendaCreate'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'addendaCreate'>> {
  return send('addendaCreate', request, options);
}

/** PUT /api/v1/buyer/clarifications/addenda/:addendumId (`buyer.clarifications.addendaUpdate`). */
export function addendaUpdate(
  request: ClarificationsRequest<'addendaUpdate'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'addendaUpdate'>> {
  return send('addendaUpdate', request, options);
}

/** POST /api/v1/buyer/clarifications/addenda/:addendumId/submit (`buyer.clarifications.addendaSubmit`). */
export function addendaSubmit(
  request: ClarificationsRequest<'addendaSubmit'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'addendaSubmit'>> {
  return send('addendaSubmit', request, options);
}

/** POST /api/v1/buyer/clarifications/addenda/:addendumId/issue (`buyer.clarifications.addendaIssue`). */
export function addendaIssue(
  request: ClarificationsRequest<'addendaIssue'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'addendaIssue'>> {
  return send('addendaIssue', request, options);
}

/** POST /api/v1/buyer/clarifications/addenda/:addendumId/withdraw (`buyer.clarifications.addendaWithdraw`). */
export function addendaWithdraw(
  request: ClarificationsRequest<'addendaWithdraw'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'addendaWithdraw'>> {
  return send('addendaWithdraw', request, options);
}

/** POST /api/v1/buyer/clarifications/addenda/:addendumId/reminders (`buyer.clarifications.addendaRemind`). */
export function addendaRemind(
  request: ClarificationsRequest<'addendaRemind'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'addendaRemind'>> {
  return send('addendaRemind', request, options);
}

/** GET /api/v1/buyer/clarifications/sessions (`buyer.clarifications.sessionsList`). */
export function sessionsList(
  request: ClarificationsRequest<'sessionsList'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'sessionsList'>> {
  return send('sessionsList', request, options);
}

/** GET /api/v1/buyer/clarifications/sessions/:sessionId (`buyer.clarifications.sessionsGet`). */
export function sessionsGet(
  request: ClarificationsRequest<'sessionsGet'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'sessionsGet'>> {
  return send('sessionsGet', request, options);
}

/** POST /api/v1/buyer/clarifications/sessions (`buyer.clarifications.sessionsCreate`). */
export function sessionsCreate(
  request: ClarificationsRequest<'sessionsCreate'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'sessionsCreate'>> {
  return send('sessionsCreate', request, options);
}

/** PUT /api/v1/buyer/clarifications/sessions/:sessionId (`buyer.clarifications.sessionsUpdate`). */
export function sessionsUpdate(
  request: ClarificationsRequest<'sessionsUpdate'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'sessionsUpdate'>> {
  return send('sessionsUpdate', request, options);
}

/** POST /api/v1/buyer/clarifications/sessions/:sessionId/cancel (`buyer.clarifications.sessionsCancel`). */
export function sessionsCancel(
  request: ClarificationsRequest<'sessionsCancel'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'sessionsCancel'>> {
  return send('sessionsCancel', request, options);
}

/** POST /api/v1/buyer/clarifications/sessions/:sessionId/attendance (`buyer.clarifications.sessionsRecordAttendance`). */
export function sessionsRecordAttendance(
  request: ClarificationsRequest<'sessionsRecordAttendance'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'sessionsRecordAttendance'>> {
  return send('sessionsRecordAttendance', request, options);
}

/** POST /api/v1/buyer/clarifications/sessions/:sessionId/minutes (`buyer.clarifications.sessionsPublishMinutes`). */
export function sessionsPublishMinutes(
  request: ClarificationsRequest<'sessionsPublishMinutes'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'sessionsPublishMinutes'>> {
  return send('sessionsPublishMinutes', request, options);
}

/** POST /api/v1/buyer/clarifications/sessions/:sessionId/registrations/:registrationId/exception (`buyer.clarifications.sessionsResolveException`). */
export function sessionsResolveException(
  request: ClarificationsRequest<'sessionsResolveException'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'sessionsResolveException'>> {
  return send('sessionsResolveException', request, options);
}

/** GET /api/v1/supplier/clarifications/tenders (`supplier.clarifications.tenders`). */
export function supplierTenders(
  request: ClarificationsRequest<'supplierTenders'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'supplierTenders'>> {
  return send('supplierTenders', request, options);
}

/** GET /api/v1/supplier/clarifications/tenders/:tenderId (`supplier.clarifications.tenderContext`). */
export function supplierTenderContext(
  request: ClarificationsRequest<'supplierTenderContext'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'supplierTenderContext'>> {
  return send('supplierTenderContext', request, options);
}

/** GET /api/v1/supplier/clarifications/tenders/:tenderId/answers (`supplier.clarifications.publishedAnswers`). */
export function supplierPublishedAnswers(
  request: ClarificationsRequest<'supplierPublishedAnswers'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'supplierPublishedAnswers'>> {
  return send('supplierPublishedAnswers', request, options);
}

/** GET /api/v1/supplier/clarifications/questions (`supplier.clarifications.questionsList`). */
export function supplierQuestionsList(
  request: ClarificationsRequest<'supplierQuestionsList'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'supplierQuestionsList'>> {
  return send('supplierQuestionsList', request, options);
}

/** GET /api/v1/supplier/clarifications/questions/:questionId (`supplier.clarifications.questionsGet`). */
export function supplierQuestionsGet(
  request: ClarificationsRequest<'supplierQuestionsGet'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'supplierQuestionsGet'>> {
  return send('supplierQuestionsGet', request, options);
}

/** POST /api/v1/supplier/clarifications/questions (`supplier.clarifications.questionsAsk`). */
export function supplierQuestionsAsk(
  request: ClarificationsRequest<'supplierQuestionsAsk'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'supplierQuestionsAsk'>> {
  return send('supplierQuestionsAsk', request, options);
}

/** POST /api/v1/supplier/clarifications/questions/:questionId/withdraw (`supplier.clarifications.questionsWithdraw`). */
export function supplierQuestionsWithdraw(
  request: ClarificationsRequest<'supplierQuestionsWithdraw'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'supplierQuestionsWithdraw'>> {
  return send('supplierQuestionsWithdraw', request, options);
}

/** GET /api/v1/supplier/clarifications/addenda (`supplier.clarifications.addendaList`). */
export function supplierAddendaList(
  request: ClarificationsRequest<'supplierAddendaList'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'supplierAddendaList'>> {
  return send('supplierAddendaList', request, options);
}

/** GET /api/v1/supplier/clarifications/addenda/:addendumId (`supplier.clarifications.addendaGet`). */
export function supplierAddendaGet(
  request: ClarificationsRequest<'supplierAddendaGet'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'supplierAddendaGet'>> {
  return send('supplierAddendaGet', request, options);
}

/** POST /api/v1/supplier/clarifications/addenda/:addendumId/acknowledge (`supplier.clarifications.addendaAcknowledge`). */
export function supplierAddendaAcknowledge(
  request: ClarificationsRequest<'supplierAddendaAcknowledge'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'supplierAddendaAcknowledge'>> {
  return send('supplierAddendaAcknowledge', request, options);
}

/** GET /api/v1/supplier/clarifications/sessions (`supplier.clarifications.sessionsList`). */
export function supplierSessionsList(
  request: ClarificationsRequest<'supplierSessionsList'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'supplierSessionsList'>> {
  return send('supplierSessionsList', request, options);
}

/** GET /api/v1/supplier/clarifications/sessions/:sessionId (`supplier.clarifications.sessionsGet`). */
export function supplierSessionsGet(
  request: ClarificationsRequest<'supplierSessionsGet'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'supplierSessionsGet'>> {
  return send('supplierSessionsGet', request, options);
}

/** POST /api/v1/supplier/clarifications/sessions/:sessionId/registrations (`supplier.clarifications.sessionsRegister`). */
export function supplierSessionsRegister(
  request: ClarificationsRequest<'supplierSessionsRegister'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'supplierSessionsRegister'>> {
  return send('supplierSessionsRegister', request, options);
}

/** PUT /api/v1/supplier/clarifications/registrations/:registrationId (`supplier.clarifications.registrationUpdate`). */
export function supplierRegistrationUpdate(
  request: ClarificationsRequest<'supplierRegistrationUpdate'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'supplierRegistrationUpdate'>> {
  return send('supplierRegistrationUpdate', request, options);
}

/** POST /api/v1/supplier/clarifications/registrations/:registrationId/cancel (`supplier.clarifications.registrationCancel`). */
export function supplierRegistrationCancel(
  request: ClarificationsRequest<'supplierRegistrationCancel'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'supplierRegistrationCancel'>> {
  return send('supplierRegistrationCancel', request, options);
}

/** GET /api/v1/public/clarifications/:buyerSlug/:reference (`public.clarifications.edition`). */
export function publicEdition(
  request: ClarificationsRequest<'publicEdition'>,
  options?: CallOptions,
): Promise<ClarificationsResponse<'publicEdition'>> {
  return send('publicEdition', request, options);
}
