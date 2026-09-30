/**
 * Projections of the suppliers fixtures into contract shapes, one per audience:
 * - supplier views read only the supplier's own tenant rows ([S] and supplier-owned tables);
 * - buyer views read only the buyer's own [R] rows plus evidence shared with that buyer (BR-45, DD-03);
 * - operator views carry identity metadata only, never procurement content.
 */
import type { PermissionCode } from '../../../contracts/permissions.js';
import type {
  DirectoryRow,
  DuplicateCandidate,
  EvidenceDetail,
  EvidenceFreshnessSummary,
  EvidenceItem,
  EvidenceShare,
  EvidenceSubmission,
  IdentityChange,
  OpsRegistrationRow,
  OpsSupplierSummary,
  QualificationScope,
  Relationship,
  RelationshipContact,
  SharedEvidenceRow,
  SupplierProfile,
  VerificationRequest,
} from '../../../contracts/suppliers.js';
import { BANKING_NOT_COLLECTED_NOTICE } from '../../../contracts/suppliers.js';
import { findCategory } from '../../fixtures/suppliers/catalog.js';
import {
  DUPLICATE_CANDIDATES,
  EVIDENCE_ITEMS,
  EVIDENCE_SHARES,
  EVIDENCE_SUBMISSIONS,
  IDENTITY_CHANGES,
  QUALIFICATION_PROGRAMS,
  QUALIFICATION_STANDINGS,
  RELATIONSHIPS,
  RELATIONSHIP_CONTACTS,
  RELATIONSHIP_CONTRACTS,
  SUPPLIER_ORGS,
  VERIFICATION_REQUESTER_LABEL,
  findSupplierOrg,
  verificationRequestsOf,
} from '../../fixtures/suppliers/index.js';
import type {
  FixtureDuplicateCandidate,
  FixtureEvidenceItem,
  FixtureEvidenceShare,
  FixtureIdentityChange,
  FixtureRelationship,
  FixtureRelationshipContact,
  FixtureSupplierOrg,
  FixtureVerificationRequest,
} from '../../fixtures/suppliers/index.js';
import { activeMembersOf, categoriesOf, emailOf, freshnessOf, orgLabel, personOf, worstFreshness } from './shared.js';

// ---------------------------------------------------------------------------------------------------------
// Evidence (supplier side)
// ---------------------------------------------------------------------------------------------------------

/** Financial evidence needs `supplier.financial.view` on the supplier side (PRD §4.3). */
export function isFinancialEvidence(item: Pick<FixtureEvidenceItem, 'sensitivity' | 'evidenceType'>): boolean {
  return item.sensitivity === 'financial' || item.evidenceType === 'financial_statement' || item.evidenceType === 'credit_report';
}

export function evidenceOfTenant(tenantId: number): FixtureEvidenceItem[] {
  return EVIDENCE_ITEMS.filter((item) => item.tenantId === tenantId);
}

export function findEvidence(tenantId: number, evidenceId: number): FixtureEvidenceItem | undefined {
  return EVIDENCE_ITEMS.find((item) => item.tenantId === tenantId && item.id === evidenceId);
}

/** Every edition of the lineage an item belongs to, oldest first. */
export function lineageOf(item: FixtureEvidenceItem): FixtureEvidenceItem[] {
  const byId = new Map(EVIDENCE_ITEMS.filter((candidate) => candidate.tenantId === item.tenantId).map((candidate) => [candidate.id, candidate]));
  let root = item;
  while (root.replacesId !== null) {
    const previous = byId.get(root.replacesId);
    if (previous === undefined) {
      break;
    }
    root = previous;
  }
  const chain = [root];
  let cursor = root;
  while (cursor.replacedById !== null) {
    const next = byId.get(cursor.replacedById);
    if (next === undefined) {
      break;
    }
    chain.push(next);
    cursor = next;
  }
  return chain;
}

export function sharesOfItem(item: FixtureEvidenceItem): FixtureEvidenceShare[] {
  return EVIDENCE_SHARES.filter((share) => share.tenantId === item.tenantId && share.evidenceItemId === item.id);
}

