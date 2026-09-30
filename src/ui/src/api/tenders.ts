/**
 * Tenders domain client (the `tenders` contract, domain 06): the tender register and creation (BUY-07), overview,
 * team and readiness (BUY-08), lots and requirements (BUY-09), pricing and terms (BUY-10), the evaluation plan
 * (BUY-11), the timetable and participation rules (BUY-12) and the release review (BUY-13).
 *
 * Thin imperative wrappers over `call()` for code outside hooks; pages pass the contract endpoints from
 * `tenderEndpoints` to `useApiQuery`/`useApiMutation` directly.
 */
import { tenderEndpoints } from '@contracts/tenders';
import type {
  EndpointBody,
  EndpointParams,
  EndpointQuery,
  EndpointResponse,
} from '@contracts/endpoint';

import { call } from './client';
import type { CallOptions } from './client';

const e = tenderEndpoints;
type Ep = typeof tenderEndpoints;
type Params<K extends keyof Ep> = EndpointParams<Ep[K]>;
type Query<K extends keyof Ep> = EndpointQuery<Ep[K]>;
type Body<K extends keyof Ep> = EndpointBody<Ep[K]>;
type Result<K extends keyof Ep> = Promise<EndpointResponse<Ep[K]>>;

/** GET /api/v1/buyer/tenders (BUY-07). */
export function fetchTenders(query: Query<'list'> = {}, options?: CallOptions): Result<'list'> {
  return call(e.list, { query }, options);
}

/** GET /api/v1/buyer/tender-sources (BUY-07). */
export function fetchCreationSources(
  query: Query<'creationSources'> = {},
  options?: CallOptions,
): Result<'creationSources'> {
  return call(e.creationSources, { query }, options);
}

/** POST /api/v1/buyer/tenders (BUY-07). */
export function createTender(body: Body<'create'>, options?: CallOptions): Result<'create'> {
  return call(e.create, { body }, options);
}

/** POST /api/v1/buyer/tenders/:tenderId/templates (BUY-07, BUY-08). */
export function saveTenderAsTemplate(
  params: Params<'saveAsTemplate'>,
  body: Body<'saveAsTemplate'>,
  options?: CallOptions,
): Result<'saveAsTemplate'> {
  return call(e.saveAsTemplate, { params, body }, options);
}

/** POST /api/v1/buyer/tenders/:tenderId/link (BUY-07, BUY-08). */
export function linkTender(
  params: Params<'link'>,
  body: Body<'link'>,
  options?: CallOptions,
): Result<'link'> {
  return call(e.link, { params, body }, options);
}

/** GET /api/v1/buyer/tenders/:tenderId (BUY-08). */
export function fetchTender(params: Params<'get'>, options?: CallOptions): Result<'get'> {
  return call(e.get, { params }, options);
}

/** PATCH /api/v1/buyer/tenders/:tenderId (BUY-08, BUY-10, BUY-12). */
export function updateTender(
  params: Params<'update'>,
  body: Body<'update'>,
  options?: CallOptions,
): Result<'update'> {
  return call(e.update, { params, body }, options);
}

/** GET /api/v1/buyer/tenders/:tenderId/team (BUY-08). */
export function fetchTenderTeam(params: Params<'team'>, options?: CallOptions): Result<'team'> {
  return call(e.team, { params }, options);
}

/** GET /api/v1/buyer/tenders/:tenderId/team-candidates (BUY-08). */
export function fetchTeamCandidates(
  params: Params<'teamCandidates'>,
  query: Query<'teamCandidates'>,
  options?: CallOptions,
): Result<'teamCandidates'> {
  return call(e.teamCandidates, { params, query }, options);
}

/** POST /api/v1/buyer/tenders/:tenderId/team (BUY-08). */
export function assignTeamMember(
  params: Params<'assignTeamMember'>,
  body: Body<'assignTeamMember'>,
  options?: CallOptions,
): Result<'assignTeamMember'> {
  return call(e.assignTeamMember, { params, body }, options);
}

/** POST /api/v1/buyer/tenders/:tenderId/team/:memberId/remove (BUY-08). */
export function removeTeamMember(
  params: Params<'removeTeamMember'>,
  body: Body<'removeTeamMember'>,
  options?: CallOptions,
): Result<'removeTeamMember'> {
  return call(e.removeTeamMember, { params, body }, options);
}

/** GET /api/v1/buyer/tenders/:tenderId/readiness (BUY-08, BUY-13). */
export function fetchTenderReadiness(
  params: Params<'readiness'>,
  options?: CallOptions,
): Result<'readiness'> {
  return call(e.readiness, { params }, options);
}

