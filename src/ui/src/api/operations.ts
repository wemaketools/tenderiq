/**
 * Operations client (the `operations` contract; FR-22, PRD §16, §19–§21): the operator area (OPS-01..07), buyer
 * integrations, imports and subscription (ADM-15..17) and the help centre and service cases (COM-09). Pages use the
 * hooks with the contract endpoints directly; these typed wrappers serve code outside hooks.
 */
import { operationsEndpoints } from '@contracts/operations';
import type { EndpointRequest, EndpointResponse } from '@contracts/endpoint';

import { call } from './client';
import type { CallOptions } from './client';

type Endpoints = typeof operationsEndpoints;
/** The request (`params`, `query`, `body`) of an operations endpoint. */
export type OperationsRequest<K extends keyof Endpoints> = EndpointRequest<Endpoints[K]>;
/** The response of an operations endpoint. */
export type OperationsResponse<K extends keyof Endpoints> = EndpointResponse<Endpoints[K]>;

function send<K extends keyof Endpoints>(
  key: K,
  request: OperationsRequest<K>,
  options?: CallOptions,
): Promise<OperationsResponse<K>> {
  return call(operationsEndpoints[key], request, options);
}

/** GET /api/v1/ops/customers (`ops.operations.customers.list`). */
export function listCustomers(
  request: OperationsRequest<'listCustomers'>,
  options?: CallOptions,
): Promise<OperationsResponse<'listCustomers'>> {
  return send('listCustomers', request, options);
}

/** GET /api/v1/ops/customers/:customerTenantId (`ops.operations.customers.get`). */
export function getCustomer(
  request: OperationsRequest<'getCustomer'>,
  options?: CallOptions,
): Promise<OperationsResponse<'getCustomer'>> {
  return send('getCustomer', request, options);
}

/** POST /api/v1/ops/customers (`ops.operations.customers.create`). */
export function createCustomer(
  request: OperationsRequest<'createCustomer'>,
  options?: CallOptions,
): Promise<OperationsResponse<'createCustomer'>> {
  return send('createCustomer', request, options);
}

/** PATCH /api/v1/ops/customers/:customerTenantId (`ops.operations.customers.update`). */
export function updateCustomer(
  request: OperationsRequest<'updateCustomer'>,
  options?: CallOptions,
): Promise<OperationsResponse<'updateCustomer'>> {
  return send('updateCustomer', request, options);
}

/** POST /api/v1/ops/customers/:customerTenantId/status (`ops.operations.customers.changeStatus`). */
export function changeCustomerStatus(
  request: OperationsRequest<'changeCustomerStatus'>,
  options?: CallOptions,
): Promise<OperationsResponse<'changeCustomerStatus'>> {
  return send('changeCustomerStatus', request, options);
}

/** GET /api/v1/ops/customers/:customerTenantId/onboarding (`ops.operations.onboarding.get`). */
export function getOnboarding(
  request: OperationsRequest<'getOnboarding'>,
  options?: CallOptions,
): Promise<OperationsResponse<'getOnboarding'>> {
  return send('getOnboarding', request, options);
}

/** POST /api/v1/ops/customers/:customerTenantId/onboarding/items/:itemId (`ops.operations.onboarding.updateItem`). */
export function updateOnboardingItem(
  request: OperationsRequest<'updateOnboardingItem'>,
  options?: CallOptions,
): Promise<OperationsResponse<'updateOnboardingItem'>> {
  return send('updateOnboardingItem', request, options);
}

/** POST /api/v1/ops/customers/:customerTenantId/onboarding/advance (`ops.operations.onboarding.advance`). */
export function advanceOnboarding(
  request: OperationsRequest<'advanceOnboarding'>,
  options?: CallOptions,
): Promise<OperationsResponse<'advanceOnboarding'>> {
  return send('advanceOnboarding', request, options);
}

