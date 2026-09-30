/**
 * Suppliers client (the `suppliers` contract, domain 03): thin typed wrappers over `call()` for code outside the
 * query hooks (hooks take the contract endpoint objects directly: `useApiQuery(suppliersEndpoints.listDirectory, …)`).
 *
 * SUP-02 public registration and membership requests, SUP-03 profile and identity changes, SUP-05 evidence library,
 * BUY-31/BUY-32 directory and relationship record, and the operator duplicate, registration and identity reviews.
 */
import { suppliersEndpoints as api } from '@contracts/suppliers';
import type { EndpointBody, EndpointQuery, EndpointResponse } from '@contracts/endpoint';

import { call } from './client';
import type { CallOptions } from './client';

type Api = typeof api;
type Query<K extends keyof Api> = EndpointQuery<Api[K]>;
type Body<K extends keyof Api> = EndpointBody<Api[K]>;
type Result<K extends keyof Api> = Promise<EndpointResponse<Api[K]>>;

// SUP-02: public registration --------------------------------------------------------------------------------

export function fetchCategoryOptions(): Result<'categoryOptions'> {
  return call(api.categoryOptions, {});
}

export function fetchReferenceOptions(): Result<'referenceOptions'> {
  return call(api.referenceOptions, {});
}

export function checkDuplicate(body: Body<'duplicateCheck'>): Result<'duplicateCheck'> {
  return call(api.duplicateCheck, { body });
}

export function registerSupplier(
  body: Body<'register'>,
  options?: CallOptions,
): Result<'register'> {
  return call(api.register, { body }, options);
}

export function resendVerification(body: Body<'resendVerification'>): Result<'resendVerification'> {
  return call(api.resendVerification, { body });
}

export function requestMembershipPublic(
  body: Body<'requestMembershipPublic'>,
  options?: CallOptions,
): Result<'requestMembershipPublic'> {
  return call(api.requestMembershipPublic, { body }, options);
}

// SUP-02: claiming a buyer-created provisional organization --------------------------------------------------

export function fetchClaimInvitation(token: string): Result<'getClaimInvitation'> {
  return call(api.getClaimInvitation, { params: { token } });
}

export function claimOrganization(
  token: string,
  body: Body<'claimOrganization'>,
  options?: CallOptions,
): Result<'claimOrganization'> {
  return call(api.claimOrganization, { params: { token }, body }, options);
}

// SUP-02 / COM-02: the caller's own membership requests ------------------------------------------------------

export function fetchMyMembershipRequests(
  query: Query<'myMembershipRequests'> = {},
): Result<'myMembershipRequests'> {
  return call(api.myMembershipRequests, { query });
}

export function createMyMembershipRequest(
  body: Body<'createMyMembershipRequest'>,
  options?: CallOptions,
): Result<'createMyMembershipRequest'> {
  return call(api.createMyMembershipRequest, { body }, options);
}

export function withdrawMyMembershipRequest(
  requestId: number,
): Result<'withdrawMyMembershipRequest'> {
  return call(api.withdrawMyMembershipRequest, { params: { requestId } });
}

// SUP-03: profile and identity changes -----------------------------------------------------------------------

export function fetchSupplierProfile(): Result<'getProfile'> {
  return call(api.getProfile, {});
}

export function respondVerificationRequest(
  requestId: number,
  body: Body<'respondVerificationRequest'>,
): Result<'respondVerificationRequest'> {
  return call(api.respondVerificationRequest, { params: { requestId }, body });
}

export function updateSupplierProfile(body: Body<'updateProfile'>): Result<'updateProfile'> {
  return call(api.updateProfile, { body });
}

export function fetchIdentityChanges(
  query: Query<'listIdentityChanges'> = {},
): Result<'listIdentityChanges'> {
  return call(api.listIdentityChanges, { query });
}

export function fetchIdentityChange(changeId: number): Result<'getIdentityChange'> {
  return call(api.getIdentityChange, { params: { changeId } });
}

export function createIdentityChange(
  body: Body<'createIdentityChange'>,
  options?: CallOptions,
): Result<'createIdentityChange'> {
  return call(api.createIdentityChange, { body }, options);
}

// SUP-04 / SUP-02: membership requests seen by the supplier administrator ------------------------------------

export function fetchMembershipRequests(
  query: Query<'listMembershipRequests'> = {},
): Result<'listMembershipRequests'> {
  return call(api.listMembershipRequests, { query });
}

export function decideMembershipRequest(
  requestId: number,
  body: Body<'decideMembershipRequest'>,
): Result<'decideMembershipRequest'> {
  return call(api.decideMembershipRequest, { params: { requestId }, body });
}

// SUP-05: evidence library -----------------------------------------------------------------------------------

export function fetchEvidence(query: Query<'listEvidence'> = {}): Result<'listEvidence'> {
  return call(api.listEvidence, { query });
}

export function fetchEvidenceItem(evidenceId: number): Result<'getEvidence'> {
  return call(api.getEvidence, { params: { evidenceId } });
}

export function createEvidence(
  body: Body<'createEvidence'>,
  options?: CallOptions,
): Result<'createEvidence'> {
  return call(api.createEvidence, { body }, options);
}

