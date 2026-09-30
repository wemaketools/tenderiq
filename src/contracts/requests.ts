/**
 * Requests domain contract (05): procurement requests and business cases (BUY-02, BUY-03), request and funding
 * decisions (BUY-04), the procurement plan, calendar and advance notices (BUY-05, PUB-06), and market research and
 * strategy (BUY-06). PRD FR-04, FR-05, §8.1, BR-06, BR-10; AC-05, AC-39.
 *
 * The schemas live in `./requests/*.ts`; this module re-exports them and defines the one endpoint map
 * `requestEndpoints` that the catalog discovers.
 */
import {
  assignRequest,
  closeRequest,
  combineRequests,
  commentOnRequest,
  confirmFunding,
  createRequest,
  decideRequest,
  deferRequest,
  escalateRequest,
  getRequest,
  getRequestDecision,
  getRequestOptions,
  getRequestSummary,
  getRoutingOptions,
  listRequests,
  reconsiderRequest,
  requestInformation,
  rescindRequest,
  respondToInfoRequest,
  routeRequestToContract,
  splitRequest,
  submitRequest,
  updateRequest,
  withdrawRequest,
} from './requests/requests.js';
import {
  createAdvanceNotice,
  createPlanItem,
  followPublicAdvanceNotice,
  getAdvanceNotice,
  getPlanCalendar,
  getPlanItem,
  getPublicAdvanceNotice,
  getPublicPlanSummary,
  getResourceDemand,
  listAdvanceNotices,
  listPlanItems,
  listPublicAdvanceNotices,
  publishAdvanceNotice,
  updateAdvanceNotice,
  updatePlanItem,
  withdrawAdvanceNotice,
} from './requests/planning.js';
import {
  addMarketResearch,
  createStrategy,
  decideFairnessReview,
  decideStrategy,
  getProcedureOptions,
  getStrategy,
  listStrategies,
  submitStrategy,
  updateStrategy,
} from './requests/strategies.js';

export * from './requests/shared.js';
export * from './requests/requests.js';
export * from './requests/planning.js';
export * from './requests/strategies.js';

/** The requests domain endpoint map. */
export const requestEndpoints = {
  // BUY-02 / BUY-03 / BUY-04: requests
  listRequests,
  getRequestSummary,
  getRequestOptions,
  getRequest,
  createRequest,
  updateRequest,
  submitRequest,
  withdrawRequest,
  assignRequest,
  requestInformation,
  respondToInfoRequest,
  combineRequests,
  splitRequest,
  deferRequest,
  getRoutingOptions,
  routeRequestToContract,
  getRequestDecision,
  decideRequest,
  escalateRequest,
  confirmFunding,
  commentOnRequest,
  rescindRequest,
  reconsiderRequest,
  closeRequest,
  // BUY-05: plan, calendar, advance notices
  listPlanItems,
  getPlanItem,
  createPlanItem,
  updatePlanItem,
  getPlanCalendar,
  getResourceDemand,
  listAdvanceNotices,
  getAdvanceNotice,
  createAdvanceNotice,
  updateAdvanceNotice,
  publishAdvanceNotice,
  withdrawAdvanceNotice,
  // PUB-06: public plans and advance notices
  listPublicAdvanceNotices,
  getPublicAdvanceNotice,
  getPublicPlanSummary,
  followPublicAdvanceNotice,
  // BUY-06: strategy
  listStrategies,
  getStrategy,
  createStrategy,
  updateStrategy,
  getProcedureOptions,
  addMarketResearch,
  decideFairnessReview,
  submitStrategy,
  decideStrategy,
} as const;