/** GET /api/v1/ops/offboarding-plans (`ops.operations.offboarding.list`). */
export function listOffboardingPlans(
  request: OperationsRequest<'listOffboardingPlans'>,
  options?: CallOptions,
): Promise<OperationsResponse<'listOffboardingPlans'>> {
  return send('listOffboardingPlans', request, options);
}

/** GET /api/v1/ops/offboarding-plans/:planId (`ops.operations.offboarding.get`). */
export function getOffboardingPlan(
  request: OperationsRequest<'getOffboardingPlan'>,
  options?: CallOptions,
): Promise<OperationsResponse<'getOffboardingPlan'>> {
  return send('getOffboardingPlan', request, options);
}

/** POST /api/v1/ops/customers/:customerTenantId/offboarding-plan (`ops.operations.offboarding.create`). */
export function createOffboardingPlan(
  request: OperationsRequest<'createOffboardingPlan'>,
  options?: CallOptions,
): Promise<OperationsResponse<'createOffboardingPlan'>> {
  return send('createOffboardingPlan', request, options);
}

/** PATCH /api/v1/ops/offboarding-plans/:planId (`ops.operations.offboarding.update`). */
export function updateOffboardingPlan(
  request: OperationsRequest<'updateOffboardingPlan'>,
  options?: CallOptions,
): Promise<OperationsResponse<'updateOffboardingPlan'>> {
  return send('updateOffboardingPlan', request, options);
}

/** POST /api/v1/ops/offboarding-plans/:planId/transition (`ops.operations.offboarding.transition`). */
export function transitionOffboardingPlan(
  request: OperationsRequest<'transitionOffboardingPlan'>,
  options?: CallOptions,
): Promise<OperationsResponse<'transitionOffboardingPlan'>> {
  return send('transitionOffboardingPlan', request, options);
}

/** GET /api/v1/ops/plans (`ops.operations.plans.list`). */
export function getPlanCatalog(
  request: OperationsRequest<'getPlanCatalog'>,
  options?: CallOptions,
): Promise<OperationsResponse<'getPlanCatalog'>> {
  return send('getPlanCatalog', request, options);
}

/** GET /api/v1/ops/subscriptions (`ops.operations.subscriptions.list`). */
export function listSubscriptions(
  request: OperationsRequest<'listSubscriptions'>,
  options?: CallOptions,
): Promise<OperationsResponse<'listSubscriptions'>> {
  return send('listSubscriptions', request, options);
}

/** GET /api/v1/ops/subscriptions/:subscriptionId (`ops.operations.subscriptions.get`). */
export function getSubscription(
  request: OperationsRequest<'getSubscription'>,
  options?: CallOptions,
): Promise<OperationsResponse<'getSubscription'>> {
  return send('getSubscription', request, options);
}

/** PATCH /api/v1/ops/subscriptions/:subscriptionId (`ops.operations.subscriptions.update`). */
export function updateSubscription(
  request: OperationsRequest<'updateSubscription'>,
  options?: CallOptions,
): Promise<OperationsResponse<'updateSubscription'>> {
  return send('updateSubscription', request, options);
}

/** PUT /api/v1/ops/subscriptions/:subscriptionId/entitlements/:featureCode (`ops.operations.subscriptions.updateEntitlement`). */
export function updateEntitlement(
  request: OperationsRequest<'updateEntitlement'>,
  options?: CallOptions,
): Promise<OperationsResponse<'updateEntitlement'>> {
  return send('updateEntitlement', request, options);
}

/** POST /api/v1/ops/service-actions/:actionId/resolve (`ops.operations.serviceActions.resolve`). */
export function resolveServiceAction(
  request: OperationsRequest<'resolveServiceAction'>,
  options?: CallOptions,
): Promise<OperationsResponse<'resolveServiceAction'>> {
  return send('resolveServiceAction', request, options);
}

/** GET /api/v1/ops/support-cases (`ops.operations.supportCases.list`). */
export function listSupportCases(
  request: OperationsRequest<'listSupportCases'>,
  options?: CallOptions,
): Promise<OperationsResponse<'listSupportCases'>> {
  return send('listSupportCases', request, options);
}

