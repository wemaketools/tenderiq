/**
 * URLs of the supplier organization screens (SUP-02 public registration, the requester's membership requests,
 * SUP-03 profile and identity changes, SUP-05 evidence library). Routes and links are built from here so they agree.
 */
export const SUPPLIER_ORG_ROOT = '/supplier/organization';
export const EVIDENCE_ROOT = '/supplier/evidence';

export const supplierOrgPaths = {
  register: '/register',
  /** The claim page of a buyer-created provisional organization (the link in the invitation e-mail). */
  claim: (token: string): string => `/register/claim/${token}`,
  signIn: '/signin',
  myMembershipRequests: '/me/membership-requests',
  profile: SUPPLIER_ORG_ROOT,
  editProfile: `${SUPPLIER_ORG_ROOT}/edit`,
  newIdentityChange: `${SUPPLIER_ORG_ROOT}/identity-changes/new`,
  identityChange: (changeId: number): string => `${SUPPLIER_ORG_ROOT}/identity-changes/${changeId}`,
  evidence: EVIDENCE_ROOT,
  newEvidence: `${EVIDENCE_ROOT}/new`,
  evidenceItem: (evidenceId: number): string => `${EVIDENCE_ROOT}/${evidenceId}`,
  /** The workspace document page (versions and downloads, owned by the workspace feature). */
  document: (documentId: number): string => `/me/documents/${documentId}`,
} as const;

/** Route patterns relative to each area root (routes.tsx). */
export const supplierOrgRoutes = {
  register: 'register',
  claim: 'register/claim/:token',
  myMembershipRequests: 'membership-requests',
  profile: 'organization',
  editProfile: 'organization/edit',
  newIdentityChange: 'organization/identity-changes/new',
  identityChange: 'organization/identity-changes/:changeId',
  evidence: 'evidence',
  newEvidence: 'evidence/new',
  evidenceItem: 'evidence/:evidenceId',
} as const;
