/**
 * Qualification client (the `qualification` contract, domain 04): thin typed wrappers over `call()` for code outside
 * the query hooks (hooks take the contract endpoint objects directly:
 * `useApiQuery(qualificationEndpoints.listApplications, …)`).
 *
 * ADM-09 programs, BUY-33 review queue, BUY-34 assessment (the financial review panel is restricted to financial
 * reviewers and deciders, AC-08), BUY-35 decisions and monitoring, SUP-20 applications and SUP-24 decisions.
 */
import { qualificationEndpoints as api } from '@contracts/qualification';
import type { EndpointBody, EndpointQuery, EndpointResponse } from '@contracts/endpoint';

import { call } from './client';
import type { CallOptions } from './client';

type Api = typeof api;
type Query<K extends keyof Api> = EndpointQuery<Api[K]>;
type Body<K extends keyof Api> = EndpointBody<Api[K]>;
type Result<K extends keyof Api> = Promise<EndpointResponse<Api[K]>>;

// BUY-33 / BUY-35: summary and form options ------------------------------------------------------------------

export function fetchQualificationSummary(): Result<'getQualificationSummary'> {
  return call(api.getQualificationSummary, {});
}

export function fetchQualificationOptions(): Result<'getQualificationOptions'> {
  return call(api.getQualificationOptions, {});
}

// ADM-09: programs -----------------------------------------------------------------------------------------

export function listPrograms(query: Query<'listPrograms'> = {}): Result<'listPrograms'> {
  return call(api.listPrograms, { query });
}

export function fetchProgram(programId: number, versionId?: number): Result<'getProgram'> {
  return call(api.getProgram, {
    params: { programId },
    query: versionId === undefined ? {} : { versionId },
  });
}

export function createProgram(
  body: Body<'createProgram'>,
  options?: CallOptions,
): Result<'createProgram'> {
  return call(api.createProgram, { body }, options);
}

export function updateProgram(
  programId: number,
  body: Body<'updateProgram'>,
): Result<'updateProgram'> {
  return call(api.updateProgram, { params: { programId }, body });
}

export function createProgramVersion(
  programId: number,
  body: Body<'createProgramVersion'>,
  options?: CallOptions,
): Result<'createProgramVersion'> {
  return call(api.createProgramVersion, { params: { programId }, body }, options);
}

export function saveProgramCriteria(
  programId: number,
  versionId: number,
  body: Body<'saveProgramCriteria'>,
): Result<'saveProgramCriteria'> {
  return call(api.saveProgramCriteria, { params: { programId, versionId }, body });
}

export function approveProgramVersion(
  programId: number,
  versionId: number,
  body: Body<'approveProgramVersion'>,
): Result<'approveProgramVersion'> {
  return call(api.approveProgramVersion, { params: { programId, versionId }, body });
}

export function retireProgram(
  programId: number,
  body: Body<'retireProgram'>,
): Result<'retireProgram'> {
  return call(api.retireProgram, { params: { programId }, body });
}

// BUY-33 / BUY-34: queue and assessment --------------------------------------------------------------------

export function listApplications(
  query: Query<'listApplications'> = {},
): Result<'listApplications'> {
  return call(api.listApplications, { query });
}

export function fetchApplication(applicationId: number): Result<'getApplication'> {
  return call(api.getApplication, { params: { applicationId } });
}

export function assignApplication(
  applicationId: number,
  body: Body<'assignApplication'>,
): Result<'assignApplication'> {
  return call(api.assignApplication, { params: { applicationId }, body });
}

export function fetchFinancialReview(applicationId: number): Result<'getFinancialReview'> {
  return call(api.getFinancialReview, { params: { applicationId } });
}

export function recordFinancialReview(
  applicationId: number,
  body: Body<'recordFinancialReview'>,
  options?: CallOptions,
): Result<'recordFinancialReview'> {
  return call(api.recordFinancialReview, { params: { applicationId }, body }, options);
}

export function recordFinding(
  applicationId: number,
  criterionId: number,
  body: Body<'recordFinding'>,
): Result<'recordFinding'> {
  return call(api.recordFinding, { params: { applicationId, criterionId }, body });
}

export function requestInformation(
  applicationId: number,
  body: Body<'requestInformation'>,
  options?: CallOptions,
): Result<'requestInformation'> {
  return call(api.requestInformation, { params: { applicationId }, body }, options);
}

export function closeInfoRequest(
  applicationId: number,
  infoRequestId: number,
  body: Body<'closeInfoRequest'>,
): Result<'closeInfoRequest'> {
  return call(api.closeInfoRequest, { params: { applicationId, infoRequestId }, body });
}

export function recommendOutcome(
  applicationId: number,
  body: Body<'recommendOutcome'>,
): Result<'recommendOutcome'> {
  return call(api.recommendOutcome, { params: { applicationId }, body });
}

export function listScreenings(query: Query<'listScreenings'> = {}): Result<'listScreenings'> {
  return call(api.listScreenings, { query });
}

export function reviewScreening(
  screeningId: number,
  body: Body<'reviewScreening'>,
): Result<'reviewScreening'> {
  return call(api.reviewScreening, { params: { screeningId }, body });
}

