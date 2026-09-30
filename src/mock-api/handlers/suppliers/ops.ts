/**
 * Operator handlers (OPS-01): supplier duplicate review (BR-44: merge only after review, records never re-pointed),
 * the registration queue (DD-27: abandoned registrations stay visible and can be closed; identity verification is a
 * separate status, AC-07) and legal-identity change review (FR-02). Identity metadata only, never procurement
 * content.
 */
import type { OpsIdentityChangeRow } from '../../../contracts/suppliers.js';
import { suppliersEndpoints as api } from '../../../contracts/suppliers.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import {
  DUPLICATE_CANDIDATES,
  EVIDENCE_SUBMISSIONS,
  IDENTITY_CHANGES,
  SUPPLIER_MERGES,
  VERIFICATION_REQUESTS,
  findSupplierOrg,
} from '../../fixtures/suppliers/index.js';
import type { FixtureIdentityChange, FixtureSupplierMerge } from '../../fixtures/suppliers/index.js';
import { dateOf, instantOf, matchesQuery, personOf, sortBy, withinDates, zonedMidnight } from './shared.js';
import { duplicateView, identityChangeView, registrationQueue, registrationView } from './views.js';

function mergeView(merge: FixtureSupplierMerge) {
  return {
    id: merge.id,
    survivingTenantId: merge.survivingTenantId,
    mergedTenantId: merge.mergedTenantId,
    approvedBy: personOf(merge.approvedByUserId),
    reason: merge.reason,
    mergedAt: merge.mergedAt,
  };
}

function opsChangeView(change: FixtureIdentityChange): OpsIdentityChangeRow {
  const org = findSupplierOrg(change.tenantId);
  if (org === undefined) {
    throw new Error(`Identity change ${change.id} names unknown supplier ${change.tenantId}.`);
  }
  return {
    ...identityChangeView(change),
    supplier: { tenantId: org.tenantId, legalName: org.legalName, slug: org.slug, status: org.status },
  };
}

const CONSEQUENCES: Readonly<Record<FixtureIdentityChange['changeType'], string>> = {
  legal_name: 'The new legal name applies from the effective date. Earlier submissions, receipts and contracts keep the name valid when they were made.',
  registration: 'The corrected registration details apply from the effective date; earlier representations remain as submitted.',
  ownership: 'Buyers are notified of the ownership change and may trigger reassessment; earlier declarations remain as submitted.',
  merger: 'The merger is recorded without re-pointing historic bids or contracts; each keeps its original legal party.',
  succession: 'The successor organization is recorded; historic records keep their original legal party.',
  representation_transfer: 'The new representative gains authority from the effective date; earlier authorizations stay attributed to the previous representative.',
  admin_recovery: 'The new administrator receives organization administration; the previous administrator’s actions remain attributed to them.',
};

