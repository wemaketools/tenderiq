/**
 * Contracts client (the `contracts` contract; FR-18, FR-19): contract register, preparation and review, signature and
 * commencement, handover, obligations and acceptance, performance, the financial view, changes and disputes, renewal
 * and closeout (CON-01 … CON-11), and the supplier's own contracts (SUP-23). Pages use the hooks with the contract
 * endpoints directly; these typed wrappers serve code outside hooks.
 */
import { contractsEndpoints } from '@contracts/contracts';
import type { EndpointRequest, EndpointResponse } from '@contracts/endpoint';

import { call } from './client';
import type { CallOptions } from './client';

type Endpoints = typeof contractsEndpoints;
/** The request (`params`, `query`, `body`) of a contracts endpoint. */
export type ContractsRequest<K extends keyof Endpoints> = EndpointRequest<Endpoints[K]>;
/** The response of a contracts endpoint. */
export type ContractsResponse<K extends keyof Endpoints> = EndpointResponse<Endpoints[K]>;

function send<K extends keyof Endpoints>(
  key: K,
  request: ContractsRequest<K>,
  options?: CallOptions,
): Promise<ContractsResponse<K>> {
  return call(contractsEndpoints[key], request, options);
}

/** GET /api/v1/buyer/contracts (`buyer.contracts.list`). */
export function list(
  request: ContractsRequest<'list'>,
  options?: CallOptions,
): Promise<ContractsResponse<'list'>> {
  return send('list', request, options);
}
/** GET /api/v1/buyer/contracts/:contractId (`buyer.contracts.get`). */
export function get(
  request: ContractsRequest<'get'>,
  options?: CallOptions,
): Promise<ContractsResponse<'get'>> {
  return send('get', request, options);
}
/** GET /api/v1/buyer/contract-award-sources (`buyer.contracts.awardSources`). */
export function awardSources(
  request: ContractsRequest<'awardSources'>,
  options?: CallOptions,
): Promise<ContractsResponse<'awardSources'>> {
  return send('awardSources', request, options);
}
/** GET /api/v1/buyer/contract-assignees (`buyer.contracts.assignees`). */
export function assignees(
  request: ContractsRequest<'assignees'>,
  options?: CallOptions,
): Promise<ContractsResponse<'assignees'>> {
  return send('assignees', request, options);
}
/** POST /api/v1/buyer/contracts (`buyer.contracts.create`). */
export function create(
  request: ContractsRequest<'create'>,
  options?: CallOptions,
): Promise<ContractsResponse<'create'>> {
  return send('create', request, options);
}
/** PATCH /api/v1/buyer/contracts/:contractId (`buyer.contracts.update`). */
export function update(
  request: ContractsRequest<'update'>,
  options?: CallOptions,
): Promise<ContractsResponse<'update'>> {
  return send('update', request, options);
}
/** GET /api/v1/buyer/contracts/:contractId/preparation (`buyer.contracts.preparation`). */
export function preparation(
  request: ContractsRequest<'preparation'>,
  options?: CallOptions,
): Promise<ContractsResponse<'preparation'>> {
  return send('preparation', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/submit-review (`buyer.contracts.submitForReview`). */
export function submitForReview(
  request: ContractsRequest<'submitForReview'>,
  options?: CallOptions,
): Promise<ContractsResponse<'submitForReview'>> {
  return send('submitForReview', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/review-decision (`buyer.contracts.reviewDecision`). */
export function reviewDecision(
  request: ContractsRequest<'reviewDecision'>,
  options?: CallOptions,
): Promise<ContractsResponse<'reviewDecision'>> {
  return send('reviewDecision', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/owners (`buyer.contracts.assignOwners`). */
export function assignOwners(
  request: ContractsRequest<'assignOwners'>,
  options?: CallOptions,
): Promise<ContractsResponse<'assignOwners'>> {
  return send('assignOwners', request, options);
}
/** GET /api/v1/buyer/contracts/:contractId/signature (`buyer.contracts.signature`). */
export function signature(
  request: ContractsRequest<'signature'>,
  options?: CallOptions,
): Promise<ContractsResponse<'signature'>> {
  return send('signature', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/signatories (`buyer.contracts.addSignatory`). */
export function addSignatory(
  request: ContractsRequest<'addSignatory'>,
  options?: CallOptions,
): Promise<ContractsResponse<'addSignatory'>> {
  return send('addSignatory', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/signatories/:signatoryId/sign (`buyer.contracts.sign`). */
export function sign(
  request: ContractsRequest<'sign'>,
  options?: CallOptions,
): Promise<ContractsResponse<'sign'>> {
  return send('sign', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/signatories/:signatoryId/record-external (`buyer.contracts.recordExternalSignature`). */
export function recordExternalSignature(
  request: ContractsRequest<'recordExternalSignature'>,
  options?: CallOptions,
): Promise<ContractsResponse<'recordExternalSignature'>> {
  return send('recordExternalSignature', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/return-to-review (`buyer.contracts.returnToReview`). */
export function returnToReview(
  request: ContractsRequest<'returnToReview'>,
  options?: CallOptions,
): Promise<ContractsResponse<'returnToReview'>> {
  return send('returnToReview', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/commencement (`buyer.contracts.authorizeCommencement`). */
export function authorizeCommencement(
  request: ContractsRequest<'authorizeCommencement'>,
  options?: CallOptions,
): Promise<ContractsResponse<'authorizeCommencement'>> {
  return send('authorizeCommencement', request, options);
}
/** GET /api/v1/buyer/contracts/:contractId/handover (`buyer.contracts.handover`). */
export function handover(
  request: ContractsRequest<'handover'>,
  options?: CallOptions,
): Promise<ContractsResponse<'handover'>> {
  return send('handover', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/handover/submit (`buyer.contracts.submitHandover`). */
export function submitHandover(
  request: ContractsRequest<'submitHandover'>,
  options?: CallOptions,
): Promise<ContractsResponse<'submitHandover'>> {
  return send('submitHandover', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/handover/accept (`buyer.contracts.acceptHandover`). */
export function acceptHandover(
  request: ContractsRequest<'acceptHandover'>,
  options?: CallOptions,
): Promise<ContractsResponse<'acceptHandover'>> {
  return send('acceptHandover', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/handover/return (`buyer.contracts.returnHandover`). */
export function returnHandover(
  request: ContractsRequest<'returnHandover'>,
  options?: CallOptions,
): Promise<ContractsResponse<'returnHandover'>> {
  return send('returnHandover', request, options);
}
/** GET /api/v1/buyer/contracts/:contractId/obligations (`buyer.contracts.obligations`). */
export function obligations(
  request: ContractsRequest<'obligations'>,
  options?: CallOptions,
): Promise<ContractsResponse<'obligations'>> {
  return send('obligations', request, options);
}
/** GET /api/v1/buyer/contracts/:contractId/obligations/:obligationId (`buyer.contracts.obligation`). */
export function obligation(
  request: ContractsRequest<'obligation'>,
  options?: CallOptions,
): Promise<ContractsResponse<'obligation'>> {
  return send('obligation', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/obligations (`buyer.contracts.createObligation`). */
export function createObligation(
  request: ContractsRequest<'createObligation'>,
  options?: CallOptions,
): Promise<ContractsResponse<'createObligation'>> {
  return send('createObligation', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/obligations/:obligationId/assign (`buyer.contracts.assignObligation`). */
export function assignObligation(
  request: ContractsRequest<'assignObligation'>,
  options?: CallOptions,
): Promise<ContractsResponse<'assignObligation'>> {
  return send('assignObligation', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/obligations/:obligationId/escalate (`buyer.contracts.escalateObligation`). */
export function escalateObligation(
  request: ContractsRequest<'escalateObligation'>,
  options?: CallOptions,
): Promise<ContractsResponse<'escalateObligation'>> {
  return send('escalateObligation', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/obligations/:obligationId/start-review (`buyer.contracts.startObligationReview`). */
export function startObligationReview(
  request: ContractsRequest<'startObligationReview'>,
  options?: CallOptions,
): Promise<ContractsResponse<'startObligationReview'>> {
  return send('startObligationReview', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/obligations/:obligationId/decision (`buyer.contracts.decideObligation`). */
export function decideObligation(
  request: ContractsRequest<'decideObligation'>,
  options?: CallOptions,
): Promise<ContractsResponse<'decideObligation'>> {
  return send('decideObligation', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/obligations/:obligationId/evidence (`buyer.contracts.submitObligationEvidence`). */
export function submitObligationEvidence(
  request: ContractsRequest<'submitObligationEvidence'>,
  options?: CallOptions,
): Promise<ContractsResponse<'submitObligationEvidence'>> {
  return send('submitObligationEvidence', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/securities/:securityId/release (`buyer.contracts.releaseSecurity`). */
export function releaseSecurity(
  request: ContractsRequest<'releaseSecurity'>,
  options?: CallOptions,
): Promise<ContractsResponse<'releaseSecurity'>> {
  return send('releaseSecurity', request, options);
}
/** GET /api/v1/buyer/contracts/:contractId/performance (`buyer.contracts.performance`). */
export function performance(
  request: ContractsRequest<'performance'>,
  options?: CallOptions,
): Promise<ContractsResponse<'performance'>> {
  return send('performance', request, options);
}
/** GET /api/v1/buyer/contracts/:contractId/performance-reviews/:reviewId (`buyer.contracts.performanceReview`). */
export function performanceReview(
  request: ContractsRequest<'performanceReview'>,
  options?: CallOptions,
): Promise<ContractsResponse<'performanceReview'>> {
  return send('performanceReview', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/performance-reviews (`buyer.contracts.createPerformanceReview`). */
export function createPerformanceReview(
  request: ContractsRequest<'createPerformanceReview'>,
  options?: CallOptions,
): Promise<ContractsResponse<'createPerformanceReview'>> {
  return send('createPerformanceReview', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/performance-reviews/:reviewId/share (`buyer.contracts.sharePerformanceReview`). */
export function sharePerformanceReview(
  request: ContractsRequest<'sharePerformanceReview'>,
  options?: CallOptions,
): Promise<ContractsResponse<'sharePerformanceReview'>> {
  return send('sharePerformanceReview', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/performance-reviews/:reviewId/finalize (`buyer.contracts.finalizePerformanceReview`). */
export function finalizePerformanceReview(
  request: ContractsRequest<'finalizePerformanceReview'>,
  options?: CallOptions,
): Promise<ContractsResponse<'finalizePerformanceReview'>> {
  return send('finalizePerformanceReview', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/incidents (`buyer.contracts.recordIncident`). */
export function recordIncident(
  request: ContractsRequest<'recordIncident'>,
  options?: CallOptions,
): Promise<ContractsResponse<'recordIncident'>> {
  return send('recordIncident', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/improvement-actions (`buyer.contracts.createImprovementAction`). */
export function createImprovementAction(
  request: ContractsRequest<'createImprovementAction'>,
  options?: CallOptions,
): Promise<ContractsResponse<'createImprovementAction'>> {
  return send('createImprovementAction', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/improvement-actions/:actionId/status (`buyer.contracts.updateImprovementAction`). */
export function updateImprovementAction(
  request: ContractsRequest<'updateImprovementAction'>,
  options?: CallOptions,
): Promise<ContractsResponse<'updateImprovementAction'>> {
  return send('updateImprovementAction', request, options);
}
/** GET /api/v1/buyer/contracts/:contractId/financials (`buyer.contracts.financials`). */
export function financials(
  request: ContractsRequest<'financials'>,
  options?: CallOptions,
): Promise<ContractsResponse<'financials'>> {
  return send('financials', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/invoices (`buyer.contracts.recordInvoice`). */
export function recordInvoice(
  request: ContractsRequest<'recordInvoice'>,
  options?: CallOptions,
): Promise<ContractsResponse<'recordInvoice'>> {
  return send('recordInvoice', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/invoices/:invoiceId/dispute (`buyer.contracts.disputeInvoice`). */
export function disputeInvoice(
  request: ContractsRequest<'disputeInvoice'>,
  options?: CallOptions,
): Promise<ContractsResponse<'disputeInvoice'>> {
  return send('disputeInvoice', request, options);
}
/** GET /api/v1/buyer/contracts/:contractId/change-requests (`buyer.contracts.changes`). */
export function changes(
  request: ContractsRequest<'changes'>,
  options?: CallOptions,
): Promise<ContractsResponse<'changes'>> {
  return send('changes', request, options);
}
/** GET /api/v1/buyer/contracts/:contractId/change-requests/:changeId (`buyer.contracts.changeRequest`). */
export function changeRequest(
  request: ContractsRequest<'changeRequest'>,
  options?: CallOptions,
): Promise<ContractsResponse<'changeRequest'>> {
  return send('changeRequest', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/change-requests (`buyer.contracts.createChange`). */
export function createChange(
  request: ContractsRequest<'createChange'>,
  options?: CallOptions,
): Promise<ContractsResponse<'createChange'>> {
  return send('createChange', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/change-requests/:changeId/assess (`buyer.contracts.assessChange`). */
export function assessChange(
  request: ContractsRequest<'assessChange'>,
  options?: CallOptions,
): Promise<ContractsResponse<'assessChange'>> {
  return send('assessChange', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/change-requests/:changeId/request-approval (`buyer.contracts.requestChangeApproval`). */
export function requestChangeApproval(
  request: ContractsRequest<'requestChangeApproval'>,
  options?: CallOptions,
): Promise<ContractsResponse<'requestChangeApproval'>> {
  return send('requestChangeApproval', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/change-requests/:changeId/decision (`buyer.contracts.decideChange`). */
export function decideChange(
  request: ContractsRequest<'decideChange'>,
  options?: CallOptions,
): Promise<ContractsResponse<'decideChange'>> {
  return send('decideChange', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/change-requests/:changeId/withdraw (`buyer.contracts.withdrawChange`). */
export function withdrawChange(
  request: ContractsRequest<'withdrawChange'>,
  options?: CallOptions,
): Promise<ContractsResponse<'withdrawChange'>> {
  return send('withdrawChange', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/change-requests/:changeId/incorporate (`buyer.contracts.incorporateChange`). */
export function incorporateChange(
  request: ContractsRequest<'incorporateChange'>,
  options?: CallOptions,
): Promise<ContractsResponse<'incorporateChange'>> {
  return send('incorporateChange', request, options);
}
/** GET /api/v1/buyer/contracts/:contractId/disputes (`buyer.contracts.disputes`). */
export function disputes(
  request: ContractsRequest<'disputes'>,
  options?: CallOptions,
): Promise<ContractsResponse<'disputes'>> {
  return send('disputes', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/disputes (`buyer.contracts.recordDispute`). */
export function recordDispute(
  request: ContractsRequest<'recordDispute'>,
  options?: CallOptions,
): Promise<ContractsResponse<'recordDispute'>> {
  return send('recordDispute', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/disputes/:disputeId/status (`buyer.contracts.updateDispute`). */
export function updateDispute(
  request: ContractsRequest<'updateDispute'>,
  options?: CallOptions,
): Promise<ContractsResponse<'updateDispute'>> {
  return send('updateDispute', request, options);
}
/** GET /api/v1/buyer/contracts/:contractId/renewal-options (`buyer.contracts.renewals`). */
export function renewals(
  request: ContractsRequest<'renewals'>,
  options?: CallOptions,
): Promise<ContractsResponse<'renewals'>> {
  return send('renewals', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/renewal-options/:optionId/decision (`buyer.contracts.decideRenewal`). */
export function decideRenewal(
  request: ContractsRequest<'decideRenewal'>,
  options?: CallOptions,
): Promise<ContractsResponse<'decideRenewal'>> {
  return send('decideRenewal', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/renewal-options/:optionId/notify (`buyer.contracts.notifyRenewal`). */
export function notifyRenewal(
  request: ContractsRequest<'notifyRenewal'>,
  options?: CallOptions,
): Promise<ContractsResponse<'notifyRenewal'>> {
  return send('notifyRenewal', request, options);
}
/** GET /api/v1/buyer/contracts/:contractId/closeout (`buyer.contracts.closeout`). */
export function closeout(
  request: ContractsRequest<'closeout'>,
  options?: CallOptions,
): Promise<ContractsResponse<'closeout'>> {
  return send('closeout', request, options);
}
/** PUT /api/v1/buyer/contracts/:contractId/closeout (`buyer.contracts.saveCloseout`). */
export function saveCloseout(
  request: ContractsRequest<'saveCloseout'>,
  options?: CallOptions,
): Promise<ContractsResponse<'saveCloseout'>> {
  return send('saveCloseout', request, options);
}
/** POST /api/v1/buyer/contracts/:contractId/closeout/close (`buyer.contracts.closeContract`). */
export function closeContract(
  request: ContractsRequest<'closeContract'>,
  options?: CallOptions,
): Promise<ContractsResponse<'closeContract'>> {
  return send('closeContract', request, options);
}
/** GET /api/v1/supplier/contracts (`supplier.contracts.list`). */
export function supplierList(
  request: ContractsRequest<'supplierList'>,
  options?: CallOptions,
): Promise<ContractsResponse<'supplierList'>> {
  return send('supplierList', request, options);
}
/** GET /api/v1/supplier/contracts/:contractId (`supplier.contracts.get`). */
export function supplierGet(
  request: ContractsRequest<'supplierGet'>,
  options?: CallOptions,
): Promise<ContractsResponse<'supplierGet'>> {
  return send('supplierGet', request, options);
}
/** GET /api/v1/supplier/contracts/:contractId/obligations/:obligationId (`supplier.contracts.obligation`). */
export function supplierObligation(
  request: ContractsRequest<'supplierObligation'>,
  options?: CallOptions,
): Promise<ContractsResponse<'supplierObligation'>> {
  return send('supplierObligation', request, options);
}
/** POST /api/v1/supplier/contracts/:contractId/signatories/:signatoryId/sign (`supplier.contracts.sign`). */
export function supplierSign(
  request: ContractsRequest<'supplierSign'>,
  options?: CallOptions,
): Promise<ContractsResponse<'supplierSign'>> {
  return send('supplierSign', request, options);
}
/** POST /api/v1/supplier/contracts/:contractId/signatories/:signatoryId/refuse (`supplier.contracts.refuseSignature`). */
export function supplierRefuseSignature(
  request: ContractsRequest<'supplierRefuseSignature'>,
  options?: CallOptions,
): Promise<ContractsResponse<'supplierRefuseSignature'>> {
  return send('supplierRefuseSignature', request, options);
}
/** POST /api/v1/supplier/contracts/:contractId/obligations/:obligationId/evidence (`supplier.contracts.submitEvidence`). */
export function supplierSubmitEvidence(
  request: ContractsRequest<'supplierSubmitEvidence'>,
  options?: CallOptions,
): Promise<ContractsResponse<'supplierSubmitEvidence'>> {
  return send('supplierSubmitEvidence', request, options);
}
/** POST /api/v1/supplier/contracts/:contractId/performance-reviews/:reviewId/response (`supplier.contracts.respondReview`). */
export function supplierRespondReview(
  request: ContractsRequest<'supplierRespondReview'>,
  options?: CallOptions,
): Promise<ContractsResponse<'supplierRespondReview'>> {
  return send('supplierRespondReview', request, options);
}
/** POST /api/v1/supplier/contracts/:contractId/change-requests (`supplier.contracts.requestChange`). */
export function supplierRequestChange(
  request: ContractsRequest<'supplierRequestChange'>,
  options?: CallOptions,
): Promise<ContractsResponse<'supplierRequestChange'>> {
  return send('supplierRequestChange', request, options);
}
/** POST /api/v1/supplier/contracts/:contractId/change-requests/:changeId/agree (`supplier.contracts.agreeChange`). */
export function supplierAgreeChange(
  request: ContractsRequest<'supplierAgreeChange'>,
  options?: CallOptions,
): Promise<ContractsResponse<'supplierAgreeChange'>> {
  return send('supplierAgreeChange', request, options);
}
/** POST /api/v1/supplier/contracts/:contractId/disputes (`supplier.contracts.raiseDispute`). */
export function supplierRaiseDispute(
  request: ContractsRequest<'supplierRaiseDispute'>,
  options?: CallOptions,
): Promise<ContractsResponse<'supplierRaiseDispute'>> {
  return send('supplierRaiseDispute', request, options);
}