/** GET /api/v1/ops/support-cases/:caseId (`ops.operations.supportCases.get`). */
export function getSupportCase(
  request: OperationsRequest<'getSupportCase'>,
  options?: CallOptions,
): Promise<OperationsResponse<'getSupportCase'>> {
  return send('getSupportCase', request, options);
}

/** POST /api/v1/ops/support-cases (`ops.operations.supportCases.create`). */
export function createSupportCase(
  request: OperationsRequest<'createSupportCase'>,
  options?: CallOptions,
): Promise<OperationsResponse<'createSupportCase'>> {
  return send('createSupportCase', request, options);
}

/** POST /api/v1/ops/support-cases/:caseId/assign (`ops.operations.supportCases.assign`). */
export function assignSupportCase(
  request: OperationsRequest<'assignSupportCase'>,
  options?: CallOptions,
): Promise<OperationsResponse<'assignSupportCase'>> {
  return send('assignSupportCase', request, options);
}

/** POST /api/v1/ops/support-cases/:caseId/status (`ops.operations.supportCases.transition`). */
export function transitionSupportCase(
  request: OperationsRequest<'transitionSupportCase'>,
  options?: CallOptions,
): Promise<OperationsResponse<'transitionSupportCase'>> {
  return send('transitionSupportCase', request, options);
}

/** POST /api/v1/ops/support-cases/:caseId/messages (`ops.operations.supportCases.addMessage`). */
export function addSupportCaseMessage(
  request: OperationsRequest<'addSupportCaseMessage'>,
  options?: CallOptions,
): Promise<OperationsResponse<'addSupportCaseMessage'>> {
  return send('addSupportCaseMessage', request, options);
}

/** POST /api/v1/ops/support-cases/:caseId/route-to-buyer (`ops.operations.supportCases.routeToBuyer`). */
export function routeSupportCaseToBuyer(
  request: OperationsRequest<'routeSupportCaseToBuyer'>,
  options?: CallOptions,
): Promise<OperationsResponse<'routeSupportCaseToBuyer'>> {
  return send('routeSupportCaseToBuyer', request, options);
}

/** POST /api/v1/ops/support-cases/:caseId/access-grants (`ops.operations.supportGrants.request`). */
export function requestSupportGrant(
  request: OperationsRequest<'requestSupportGrant'>,
  options?: CallOptions,
): Promise<OperationsResponse<'requestSupportGrant'>> {
  return send('requestSupportGrant', request, options);
}

/** GET /api/v1/ops/support-access-grants (`ops.operations.supportGrants.list`). */
export function listSupportGrants(
  request: OperationsRequest<'listSupportGrants'>,
  options?: CallOptions,
): Promise<OperationsResponse<'listSupportGrants'>> {
  return send('listSupportGrants', request, options);
}

/** POST /api/v1/ops/support-access-grants/:grantId/end (`ops.operations.supportGrants.end`). */
export function endSupportGrant(
  request: OperationsRequest<'endSupportGrant'>,
  options?: CallOptions,
): Promise<OperationsResponse<'endSupportGrant'>> {
  return send('endSupportGrant', request, options);
}

/** GET /api/v1/buyer/support-access-grants (`buyer.operations.supportAccess.list`). */
export function listCustomerSupportGrants(
  request: OperationsRequest<'listCustomerSupportGrants'>,
  options?: CallOptions,
): Promise<OperationsResponse<'listCustomerSupportGrants'>> {
  return send('listCustomerSupportGrants', request, options);
}

/** GET /api/v1/buyer/support-access-grants/:grantId (`buyer.operations.supportAccess.get`). */
export function getCustomerSupportGrant(
  request: OperationsRequest<'getCustomerSupportGrant'>,
  options?: CallOptions,
): Promise<OperationsResponse<'getCustomerSupportGrant'>> {
  return send('getCustomerSupportGrant', request, options);
}