export function registerOps(app: MockApp): void {
  // ---------------------------------------------------------------------------------------------------
  // Duplicate review
  // ---------------------------------------------------------------------------------------------------
  mockRoute(app, api.listDuplicates, ({ query, fixtures }) => {
    const rows = DUPLICATE_CANDIDATES.map(duplicateView)
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.detectedReason === undefined || query.detectedReason.includes(row.detectedReason))
      .filter((row) => withinDates(row.createdAt, query.createdFrom, query.createdTo))
      .filter((row) =>
        matchesQuery(query.q, row.tenantA.legalName, row.tenantB.legalName, row.tenantA.registrationNumber, row.tenantB.registrationNumber),
      );
    const sorted = sortBy(
      rows,
      (row) => (query.sort === 'status' ? row.status : query.sort === 'detectedReason' ? row.detectedReason : row.createdAt),
      query.sort === undefined ? 'desc' : query.dir,
    );
    return fixtures.page(sorted);
  });

  mockRoute(app, api.getDuplicate, ({ params, notFound }) => {
    const candidate = DUPLICATE_CANDIDATES.find((row) => row.id === params.candidateId);
    const orgA = candidate === undefined ? undefined : findSupplierOrg(candidate.tenantAId);
    const orgB = candidate === undefined ? undefined : findSupplierOrg(candidate.tenantBId);
    if (candidate === undefined || orgA === undefined || orgB === undefined) {
      return notFound();
    }
    const officeOf = (locations: typeof orgA.locations) => locations.find((location) => location.isRegisteredOffice)?.address ?? null;
    const compare = (field: string, valueA: string | null, valueB: string | null) => ({
      field,
      valueA,
      valueB,
      matches: valueA !== null && valueB !== null && valueA.trim().toLowerCase() === valueB.trim().toLowerCase(),
    });
    const merge = SUPPLIER_MERGES.find((row) => row.candidateId === candidate.id);
    return {
      ...duplicateView(candidate),
      merge: merge === undefined ? null : mergeView(merge),
      comparison: [
        compare('Legal name', orgA.legalName, orgB.legalName),
        compare('Registration number', orgA.registrationNumber, orgB.registrationNumber),
        compare('Country', orgA.country, orgB.country),
        compare('Registered office', officeOf(orgA.locations), officeOf(orgB.locations)),
        compare('E-mail domain', orgA.emailDomain, orgB.emailDomain),
        compare('Categories', [...orgA.categories].sort().join(', '), [...orgB.categories].sort().join(', ')),
      ],
      guidance:
        'A similar name or a shared e-mail domain is not enough to merge. Confirm the legal identity against the registry. A merge never re-points historic bids, receipts or contracts (BR-44).',
    };
  });

  mockRoute(app, api.decideDuplicate, ({ requirePersona, params, body, now, notFound, fail }) => {
    const persona = requirePersona();
    const candidate = DUPLICATE_CANDIDATES.find((row) => row.id === params.candidateId);
    if (candidate === undefined) {
      return notFound();
    }
    if (candidate.status !== 'open' && candidate.status !== 'escalated') {
      return fail(409, 'DUPLICATE_ALREADY_DECIDED', 'This candidate has already been decided.');
    }
    if (candidate.status === 'escalated' && body.decision === 'escalated') {
      return fail(409, 'DUPLICATE_ALREADY_DECIDED', 'This candidate is already escalated.');
    }
    if (
      body.decision === 'merged' &&
      body.survivingTenantId !== candidate.tenantAId &&
      body.survivingTenantId !== candidate.tenantBId
    ) {
      return fail(422, 'SURVIVING_TENANT_INVALID', 'The surviving organization must be one of the two records.');
    }
    const at = instantOf(now);
    const survivingTenantId = body.survivingTenantId ?? candidate.tenantAId;
    const merge =
      body.decision === 'merged'
        ? {
            id: 900,
            survivingTenantId,
            mergedTenantId: survivingTenantId === candidate.tenantAId ? candidate.tenantBId : candidate.tenantAId,
            approvedBy: { userId: persona.userId, fullName: persona.fullName },
            reason: body.reason,
            mergedAt: at,
          }
        : null;
    const messages = {
      not_duplicate: 'Recorded as not a duplicate. Both organizations remain separate.',
      merged: 'Merged. Historic bids, receipts and contracts keep their original legal party; nothing was re-pointed.',
      escalated: 'Escalated for further verification. Both records remain unchanged.',
    } as const;
    return {
      candidate: {
        ...duplicateView(candidate),
        status: body.decision,
        reviewedBy: { userId: persona.userId, fullName: persona.fullName },
        reviewedAt: at,
        note: body.reason,
      },
      merge,
      message: messages[body.decision],
    };
  });

  // ---------------------------------------------------------------------------------------------------
  // Registration queue
  // ---------------------------------------------------------------------------------------------------
  mockRoute(app, api.listRegistrations, ({ query, fixtures }) => {
    const rows = registrationQueue()
      .map(registrationView)
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.verificationStatus === undefined || query.verificationStatus.includes(row.verificationStatus))
      .filter((row) => query.verificationEmailStatus === undefined || query.verificationEmailStatus.includes(row.verificationEmailStatus))
      .filter((row) => query.possibleDuplicate === undefined || row.possibleDuplicate === query.possibleDuplicate)
      .filter((row) => withinDates(row.createdAt, query.createdFrom, query.createdTo))
      .filter((row) => matchesQuery(query.q, row.legalName, row.registrationNumber, row.registrant.fullName, row.registrant.email));
    const sorted = sortBy(
      rows,
      (row) => (query.sort === 'legalName' ? row.legalName.toLowerCase() : query.sort === 'lastActivityAt' ? row.lastActivityAt : row.createdAt),
      query.sort === undefined ? 'desc' : query.dir,
    );
    return fixtures.page(sorted);
  });

  mockRoute(app, api.closeRegistration, ({ params, now, notFound, fail }) => {
    const org = registrationQueue().find((candidate) => candidate.tenantId === params.supplierTenantId);
    if (org === undefined) {
      return notFound();
    }
    if (org.status !== 'pending') {
      return fail(409, 'REGISTRATION_NOT_PENDING', 'Only a pending registration can be closed.');
    }
    return { ...registrationView(org), status: 'closed', lastActivityAt: instantOf(now) };
  });

  mockRoute(app, api.verifyIdentity, ({ params, now, notFound, fail }) => {
    const org = registrationQueue().find((candidate) => candidate.tenantId === params.supplierTenantId);
    if (org === undefined || org.status === 'closed') {
      return notFound();
    }
    if (org.verificationStatus === 'identity_verified') {
      return fail(409, 'IDENTITY_ALREADY_VERIFIED', 'The identity of this organization is already verified.');
    }
    if (org.verificationStatus !== 'contact_verified') {
      return fail(409, 'CONTACT_NOT_VERIFIED', 'The registrant has not verified the contact e-mail yet.');
    }
    return { ...registrationView(org), verificationStatus: 'identity_verified', lastActivityAt: instantOf(now) };
  });

  mockRoute(app, api.requestVerificationEvidence, ({ params, body, now, notFound, fail }) => {
    const org = registrationQueue().find((candidate) => candidate.tenantId === params.supplierTenantId);
    if (org === undefined || org.status === 'closed') {
      return notFound();
    }
    if (org.verificationStatus === 'identity_verified') {
      return fail(409, 'IDENTITY_ALREADY_VERIFIED', 'The identity of this organization is already verified.');
    }
    if (VERIFICATION_REQUESTS.some((request) => request.supplierTenantId === org.tenantId && request.status === 'open')) {
      return fail(409, 'VERIFICATION_REQUEST_OPEN', 'A request for missing evidence is already open for this organization.');
    }
    if (body.dueDate !== null && body.dueDate < dateOf(now)) {
      return fail(422, 'DUE_DATE_IN_PAST', 'Choose a due date from today onwards.');
    }
    const at = instantOf(now);
    return {
      ...registrationView(org),
      evidenceRequest: {
        id: 900,
        status: 'open',
        reason: body.reason,
        evidenceTypes: [...body.evidenceTypes],
        dueDate: body.dueDate,
        requestedAt: at,
        respondedAt: null,
      },
      lastActivityAt: at,
    };
  });

  // ---------------------------------------------------------------------------------------------------
  // Legal-identity change review
  // ---------------------------------------------------------------------------------------------------
  mockRoute(app, api.listOpsIdentityChanges, ({ query, fixtures }) => {
    const rows = IDENTITY_CHANGES.map(opsChangeView)
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.changeType === undefined || query.changeType.includes(row.changeType))
      .filter((row) => query.supplierTenantId === undefined || row.supplier.tenantId === query.supplierTenantId)
      .filter((row) => withinDates(row.submittedAt, query.submittedFrom, query.submittedTo))
      .filter((row) => matchesQuery(query.q, row.supplier.legalName, row.proposedValue, row.previousValue));
    const sorted = sortBy(
      rows,
      (row) => (query.sort === 'status' ? row.status : query.sort === 'changeType' ? row.changeType : row.submittedAt),
      query.sort === undefined ? 'desc' : query.dir,
    );
    return fixtures.page(sorted);
  });

  mockRoute(app, api.getOpsIdentityChange, ({ params, notFound }) => {
    const change = IDENTITY_CHANGES.find((row) => row.id === params.changeId);
    const org = change === undefined ? undefined : findSupplierOrg(change.tenantId);
    if (change === undefined || org === undefined) {
      return notFound();
    }
    const contexts = new Set(
      EVIDENCE_SUBMISSIONS.filter((submission) => submission.supplierTenantId === org.tenantId).map(
        (submission) => `${submission.tenantId}:${submission.contextType}:${submission.contextId}`,
      ),
    );
    return {
      ...opsChangeView(change),
      legalNameHistory: org.legalNames.map((entry) => ({ ...entry })),
      otherChanges: IDENTITY_CHANGES.filter((row) => row.tenantId === org.tenantId && row.id !== change.id).map(identityChangeView),
      historicSubmissionCount: contexts.size,
      consequence: CONSEQUENCES[change.changeType],
    };
  });

  mockRoute(app, api.startIdentityReview, ({ params, notFound, fail }) => {
    const change = IDENTITY_CHANGES.find((row) => row.id === params.changeId);
    if (change === undefined) {
      return notFound();
    }
    if (change.status !== 'submitted') {
      return fail(409, 'IDENTITY_CHANGE_NOT_SUBMITTED', 'Only a submitted change can be taken into review.');
    }
    return { ...opsChangeView(change), status: 'under_review' };
  });

  mockRoute(app, api.decideIdentityChange, ({ requirePersona, params, body, now, notFound, fail }) => {
    const persona = requirePersona();
    const change = IDENTITY_CHANGES.find((row) => row.id === params.changeId);
    const org = change === undefined ? undefined : findSupplierOrg(change.tenantId);
    if (change === undefined || org === undefined) {
      return notFound();
    }
    if (change.status === 'approved' || change.status === 'rejected') {
      return fail(409, 'IDENTITY_CHANGE_ALREADY_DECIDED', 'This change has already been decided.');
    }
    if (body.decision === 'approved' && change.evidenceDocument === null) {
      return fail(422, 'EVIDENCE_REQUIRED', 'A change cannot be approved without supporting evidence.');
    }
    return {
      ...opsChangeView(change),
      status: body.decision,
      reviewedBy: { userId: persona.userId, fullName: persona.fullName },
      reviewedAt: instantOf(now),
      effectiveAt: body.decision === 'approved' && body.effectiveDate !== undefined ? zonedMidnight(body.effectiveDate, org.officialTimeZone) : null,
      decisionNote: body.decisionNote,
    };
  });
}