/** GET /api/v1/buyer/tenders/:tenderId/lots (BUY-09). */
export function fetchLots(params: Params<'lots'>, options?: CallOptions): Result<'lots'> {
  return call(e.lots, { params }, options);
}

/** POST /api/v1/buyer/tenders/:tenderId/lots (BUY-09). */
export function createLot(
  params: Params<'createLot'>,
  body: Body<'createLot'>,
  options?: CallOptions,
): Result<'createLot'> {
  return call(e.createLot, { params, body }, options);
}

/** PATCH /api/v1/buyer/tenders/:tenderId/lots/:lotId (BUY-09). */
export function updateLot(
  params: Params<'updateLot'>,
  body: Body<'updateLot'>,
  options?: CallOptions,
): Result<'updateLot'> {
  return call(e.updateLot, { params, body }, options);
}

/** GET /api/v1/buyer/tenders/:tenderId/requirements (BUY-09). */
export function fetchRequirements(
  params: Params<'requirements'>,
  query: Query<'requirements'> = {},
  options?: CallOptions,
): Result<'requirements'> {
  return call(e.requirements, { params, query }, options);
}

/** POST /api/v1/buyer/tenders/:tenderId/requirements (BUY-09). */
export function createRequirement(
  params: Params<'createRequirement'>,
  body: Body<'createRequirement'>,
  options?: CallOptions,
): Result<'createRequirement'> {
  return call(e.createRequirement, { params, body }, options);
}

/** PATCH /api/v1/buyer/tenders/:tenderId/requirements/:requirementId (BUY-09). */
export function updateRequirement(
  params: Params<'updateRequirement'>,
  body: Body<'updateRequirement'>,
  options?: CallOptions,
): Result<'updateRequirement'> {
  return call(e.updateRequirement, { params, body }, options);
}

/** DELETE /api/v1/buyer/tenders/:tenderId/requirements/:requirementId (BUY-09). */
export function removeRequirement(
  params: Params<'removeRequirement'>,
  options?: CallOptions,
): Result<'removeRequirement'> {
  return call(e.removeRequirement, { params }, options);
}

/** GET /api/v1/buyer/tenders/:tenderId/pricing (BUY-10). */
export function fetchPricing(params: Params<'pricing'>, options?: CallOptions): Result<'pricing'> {
  return call(e.pricing, { params }, options);
}

/** POST /api/v1/buyer/tenders/:tenderId/pricing-schedules (BUY-10). */
export function createPricingSchedule(
  params: Params<'createPricingSchedule'>,
  body: Body<'createPricingSchedule'>,
  options?: CallOptions,
): Result<'createPricingSchedule'> {
  return call(e.createPricingSchedule, { params, body }, options);
}

/** PATCH /api/v1/buyer/tenders/:tenderId/pricing-schedules/:scheduleId (BUY-10). */
export function updatePricingSchedule(
  params: Params<'updatePricingSchedule'>,
  body: Body<'updatePricingSchedule'>,
  options?: CallOptions,
): Result<'updatePricingSchedule'> {
  return call(e.updatePricingSchedule, { params, body }, options);
}

/** POST /api/v1/buyer/tenders/:tenderId/pricing-schedules/:scheduleId/items (BUY-10). */
export function createPricingItem(
  params: Params<'createPricingItem'>,
  body: Body<'createPricingItem'>,
  options?: CallOptions,
): Result<'createPricingItem'> {
  return call(e.createPricingItem, { params, body }, options);
}

/** PATCH /api/v1/buyer/tenders/:tenderId/pricing-schedules/:scheduleId/items/:itemId (BUY-10). */
export function updatePricingItem(
  params: Params<'updatePricingItem'>,
  body: Body<'updatePricingItem'>,
  options?: CallOptions,
): Result<'updatePricingItem'> {
  return call(e.updatePricingItem, { params, body }, options);
}

/** PUT /api/v1/buyer/tenders/:tenderId/terms/:termType (BUY-10). */
export function saveTenderTerm(
  params: Params<'upsertTerm'>,
  body: Body<'upsertTerm'>,
  options?: CallOptions,
): Result<'upsertTerm'> {
  return call(e.upsertTerm, { params, body }, options);
}

/** GET /api/v1/buyer/tenders/:tenderId/evaluation-plans (BUY-11). */
export function fetchEvaluationPlans(
  params: Params<'evaluationPlans'>,
  options?: CallOptions,
): Result<'evaluationPlans'> {
  return call(e.evaluationPlans, { params }, options);
}

