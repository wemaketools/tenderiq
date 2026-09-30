/**
 * Suppliers fixtures: every row projects into a contract-valid shape for every audience, and the static data is
 * internally consistent (references resolve, edition chains are symmetric, shares and submissions point at the
 * right libraries, and the storyline anchors hold).
 */
import { describe, expect, it } from 'vitest';

import {
  CategoryOption,
  DirectoryRow,
  DuplicateCandidate,
  EvidenceDetail,
  IdentityChange,
  OpsRegistrationRow,
  RelationshipContact,
  SupplierProfile,
  SharedEvidenceRow,
  VerificationRequest,
} from '../../../contracts/suppliers.js';
import { PERSONAS, TENANTS, TENANT_IDS } from '../platform.js';
import {
  directoryOrgs,
  directoryRowView,
  duplicateView,
  evidenceDetailView,
  identityChangeView,
  profileView,
  registrationQueue,
  registrationView,
  sharedEvidenceView,
  sharedItemsFor,
  verificationRequestView,
} from '../../handlers/suppliers/views.js';
import {
  CATEGORY_CATALOG,
  CLAIM_INVITATIONS,
  DUPLICATE_CANDIDATES,
  EVIDENCE_ITEMS,
  EVIDENCE_SHARES,
  EVIDENCE_SUBMISSIONS,
  EXTERNAL_PEOPLE,
  IDENTITY_CHANGES,
  MATCH_TOKENS,
  MEMBERSHIP_REQUESTS,
  QUALIFICATION_PROGRAMS,
  QUALIFICATION_STANDINGS,
  RELATIONSHIPS,
  RELATIONSHIP_CONTACTS,
  RELATIONSHIP_EVENTS,
  SUPPLIER_MERGES,
  SUPPLIER_ORGS,
  VERIFICATION_REQUESTS,
  findCategory,
  findSupplierOrg,
} from './index.js';

const NOW = new Date('2026-10-01T08:00:00Z');
const BUYERS = [TENANT_IDS.kwu, TENANT_IDS.odc];
const knownUser = (userId: number): boolean =>
  PERSONAS.some((persona) => persona.userId === userId) || EXTERNAL_PEOPLE.some((person) => person.userId === userId);

describe('suppliers fixtures parse against the contract', () => {
  it('parses every catalog category and resolves every parent code', () => {
    for (const category of CATEGORY_CATALOG) {
      expect(() => CategoryOption.parse(category)).not.toThrow();
      if (category.parentCode !== null) {
        expect(findCategory(category.parentCode)).toBeDefined();
      }
    }
  });

  it('projects every platform supplier organization into a valid SupplierProfile', () => {
    const platformSuppliers = TENANTS.filter((tenant) => tenant.kind === 'supplier');
    expect(platformSuppliers).toHaveLength(6);
    for (const tenant of platformSuppliers) {
      const org = findSupplierOrg(tenant.id);
      expect(org, tenant.slug).toBeDefined();
      if (org !== undefined) {
        const profile = SupplierProfile.parse(profileView(org));
        expect(profile.bankingCollected).toBe(false);
        expect(profile.legalName).toBe(tenant.legalName);
      }
    }
  });

  it('projects every evidence item into a valid EvidenceDetail', () => {
    for (const item of EVIDENCE_ITEMS) {
      expect(() => EvidenceDetail.parse(evidenceDetailView(item, NOW)), `item ${item.id}`).not.toThrow();
    }
  });

  it('projects every directory row, shared evidence row and contact for both buyers', () => {
    for (const buyerId of BUYERS) {
      for (const org of directoryOrgs(buyerId)) {
        expect(() => DirectoryRow.parse(directoryRowView(buyerId, org, NOW)), `${buyerId}/${org.slug}`).not.toThrow();
        for (const { item, share } of sharedItemsFor(buyerId, org.tenantId)) {
          expect(() => SharedEvidenceRow.parse(sharedEvidenceView(item, share, [], NOW))).not.toThrow();
        }
      }
    }
    for (const contact of RELATIONSHIP_CONTACTS) {
      expect(() => RelationshipContact.parse(contact)).not.toThrow();
    }
  });

  it('projects every identity change, duplicate candidate and registration row', () => {
    for (const change of IDENTITY_CHANGES) {
      expect(() => IdentityChange.parse(identityChangeView(change))).not.toThrow();
    }
    for (const candidate of DUPLICATE_CANDIDATES) {
      expect(() => DuplicateCandidate.parse(duplicateView(candidate))).not.toThrow();
    }
    const queue = registrationQueue();
    expect(queue.length).toBeGreaterThanOrEqual(4);
    for (const org of queue) {
      expect(() => OpsRegistrationRow.parse(registrationView(org))).not.toThrow();
    }
  });
});