/** POST /api/v1/buyer/support-access-grants/:grantId/authorize (`buyer.operations.supportAccess.authorize`). */
export function authorizeSupportGrant(
  request: OperationsRequest<'authorizeSupportGrant'>,
  options?: CallOptions,
): Promise<OperationsResponse<'authorizeSupportGrant'>> {
  return send('authorizeSupportGrant', request, options);
}

/** POST /api/v1/buyer/support-access-grants/:grantId/deny (`buyer.operations.supportAccess.deny`). */
export function denySupportGrant(
  request: OperationsRequest<'denySupportGrant'>,
  options?: CallOptions,
): Promise<OperationsResponse<'denySupportGrant'>> {
  return send('denySupportGrant', request, options);
}

/** POST /api/v1/buyer/support-access-grants/:grantId/revoke (`buyer.operations.supportAccess.revoke`). */
export function revokeSupportGrant(
  request: OperationsRequest<'revokeSupportGrant'>,
  options?: CallOptions,
): Promise<OperationsResponse<'revokeSupportGrant'>> {
  return send('revokeSupportGrant', request, options);
}

/** GET /api/v1/me/support-cases (`me.operations.supportCases.list`). */
export function listMySupportCases(
  request: OperationsRequest<'listMySupportCases'>,
  options?: CallOptions,
): Promise<OperationsResponse<'listMySupportCases'>> {
  return send('listMySupportCases', request, options);
}

/** GET /api/v1/me/support-cases/:caseId (`me.operations.supportCases.get`). */
export function getMySupportCase(
  request: OperationsRequest<'getMySupportCase'>,
  options?: CallOptions,
): Promise<OperationsResponse<'getMySupportCase'>> {
  return send('getMySupportCase', request, options);
}

/** POST /api/v1/me/support-cases (`me.operations.supportCases.open`). */
export function openMySupportCase(
  request: OperationsRequest<'openMySupportCase'>,
  options?: CallOptions,
): Promise<OperationsResponse<'openMySupportCase'>> {
  return send('openMySupportCase', request, options);
}

/** POST /api/v1/me/support-cases/:caseId/messages (`me.operations.supportCases.reply`). */
export function replyMySupportCase(
  request: OperationsRequest<'replyMySupportCase'>,
  options?: CallOptions,
): Promise<OperationsResponse<'replyMySupportCase'>> {
  return send('replyMySupportCase', request, options);
}

/** POST /api/v1/me/accommodation-requests (`me.operations.accommodations.request`). */
export function requestAccommodation(
  request: OperationsRequest<'requestAccommodation'>,
  options?: CallOptions,
): Promise<OperationsResponse<'requestAccommodation'>> {
  return send('requestAccommodation', request, options);
}

/** GET /api/v1/ops/incidents (`ops.operations.incidents.list`). */
export function listIncidents(
  request: OperationsRequest<'listIncidents'>,
  options?: CallOptions,
): Promise<OperationsResponse<'listIncidents'>> {
  return send('listIncidents', request, options);
}

/** GET /api/v1/ops/incidents/:incidentId (`ops.operations.incidents.get`). */
export function getIncident(
  request: OperationsRequest<'getIncident'>,
  options?: CallOptions,
): Promise<OperationsResponse<'getIncident'>> {
  return send('getIncident', request, options);
}

/** POST /api/v1/ops/incidents (`ops.operations.incidents.create`). */
export function createIncident(
  request: OperationsRequest<'createIncident'>,
  options?: CallOptions,
): Promise<OperationsResponse<'createIncident'>> {
  return send('createIncident', request, options);
}

/** POST /api/v1/ops/incidents/:incidentId/updates (`ops.operations.incidents.update`). */
export function updateIncident(
  request: OperationsRequest<'updateIncident'>,
  options?: CallOptions,
): Promise<OperationsResponse<'updateIncident'>> {
  return send('updateIncident', request, options);
}

