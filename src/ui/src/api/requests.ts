/**
 * Requests domain client (the `requests` contract, domain 05): procurement requests and funding decisions
 * (BUY-02..04), the procurement plan and advance notices (BUY-05, PUB-06), and strategy (BUY-06).
 *
 * Thin imperative wrappers over `call()` for code outside hooks; pages pass the contract endpoints from
 * `requestEndpoints` to `useApiQuery`/`useApiMutation` directly.
 */
import { requestEndpoints } from '@contracts/requests';
import type {
  EndpointBody,
  EndpointParams,
  EndpointQuery,
  EndpointResponse,
} from '@contracts/endpoint';

import { call } from './client';
import type { CallOptions } from './client';

const e = requestEndpoints;
type Ep = typeof requestEndpoints;
type Params<K extends keyof Ep> = EndpointParams<Ep[K]>;
type Query<K extends keyof Ep> = EndpointQuery<Ep[K]>;
type Body<K extends keyof Ep> = EndpointBody<Ep[K]>;
type Result<K extends keyof Ep> = Promise<EndpointResponse<Ep[K]>>;

/** GET /api/v1/buyer/requests (BUY-02). */
export function fetchRequests(
  query: Query<'listRequests'> = {},
  options?: CallOptions,
): Result<'listRequests'> {
  return call(e.listRequests, { query }, options);
}

/** GET /api/v1/buyer/request-summary (BUY-02). */
export function fetchRequestSummary(options?: CallOptions): Result<'getRequestSummary'> {
  return call(e.getRequestSummary, {}, options);
}

/** GET /api/v1/buyer/request-options (BUY-03, BUY-05, BUY-06). */
export function fetchRequestOptions(options?: CallOptions): Result<'getRequestOptions'> {
  return call(e.getRequestOptions, {}, options);
}

/** GET /api/v1/buyer/requests/:requestId (BUY-03). */
export function fetchRequest(
  params: Params<'getRequest'>,
  options?: CallOptions,
): Result<'getRequest'> {
  return call(e.getRequest, { params }, options);
}

/** POST /api/v1/buyer/requests (BUY-03). */
export function createRequest(
  body: Body<'createRequest'>,
  options?: CallOptions,
): Result<'createRequest'> {
  return call(e.createRequest, { body }, options);
}

/** PUT /api/v1/buyer/requests/:requestId (BUY-03). */
export function updateRequest(
  params: Params<'updateRequest'>,
  body: Body<'updateRequest'>,
  options?: CallOptions,
): Result<'updateRequest'> {
  return call(e.updateRequest, { params, body }, options);
}

/** POST /api/v1/buyer/requests/:requestId/submit (BUY-03). */
export function submitRequest(
  params: Params<'submitRequest'>,
  body: Body<'submitRequest'>,
  options?: CallOptions,
): Result<'submitRequest'> {
  return call(e.submitRequest, { params, body }, options);
}

/** POST /api/v1/buyer/requests/:requestId/withdraw (BUY-03). */
export function withdrawRequest(
  params: Params<'withdrawRequest'>,
  body: Body<'withdrawRequest'>,
  options?: CallOptions,
): Result<'withdrawRequest'> {
  return call(e.withdrawRequest, { params, body }, options);
}

/** POST /api/v1/buyer/requests/:requestId/assign (BUY-02). */
export function assignRequest(
  params: Params<'assignRequest'>,
  body: Body<'assignRequest'>,
  options?: CallOptions,
): Result<'assignRequest'> {
  return call(e.assignRequest, { params, body }, options);
}

/** POST /api/v1/buyer/requests/:requestId/info-requests (BUY-04). */
export function requestInformation(
  params: Params<'requestInformation'>,
  body: Body<'requestInformation'>,
  options?: CallOptions,
): Result<'requestInformation'> {
  return call(e.requestInformation, { params, body }, options);
}

/** POST /api/v1/buyer/requests/:requestId/info-requests/:infoRequestId/respond (BUY-03). */
export function respondToInfoRequest(
  params: Params<'respondToInfoRequest'>,
  body: Body<'respondToInfoRequest'>,
  options?: CallOptions,
): Result<'respondToInfoRequest'> {
  return call(e.respondToInfoRequest, { params, body }, options);
}