describe('suppliers fixtures are internally consistent', () => {
  it('uses unique ids and known categories, people and tenants', () => {
    const orgIds = SUPPLIER_ORGS.map((org) => org.tenantId);
    expect(new Set(orgIds).size).toBe(orgIds.length);
    expect(new Set(EVIDENCE_ITEMS.map((item) => item.id)).size).toBe(EVIDENCE_ITEMS.length);
    for (const org of SUPPLIER_ORGS) {
      for (const code of org.categories) {
        expect(findCategory(code), `${org.slug}:${code}`).toBeDefined();
      }
      if (org.profile.primaryContactUserId !== null) {
        expect(knownUser(org.profile.primaryContactUserId)).toBe(true);
      }
      if (org.registration !== null) {
        expect(knownUser(org.registration.registrantUserId)).toBe(true);
      }
      const platform = TENANTS.find((tenant) => tenant.id === org.tenantId);
      if (platform === undefined) {
        expect(org.tenantId).toBeGreaterThanOrEqual(50);
      } else {
        expect(platform.kind).toBe('supplier');
      }
    }
    for (const item of EVIDENCE_ITEMS) {
      expect(knownUser(item.createdByUserId)).toBe(true);
      expect(findSupplierOrg(item.tenantId)).toBeDefined();
    }
  });

  it('links every evidence edition chain in both directions', () => {
    for (const item of EVIDENCE_ITEMS) {
      if (item.replacedById !== null) {
        const next = EVIDENCE_ITEMS.find((candidate) => candidate.id === item.replacedById);
        expect(next?.replacesId).toBe(item.id);
        expect(next?.tenantId).toBe(item.tenantId);
        expect(next?.editionNo).toBe(item.editionNo + 1);
        expect(item.status).toBe('replaced');
      }
      if (item.replacesId !== null) {
        expect(EVIDENCE_ITEMS.find((candidate) => candidate.id === item.replacesId)?.replacedById).toBe(item.id);
      }
    }
  });

  it('shares and submits only items of the supplier’s own library, to buyers', () => {
    for (const share of EVIDENCE_SHARES) {
      const item = EVIDENCE_ITEMS.find((candidate) => candidate.id === share.evidenceItemId);
      expect(item?.tenantId).toBe(share.tenantId);
      expect(BUYERS).toContain(share.buyerTenantId);
      if (item?.status === 'replaced' || item?.status === 'withdrawn') {
        expect(share.withdrawnAt, `share ${share.id}`).not.toBeNull();
      }
    }
    for (const submission of EVIDENCE_SUBMISSIONS) {
      const item = EVIDENCE_ITEMS.find((candidate) => candidate.id === submission.evidenceItemId);
      expect(item?.tenantId).toBe(submission.supplierTenantId);
      expect(BUYERS).toContain(submission.tenantId);
      expect(submission.submittedAt >= (item?.createdAt ?? '')).toBe(true);
    }
  });

  it('keeps relationships, contacts, events and standings on known buyers and suppliers', () => {
    for (const row of RELATIONSHIPS) {
      expect(BUYERS).toContain(row.tenantId);
      expect(directoryOrgs(row.tenantId).some((org) => org.tenantId === row.supplierTenantId), `relationship ${row.id}`).toBe(true);
      if (row.ownerUserId !== null) {
        const owner = PERSONAS.find((persona) => persona.userId === row.ownerUserId);
        expect(owner?.memberships.some((membership) => membership.tenantId === row.tenantId)).toBe(true);
      }
      if (row.status === 'restricted' || row.status === 'suspended') {
        expect(row.restrictionNote).not.toBeNull();
      }
    }
    const pairs = RELATIONSHIPS.map((row) => `${row.tenantId}:${row.supplierTenantId}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    for (const contact of RELATIONSHIP_CONTACTS) {
      expect(RELATIONSHIPS.find((row) => row.id === contact.relationshipId)?.tenantId).toBe(contact.tenantId);
    }
    for (const event of RELATIONSHIP_EVENTS) {
      expect(pairs).toContain(`${event.tenantId}:${event.supplierTenantId}`);
    }
    for (const standing of QUALIFICATION_STANDINGS) {
      expect(QUALIFICATION_PROGRAMS.some((program) => program.programId === standing.programId && program.tenantId === standing.tenantId)).toBe(true);
    }
  });

  it('keeps reviews on known organizations and people', () => {
    for (const change of IDENTITY_CHANGES) {
      expect(findSupplierOrg(change.tenantId)).toBeDefined();
      expect(knownUser(change.submittedByUserId)).toBe(true);
    }
    for (const request of MEMBERSHIP_REQUESTS) {
      expect(findSupplierOrg(request.tenantId)).toBeDefined();
      expect(knownUser(request.userId)).toBe(true);
    }
    for (const candidate of DUPLICATE_CANDIDATES) {
      expect(findSupplierOrg(candidate.tenantAId)).toBeDefined();
      expect(findSupplierOrg(candidate.tenantBId)).toBeDefined();
    }
    for (const merge of SUPPLIER_MERGES) {
      expect(DUPLICATE_CANDIDATES.find((candidate) => candidate.id === merge.candidateId)?.status).toBe('merged');
      expect(findSupplierOrg(merge.mergedTenantId)?.status).toBe('closed');
    }
    expect(new Set(MATCH_TOKENS.map((entry) => entry.token)).size).toBe(MATCH_TOKENS.length);
  });

  it('holds the storyline anchors (AC-07, AC-08, AC-09, AC-17)', () => {
    const chobeInsurance = EVIDENCE_ITEMS.find((item) => item.id === 504);
    expect(chobeInsurance).toMatchObject({ tenantId: TENANT_IDS['chobe-pipe'], evidenceType: 'insurance', expiresAt: '2026-10-08', status: 'current' });
    const makgadikgadi = QUALIFICATION_STANDINGS.find(
      (standing) => standing.tenantId === TENANT_IDS.kwu && standing.supplierTenantId === TENANT_IDS.makgadikgadi,
    );
    expect(makgadikgadi).toMatchObject({ effectiveStatus: 'not_assessed', applicationInProgress: 'QA-2026-0006' });
    expect(findSupplierOrg(TENANT_IDS.makgadikgadi)).toMatchObject({ status: 'active', verificationStatus: 'contact_verified' });
    expect(EVIDENCE_ITEMS.some((item) => item.tenantId === TENANT_IDS.makgadikgadi && item.title.includes('ISO 9001'))).toBe(false);
    expect(EVIDENCE_ITEMS.find((item) => item.id === 602)).toMatchObject({ verificationStatus: 'supplier_provided', sensitivity: 'financial', isConsolidated: true });
    expect(EVIDENCE_ITEMS.find((item) => item.id === 803)).toMatchObject({ tenantId: TENANT_IDS['limpopo-env'], status: 'expired', expiresAt: '2026-09-05' });
  });

  it('gives every financial statement the financial sensitivity and every registration certificate the profile number', () => {
    for (const item of EVIDENCE_ITEMS) {
      if (item.evidenceType === 'financial_statement') {
        expect(item.sensitivity, `item ${item.id}`).toBe('financial');
      }
      if (item.evidenceType === 'registration' && item.title === 'Certificate of incorporation') {
        expect(item.referenceNumber, `item ${item.id}`).toBe(findSupplierOrg(item.tenantId)?.registrationNumber);
      }
    }
  });

  it('keeps every edition created before it is replaced, shared or formally submitted', () => {
    for (const item of EVIDENCE_ITEMS) {
      if (item.replacedById !== null) {
        const next = EVIDENCE_ITEMS.find((candidate) => candidate.id === item.replacedById);
        expect(item.createdAt < (next?.createdAt ?? ''), `item ${item.id}`).toBe(true);
        expect(item.updatedAt).toBe(next?.createdAt);
      }
    }
    for (const share of EVIDENCE_SHARES) {
      const item = EVIDENCE_ITEMS.find((candidate) => candidate.id === share.evidenceItemId);
      expect(share.sharedAt >= (item?.createdAt ?? '9999'), `share ${share.id}`).toBe(true);
      if (share.withdrawnAt !== null) {
        expect(share.withdrawnAt >= share.sharedAt).toBe(true);
      }
    }
    expect(new Set(EVIDENCE_SUBMISSIONS.map((submission) => submission.id)).size).toBe(EVIDENCE_SUBMISSIONS.length);
    expect(new Set(EVIDENCE_SHARES.map((share) => share.id)).size).toBe(EVIDENCE_SHARES.length);
  });

  it('keeps a withdrawn share while the earlier submissions to that buyer remain', () => {
    const withdrawn = EVIDENCE_SHARES.find((share) => share.evidenceItemId === 408 && share.buyerTenantId === TENANT_IDS.kwu);
    expect(withdrawn?.withdrawnAt).toBe('2026-08-01T07:40:00Z');
    const submitted = EVIDENCE_SUBMISSIONS.filter((submission) => submission.evidenceItemId === 408 && submission.tenantId === TENANT_IDS.kwu);
    expect(submitted.map((submission) => submission.contextReference).sort()).toEqual(['QA-2026-0002', 'QA-2026-0004']);
  });

  it('gives each provisional supplier one claim invitation from the buyer that created it', () => {
    for (const org of SUPPLIER_ORGS.filter((candidate) => candidate.isProvisional)) {
      const invitations = CLAIM_INVITATIONS.filter((invitation) => invitation.supplierTenantId === org.tenantId);
      expect(invitations, org.slug).toHaveLength(1);
      expect(invitations[0]?.buyerTenantId).toBe(org.createdByTenantId);
      expect(knownUser(invitations[0]?.contactUserId ?? 0)).toBe(true);
      expect(invitations[0]?.contactUserId).toBe(org.registration?.registrantUserId);
    }
    expect(new Set(CLAIM_INVITATIONS.map((invitation) => invitation.token)).size).toBe(CLAIM_INVITATIONS.length);
    expect(CLAIM_INVITATIONS.every((invitation) => /^clm_[A-Za-z0-9]{8,64}$/.test(invitation.token))).toBe(true);
  });

  it('asks only unverified organizations for missing evidence and answers with their own current items', () => {
    for (const request of VERIFICATION_REQUESTS) {
      const org = findSupplierOrg(request.supplierTenantId);
      expect(org).toBeDefined();
      if (request.status === 'open') {
        expect(org?.verificationStatus, `request ${request.id}`).not.toBe('identity_verified');
        expect(request.response).toBeNull();
      } else {
        expect(request.response).not.toBeNull();
        for (const id of request.response?.evidenceItemIds ?? []) {
          expect(EVIDENCE_ITEMS.find((item) => item.id === id)?.tenantId).toBe(request.supplierTenantId);
        }
      }
      expect(() => VerificationRequest.parse(verificationRequestView(request))).not.toThrow();
    }
    expect(VERIFICATION_REQUESTS.some((request) => request.supplierTenantId === TENANT_IDS.makgadikgadi && request.status === 'open')).toBe(true);
  });
});