/** PUT /api/v1/buyer/tenders/:tenderId/evaluation-plans/:planId (BUY-11). */
export function updateEvaluationPlan(
  params: Params<'updateEvaluationPlan'>,
  body: Body<'updateEvaluationPlan'>,
  options?: CallOptions,
): Result<'updateEvaluationPlan'> {
  return call(e.updateEvaluationPlan, { params, body }, options);
}

/** POST /api/v1/buyer/tenders/:tenderId/evaluation-plans/:planId/approve (BUY-11). */
export function approveEvaluationPlan(
  params: Params<'approveEvaluationPlan'>,
  body: Body<'approveEvaluationPlan'>,
  options?: CallOptions,
): Result<'approveEvaluationPlan'> {
  return call(e.approveEvaluationPlan, { params, body }, options);
}

/** GET /api/v1/buyer/tenders/:tenderId/timetable (BUY-12). */
export function fetchTimetable(
  params: Params<'timetable'>,
  options?: CallOptions,
): Result<'timetable'> {
  return call(e.timetable, { params }, options);
}

/** PUT /api/v1/buyer/tenders/:tenderId/timetable (BUY-12). */
export function updateTimetable(
  params: Params<'updateTimetable'>,
  body: Body<'updateTimetable'>,
  options?: CallOptions,
): Result<'updateTimetable'> {
  return call(e.updateTimetable, { params, body }, options);
}

/** PUT /api/v1/buyer/tenders/:tenderId/envelopes (BUY-12). */
export function updateEnvelopes(
  params: Params<'updateEnvelopes'>,
  body: Body<'updateEnvelopes'>,
  options?: CallOptions,
): Result<'updateEnvelopes'> {
  return call(e.updateEnvelopes, { params, body }, options);
}

/** POST /api/v1/buyer/tenders/:tenderId/participation-conditions (BUY-12). */
export function createParticipationCondition(
  params: Params<'createCondition'>,
  body: Body<'createCondition'>,
  options?: CallOptions,
): Result<'createCondition'> {
  return call(e.createCondition, { params, body }, options);
}

/** PATCH /api/v1/buyer/tenders/:tenderId/participation-conditions/:conditionId (BUY-12). */
export function updateParticipationCondition(
  params: Params<'updateCondition'>,
  body: Body<'updateCondition'>,
  options?: CallOptions,
): Result<'updateCondition'> {
  return call(e.updateCondition, { params, body }, options);
}

/** DELETE /api/v1/buyer/tenders/:tenderId/participation-conditions/:conditionId (BUY-12). */
export function removeParticipationCondition(
  params: Params<'removeCondition'>,
  options?: CallOptions,
): Result<'removeCondition'> {
  return call(e.removeCondition, { params }, options);
}

/** GET /api/v1/buyer/tenders/:tenderId/release-review (BUY-13). */
export function fetchReleaseReview(
  params: Params<'releaseReview'>,
  options?: CallOptions,
): Result<'releaseReview'> {
  return call(e.releaseReview, { params }, options);
}

/** PUT /api/v1/buyer/tenders/:tenderId/release-checks/:checkArea (BUY-13). */
export function recordReleaseCheck(
  params: Params<'recordReleaseCheck'>,
  body: Body<'recordReleaseCheck'>,
  options?: CallOptions,
): Result<'recordReleaseCheck'> {
  return call(e.recordReleaseCheck, { params, body }, options);
}

/** GET /api/v1/buyer/tenders/:tenderId/preview (BUY-13). */
export function fetchPackagePreview(
  params: Params<'preview'>,
  query: Query<'preview'>,
  options?: CallOptions,
): Result<'preview'> {
  return call(e.preview, { params, query }, options);
}

/** POST /api/v1/buyer/tenders/:tenderId/corrections (BUY-13). */
export function requestCorrection(
  params: Params<'requestCorrection'>,
  body: Body<'requestCorrection'>,
  options?: CallOptions,
): Result<'requestCorrection'> {
  return call(e.requestCorrection, { params, body }, options);
}

/** POST /api/v1/buyer/tenders/:tenderId/release-approval (BUY-13). */
export function requestReleaseApproval(
  params: Params<'requestReleaseApproval'>,
  body: Body<'requestReleaseApproval'>,
  options?: CallOptions,
): Result<'requestReleaseApproval'> {
  return call(e.requestReleaseApproval, { params, body }, options);
}