/** POST /api/v1/buyer/requests/:requestId/combine (BUY-02). */
export function combineRequests(
  params: Params<'combineRequests'>,
  body: Body<'combineRequests'>,
  options?: CallOptions,
): Result<'combineRequests'> {
  return call(e.combineRequests, { params, body }, options);
}

/** POST /api/v1/buyer/requests/:requestId/split (BUY-04). */
export function splitRequest(
  params: Params<'splitRequest'>,
  body: Body<'splitRequest'>,
  options?: CallOptions,
): Result<'splitRequest'> {
  return call(e.splitRequest, { params, body }, options);
}

/** POST /api/v1/buyer/requests/:requestId/defer (BUY-02, BUY-04). */
export function deferRequest(
  params: Params<'deferRequest'>,
  body: Body<'deferRequest'>,
  options?: CallOptions,
): Result<'deferRequest'> {
  return call(e.deferRequest, { params, body }, options);
}

/** GET /api/v1/buyer/requests/:requestId/routing-options (BUY-04). */
export function fetchRoutingOptions(
  params: Params<'getRoutingOptions'>,
  options?: CallOptions,
): Result<'getRoutingOptions'> {
  return call(e.getRoutingOptions, { params }, options);
}

/** POST /api/v1/buyer/requests/:requestId/route-to-contract (BUY-02, BUY-04). */
export function routeRequestToContract(
  params: Params<'routeRequestToContract'>,
  body: Body<'routeRequestToContract'>,
  options?: CallOptions,
): Result<'routeRequestToContract'> {
  return call(e.routeRequestToContract, { params, body }, options);
}

/** GET /api/v1/buyer/requests/:requestId/decision (BUY-04). */
export function fetchRequestDecision(
  params: Params<'getRequestDecision'>,
  options?: CallOptions,
): Result<'getRequestDecision'> {
  return call(e.getRequestDecision, { params }, options);
}

/** POST /api/v1/buyer/requests/:requestId/decision (BUY-04). */
export function decideRequest(
  params: Params<'decideRequest'>,
  body: Body<'decideRequest'>,
  options?: CallOptions,
): Result<'decideRequest'> {
  return call(e.decideRequest, { params, body }, options);
}

/** POST /api/v1/buyer/requests/:requestId/decision/escalate (BUY-04). */
export function escalateRequest(
  params: Params<'escalateRequest'>,
  body: Body<'escalateRequest'>,
  options?: CallOptions,
): Result<'escalateRequest'> {
  return call(e.escalateRequest, { params, body }, options);
}

/** POST /api/v1/buyer/requests/:requestId/funding (BUY-04). */
export function confirmFunding(
  params: Params<'confirmFunding'>,
  body: Body<'confirmFunding'>,
  options?: CallOptions,
): Result<'confirmFunding'> {
  return call(e.confirmFunding, { params, body }, options);
}

/** POST /api/v1/buyer/requests/:requestId/comments (BUY-04). */
export function commentOnRequest(
  params: Params<'commentOnRequest'>,
  body: Body<'commentOnRequest'>,
  options?: CallOptions,
): Result<'commentOnRequest'> {
  return call(e.commentOnRequest, { params, body }, options);
}

/** POST /api/v1/buyer/requests/:requestId/rescind (BUY-04). */
export function rescindRequest(
  params: Params<'rescindRequest'>,
  body: Body<'rescindRequest'>,
  options?: CallOptions,
): Result<'rescindRequest'> {
  return call(e.rescindRequest, { params, body }, options);
}

/** POST /api/v1/buyer/requests/:requestId/reconsider (BUY-04). */
export function reconsiderRequest(
  params: Params<'reconsiderRequest'>,
  body: Body<'reconsiderRequest'>,
  options?: CallOptions,
): Result<'reconsiderRequest'> {
  return call(e.reconsiderRequest, { params, body }, options);
}