export function replaceEvidence(
  evidenceId: number,
  body: Body<'replaceEvidence'>,
  options?: CallOptions,
): Result<'replaceEvidence'> {
  return call(api.replaceEvidence, { params: { evidenceId }, body }, options);
}

export function renewEvidence(
  evidenceId: number,
  body: Body<'renewEvidence'>,
  options?: CallOptions,
): Result<'renewEvidence'> {
  return call(api.renewEvidence, { params: { evidenceId }, body }, options);
}

export function withdrawEvidence(
  evidenceId: number,
  body: Body<'withdrawEvidence'>,
): Result<'withdrawEvidence'> {
  return call(api.withdrawEvidence, { params: { evidenceId }, body });
}

export function shareEvidence(
  evidenceId: number,
  body: Body<'shareEvidence'>,
  options?: CallOptions,
): Result<'shareEvidence'> {
  return call(api.shareEvidence, { params: { evidenceId }, body }, options);
}

export function withdrawEvidenceShare(
  evidenceId: number,
  shareId: number,
  body: Body<'withdrawShare'> = {},
): Result<'withdrawShare'> {
  return call(api.withdrawShare, { params: { evidenceId, shareId }, body });
}

export function fetchSharingBuyers(): Result<'sharingBuyers'> {
  return call(api.sharingBuyers, {});
}

// BUY-31 / BUY-32: directory and relationship record ---------------------------------------------------------

export function fetchSupplierDirectory(
  query: Query<'listDirectory'> = {},
): Result<'listDirectory'> {
  return call(api.listDirectory, { query });
}

export function fetchRelationshipRecord(supplierTenantId: number): Result<'getRelationshipRecord'> {
  return call(api.getRelationshipRecord, { params: { supplierTenantId } });
}

export function updateRelationship(
  supplierTenantId: number,
  body: Body<'updateRelationship'>,
): Result<'updateRelationship'> {
  return call(api.updateRelationship, { params: { supplierTenantId }, body });
}

export function createRelationshipContact(
  supplierTenantId: number,
  body: Body<'createContact'>,
  options?: CallOptions,
): Result<'createContact'> {
  return call(api.createContact, { params: { supplierTenantId }, body }, options);
}

export function updateRelationshipContact(
  supplierTenantId: number,
  contactId: number,
  body: Body<'updateContact'>,
): Result<'updateContact'> {
  return call(api.updateContact, { params: { supplierTenantId, contactId }, body });
}

export function createProvisionalSupplier(
  body: Body<'createProvisionalSupplier'>,
  options?: CallOptions,
): Result<'createProvisionalSupplier'> {
  return call(api.createProvisionalSupplier, { body }, options);
}

export function requestQualification(
  supplierTenantId: number,
  body: Body<'requestQualification'>,
  options?: CallOptions,
): Result<'requestQualification'> {
  return call(api.requestQualification, { params: { supplierTenantId }, body }, options);
}

export function flagDuplicateSupplier(
  supplierTenantId: number,
  body: Body<'flagDuplicate'>,
  options?: CallOptions,
): Result<'flagDuplicate'> {
  return call(api.flagDuplicate, { params: { supplierTenantId }, body }, options);
}

// Operator reviews (OPS-01) ----------------------------------------------------------------------------------

export function fetchDuplicateCandidates(
  query: Query<'listDuplicates'> = {},
): Result<'listDuplicates'> {
  return call(api.listDuplicates, { query });
}

export function fetchDuplicateCandidate(candidateId: number): Result<'getDuplicate'> {
  return call(api.getDuplicate, { params: { candidateId } });
}

export function decideDuplicateCandidate(
  candidateId: number,
  body: Body<'decideDuplicate'>,
): Result<'decideDuplicate'> {
  return call(api.decideDuplicate, { params: { candidateId }, body });
}

export function fetchSupplierRegistrations(
  query: Query<'listRegistrations'> = {},
): Result<'listRegistrations'> {
  return call(api.listRegistrations, { query });
}

export function closeSupplierRegistration(
  supplierTenantId: number,
  body: Body<'closeRegistration'>,
): Result<'closeRegistration'> {
  return call(api.closeRegistration, { params: { supplierTenantId }, body });
}

export function verifySupplierIdentity(
  supplierTenantId: number,
  body: Body<'verifyIdentity'>,
): Result<'verifyIdentity'> {
  return call(api.verifyIdentity, { params: { supplierTenantId }, body });
}

export function requestVerificationEvidence(
  supplierTenantId: number,
  body: Body<'requestVerificationEvidence'>,
): Result<'requestVerificationEvidence'> {
  return call(api.requestVerificationEvidence, { params: { supplierTenantId }, body });
}

export function fetchOpsIdentityChanges(
  query: Query<'listOpsIdentityChanges'> = {},
): Result<'listOpsIdentityChanges'> {
  return call(api.listOpsIdentityChanges, { query });
}

export function fetchOpsIdentityChange(changeId: number): Result<'getOpsIdentityChange'> {
  return call(api.getOpsIdentityChange, { params: { changeId } });
}

export function startIdentityChangeReview(changeId: number): Result<'startIdentityReview'> {
  return call(api.startIdentityReview, { params: { changeId } });
}

export function decideIdentityChange(
  changeId: number,
  body: Body<'decideIdentityChange'>,
): Result<'decideIdentityChange'> {
  return call(api.decideIdentityChange, { params: { changeId }, body });
}