/** POST /api/v1/ops/incidents/:incidentId/impacts (`ops.operations.incidents.addImpact`). */
export function addIncidentImpact(
  request: OperationsRequest<'addIncidentImpact'>,
  options?: CallOptions,
): Promise<OperationsResponse<'addIncidentImpact'>> {
  return send('addIncidentImpact', request, options);
}

/** GET /api/v1/ops/oversight (`ops.operations.oversight.summary`). */
export function getOversightSummary(
  request: OperationsRequest<'getOversightSummary'>,
  options?: CallOptions,
): Promise<OperationsResponse<'getOversightSummary'>> {
  return send('getOversightSummary', request, options);
}

/** GET /api/v1/ops/privileged-access-reviews (`ops.operations.accessReviews.list`). */
export function listAccessReviews(
  request: OperationsRequest<'listAccessReviews'>,
  options?: CallOptions,
): Promise<OperationsResponse<'listAccessReviews'>> {
  return send('listAccessReviews', request, options);
}

/** POST /api/v1/ops/privileged-access-reviews/:reviewId/complete (`ops.operations.accessReviews.complete`). */
export function completeAccessReview(
  request: OperationsRequest<'completeAccessReview'>,
  options?: CallOptions,
): Promise<OperationsResponse<'completeAccessReview'>> {
  return send('completeAccessReview', request, options);
}

/** GET /api/v1/ops/conduct-cases (`ops.operations.conductCases.list`). */
export function listConductCases(
  request: OperationsRequest<'listConductCases'>,
  options?: CallOptions,
): Promise<OperationsResponse<'listConductCases'>> {
  return send('listConductCases', request, options);
}

/** POST /api/v1/ops/conduct-cases/:conductCaseId/review (`ops.operations.conductCases.review`). */
export function reviewConductCase(
  request: OperationsRequest<'reviewConductCase'>,
  options?: CallOptions,
): Promise<OperationsResponse<'reviewConductCase'>> {
  return send('reviewConductCase', request, options);
}

/** GET /api/v1/ops/announcements (`ops.operations.announcements.list`). */
export function listAnnouncements(
  request: OperationsRequest<'listAnnouncements'>,
  options?: CallOptions,
): Promise<OperationsResponse<'listAnnouncements'>> {
  return send('listAnnouncements', request, options);
}

/** GET /api/v1/ops/announcements/:announcementId (`ops.operations.announcements.get`). */
export function getAnnouncement(
  request: OperationsRequest<'getAnnouncement'>,
  options?: CallOptions,
): Promise<OperationsResponse<'getAnnouncement'>> {
  return send('getAnnouncement', request, options);
}

/** POST /api/v1/ops/announcements (`ops.operations.announcements.create`). */
export function createAnnouncement(
  request: OperationsRequest<'createAnnouncement'>,
  options?: CallOptions,
): Promise<OperationsResponse<'createAnnouncement'>> {
  return send('createAnnouncement', request, options);
}

/** PATCH /api/v1/ops/announcements/:announcementId (`ops.operations.announcements.update`). */
export function updateAnnouncement(
  request: OperationsRequest<'updateAnnouncement'>,
  options?: CallOptions,
): Promise<OperationsResponse<'updateAnnouncement'>> {
  return send('updateAnnouncement', request, options);
}

/** POST /api/v1/ops/announcements/:announcementId/publish (`ops.operations.announcements.publish`). */
export function publishAnnouncement(
  request: OperationsRequest<'publishAnnouncement'>,
  options?: CallOptions,
): Promise<OperationsResponse<'publishAnnouncement'>> {
  return send('publishAnnouncement', request, options);
}

/** POST /api/v1/ops/announcements/:announcementId/archive (`ops.operations.announcements.archive`). */
export function archiveAnnouncement(
  request: OperationsRequest<'archiveAnnouncement'>,
  options?: CallOptions,
): Promise<OperationsResponse<'archiveAnnouncement'>> {
  return send('archiveAnnouncement', request, options);
}

