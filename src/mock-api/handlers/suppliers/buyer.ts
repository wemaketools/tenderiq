/**
 * Buyer-audience handlers (BUY-31 directory, BUY-32 relationship record). Every row comes from the ACTIVE buyer's own
 * relationship, contacts and qualification standing, plus evidence the supplier shared with that buyer; another
 * buyer's assessments never appear (BR-45). Another buyer's provisional supplier record is not found.
 */
import type { DirectoryListQuery, DirectoryRow, RelationshipRecord } from '../../../contracts/suppliers.js';
import { suppliersEndpoints as api } from '../../../contracts/suppliers.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { PERSONAS } from '../../fixtures/platform.js';
import {
  DUPLICATE_CANDIDATES,
  QUALIFICATION_PROGRAMS,
  QUALIFICATION_STANDINGS,
  RELATIONSHIP_CONTRACTS,
  RELATIONSHIP_EVENTS,
  categoryWithDescendants,
  claimInvitationOf,
  findCategory,
  findExternalPerson,
  findSupplierOrg,
} from '../../fixtures/suppliers/index.js';
import { claimStateAt } from './public.js';
import { activeMembersOf, categoriesOf, instantOf, isActiveMember, matchesQuery, normalizeName, orgLabel, personOf, sortBy, withinDates } from './shared.js';
import {
  contactView,
  contactsOf,
  directoryOrgs,
  directoryRowView,
  findDirectoryOrg,
  freshnessSummary,
  identityChangeView,
  identityChangesOf,
  qualificationOf,
  relationshipOf,
  relationshipView,
  sharedEvidenceView,
  sharedItemsFor,
} from './views.js';

const RISK_ORDER = { low: 1, medium: 2, high: 3, not_assessed: 0 } as const;

const SEGREGATION_NOTICE =
  'This record shows only your organization’s relationship, contacts, qualification decisions and the evidence this supplier shared with you. Other buyers’ assessments are never shown.';

/** The claim invitation of a provisional supplier, shown only to the buyer that created the record (DD-17). */
function claimInvitationFor(buyerTenantId: number, supplierTenantId: number, now: Date): RelationshipRecord['claimInvitation'] {
  const invitation = claimInvitationOf(supplierTenantId);
  const contact = invitation === undefined ? undefined : findExternalPerson(invitation.contactUserId);
  if (invitation === undefined || contact === undefined || invitation.buyerTenantId !== buyerTenantId) {
    return null;
  }
  return {
    state: claimStateAt(invitation, now),
    contactName: contact.fullName,
    email: contact.email,
    sentAt: invitation.sentAt,
    sentCount: invitation.sentCount,
    expiresAt: invitation.expiresAt,
    claimPath: `/register/claim/${invitation.token}`,
  };
}

function matchesDirectoryFilters(row: DirectoryRow, query: DirectoryListQuery): boolean {
  if (query.category !== undefined) {
    const wanted = new Set(query.category.flatMap((code) => [...categoryWithDescendants(code)]));
    if (!row.categories.some((category) => wanted.has(category.catalogCode))) {
      return false;
    }
  }
  if (query.relationshipStatus !== undefined && !query.relationshipStatus.includes(row.relationship?.status ?? 'none')) {
    return false;
  }
  if (query.qualificationStatus !== undefined) {
    const statuses = row.qualification.length === 0 ? ['not_assessed' as const] : row.qualification.map((scope) => scope.effectiveStatus);
    if (!statuses.some((status) => query.qualificationStatus?.includes(status) === true)) {
      return false;
    }
  }
  if (query.riskRating !== undefined && !query.riskRating.includes(row.relationship?.riskRating ?? 'not_assessed')) {
    return false;
  }
  if (query.evidenceFreshness !== undefined && (row.evidence.worst === null || !query.evidenceFreshness.includes(row.evidence.worst))) {
    return false;
  }
  if (query.verificationStatus !== undefined && !query.verificationStatus.includes(row.verificationStatus)) {
    return false;
  }
  if (query.ownerUserId !== undefined && row.relationship?.owner?.userId !== query.ownerUserId) {
    return false;
  }
  if (query.hasContracts !== undefined && (row.contractCount > 0) !== query.hasContracts) {
    return false;
  }
  if (query.provisionalOnly === true && !row.isProvisional) {
    return false;
  }
  if (!withinDates(row.relationship?.firstEngagedAt ?? null, query.engagedFrom, query.engagedTo)) {
    return false;
  }
  return matchesQuery(query.q, row.legalName, row.tradingName, row.slug, ...row.categories.map((category) => category.name));
}