// BUY-35: decisions and monitoring -------------------------------------------------------------------------

export function decideApplication(
  applicationId: number,
  body: Body<'decideApplication'>,
  options?: CallOptions,
): Result<'decideApplication'> {
  return call(api.decideApplication, { params: { applicationId }, body }, options);
}

export function listStatuses(query: Query<'listStatuses'> = {}): Result<'listStatuses'> {
  return call(api.listStatuses, { query });
}

export function checkEligibility(query: Query<'checkEligibility'>): Result<'checkEligibility'> {
  return call(api.checkEligibility, { query });
}

export function listDecisions(query: Query<'listDecisions'> = {}): Result<'listDecisions'> {
  return call(api.listDecisions, { query });
}

export function fetchDecision(decisionId: number): Result<'getDecision'> {
  return call(api.getDecision, { params: { decisionId } });
}

export function supersedeDecision(
  decisionId: number,
  body: Body<'supersedeDecision'>,
  options?: CallOptions,
): Result<'supersedeDecision'> {
  return call(api.supersedeDecision, { params: { decisionId }, body }, options);
}

export function requestRenewal(
  decisionId: number,
  body: Body<'requestRenewal'>,
): Result<'requestRenewal'> {
  return call(api.requestRenewal, { params: { decisionId }, body });
}

export function listTriggers(query: Query<'listTriggers'> = {}): Result<'listTriggers'> {
  return call(api.listTriggers, { query });
}

export function fetchTrigger(triggerId: number): Result<'getTrigger'> {
  return call(api.getTrigger, { params: { triggerId } });
}

export function createTrigger(
  body: Body<'createTrigger'>,
  options?: CallOptions,
): Result<'createTrigger'> {
  return call(api.createTrigger, { body }, options);
}

export function assessTrigger(
  triggerId: number,
  body: Body<'assessTrigger'>,
): Result<'assessTrigger'> {
  return call(api.assessTrigger, { params: { triggerId }, body });
}

// SUP-20: supplier programs and applications ---------------------------------------------------------------

export function fetchSupplierOverview(): Result<'getSupplierOverview'> {
  return call(api.getSupplierOverview, {});
}

export function listSupplierPrograms(
  query: Query<'listSupplierPrograms'> = {},
): Result<'listSupplierPrograms'> {
  return call(api.listSupplierPrograms, { query });
}

export function fetchSupplierProgram(programId: number): Result<'getSupplierProgram'> {
  return call(api.getSupplierProgram, { params: { programId } });
}

export function listSupplierApplications(
  query: Query<'listSupplierApplications'> = {},
): Result<'listSupplierApplications'> {
  return call(api.listSupplierApplications, { query });
}

export function fetchSupplierApplication(applicationId: number): Result<'getSupplierApplication'> {
  return call(api.getSupplierApplication, { params: { applicationId } });
}

export function createSupplierApplication(
  body: Body<'createSupplierApplication'>,
  options?: CallOptions,
): Result<'createSupplierApplication'> {
  return call(api.createSupplierApplication, { body }, options);
}

export function saveSupplierAnswers(
  applicationId: number,
  body: Body<'saveSupplierAnswers'>,
): Result<'saveSupplierAnswers'> {
  return call(api.saveSupplierAnswers, { params: { applicationId }, body });
}

export function fetchEvidenceCandidates(applicationId: number): Result<'listEvidenceCandidates'> {
  return call(api.listEvidenceCandidates, { params: { applicationId } });
}

export function submitSupplierApplication(
  applicationId: number,
  body: Body<'submitSupplierApplication'>,
): Result<'submitSupplierApplication'> {
  return call(api.submitSupplierApplication, { params: { applicationId }, body });
}

export function withdrawSupplierApplication(
  applicationId: number,
  body: Body<'withdrawSupplierApplication'>,
): Result<'withdrawSupplierApplication'> {
  return call(api.withdrawSupplierApplication, { params: { applicationId }, body });
}

export function respondToInfoRequest(
  applicationId: number,
  infoRequestId: number,
  body: Body<'respondToInfoRequest'>,
): Result<'respondToInfoRequest'> {
  return call(api.respondToInfoRequest, { params: { applicationId, infoRequestId }, body });
}

// SUP-24: supplier decisions and renewals ------------------------------------------------------------------

export function listSupplierDecisions(
  query: Query<'listSupplierDecisions'> = {},
): Result<'listSupplierDecisions'> {
  return call(api.listSupplierDecisions, { query });
}

export function fetchSupplierDecision(decisionId: number): Result<'getSupplierDecision'> {
  return call(api.getSupplierDecision, { params: { decisionId } });
}

export function requestReconsideration(
  decisionId: number,
  body: Body<'requestReconsideration'>,
  options?: CallOptions,
): Result<'requestReconsideration'> {
  return call(api.requestReconsideration, { params: { decisionId }, body }, options);
}

export function supplyDecisionEvidence(
  decisionId: number,
  body: Body<'supplyDecisionEvidence'>,
  options?: CallOptions,
): Result<'supplyDecisionEvidence'> {
  return call(api.supplyDecisionEvidence, { params: { decisionId }, body }, options);
}