/** GET /api/v1/ops/help-articles (`ops.operations.helpArticles.list`). */
export function listHelpArticles(
  request: OperationsRequest<'listHelpArticles'>,
  options?: CallOptions,
): Promise<OperationsResponse<'listHelpArticles'>> {
  return send('listHelpArticles', request, options);
}

/** GET /api/v1/ops/help-articles/:articleId (`ops.operations.helpArticles.get`). */
export function getHelpArticle(
  request: OperationsRequest<'getHelpArticle'>,
  options?: CallOptions,
): Promise<OperationsResponse<'getHelpArticle'>> {
  return send('getHelpArticle', request, options);
}

/** POST /api/v1/ops/help-articles (`ops.operations.helpArticles.create`). */
export function createHelpArticle(
  request: OperationsRequest<'createHelpArticle'>,
  options?: CallOptions,
): Promise<OperationsResponse<'createHelpArticle'>> {
  return send('createHelpArticle', request, options);
}

/** PATCH /api/v1/ops/help-articles/:articleId (`ops.operations.helpArticles.update`). */
export function updateHelpArticle(
  request: OperationsRequest<'updateHelpArticle'>,
  options?: CallOptions,
): Promise<OperationsResponse<'updateHelpArticle'>> {
  return send('updateHelpArticle', request, options);
}

/** POST /api/v1/ops/help-articles/:articleId/publish (`ops.operations.helpArticles.publish`). */
export function publishHelpArticle(
  request: OperationsRequest<'publishHelpArticle'>,
  options?: CallOptions,
): Promise<OperationsResponse<'publishHelpArticle'>> {
  return send('publishHelpArticle', request, options);
}

/** POST /api/v1/ops/help-articles/:articleId/archive (`ops.operations.helpArticles.archive`). */
export function archiveHelpArticle(
  request: OperationsRequest<'archiveHelpArticle'>,
  options?: CallOptions,
): Promise<OperationsResponse<'archiveHelpArticle'>> {
  return send('archiveHelpArticle', request, options);
}

/** GET /api/v1/me/help-articles (`me.operations.help.list`). */
export function listMyHelpArticles(
  request: OperationsRequest<'listMyHelpArticles'>,
  options?: CallOptions,
): Promise<OperationsResponse<'listMyHelpArticles'>> {
  return send('listMyHelpArticles', request, options);
}

/** GET /api/v1/me/help-articles/:articleSlug (`me.operations.help.get`). */
export function getMyHelpArticle(
  request: OperationsRequest<'getMyHelpArticle'>,
  options?: CallOptions,
): Promise<OperationsResponse<'getMyHelpArticle'>> {
  return send('getMyHelpArticle', request, options);
}

/** GET /api/v1/me/help-contacts (`me.operations.help.contacts`). */
export function getMyHelpContacts(
  request: OperationsRequest<'getMyHelpContacts'>,
  options?: CallOptions,
): Promise<OperationsResponse<'getMyHelpContacts'>> {
  return send('getMyHelpContacts', request, options);
}

/** GET /api/v1/me/service-notices (`me.operations.serviceNotices.list`). */
export function listMyServiceNotices(
  request: OperationsRequest<'listMyServiceNotices'>,
  options?: CallOptions,
): Promise<OperationsResponse<'listMyServiceNotices'>> {
  return send('listMyServiceNotices', request, options);
}

/** GET /api/v1/public/service-notices (`public.operations.serviceNotices.list`). */
export function listPublicServiceNotices(
  request: OperationsRequest<'listPublicServiceNotices'>,
  options?: CallOptions,
): Promise<OperationsResponse<'listPublicServiceNotices'>> {
  return send('listPublicServiceNotices', request, options);
}

/** GET /api/v1/public/help-contacts (`public.operations.help.contacts`). */
export function getPublicHelpContacts(
  request: OperationsRequest<'getPublicHelpContacts'>,
  options?: CallOptions,
): Promise<OperationsResponse<'getPublicHelpContacts'>> {
  return send('getPublicHelpContacts', request, options);
}

