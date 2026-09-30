/**
 * Supplier-audience handlers (SUP-03 profile and identity changes, SUP-04/SUP-02 membership requests, SUP-05
 * evidence library). Every read is scoped to the ACTIVE supplier tenant: another supplier's rows are simply not
 * found. Financial evidence requires `supplier.financial.view` (PRD §4.3): the list withholds it and says so, the
 * detail and every command on it answer 403 `FINANCIAL_EVIDENCE_RESTRICTED`.
 */
import type { PermissionCode } from '../../../contracts/permissions.js';
import type { EvidenceItem, IdentityChange, MembershipRequestRow, SupplierProfile } from '../../../contracts/suppliers.js';
import { suppliersEndpoints as api } from '../../../contracts/suppliers.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { TENANTS } from '../../fixtures/platform.js';
import { EVIDENCE_SHARES, MEMBERSHIP_REQUESTS, findCategory, findSupplierOrg, verificationRequestsOf } from '../../fixtures/suppliers/index.js';
import type { FixtureEvidenceItem, FixtureMembershipRequest, FixtureSupplierOrg } from '../../fixtures/suppliers/index.js';
import { categoriesOf, emailOf, freshnessOf, instantOf, isActiveMember, matchesQuery, orgLabel, personOf, sortBy, withinDates } from './shared.js';
import {
  activeSharesOfItem,
  evidenceDetailView,
  evidenceOfTenant,
  evidenceView,
  findEvidence,
  identityChangeView,
  identityChangesOf,
  isFinancialEvidence,
  lineageOf,
  profileView,
  shareView,
  submissionsOfItem,
  verificationRequestView,
} from './views.js';

/** The fixture org of the active supplier tenant (every platform supplier has one). */
function ownOrg(tenantId: number): FixtureSupplierOrg {
  const org = findSupplierOrg(tenantId);
  if (org === undefined) {
    throw new Error(`Supplier tenant ${tenantId} has no organization fixture.`);
  }
  return org;
}

/** Supplier side of the financial audience rule (PRD §4.3): only `supplier.financial.view` holders. */
export function canViewFinancial(permissions: readonly PermissionCode[]): boolean {
  return permissions.includes('supplier.financial.view');
}

/** The library rows a member may see: financial evidence only with `supplier.financial.view`. */
export function visibleEvidence(tenantId: number, permissions: readonly PermissionCode[]): FixtureEvidenceItem[] {
  const financial = canViewFinancial(permissions);
  return evidenceOfTenant(tenantId).filter((item) => financial || !isFinancialEvidence(item));
}

const FINANCIAL_RESTRICTED_DETAIL = 'Financial evidence is visible only to members who hold the financial evidence right.';

/** An uploaded document reference for a new edition (the documents contract owns the file itself). */
function uploadedDocument(documentId: number) {
  return { documentId, fileName: `evidence-document-${documentId}.pdf`, versionNo: 1 };
}

function membershipRequestView(row: FixtureMembershipRequest): MembershipRequestRow {
  return {
    id: row.id,
    requester: { userId: row.userId, fullName: personOf(row.userId).fullName, email: emailOf(row.userId) },
    message: row.message,
    status: row.status,
    decidedBy: row.decidedByUserId === null ? null : personOf(row.decidedByUserId),
    decidedAt: row.decidedAt,
    decisionNote: row.decisionNote,
    createdAt: row.createdAt,
  };
}

function previousValueOf(org: FixtureSupplierOrg, changeType: IdentityChange['changeType']): string | null {
  switch (changeType) {
    case 'legal_name':
      return org.legalName;
    case 'registration':
      return org.registrationNumber;
    case 'ownership':
      return org.profile.ownershipDisclosure;
    default:
      return null;
  }
}

/** The evidence item as a new edition built from a replace or renew command. */
function nextEdition(previous: FixtureEvidenceItem, fields: Partial<FixtureEvidenceItem>, now: Date, userId: number): FixtureEvidenceItem {
  const at = instantOf(now);
  return {
    ...previous,
    ...fields,
    id: 900,
    status: 'current',
    verificationStatus: 'supplier_provided',
    editionNo: previous.editionNo + 1,
    replacesId: previous.id,
    replacedById: null,
    createdByUserId: userId,
    createdAt: at,
    updatedAt: at,
  };
}