export function registerBuyer(app: MockApp): void {
  mockRoute(app, api.listDirectory, ({ requireTenant, query, now, fixtures }) => {
    const buyerId = requireTenant().tenant.id;
    const all = directoryOrgs(buyerId).map((org) => directoryRowView(buyerId, org, now));
    const rows = all.filter((row) => matchesDirectoryFilters(row, query));
    const sorted = sortBy(
      rows,
      (row) => {
        switch (query.sort) {
          case 'relationshipStatus':
            return row.relationship?.status ?? null;
          case 'firstEngagedAt':
            return row.relationship?.firstEngagedAt ?? null;
          case 'nextEvidenceExpiry':
            return row.evidence.nextExpiry;
          case 'riskRating':
            return row.relationship === null ? null : RISK_ORDER[row.relationship.riskRating];
          default:
            return row.legalName.toLowerCase();
        }
      },
      query.dir,
    );
    return {
      ...fixtures.page(sorted),
      ownerOptions: activeMembersOf(buyerId),
      summary: {
        active: all.filter((row) => row.relationship?.status === 'active').length,
        qualified: all.filter((row) =>
          row.qualification.some((scope) => scope.effectiveStatus === 'qualified' || scope.effectiveStatus === 'qualified_with_conditions'),
        ).length,
        restrictedOrSuspended: all.filter((row) => row.relationship?.status === 'restricted' || row.relationship?.status === 'suspended').length,
        evidenceExpiring: all.filter((row) => row.evidence.expiringSoonCount > 0 || row.evidence.expiredCount > 0).length,
      },
    };
  });

  mockRoute(app, api.getRelationshipRecord, ({ requireTenant, params, now, notFound }) => {
    const { tenant, permissions } = requireTenant();
    const org = findDirectoryOrg(tenant.id, params.supplierTenantId);
    if (org === undefined) {
      return notFound();
    }
    const relationship = relationshipOf(tenant.id, org.tenantId);
    const record: RelationshipRecord = {
      supplierTenantId: org.tenantId,
      legalName: org.legalName,
      tradingNames: [...org.profile.tradingNames],
      slug: org.slug,
      country: org.country,
      registrationJurisdiction: org.registrationJurisdiction,
      registrationNumber: org.registrationNumber,
      registrationStatus: org.status,
      verificationStatus: org.verificationStatus,
      isProvisional: org.isProvisional,
      createdByThisBuyer: org.createdByTenantId === tenant.id,
      claimInvitation: claimInvitationFor(tenant.id, org.tenantId, now),
      website: org.profile.website,
      description: org.profile.description,
      yearEstablished: org.profile.yearEstablished,
      ownershipDisclosure: org.profile.ownershipDisclosure,
      ultimateParentName: org.profile.ultimateParentName,
      serviceAreas: [...org.profile.serviceAreas],
      locations: org.locations.map((location) => ({ ...location })),
      categories: categoriesOf(org.categories),
      legalNameHistory: org.legalNames.map((entry) => ({ ...entry })),
      identityChanges: identityChangesOf(org.tenantId)
        .filter((change) => change.status !== 'rejected')
        .map(identityChangeView)
        .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)),
      relationship: relationship === undefined ? null : relationshipView(relationship),
      contacts: relationship === undefined ? [] : contactsOf(tenant.id, relationship.id).map(contactView),
      qualification: qualificationOf(tenant.id, org.tenantId),
      requestablePrograms: QUALIFICATION_PROGRAMS.filter((program) => program.tenantId === tenant.id && program.status === 'active').map((program) => {
        const category = program.categoryCode === null ? undefined : findCategory(program.categoryCode);
        return {
          programId: program.programId,
          name: program.name,
          category: category === undefined ? null : { catalogCode: category.code, name: category.name, parentCode: category.parentCode },
        };
      }),
      contracts: RELATIONSHIP_CONTRACTS.filter((row) => row.tenantId === tenant.id && row.supplierTenantId === org.tenantId).map((row) => ({
        contractId: row.contractId,
        reference: row.reference,
        title: row.title,
        status: row.status,
        performance: row.performance === null ? null : { ...row.performance },
      })),
      sharedEvidence: sharedItemsFor(tenant.id, org.tenantId)
        .map(({ item, share }) => sharedEvidenceView(item, share, permissions, now))
        .sort((a, b) => (a.expiresAt ?? '9999-12-31').localeCompare(b.expiresAt ?? '9999-12-31')),
      evidence: freshnessSummary(tenant.id, org.tenantId, now),
      duplicateFlags: DUPLICATE_CANDIDATES.filter(
        (candidate) => candidate.raisedByTenantId === tenant.id && (candidate.tenantAId === org.tenantId || candidate.tenantBId === org.tenantId),
      ).map((candidate) => {
        const otherId = candidate.tenantAId === org.tenantId ? candidate.tenantBId : candidate.tenantAId;
        return {
          id: candidate.id,
          otherSupplier: { supplierTenantId: otherId, legalName: findSupplierOrg(otherId)?.legalName ?? 'Supplier organization' },
          detectedReason: candidate.detectedReason,
          status: candidate.status,
          note: candidate.note,
          createdAt: candidate.createdAt,
        };
      }),
      history: RELATIONSHIP_EVENTS.filter((event) => event.tenantId === tenant.id && event.supplierTenantId === org.tenantId)
        .map((event) => ({
          id: event.id,
          at: event.at,
          eventType: event.eventType,
          summary: event.summary,
          actor: event.actorUserId === null ? null : personOf(event.actorUserId),
        }))
        .sort((a, b) => (a.at < b.at ? 1 : -1)),
      ownerOptions: activeMembersOf(tenant.id),
      segregationNotice: SEGREGATION_NOTICE,
    };
    return record;
  });

  mockRoute(app, api.updateRelationship, ({ requireTenant, params, body, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const org = findDirectoryOrg(tenant.id, params.supplierTenantId);
    if (org === undefined) {
      return notFound();
    }
    if (body.relationshipOwnerUserId !== null && !isActiveMember(body.relationshipOwnerUserId, tenant.id)) {
      return fail(422, 'OWNER_NOT_MEMBER', 'The relationship owner must be an active member of your organization.');
    }
    const existing = relationshipOf(tenant.id, org.tenantId);
    if (
      existing !== undefined &&
      existing.status === body.status &&
      existing.riskRating === body.riskRating &&
      existing.ownerUserId === body.relationshipOwnerUserId &&
      existing.restrictionNote === body.restrictionNote &&
      existing.internalNotes === body.internalNotes
    ) {
      return fail(422, 'RELATIONSHIP_UNCHANGED', 'Nothing changed in the relationship.');
    }
    return {
      id: existing?.id ?? 900,
      status: body.status,
      riskRating: body.riskRating,
      owner: body.relationshipOwnerUserId === null ? null : personOf(body.relationshipOwnerUserId),
      restrictionNote: body.status === 'restricted' || body.status === 'suspended' ? body.restrictionNote : null,
      internalNotes: body.internalNotes,
      firstEngagedAt: existing?.firstEngagedAt ?? (body.status === 'active' ? instantOf(now) : null),
      updatedAt: instantOf(now),
    };
  });

  mockRoute(app, api.createContact, ({ requireTenant, params, body, notFound, fail }) => {
    const { tenant } = requireTenant();
    const org = findDirectoryOrg(tenant.id, params.supplierTenantId);
    if (org === undefined) {
      return notFound();
    }
    const relationship = relationshipOf(tenant.id, org.tenantId);
    if (relationship === undefined) {
      return fail(409, 'RELATIONSHIP_REQUIRED', 'Record the relationship before adding contacts.');
    }
    if (body.email !== null && contactsOf(tenant.id, relationship.id).some((contact) => contact.email === body.email)) {
      return fail(409, 'CONTACT_EMAIL_DUPLICATE', 'A contact with this e-mail address already exists.');
    }
    return { id: 900, ...body };
  });

  mockRoute(app, api.updateContact, ({ requireTenant, params, body, notFound, fail }) => {
    const { tenant } = requireTenant();
    const org = findDirectoryOrg(tenant.id, params.supplierTenantId);
    const relationship = org === undefined ? undefined : relationshipOf(tenant.id, org.tenantId);
    const contacts = relationship === undefined ? [] : contactsOf(tenant.id, relationship.id);
    const contact = contacts.find((candidate) => candidate.id === params.contactId);
    if (contact === undefined) {
      return notFound();
    }
    if (body.email !== null && contacts.some((other) => other.id !== contact.id && other.email === body.email)) {
      return fail(409, 'CONTACT_EMAIL_DUPLICATE', 'A contact with this e-mail address already exists.');
    }
    if (contact.isPrimary && (!body.isPrimary || !body.active) && !contacts.some((other) => other.id !== contact.id && other.isPrimary && other.active)) {
      return fail(422, 'PRIMARY_CONTACT_REQUIRED', 'Make another contact primary before changing this one.');
    }
    return { id: contact.id, ...body };
  });

  mockRoute(app, api.createProvisionalSupplier, ({ requireTenant, requirePersona, body, now, fail }) => {
    const { tenant } = requireTenant();
    const persona = requirePersona();
    const unknown = body.categories.filter((code) => findCategory(code) === undefined);
    if (unknown.length > 0) {
      return fail(422, 'CATEGORY_UNKNOWN', `Unknown categories: ${unknown.join(', ')}.`);
    }
    if (PERSONAS.some((candidate) => candidate.email.toLowerCase() === body.contactEmail.toLowerCase())) {
      return fail(409, 'EMAIL_ALREADY_REGISTERED', 'This contact already has a TenderIQ account; find the supplier in the directory instead.');
    }
    const wanted = normalizeName(body.legalName);
    const match = directoryOrgs(tenant.id).find(
      (org) =>
        (body.registrationNumber !== undefined && org.registrationNumber === body.registrationNumber) ||
        [org.legalName, ...org.profile.tradingNames].some((name) => normalizeName(name) === wanted),
    );
    if (match !== undefined) {
      return fail(409, 'POSSIBLE_DUPLICATE_SUPPLIER', `${match.legalName} is already in the supplier directory. Open its record instead.`);
    }
    const at = instantOf(now);
    return {
      supplierTenantId: 900,
      legalName: body.legalName,
      isProvisional: true,
      registrationStatus: 'pending',
      invitationStatus: 'pending',
      relationship: {
        id: 900,
        status: 'prospective',
        riskRating: 'not_assessed',
        owner: { userId: persona.userId, fullName: persona.fullName },
        restrictionNote: null,
        internalNotes: body.message ?? null,
        firstEngagedAt: null,
        updatedAt: at,
      },
      message: `A provisional record was created and ${body.contactName} was invited to claim it and complete registration.`,
    };
  });

  mockRoute(app, api.requestQualification, ({ requireTenant, params, body, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const org = findDirectoryOrg(tenant.id, params.supplierTenantId);
    if (org === undefined) {
      return notFound();
    }
    const program = QUALIFICATION_PROGRAMS.find((candidate) => candidate.tenantId === tenant.id && candidate.programId === body.programId && candidate.status === 'active');
    if (program === undefined) {
      return fail(422, 'PROGRAM_UNKNOWN', 'Choose one of your active qualification programs.');
    }
    if (org.status !== 'active') {
      return fail(409, 'SUPPLIER_NOT_ELIGIBLE_FOR_REQUEST', 'The supplier must complete registration before it can apply.');
    }
    const standing = QUALIFICATION_STANDINGS.find(
      (candidate) => candidate.tenantId === tenant.id && candidate.supplierTenantId === org.tenantId && candidate.programId === program.programId,
    );
    if (standing?.effectiveStatus === 'qualified' || standing?.effectiveStatus === 'qualified_with_conditions') {
      return fail(409, 'ALREADY_QUALIFIED', 'The supplier already holds a current decision for this program.');
    }
    if (standing?.applicationInProgress !== null && standing?.applicationInProgress !== undefined) {
      return fail(409, 'APPLICATION_IN_PROGRESS', `Application ${standing.applicationInProgress} is already in progress.`);
    }
    return {
      supplierTenantId: org.tenantId,
      programId: program.programId,
      programName: program.name,
      requestedAt: instantOf(now),
      message: `${org.legalName} was asked to apply to ${program.name}. Registration alone does not qualify the supplier.`,
    };
  });

  mockRoute(app, api.flagDuplicate, ({ requireTenant, params, body, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const org = findDirectoryOrg(tenant.id, params.supplierTenantId);
    if (org === undefined) {
      return notFound();
    }
    if (body.otherSupplierTenantId === org.tenantId) {
      return fail(422, 'SAME_SUPPLIER', 'Choose a different supplier record.');
    }
    const other = findDirectoryOrg(tenant.id, body.otherSupplierTenantId);
    if (other === undefined) {
      return notFound('The other supplier record was not found.');
    }
    const pair = new Set([org.tenantId, other.tenantId]);
    if (
      DUPLICATE_CANDIDATES.some(
        (candidate) =>
          pair.has(candidate.tenantAId) && pair.has(candidate.tenantBId) && (candidate.status === 'open' || candidate.status === 'escalated'),
      )
    ) {
      return fail(409, 'DUPLICATE_ALREADY_FLAGGED', 'These records are already under duplicate review.');
    }
    return {
      id: 900,
      status: 'open',
      message: `Flagged for platform review by ${orgLabel(tenant.id).tenantName}. Records are only merged after review (BR-44).`,
      createdAt: instantOf(now),
    };
  });
}