/** GET /api/v1/buyer/integrations (`buyer.operations.integrations.list`). */
export function listIntegrations(
  request: OperationsRequest<'listIntegrations'>,
  options?: CallOptions,
): Promise<OperationsResponse<'listIntegrations'>> {
  return send('listIntegrations', request, options);
}

/** GET /api/v1/buyer/integrations/:connectionId (`buyer.operations.integrations.get`). */
export function getIntegration(
  request: OperationsRequest<'getIntegration'>,
  options?: CallOptions,
): Promise<OperationsResponse<'getIntegration'>> {
  return send('getIntegration', request, options);
}

/** POST /api/v1/buyer/integrations (`buyer.operations.integrations.create`). */
export function createIntegration(
  request: OperationsRequest<'createIntegration'>,
  options?: CallOptions,
): Promise<OperationsResponse<'createIntegration'>> {
  return send('createIntegration', request, options);
}

/** PATCH /api/v1/buyer/integrations/:connectionId (`buyer.operations.integrations.update`). */
export function updateIntegration(
  request: OperationsRequest<'updateIntegration'>,
  options?: CallOptions,
): Promise<OperationsResponse<'updateIntegration'>> {
  return send('updateIntegration', request, options);
}

/** POST /api/v1/buyer/integrations/:connectionId/status (`buyer.operations.integrations.changeStatus`). */
export function changeIntegrationStatus(
  request: OperationsRequest<'changeIntegrationStatus'>,
  options?: CallOptions,
): Promise<OperationsResponse<'changeIntegrationStatus'>> {
  return send('changeIntegrationStatus', request, options);
}

/** POST /api/v1/buyer/integrations/:connectionId/confirm (`buyer.operations.integrations.confirm`). */
export function confirmIntegration(
  request: OperationsRequest<'confirmIntegration'>,
  options?: CallOptions,
): Promise<OperationsResponse<'confirmIntegration'>> {
  return send('confirmIntegration', request, options);
}

/** GET /api/v1/buyer/integration-exceptions (`buyer.operations.integrationExceptions.list`). */
export function listIntegrationExceptions(
  request: OperationsRequest<'listIntegrationExceptions'>,
  options?: CallOptions,
): Promise<OperationsResponse<'listIntegrationExceptions'>> {
  return send('listIntegrationExceptions', request, options);
}

/** GET /api/v1/buyer/integration-exceptions/:exceptionId (`buyer.operations.integrationExceptions.get`). */
export function getIntegrationException(
  request: OperationsRequest<'getIntegrationException'>,
  options?: CallOptions,
): Promise<OperationsResponse<'getIntegrationException'>> {
  return send('getIntegrationException', request, options);
}

/** POST /api/v1/buyer/integration-exceptions/:exceptionId/assign (`buyer.operations.integrationExceptions.assign`). */
export function assignIntegrationException(
  request: OperationsRequest<'assignIntegrationException'>,
  options?: CallOptions,
): Promise<OperationsResponse<'assignIntegrationException'>> {
  return send('assignIntegrationException', request, options);
}

/** POST /api/v1/buyer/integration-exceptions/:exceptionId/investigate (`buyer.operations.integrationExceptions.investigate`). */
export function investigateIntegrationException(
  request: OperationsRequest<'investigateIntegrationException'>,
  options?: CallOptions,
): Promise<OperationsResponse<'investigateIntegrationException'>> {
  return send('investigateIntegrationException', request, options);
}

/** POST /api/v1/buyer/integration-exceptions/:exceptionId/resolve (`buyer.operations.integrationExceptions.resolve`). */
export function resolveIntegrationException(
  request: OperationsRequest<'resolveIntegrationException'>,
  options?: CallOptions,
): Promise<OperationsResponse<'resolveIntegrationException'>> {
  return send('resolveIntegrationException', request, options);
}