/** POST /api/v1/buyer/requests/:requestId/close (BUY-02). */
export function closeRequest(
  params: Params<'closeRequest'>,
  body: Body<'closeRequest'>,
  options?: CallOptions,
): Result<'closeRequest'> {
  return call(e.closeRequest, { params, body }, options);
}

/** GET /api/v1/buyer/plan-items (BUY-05). */
export function fetchPlanItems(
  query: Query<'listPlanItems'> = {},
  options?: CallOptions,
): Result<'listPlanItems'> {
  return call(e.listPlanItems, { query }, options);
}

/** GET /api/v1/buyer/plan-items/:planItemId (BUY-05). */
export function fetchPlanItem(
  params: Params<'getPlanItem'>,
  options?: CallOptions,
): Result<'getPlanItem'> {
  return call(e.getPlanItem, { params }, options);
}

/** POST /api/v1/buyer/plan-items (BUY-05). */
export function createPlanItem(
  body: Body<'createPlanItem'>,
  options?: CallOptions,
): Result<'createPlanItem'> {
  return call(e.createPlanItem, { body }, options);
}

/** PUT /api/v1/buyer/plan-items/:planItemId (BUY-05). */
export function updatePlanItem(
  params: Params<'updatePlanItem'>,
  body: Body<'updatePlanItem'>,
  options?: CallOptions,
): Result<'updatePlanItem'> {
  return call(e.updatePlanItem, { params, body }, options);
}

/** GET /api/v1/buyer/plan-calendar (BUY-05). */
export function fetchPlanCalendar(
  query: Query<'getPlanCalendar'>,
  options?: CallOptions,
): Result<'getPlanCalendar'> {
  return call(e.getPlanCalendar, { query }, options);
}

/** GET /api/v1/buyer/plan-resource-demand (BUY-05). */
export function fetchResourceDemand(
  query: Query<'getResourceDemand'>,
  options?: CallOptions,
): Result<'getResourceDemand'> {
  return call(e.getResourceDemand, { query }, options);
}

/** GET /api/v1/buyer/advance-notices (BUY-05). */
export function fetchAdvanceNotices(
  query: Query<'listAdvanceNotices'> = {},
  options?: CallOptions,
): Result<'listAdvanceNotices'> {
  return call(e.listAdvanceNotices, { query }, options);
}

/** GET /api/v1/buyer/advance-notices/:noticeId (BUY-05). */
export function fetchAdvanceNotice(
  params: Params<'getAdvanceNotice'>,
  options?: CallOptions,
): Result<'getAdvanceNotice'> {
  return call(e.getAdvanceNotice, { params }, options);
}

/** POST /api/v1/buyer/advance-notices (BUY-05). */
export function createAdvanceNotice(
  body: Body<'createAdvanceNotice'>,
  options?: CallOptions,
): Result<'createAdvanceNotice'> {
  return call(e.createAdvanceNotice, { body }, options);
}

/** PUT /api/v1/buyer/advance-notices/:noticeId (BUY-05). */
export function updateAdvanceNotice(
  params: Params<'updateAdvanceNotice'>,
  body: Body<'updateAdvanceNotice'>,
  options?: CallOptions,
): Result<'updateAdvanceNotice'> {
  return call(e.updateAdvanceNotice, { params, body }, options);
}

/** POST /api/v1/buyer/advance-notices/:noticeId/publish (BUY-05). */
export function publishAdvanceNotice(
  params: Params<'publishAdvanceNotice'>,
  options?: CallOptions,
): Result<'publishAdvanceNotice'> {
  return call(e.publishAdvanceNotice, { params }, options);
}

/** POST /api/v1/buyer/advance-notices/:noticeId/withdraw (BUY-05). */
export function withdrawAdvanceNotice(
  params: Params<'withdrawAdvanceNotice'>,
  body: Body<'withdrawAdvanceNotice'>,
  options?: CallOptions,
): Result<'withdrawAdvanceNotice'> {
  return call(e.withdrawAdvanceNotice, { params, body }, options);
}