function editionResult(previous: FixtureEvidenceItem, current: FixtureEvidenceItem, now: Date) {
  const carried = activeSharesOfItem(previous);
  const previousView: EvidenceItem = {
    ...evidenceView(previous, now),
    status: 'replaced',
    replacedById: current.id,
    activeShares: [],
    updatedAt: current.createdAt,
  };
  const currentView: EvidenceItem = {
    ...evidenceView(current, now),
    activeShares: carried.map((share, index) => ({ shareId: 900 + index, buyer: orgLabel(share.buyerTenantId), sharedAt: current.createdAt })),
    submissionCount: 0,
  };
  return {
    previous: previousView,
    current: currentView,
    carriedShareCount: carried.length,
    retainedSubmissionCount: submissionsOfItem(previous).length,
  };
}

export function registerSupplier(app: MockApp): void {
  // ---------------------------------------------------------------------------------------------------
  // SUP-03 profile
  // ---------------------------------------------------------------------------------------------------
  mockRoute(app, api.getProfile, ({ requireTenant }) => profileView(ownOrg(requireTenant().tenant.id)));

  mockRoute(app, api.respondVerificationRequest, ({ requireTenant, requirePersona, params, body, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const persona = requirePersona();
    const request = verificationRequestsOf(tenant.id).find((candidate) => candidate.id === params.requestId);
    if (request === undefined) {
      return notFound();
    }
    if (request.status !== 'open') {
      return fail(409, 'VERIFICATION_REQUEST_NOT_OPEN', 'This request has already been answered.');
    }
    const items = body.evidenceItemIds.map((id) => findEvidence(tenant.id, id));
    if (items.some((item) => item === undefined || item.status !== 'current')) {
      return fail(422, 'EVIDENCE_NOT_CURRENT', 'Choose current evidence from your library.');
    }
    const chosen = items.filter((item): item is FixtureEvidenceItem => item !== undefined);
    const missing = request.evidenceTypes.filter((type) => !chosen.some((item) => item.evidenceType === type));
    if (missing.length > 0) {
      return fail(422, 'EVIDENCE_TYPES_NOT_COVERED', `The request still needs: ${missing.join(', ')}.`);
    }
    return {
      ...verificationRequestView(request),
      status: 'answered',
      response: {
        respondedBy: personOf(persona.userId),
        respondedAt: instantOf(now),
        note: body.note,
        evidence: chosen.map((item) => ({ evidenceItemId: item.id, evidenceType: item.evidenceType, title: item.title })),
      },
    };
  });

  mockRoute(app, api.updateProfile, ({ requireTenant, body, now, fail }) => {
    const { tenant } = requireTenant();
    const unknown = body.categories.filter((code) => findCategory(code) === undefined);
    if (unknown.length > 0) {
      return fail(422, 'CATEGORY_UNKNOWN', `Unknown categories: ${unknown.join(', ')}.`);
    }
    if (body.primaryContactUserId !== null && !isActiveMember(body.primaryContactUserId, tenant.id)) {
      return fail(422, 'PRIMARY_CONTACT_NOT_MEMBER', 'The primary contact must be an active member of your organization.');
    }
    const current = profileView(ownOrg(tenant.id));
    const updated: SupplierProfile = {
      ...current,
      tradingNames: body.tradingNames,
      website: body.website,
      description: body.description,
      yearEstablished: body.yearEstablished,
      employeeCountBand: body.employeeCountBand,
      annualTurnoverBand: body.annualTurnoverBand,
      capacityOverview: body.capacityOverview,
      serviceAreas: body.serviceAreas,
      preferredLanguages: body.preferredLanguages,
      primaryContact: body.primaryContactUserId === null ? null : personOf(body.primaryContactUserId),
      locations: body.locations.map((location, index) => ({
        id: 900 + index,
        name: location.name,
        address: location.address,
        region: location.region ?? null,
        country: location.country,
        isRegisteredOffice: location.isRegisteredOffice,
      })),
      categories: categoriesOf(body.categories),
      updatedAt: instantOf(now),
    };
    return updated;
  });

  // ---------------------------------------------------------------------------------------------------
  // Legal-identity changes
  // ---------------------------------------------------------------------------------------------------
  mockRoute(app, api.listIdentityChanges, ({ requireTenant, query, fixtures }) => {
    const rows = identityChangesOf(requireTenant().tenant.id)
      .filter((change) => query.status === undefined || query.status.includes(change.status))
      .filter((change) => query.changeType === undefined || query.changeType.includes(change.changeType))
      .filter((change) => withinDates(change.submittedAt, query.submittedFrom, query.submittedTo))
      .filter((change) => matchesQuery(query.q, change.proposedValue, change.previousValue, change.reason));
    const key = query.sort ?? 'submittedAt';
    const sorted = sortBy(rows, (change) => change[key], query.sort === undefined ? 'desc' : query.dir);
    return fixtures.page(sorted.map(identityChangeView));
  });

  mockRoute(app, api.getIdentityChange, ({ requireTenant, params, notFound }) => {
    const change = identityChangesOf(requireTenant().tenant.id).find((candidate) => candidate.id === params.changeId);
    return change === undefined ? notFound() : identityChangeView(change);
  });

  mockRoute(app, api.createIdentityChange, ({ requireTenant, requirePersona, body, now, fail }) => {
    const { tenant } = requireTenant();
    const persona = requirePersona();
    const org = ownOrg(tenant.id);
    if (body.evidenceDocumentId === null) {
      return fail(422, 'EVIDENCE_REQUIRED', 'Attach the document that proves the change.');
    }
    if (
      identityChangesOf(tenant.id).some(
        (change) => change.changeType === body.changeType && (change.status === 'submitted' || change.status === 'under_review'),
      )
    ) {
      return fail(409, 'IDENTITY_CHANGE_ALREADY_PENDING', 'A change of this type is already awaiting review.');
    }
    const previousValue = previousValueOf(org, body.changeType);
    if (previousValue !== null && previousValue.trim().toLowerCase() === body.proposedValue.trim().toLowerCase()) {
      return fail(422, 'PROPOSED_VALUE_UNCHANGED', 'The proposed value is the same as the current one.');
    }
    return {
      id: 900,
      changeType: body.changeType,
      previousValue,
      proposedValue: body.proposedValue,
      reason: body.reason,
      evidenceDocument: uploadedDocument(body.evidenceDocumentId),
      status: 'submitted',
      submittedBy: { userId: persona.userId, fullName: persona.fullName },
      submittedAt: instantOf(now),
      reviewedBy: null,
      reviewedAt: null,
      effectiveAt: null,
      decisionNote: null,
    };
  });

  // ---------------------------------------------------------------------------------------------------
  // Membership requests (SUP-04 / SUP-02)
  // ---------------------------------------------------------------------------------------------------
  mockRoute(app, api.listMembershipRequests, ({ requireTenant, query, fixtures }) => {
    const tenantId = requireTenant().tenant.id;
    const rows = MEMBERSHIP_REQUESTS.filter((row) => row.tenantId === tenantId)
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => withinDates(row.createdAt, query.createdFrom, query.createdTo))
      .filter((row) => matchesQuery(query.q, personOf(row.userId).fullName, emailOf(row.userId), row.message));
    const sorted = sortBy(rows, (row) => (query.sort === 'status' ? row.status : row.createdAt), query.sort === undefined ? 'desc' : query.dir);
    return fixtures.page(sorted.map(membershipRequestView));
  });

  mockRoute(app, api.decideMembershipRequest, ({ requireTenant, requirePersona, params, body, now, notFound, fail }) => {
    const tenantId = requireTenant().tenant.id;
    const persona = requirePersona();
    const row = MEMBERSHIP_REQUESTS.find((candidate) => candidate.tenantId === tenantId && candidate.id === params.requestId);
    if (row === undefined) {
      return notFound();
    }
    if (row.status !== 'pending') {
      return fail(409, 'MEMBERSHIP_REQUEST_NOT_PENDING', 'This request has already been decided or withdrawn.');
    }
    return {
      ...membershipRequestView(row),
      status: body.decision,
      decidedBy: { userId: persona.userId, fullName: persona.fullName },
      decidedAt: instantOf(now),
      decisionNote: body.decisionNote ?? (body.decision === 'approved' ? `Approved as ${body.capacity ?? 'member'}.` : null),
    };
  });

  // ---------------------------------------------------------------------------------------------------
  // SUP-05 evidence library
  // ---------------------------------------------------------------------------------------------------
  mockRoute(app, api.listEvidence, ({ requireTenant, query, now, fixtures }) => {
    const { tenant, permissions } = requireTenant();
    const financial = canViewFinancial(permissions);
    const library = evidenceOfTenant(tenant.id);
    const visible = visibleEvidence(tenant.id, permissions);
    const latest = visible.filter((item) => query.includeHistory === true || item.status !== 'replaced');
    const rows = latest
      .filter((item) => query.evidenceType === undefined || query.evidenceType.includes(item.evidenceType))
      .filter((item) => query.status === undefined || query.status.includes(item.status))
      .filter((item) => query.freshness === undefined || query.freshness.includes(freshnessOf(item.expiresAt, now)))
      .filter((item) => query.sensitivity === undefined || query.sensitivity.includes(item.sensitivity))
      .filter((item) => query.createdBy === undefined || item.createdByUserId === query.createdBy)
      .filter(
        (item) =>
          query.sharedWithBuyerId === undefined ||
          activeSharesOfItem(item).some((share) => share.buyerTenantId === query.sharedWithBuyerId),
      )
      .filter((item) => withinDates(item.expiresAt, query.expiresFrom, query.expiresTo))
      .filter((item) => matchesQuery(query.q, item.title, item.issuer, item.referenceNumber));
    const sorted = sortBy(
      rows,
      (item) => {
        switch (query.sort) {
          case 'title':
            return item.title.toLowerCase();
          case 'evidenceType':
            return item.evidenceType;
          case 'expiresAt':
            return item.expiresAt;
          case 'status':
            return item.status;
          default:
            return item.createdAt;
        }
      },
      query.sort === undefined ? 'desc' : query.dir,
    );
    const current = visible.filter((item) => item.status !== 'replaced' && item.status !== 'withdrawn');
    const freshness = current.map((item) => freshnessOf(item.expiresAt, now));
    return {
      ...fixtures.page(sorted.map((item) => evidenceView(item, now))),
      financialRestricted: !financial && library.some(isFinancialEvidence),
      summary: {
        current: freshness.filter((value) => value === 'current' || value === 'no_expiry').length,
        expiringSoon: freshness.filter((value) => value === 'expiring_soon').length,
        expired: freshness.filter((value) => value === 'expired').length,
        withdrawn: visible.filter((item) => item.status === 'withdrawn').length,
      },
    };
  });

  mockRoute(app, api.getEvidence, ({ requireTenant, params, now, notFound, fail }) => {
    const { tenant, permissions } = requireTenant();
    const item = findEvidence(tenant.id, params.evidenceId);
    if (item === undefined) {
      return notFound();
    }
    if (isFinancialEvidence(item) && !canViewFinancial(permissions)) {
      return fail(403, 'FINANCIAL_EVIDENCE_RESTRICTED', FINANCIAL_RESTRICTED_DETAIL);
    }
    return evidenceDetailView(item, now);
  });

  mockRoute(app, api.createEvidence, ({ requireTenant, requirePersona, body, now, fail }) => {
    const { permissions } = requireTenant();
    const persona = requirePersona();
    if (isFinancialEvidence(body) && !canViewFinancial(permissions)) {
      return fail(403, 'FINANCIAL_EVIDENCE_RESTRICTED', FINANCIAL_RESTRICTED_DETAIL);
    }
    const at = instantOf(now);
    return {
      id: 900,
      evidenceType: body.evidenceType,
      title: body.title,
      issuer: body.issuer,
      referenceNumber: body.referenceNumber,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      reportingCurrency: body.reportingCurrency,
      isConsolidated: body.isConsolidated,
      coverage: body.coverage,
      validFrom: body.validFrom,
      expiresAt: body.expiresAt,
      status: 'current',
      freshness: freshnessOf(body.expiresAt, now),
      verificationStatus: 'supplier_provided',
      sensitivity: body.sensitivity,
      editionNo: 1,
      replacesId: null,
      replacedById: null,
      document: uploadedDocument(body.documentId),
      activeShares: [],
      submissionCount: 0,
      createdBy: { userId: persona.userId, fullName: persona.fullName },
      createdAt: at,
      updatedAt: at,
    };
  });

  mockRoute(app, api.replaceEvidence, ({ requireTenant, requirePersona, params, body, now, notFound, fail }) => {
    const { tenant, permissions } = requireTenant();
    const item = findEvidence(tenant.id, params.evidenceId);
    if (item === undefined) {
      return notFound();
    }
    if (isFinancialEvidence(item) && !canViewFinancial(permissions)) {
      return fail(403, 'FINANCIAL_EVIDENCE_RESTRICTED', FINANCIAL_RESTRICTED_DETAIL);
    }
    if (item.status !== 'current' && item.status !== 'expired') {
      return fail(409, 'EVIDENCE_NOT_CURRENT', 'Only the latest edition can be replaced.');
    }
    if (item.evidenceType === 'financial_statement' && (body.periodStart === null || body.periodEnd === null || body.reportingCurrency === null)) {
      return fail(422, 'REPORTING_PERIOD_REQUIRED', 'Financial statements need the reporting period and currency.');
    }
    if (item.evidenceType === 'insurance' && (body.coverage === null || body.expiresAt === null)) {
      return fail(422, 'COVERAGE_REQUIRED', 'Insurance needs the coverage amount and the expiry date.');
    }
    const { reason: _reason, documentId, ...fields } = body;
    const current = nextEdition(item, { ...fields, document: uploadedDocument(documentId) }, now, requirePersona().userId);
    return editionResult(item, current, now);
  });

  mockRoute(app, api.renewEvidence, ({ requireTenant, requirePersona, params, body, now, notFound, fail }) => {
    const { tenant, permissions } = requireTenant();
    const item = findEvidence(tenant.id, params.evidenceId);
    if (item === undefined) {
      return notFound();
    }
    if (isFinancialEvidence(item) && !canViewFinancial(permissions)) {
      return fail(403, 'FINANCIAL_EVIDENCE_RESTRICTED', FINANCIAL_RESTRICTED_DETAIL);
    }
    if (item.expiresAt === null || (item.status !== 'current' && item.status !== 'expired')) {
      return fail(409, 'EVIDENCE_NOT_RENEWABLE', 'Only the latest edition of evidence with an expiry date can be renewed.');
    }
    if (body.expiresAt <= item.expiresAt) {
      return fail(422, 'RENEWAL_NOT_LATER', 'The renewed evidence must expire after the current edition.');
    }
    const current = nextEdition(
      item,
      {
        validFrom: body.validFrom,
        expiresAt: body.expiresAt,
        referenceNumber: body.referenceNumber ?? item.referenceNumber,
        coverage: body.coverage ?? item.coverage,
        document: uploadedDocument(body.documentId),
      },
      now,
      requirePersona().userId,
    );
    return editionResult(item, current, now);
  });

  mockRoute(app, api.withdrawEvidence, ({ requireTenant, params, now, notFound, fail }) => {
    const { tenant, permissions } = requireTenant();
    const item = findEvidence(tenant.id, params.evidenceId);
    if (item === undefined) {
      return notFound();
    }
    if (isFinancialEvidence(item) && !canViewFinancial(permissions)) {
      return fail(403, 'FINANCIAL_EVIDENCE_RESTRICTED', FINANCIAL_RESTRICTED_DETAIL);
    }
    if (item.status === 'withdrawn') {
      return fail(409, 'EVIDENCE_ALREADY_WITHDRAWN', 'This evidence is already withdrawn.');
    }
    const ended = activeSharesOfItem(item).length;
    return {
      item: { ...evidenceView(item, now), status: 'withdrawn', activeShares: [], updatedAt: instantOf(now) },
      endedShareCount: ended,
      retainedSubmissionCount: lineageOf(item).reduce((count, edition) => count + submissionsOfItem(edition).length, 0),
    };
  });

  mockRoute(app, api.shareEvidence, ({ requireTenant, requirePersona, params, body, now, notFound, fail }) => {
    const { tenant, permissions } = requireTenant();
    const persona = requirePersona();
    const item = findEvidence(tenant.id, params.evidenceId);
    if (item === undefined) {
      return notFound();
    }
    if (isFinancialEvidence(item) && !canViewFinancial(permissions)) {
      return fail(403, 'FINANCIAL_EVIDENCE_RESTRICTED', FINANCIAL_RESTRICTED_DETAIL);
    }
    if (item.status !== 'current') {
      return fail(409, 'EVIDENCE_NOT_CURRENT', 'Only current evidence can be shared.');
    }
    const buyer = TENANTS.find((candidate) => candidate.id === body.buyerTenantId && candidate.kind === 'buyer' && candidate.status === 'active');
    if (buyer === undefined) {
      return fail(422, 'BUYER_UNKNOWN', 'Choose a buyer organization on TenderIQ.');
    }
    if (activeSharesOfItem(item).some((share) => share.buyerTenantId === buyer.id)) {
      return fail(409, 'ALREADY_SHARED', 'This evidence is already shared with that buyer.');
    }
    return {
      id: 900,
      buyer: orgLabel(buyer.id),
      sharedAt: instantOf(now),
      sharedBy: { userId: persona.userId, fullName: persona.fullName },
      withdrawnAt: null,
      withdrawnBy: null,
    };
  });

  mockRoute(app, api.withdrawShare, ({ requireTenant, requirePersona, params, now, notFound, fail }) => {
    const { tenant, permissions } = requireTenant();
    const persona = requirePersona();
    const item = findEvidence(tenant.id, params.evidenceId);
    const share = EVIDENCE_SHARES.find(
      (candidate) => candidate.tenantId === tenant.id && candidate.id === params.shareId && candidate.evidenceItemId === params.evidenceId,
    );
    if (item === undefined || share === undefined) {
      return notFound();
    }
    if (isFinancialEvidence(item) && !canViewFinancial(permissions)) {
      return fail(403, 'FINANCIAL_EVIDENCE_RESTRICTED', FINANCIAL_RESTRICTED_DETAIL);
    }
    if (share.withdrawnAt !== null) {
      return fail(409, 'SHARE_ALREADY_WITHDRAWN', 'Sharing with this buyer has already been withdrawn.');
    }
    const retained = lineageOf(item)
      .flatMap((edition) => submissionsOfItem(edition))
      .filter((submission) => submission.tenantId === share.buyerTenantId).length;
    return {
      share: { ...shareView(share), withdrawnAt: instantOf(now), withdrawnBy: { userId: persona.userId, fullName: persona.fullName } },
      retainedSubmissionCount: retained,
      message:
        retained === 0
          ? 'Future sharing with this buyer has stopped.'
          : `Future sharing with this buyer has stopped. ${retained} earlier formal submission(s) remain part of the buyer's procurement record.`,
    };
  });

  mockRoute(app, api.sharingBuyers, ({ requireTenant }) => {
    const tenantId = requireTenant().tenant.id;
    const submissions = evidenceOfTenant(tenantId).flatMap((item) => submissionsOfItem(item));
    return {
      items: TENANTS.filter((candidate) => candidate.kind === 'buyer' && candidate.status === 'active').map((buyer) => ({
        buyer: orgLabel(buyer.id),
        slug: buyer.slug,
        sharedItemCount: EVIDENCE_SHARES.filter(
          (share) => share.tenantId === tenantId && share.buyerTenantId === buyer.id && share.withdrawnAt === null,
        ).length,
        hasParticipated: submissions.some((submission) => submission.tenantId === buyer.id),
      })),
    };
  });
}