/** GET /api/v1/buyer/imports (`buyer.operations.imports.list`). */
export function listImportBatches(
  request: OperationsRequest<'listImportBatches'>,
  options?: CallOptions,
): Promise<OperationsResponse<'listImportBatches'>> {
  return send('listImportBatches', request, options);
}

/** GET /api/v1/buyer/imports/:batchId (`buyer.operations.imports.get`). */
export function getImportBatch(
  request: OperationsRequest<'getImportBatch'>,
  options?: CallOptions,
): Promise<OperationsResponse<'getImportBatch'>> {
  return send('getImportBatch', request, options);
}

/** GET /api/v1/buyer/imports/:batchId/records (`buyer.operations.imports.records`). */
export function listImportRecords(
  request: OperationsRequest<'listImportRecords'>,
  options?: CallOptions,
): Promise<OperationsResponse<'listImportRecords'>> {
  return send('listImportRecords', request, options);
}

/** POST /api/v1/buyer/imports (`buyer.operations.imports.create`). */
export function createImportBatch(
  request: OperationsRequest<'createImportBatch'>,
  options?: CallOptions,
): Promise<OperationsResponse<'createImportBatch'>> {
  return send('createImportBatch', request, options);
}

/** POST /api/v1/buyer/imports/:batchId/records/:recordId/decide (`buyer.operations.imports.decideRecord`). */
export function decideImportRecord(
  request: OperationsRequest<'decideImportRecord'>,
  options?: CallOptions,
): Promise<OperationsResponse<'decideImportRecord'>> {
  return send('decideImportRecord', request, options);
}

/** POST /api/v1/buyer/imports/:batchId/complete (`buyer.operations.imports.complete`). */
export function completeImportBatch(
  request: OperationsRequest<'completeImportBatch'>,
  options?: CallOptions,
): Promise<OperationsResponse<'completeImportBatch'>> {
  return send('completeImportBatch', request, options);
}

/** GET /api/v1/buyer/subscription (`buyer.operations.subscription.get`). */
export function getBuyerSubscription(
  request: OperationsRequest<'getBuyerSubscription'>,
  options?: CallOptions,
): Promise<OperationsResponse<'getBuyerSubscription'>> {
  return send('getBuyerSubscription', request, options);
}

/** POST /api/v1/buyer/subscription/offboarding-request (`buyer.operations.subscription.requestOffboarding`). */
export function requestOffboarding(
  request: OperationsRequest<'requestOffboarding'>,
  options?: CallOptions,
): Promise<OperationsResponse<'requestOffboarding'>> {
  return send('requestOffboarding', request, options);
}

/** POST /api/v1/buyer/subscription/offboarding-plan/agree (`buyer.operations.subscription.agreePlan`). */
export function agreeOffboardingPlan(
  request: OperationsRequest<'agreeOffboardingPlan'>,
  options?: CallOptions,
): Promise<OperationsResponse<'agreeOffboardingPlan'>> {
  return send('agreeOffboardingPlan', request, options);
}

/** POST /api/v1/buyer/subscription/exit-exports (`buyer.operations.subscription.requestExport`). */
export function requestExitExport(
  request: OperationsRequest<'requestExitExport'>,
  options?: CallOptions,
): Promise<OperationsResponse<'requestExitExport'>> {
  return send('requestExitExport', request, options);
}

/** GET /api/v1/ops/staff (`ops.operations.staff.list`). */
export function listOperatorStaff(
  request: OperationsRequest<'listOperatorStaff'>,
  options?: CallOptions,
): Promise<OperationsResponse<'listOperatorStaff'>> {
  return send('listOperatorStaff', request, options);
}

/** GET /api/v1/buyer/operations-people (`buyer.operations.people.list`). */
export function listOperationsPeople(
  request: OperationsRequest<'listOperationsPeople'>,
  options?: CallOptions,
): Promise<OperationsResponse<'listOperationsPeople'>> {
  return send('listOperationsPeople', request, options);
}