/** GET /api/v1/public/advance-notices (PUB-06). */
export function fetchPublicAdvanceNotices(
  query: Query<'listPublicAdvanceNotices'> = {},
  options?: CallOptions,
): Result<'listPublicAdvanceNotices'> {
  return call(e.listPublicAdvanceNotices, { query }, options);
}

/** GET /api/v1/public/advance-notices/:buyerSlug/:noticeId (PUB-06). */
export function fetchPublicAdvanceNotice(
  params: Params<'getPublicAdvanceNotice'>,
  options?: CallOptions,
): Result<'getPublicAdvanceNotice'> {
  return call(e.getPublicAdvanceNotice, { params }, options);
}

/** GET /api/v1/public/procurement-plans (PUB-06). */
export function fetchPublicPlanSummary(
  query: Query<'getPublicPlanSummary'> = {},
  options?: CallOptions,
): Result<'getPublicPlanSummary'> {
  return call(e.getPublicPlanSummary, { query }, options);
}

/** POST /api/v1/public/advance-notices/:buyerSlug/:noticeId/follow (PUB-06). */
export function followPublicAdvanceNotice(
  params: Params<'followPublicAdvanceNotice'>,
  body: Body<'followPublicAdvanceNotice'>,
  options?: CallOptions,
): Result<'followPublicAdvanceNotice'> {
  return call(e.followPublicAdvanceNotice, { params, body }, options);
}

/** GET /api/v1/buyer/strategies (BUY-06). */
export function fetchStrategies(
  query: Query<'listStrategies'> = {},
  options?: CallOptions,
): Result<'listStrategies'> {
  return call(e.listStrategies, { query }, options);
}

/** GET /api/v1/buyer/strategies/:strategyId (BUY-06). */
export function fetchStrategy(
  params: Params<'getStrategy'>,
  options?: CallOptions,
): Result<'getStrategy'> {
  return call(e.getStrategy, { params }, options);
}

/** POST /api/v1/buyer/strategies (BUY-06). */
export function createStrategy(
  body: Body<'createStrategy'>,
  options?: CallOptions,
): Result<'createStrategy'> {
  return call(e.createStrategy, { body }, options);
}

/** PUT /api/v1/buyer/strategies/:strategyId (BUY-06). */
export function updateStrategy(
  params: Params<'updateStrategy'>,
  body: Body<'updateStrategy'>,
  options?: CallOptions,
): Result<'updateStrategy'> {
  return call(e.updateStrategy, { params, body }, options);
}

/** GET /api/v1/buyer/strategies/:strategyId/procedure-options (BUY-06). */
export function fetchProcedureOptions(
  params: Params<'getProcedureOptions'>,
  options?: CallOptions,
): Result<'getProcedureOptions'> {
  return call(e.getProcedureOptions, { params }, options);
}

/** POST /api/v1/buyer/strategies/:strategyId/market-research (BUY-06). */
export function addMarketResearch(
  params: Params<'addMarketResearch'>,
  body: Body<'addMarketResearch'>,
  options?: CallOptions,
): Result<'addMarketResearch'> {
  return call(e.addMarketResearch, { params, body }, options);
}

/** POST /api/v1/buyer/strategies/:strategyId/fairness-reviews/:reviewId/decision (BUY-06). */
export function decideFairnessReview(
  params: Params<'decideFairnessReview'>,
  body: Body<'decideFairnessReview'>,
  options?: CallOptions,
): Result<'decideFairnessReview'> {
  return call(e.decideFairnessReview, { params, body }, options);
}

/** POST /api/v1/buyer/strategies/:strategyId/submit (BUY-06). */
export function submitStrategy(
  params: Params<'submitStrategy'>,
  body: Body<'submitStrategy'>,
  options?: CallOptions,
): Result<'submitStrategy'> {
  return call(e.submitStrategy, { params, body }, options);
}

/** POST /api/v1/buyer/strategies/:strategyId/decision (BUY-06). */
export function decideStrategy(
  params: Params<'decideStrategy'>,
  body: Body<'decideStrategy'>,
  options?: CallOptions,
): Result<'decideStrategy'> {
  return call(e.decideStrategy, { params, body }, options);
}