export function activeSharesOfItem(item: FixtureEvidenceItem): FixtureEvidenceShare[] {
  return sharesOfItem(item).filter((share) => share.withdrawnAt === null);
}

export function submissionsOfItem(item: FixtureEvidenceItem) {
  return EVIDENCE_SUBMISSIONS.filter((submission) => submission.supplierTenantId === item.tenantId && submission.evidenceItemId === item.id);
}

export function evidenceView(item: FixtureEvidenceItem, now: Date): EvidenceItem {
  return {
    id: item.id,
    evidenceType: item.evidenceType,
    title: item.title,
    issuer: item.issuer,
    referenceNumber: item.referenceNumber,
    periodStart: item.periodStart,
    periodEnd: item.periodEnd,
    reportingCurrency: item.reportingCurrency,
    isConsolidated: item.isConsolidated,
    coverage: item.coverage,
    validFrom: item.validFrom,
    expiresAt: item.expiresAt,
    status: item.status,
    freshness: freshnessOf(item.expiresAt, now),
    verificationStatus: item.verificationStatus,
    sensitivity: item.sensitivity,
    editionNo: item.editionNo,
    replacesId: item.replacesId,
    replacedById: item.replacedById,
    document: item.document,
    activeShares: activeSharesOfItem(item).map((share) => ({ shareId: share.id, buyer: orgLabel(share.buyerTenantId), sharedAt: share.sharedAt })),
    submissionCount: submissionsOfItem(item).length,
    createdBy: personOf(item.createdByUserId),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function shareView(share: FixtureEvidenceShare): EvidenceShare {
  return {
    id: share.id,
    buyer: orgLabel(share.buyerTenantId),
    sharedAt: share.sharedAt,
    sharedBy: personOf(share.sharedByUserId),
    withdrawnAt: share.withdrawnAt,
    withdrawnBy: share.withdrawnByUserId === null ? null : personOf(share.withdrawnByUserId),
  };
}

export function evidenceDetailView(item: FixtureEvidenceItem, now: Date): EvidenceDetail {
  const lineage = lineageOf(item);
  const editionById = new Map(lineage.map((edition) => [edition.id, edition.editionNo]));
  const submissions: EvidenceSubmission[] = lineage
    .flatMap((edition) => submissionsOfItem(edition))
    .map((submission) => ({
      id: submission.id,
      evidenceItemId: submission.evidenceItemId,
      editionNo: editionById.get(submission.evidenceItemId) ?? 1,
      buyer: orgLabel(submission.tenantId),
      contextType: submission.contextType,
      contextId: submission.contextId,
      contextReference: submission.contextReference,
      contextTitle: submission.contextTitle,
      submittedAt: submission.submittedAt,
    }))
    .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
  return {
    ...evidenceView(item, now),
    editions: [...lineage].reverse().map((edition) => ({
      id: edition.id,
      editionNo: edition.editionNo,
      status: edition.status,
      validFrom: edition.validFrom,
      expiresAt: edition.expiresAt,
      document: edition.document,
      createdAt: edition.createdAt,
    })),
    shares: lineage.flatMap((edition) => sharesOfItem(edition)).map(shareView),
    submissions,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Profile (supplier side)
// ---------------------------------------------------------------------------------------------------------

export function identityChangeView(change: FixtureIdentityChange): IdentityChange {
  return {
    id: change.id,
    changeType: change.changeType,
    previousValue: change.previousValue,
    proposedValue: change.proposedValue,
    reason: change.reason,
    evidenceDocument: change.evidenceDocument,
    status: change.status,
    submittedBy: personOf(change.submittedByUserId),
    submittedAt: change.submittedAt,
    reviewedBy: change.reviewedByUserId === null ? null : personOf(change.reviewedByUserId),
    reviewedAt: change.reviewedAt,
    effectiveAt: change.effectiveAt,
    decisionNote: change.decisionNote,
  };
}

export function identityChangesOf(tenantId: number): FixtureIdentityChange[] {
  return IDENTITY_CHANGES.filter((change) => change.tenantId === tenantId);
}

/** A verification request as the supplier sees it (the requester is the operations team, never a named operator). */
export function verificationRequestView(request: FixtureVerificationRequest): VerificationRequest {
  return {
    id: request.id,
    status: request.status,
    reason: request.reason,
    evidenceTypes: [...request.evidenceTypes],
    dueDate: request.dueDate,
    requestedBy: VERIFICATION_REQUESTER_LABEL,
    requestedAt: request.requestedAt,
    response:
      request.response === null
        ? null
        : {
            respondedBy: personOf(request.response.respondedByUserId),
            respondedAt: request.response.respondedAt,
            note: request.response.note,
            evidence: request.response.evidenceItemIds.flatMap((id) => {
              const item = EVIDENCE_ITEMS.find((candidate) => candidate.id === id && candidate.tenantId === request.supplierTenantId);
              return item === undefined ? [] : [{ evidenceItemId: item.id, evidenceType: item.evidenceType, title: item.title }];
            }),
          },
  };
}

export function profileView(org: FixtureSupplierOrg): SupplierProfile {
  const standings = QUALIFICATION_STANDINGS.filter((standing) => standing.supplierTenantId === org.tenantId);
  const qualifiedBuyers = new Set(
    standings
      .filter((standing) => standing.effectiveStatus === 'qualified' || standing.effectiveStatus === 'qualified_with_conditions')
      .map((standing) => standing.tenantId),
  );
  const sharing = new Map<number, number>();
  for (const share of EVIDENCE_SHARES) {
    if (share.tenantId === org.tenantId && share.withdrawnAt === null) {
      sharing.set(share.buyerTenantId, (sharing.get(share.buyerTenantId) ?? 0) + 1);
    }
  }
  return {
    tenantId: org.tenantId,
    slug: org.slug,
    legalName: org.legalName,
    tradingName: org.tradingName,
    country: org.country,
    registrationJurisdiction: org.registrationJurisdiction,
    registrationNumber: org.registrationNumber,
    taxIdentifier: org.taxIdentifier,
    defaultCurrency: org.defaultCurrency,
    officialTimeZone: org.officialTimeZone,
    statuses: {
      registration: org.status,
      verification: org.verificationStatus,
      isProvisional: org.isProvisional,
      qualification: {
        qualifiedBuyerCount: qualifiedBuyers.size,
        pendingApplicationCount: standings.filter((standing) => standing.applicationInProgress !== null).length,
        note: 'Registration is not qualification. Each buyer decides qualification separately, for a stated scope and period.',
      },
    },
    tradingNames: [...org.profile.tradingNames],
    website: org.profile.website,
    description: org.profile.description,
    yearEstablished: org.profile.yearEstablished,
    employeeCountBand: org.profile.employeeCountBand,
    annualTurnoverBand: org.profile.annualTurnoverBand,
    capacityOverview: org.profile.capacityOverview,
    ownershipDisclosure: org.profile.ownershipDisclosure,
    ultimateParentName: org.profile.ultimateParentName,
    serviceAreas: [...org.profile.serviceAreas],
    preferredLanguages: [...org.profile.preferredLanguages],
    primaryContact: org.profile.primaryContactUserId === null ? null : personOf(org.profile.primaryContactUserId),
    locations: org.locations.map((location) => ({ ...location })),
    categories: categoriesOf(org.categories),
    legalNameHistory: org.legalNames.map((entry) => ({ ...entry })),
    pendingIdentityChangeCount: identityChangesOf(org.tenantId).filter(
      (change) => change.status === 'submitted' || change.status === 'under_review',
    ).length,
    verificationRequests: verificationRequestsOf(org.tenantId)
      .map(verificationRequestView)
      .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1)),
    memberOptions: activeMembersOf(org.tenantId),
    buyerSharing: [...sharing.entries()].map(([buyerTenantId, count]) => ({ buyer: orgLabel(buyerTenantId), sharedItemCount: count })),
    bankingCollected: false,
    bankingNotice: BANKING_NOT_COLLECTED_NOTICE,
    updatedAt: org.profile.updatedAt,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Buyer views (BR-45: only this buyer's rows and evidence shared with this buyer)
// ---------------------------------------------------------------------------------------------------------

/** Suppliers a buyer can see in the directory: active organizations plus its own provisional records. */
export function directoryOrgs(buyerTenantId: number): FixtureSupplierOrg[] {
  return SUPPLIER_ORGS.filter((org) =>
    org.isProvisional ? org.createdByTenantId === buyerTenantId && org.status === 'pending' : org.status === 'active',
  );
}

export function findDirectoryOrg(buyerTenantId: number, supplierTenantId: number): FixtureSupplierOrg | undefined {
  return directoryOrgs(buyerTenantId).find((org) => org.tenantId === supplierTenantId);
}

export function relationshipOf(buyerTenantId: number, supplierTenantId: number): FixtureRelationship | undefined {
  return RELATIONSHIPS.find((row) => row.tenantId === buyerTenantId && row.supplierTenantId === supplierTenantId);
}

export function relationshipView(row: FixtureRelationship): Relationship {
  return {
    id: row.id,
    status: row.status,
    riskRating: row.riskRating,
    owner: row.ownerUserId === null ? null : personOf(row.ownerUserId),
    restrictionNote: row.restrictionNote,
    internalNotes: row.internalNotes,
    firstEngagedAt: row.firstEngagedAt,
    updatedAt: row.updatedAt,
  };
}

export function contactsOf(buyerTenantId: number, relationshipId: number): FixtureRelationshipContact[] {
  return RELATIONSHIP_CONTACTS.filter((contact) => contact.tenantId === buyerTenantId && contact.relationshipId === relationshipId);
}

export function contactView(contact: FixtureRelationshipContact): RelationshipContact {
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    roleLabel: contact.roleLabel,
    isPrimary: contact.isPrimary,
    active: contact.active,
  };
}

export function qualificationOf(buyerTenantId: number, supplierTenantId: number): QualificationScope[] {
  return QUALIFICATION_STANDINGS.filter((standing) => standing.tenantId === buyerTenantId && standing.supplierTenantId === supplierTenantId).map(
    (standing) => {
      const program = QUALIFICATION_PROGRAMS.find((candidate) => candidate.programId === standing.programId && candidate.tenantId === buyerTenantId);
      const category = standing.scopeCategoryCode === null ? undefined : findCategory(standing.scopeCategoryCode);
      return {
        programId: standing.programId,
        programName: program?.name ?? 'Qualification program',
        effectiveStatus: standing.effectiveStatus,
        scopeCategory: category === undefined ? null : { catalogCode: category.code, name: category.name, parentCode: category.parentCode },
        scopeMaxValue: standing.scopeMaxValue,
        scopeGeography: standing.scopeGeography,
        effectiveFrom: standing.effectiveFrom,
        effectiveTo: standing.effectiveTo,
        conditions: standing.conditions,
      };
    },
  );
}

/** Items currently shared with the buyer (active share; the edition is current or expired, never withdrawn). */
export function sharedItemsFor(buyerTenantId: number, supplierTenantId: number): { item: FixtureEvidenceItem; share: FixtureEvidenceShare }[] {
  return EVIDENCE_SHARES.filter(
    (share) => share.tenantId === supplierTenantId && share.buyerTenantId === buyerTenantId && share.withdrawnAt === null,
  ).flatMap((share) => {
    const item = EVIDENCE_ITEMS.find((candidate) => candidate.tenantId === supplierTenantId && candidate.id === share.evidenceItemId);
    return item === undefined || item.status === 'withdrawn' || item.status === 'replaced' ? [] : [{ item, share }];
  });
}

export function freshnessSummary(buyerTenantId: number, supplierTenantId: number, now: Date): EvidenceFreshnessSummary {
  const items = sharedItemsFor(buyerTenantId, supplierTenantId).map(({ item }) => item);
  const freshness = items.map((item) => freshnessOf(item.expiresAt, now));
  const upcoming = items
    .map((item) => item.expiresAt)
    .filter((expiresAt): expiresAt is string => expiresAt !== null && freshnessOf(expiresAt, now) !== 'expired')
    .sort();
  return {
    sharedCount: items.length,
    expiringSoonCount: freshness.filter((value) => value === 'expiring_soon').length,
    expiredCount: freshness.filter((value) => value === 'expired').length,
    nextExpiry: upcoming[0] ?? null,
    worst: worstFreshness(freshness),
  };
}

/** A shared evidence row as the buyer sees it; financial rows are redacted without `qualification.financial_review`. */
export function sharedEvidenceView(
  item: FixtureEvidenceItem,
  share: FixtureEvidenceShare,
  permissions: readonly PermissionCode[],
  now: Date,
): SharedEvidenceRow {
  const restricted = isFinancialEvidence(item) && !permissions.includes('qualification.financial_review');
  return {
    evidenceItemId: item.id,
    evidenceType: item.evidenceType,
    sensitivity: item.sensitivity,
    restricted,
    title: restricted ? 'Financial evidence (restricted to financial reviewers)' : item.title,
    issuer: restricted ? null : item.issuer,
    referenceNumber: restricted ? null : item.referenceNumber,
    periodStart: restricted ? null : item.periodStart,
    periodEnd: restricted ? null : item.periodEnd,
    reportingCurrency: restricted ? null : item.reportingCurrency,
    coverage: restricted ? null : item.coverage,
    validFrom: item.validFrom,
    expiresAt: item.expiresAt,
    status: item.status,
    freshness: freshnessOf(item.expiresAt, now),
    verificationStatus: item.verificationStatus,
    editionNo: item.editionNo,
    document: restricted ? null : item.document,
    sharedAt: share.sharedAt,
  };
}

/** Open or escalated duplicate candidates this buyer raised. */
export function openFlagsRaisedBy(buyerTenantId: number): FixtureDuplicateCandidate[] {
  return DUPLICATE_CANDIDATES.filter(
    (candidate) => candidate.raisedByTenantId === buyerTenantId && (candidate.status === 'open' || candidate.status === 'escalated'),
  );
}

export function directoryRowView(buyerTenantId: number, org: FixtureSupplierOrg, now: Date): DirectoryRow {
  const relationship = relationshipOf(buyerTenantId, org.tenantId);
  const primary =
    relationship === undefined
      ? undefined
      : contactsOf(buyerTenantId, relationship.id).find((contact) => contact.isPrimary && contact.active);
  const view = relationship === undefined ? null : relationshipView(relationship);
  return {
    supplierTenantId: org.tenantId,
    legalName: org.legalName,
    tradingName: org.tradingName,
    slug: org.slug,
    country: org.country,
    registrationStatus: org.status,
    verificationStatus: org.verificationStatus,
    isProvisional: org.isProvisional,
    categories: categoriesOf(org.categories),
    relationship:
      view === null
        ? null
        : {
            id: view.id,
            status: view.status,
            riskRating: view.riskRating,
            owner: view.owner,
            restrictionNote: view.restrictionNote,
            firstEngagedAt: view.firstEngagedAt,
            updatedAt: view.updatedAt,
          },
    primaryContact: primary === undefined ? null : { name: primary.name, email: primary.email, phone: primary.phone },
    qualification: qualificationOf(buyerTenantId, org.tenantId),
    contractCount: RELATIONSHIP_CONTRACTS.filter((row) => row.tenantId === buyerTenantId && row.supplierTenantId === org.tenantId).length,
    evidence: freshnessSummary(buyerTenantId, org.tenantId, now),
    duplicateFlagged: openFlagsRaisedBy(buyerTenantId).some(
      (candidate) => candidate.tenantAId === org.tenantId || candidate.tenantBId === org.tenantId,
    ),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Operator views
// ---------------------------------------------------------------------------------------------------------

export function opsSupplierSummary(tenantId: number): OpsSupplierSummary {
  const org = findSupplierOrg(tenantId);
  if (org === undefined) {
    throw new Error(`No supplier organization ${tenantId}.`);
  }
  return {
    tenantId: org.tenantId,
    legalName: org.legalName,
    slug: org.slug,
    status: org.status,
    verificationStatus: org.verificationStatus,
    isProvisional: org.isProvisional,
    createdBy: org.createdByTenantId === null ? null : orgLabel(org.createdByTenantId),
    country: org.country,
    registrationNumber: org.registrationNumber,
    emailDomain: org.emailDomain,
    memberCount: org.memberCount,
    createdAt: org.createdAt,
  };
}

export function duplicateView(candidate: FixtureDuplicateCandidate): DuplicateCandidate {
  return {
    id: candidate.id,
    tenantA: opsSupplierSummary(candidate.tenantAId),
    tenantB: opsSupplierSummary(candidate.tenantBId),
    detectedReason: candidate.detectedReason,
    status: candidate.status,
    raisedBy: candidate.raisedByTenantId === null ? null : orgLabel(candidate.raisedByTenantId),
    reviewedBy: candidate.reviewedByUserId === null ? null : personOf(candidate.reviewedByUserId),
    reviewedAt: candidate.reviewedAt,
    note: candidate.note,
    createdAt: candidate.createdAt,
  };
}

/** Open or escalated duplicate candidates involving a tenant. */
export function hasOpenDuplicate(tenantId: number): boolean {
  return DUPLICATE_CANDIDATES.some(
    (candidate) =>
      (candidate.tenantAId === tenantId || candidate.tenantBId === tenantId) &&
      (candidate.status === 'open' || candidate.status === 'escalated'),
  );
}

/**
 * Organizations in the operator registration queue: self-registrations (pending or closed) and active suppliers whose
 * identity is not yet verified (AC-07: registered, not verified, not qualified).
 */
export function registrationQueue(): FixtureSupplierOrg[] {
  return SUPPLIER_ORGS.filter(
    (org) =>
      !org.isProvisional &&
      (org.registration !== null || (org.status !== 'closed' && org.verificationStatus !== 'identity_verified')),
  );
}

/** The latest open or answered verification request of an organization (the operator's registration row). */
export function latestEvidenceRequest(tenantId: number): OpsRegistrationRow['evidenceRequest'] {
  const latest = verificationRequestsOf(tenantId)
    .filter((request) => request.status !== 'closed')
    .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1))[0];
  return latest === undefined
    ? null
    : {
        id: latest.id,
        status: latest.status,
        reason: latest.reason,
        evidenceTypes: [...latest.evidenceTypes],
        dueDate: latest.dueDate,
        requestedAt: latest.requestedAt,
        respondedAt: latest.response?.respondedAt ?? null,
      };
}

export function registrationView(org: FixtureSupplierOrg): OpsRegistrationRow {
  const registrantUserId = org.registration?.registrantUserId ?? org.profile.primaryContactUserId;
  if (registrantUserId === null) {
    throw new Error(`Registration ${org.tenantId} has no registrant.`);
  }
  return {
    tenantId: org.tenantId,
    legalName: org.legalName,
    country: org.country,
    registrationNumber: org.registrationNumber,
    registrant: { fullName: personOf(registrantUserId).fullName, email: emailOf(registrantUserId) },
    status: org.status,
    verificationStatus: org.verificationStatus,
    verificationEmailStatus: org.registration?.verificationEmailStatus ?? 'accepted',
    verificationEmailSentCount: org.registration?.verificationEmailSentCount ?? 1,
    possibleDuplicate: hasOpenDuplicate(org.tenantId),
    categories: categoriesOf(org.categories),
    evidenceRequest: latestEvidenceRequest(org.tenantId),
    createdAt: org.createdAt,
    lastActivityAt: org.registration?.lastActivityAt ?? org.profile.updatedAt,
  };
}

