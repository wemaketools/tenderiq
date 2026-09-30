/**
 * Suppliers mock handlers with REAL authentication (local Supabase Auth, DD-43): public registration never discloses
 * another organization, suppliers see only their own records, financial evidence is withheld without the financial
 * right, buyers see only their own assessments (BR-45), wrong tenant kinds and missing permissions get 403, and every
 * command answers with its declared business errors.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { Problem } from '../../../contracts/common.js';
import { ROLE_TEMPLATES } from '../../../contracts/permissions.js';
import {
  DirectoryPage,
  DuplicateCheckResult,
  EvidenceDetail,
  EvidenceEditionResult,
  EvidencePage,
  RegistrationResult,
  RelationshipRecord,
  SupplierProfile,
  VerificationRequest,
  suppliersEndpoints as api,
} from '../../../contracts/suppliers.js';
import { EVIDENCE_SHARES, EVIDENCE_SUBMISSIONS } from '../../fixtures/suppliers/index.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp, TestResponse } from '../../testing/index.js';
import { canViewFinancial, visibleEvidence } from './supplier.js';

let app: TestMockApp;

beforeAll(async () => {
  app = await createTestMockApp({ now: () => new Date('2026-10-01T08:00:00Z') });
});

const as = (login: string): string => `${login}@tenderiq.local`;

function problemCode(response: TestResponse): string | undefined {
  return Problem.parse(response.body).code;
}

const registration = {
  legalName: 'Letlhakane Borehole Services (Pty) Ltd',
  country: 'BW',
  registrationJurisdiction: 'Botswana — CIPA',
  registrationNumber: 'BW00008999999',
  contact: { fullName: 'Kopano Ditau', email: 'kopano.ditau@letlhakane-boreholes.example' },
  locations: [{ name: 'Head office', address: 'Plot 9, Letlhakane', country: 'BW', isRegisteredOffice: true }],
  categories: ['WTR-PUMP'],
  preferredLanguages: ['en'],
  acceptTerms: true,
};

describe('suppliers module', () => {
  it('is auto-discovered and serves every contract endpoint', () => {
    expect(app.failed.filter((failure) => failure.module.startsWith('suppliers'))).toEqual([]);
    expect(app.loaded).toContain('suppliers/index');
    expect(app.endpointIds).toEqual(expect.arrayContaining(Object.values(api).map((endpoint) => endpoint.id)));
  });
});

describe('SUP-02 public registration', () => {
  it('lists the category catalog without signing in', async () => {
    const response = await app.request('GET', api.categoryOptions.path);
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).toContain('WTR-INFRA');
  });

  it('reports a possible duplicate without disclosing anything about the other organization', async () => {
    const response = await app.request('POST', api.duplicateCheck.path, {
      body: { legalName: 'Tsodilo Engineering Services (Pty) Ltd', country: 'BW', contactEmail: 'someone@example.com' },
    });
    expect(response.status).toBe(200);
    const result = DuplicateCheckResult.parse(response.body);
    expect(result.outcome).toBe('possible_duplicate');
    expect(result.matchToken).toMatch(/^dup_/);
    expect(response.text).not.toMatch(/Tsodilo|BW0000|tsodilo/);
  });

  it('refuses a registration that ignores the possible duplicate, then accepts it once acknowledged', async () => {
    const body = { ...registration, legalName: 'Chobe Pipe and Valve Supplies' };
    const refused = await app.request('POST', api.register.path, { body });
    expect(refused.status).toBe(409);
    expect(problemCode(refused)).toBe('POSSIBLE_DUPLICATE_UNACKNOWLEDGED');

    const check = DuplicateCheckResult.parse(
      (await app.request('POST', api.duplicateCheck.path, { body: { legalName: body.legalName, country: 'BW', contactEmail: body.contact.email } })).body,
    );
    const accepted = await app.request('POST', api.register.path, { body: { ...body, continueDespiteMatchToken: check.matchToken } });
    expect(accepted.status).toBe(201);
    expect(RegistrationResult.parse(accepted.body).duplicateReviewRaised).toBe(true);
  });

  it('keeps registration, verification, membership and qualification as separate statuses (AC-07)', async () => {
    const response = await app.request('POST', api.register.path, { body: registration });
    expect(response.status).toBe(201);
    expect(RegistrationResult.parse(response.body)).toMatchObject({
      organizationStatus: 'pending',
      verificationStatus: 'unverified',
      userStatus: 'invited',
      qualificationStatus: 'not_assessed',
      bankingCollected: false,
      duplicateReviewRaised: false,
    });
  });

  it('rejects a registration with an e-mail that already has an account, and invalid input with 422', async () => {
    const taken = await app.request('POST', api.register.path, {
      body: { ...registration, contact: { fullName: 'Tebogo', email: 'tebogo.officer@tenderiq.local' } },
    });
    expect(problemCode(taken)).toBe('EMAIL_ALREADY_REGISTERED');
    const invalid = await app.request('POST', api.register.path, { body: { ...registration, acceptTerms: false } });
    expect(invalid.status).toBe(422);
  });

  it('accepts a public membership request only with a valid match token', async () => {
    const bad = await app.request('POST', api.requestMembershipPublic.path, {
      body: { matchToken: 'dup_unknownToken1', fullName: 'A Person', email: 'a.person@example.com', message: 'I work there.' },
    });
    expect(problemCode(bad)).toBe('MATCH_TOKEN_INVALID');
    const good = await app.request('POST', api.requestMembershipPublic.path, {
      body: { matchToken: 'dup_q7Lm2Xa9Pt4R', fullName: 'A Person', email: 'a.person@example.com', message: 'I work there.' },
    });
    expect(good.status).toBe(201);
    expect(good.text).not.toContain('Tsodilo');
  });
});

describe('/me membership requests', () => {
  it('lists only the caller’s own requests and names an organization only once approved', async () => {
    const response = await app.callAs(as('sam.dual'), api.myMembershipRequests);
    expect(response.status).toBe(200);
    const page = api.myMembershipRequests.response.parse(response.body);
    expect(page.total).toBe(3);
    const pending = page.items.find((row) => row.status === 'pending');
    expect(pending?.organizationName).toBeNull();
    expect(page.items.filter((row) => row.status === 'approved').map((row) => row.organizationName)).toEqual(
      expect.arrayContaining(['Tsodilo Engineering', 'Chobe Pipe & Valve Supplies']),
    );
    const other = api.myMembershipRequests.response.parse((await app.callAs(as('tebogo.officer'), api.myMembershipRequests)).body);
    expect(other.total).toBe(0);
  });

  it('withdraws only a pending request of the caller', async () => {
    expect((await app.callAs(as('sam.dual'), api.withdrawMyMembershipRequest, { params: { requestId: 3 } })).status).toBe(200);
    expect(problemCode(await app.callAs(as('sam.dual'), api.withdrawMyMembershipRequest, { params: { requestId: 1 } }))).toBe(
      'MEMBERSHIP_REQUEST_NOT_PENDING',
    );
    expect((await app.callAs(as('tebogo.officer'), api.withdrawMyMembershipRequest, { params: { requestId: 3 } })).status).toBe(404);
  });

  it('refuses a request for an organization the caller already belongs to', async () => {
    const response = await app.callAs(as('sam.dual'), api.createMyMembershipRequest, {
      body: { matchToken: 'dup_q7Lm2Xa9Pt4R', message: 'Again.' },
    });
    expect(problemCode(response)).toBe('ALREADY_MEMBER');
  });
});

describe('SUP-03 profile and identity changes', () => {
  it('returns each supplier its own profile with separate statuses and no banking details', async () => {
    const tsodilo = SupplierProfile.parse((await app.callAs(as('tsodilo.admin'), api.getProfile, { tenant: 'tsodilo' })).body);
    expect(tsodilo.slug).toBe('tsodilo');
    expect(tsodilo.bankingCollected).toBe(false);
    const makgadikgadi = SupplierProfile.parse((await app.callAs(as('makgadikgadi.admin'), api.getProfile, { tenant: 'makgadikgadi' })).body);
    expect(makgadikgadi.statuses).toMatchObject({ registration: 'active', verification: 'contact_verified' });
    expect(makgadikgadi.statuses.qualification.qualifiedBuyerCount).toBe(0);
  });

  it('lets every member read the profile but only the administrator edit it', async () => {
    expect((await app.callAs(as('tsodilo.contributor'), api.getProfile, { tenant: 'tsodilo' })).status).toBe(200);
    const denied = await app.callAs(as('tsodilo.bidmanager'), api.updateProfile, {
      tenant: 'tsodilo',
      body: {
        tradingNames: [],
        website: null,
        description: null,
        yearEstablished: null,
        employeeCountBand: null,
        annualTurnoverBand: null,
        capacityOverview: null,
        serviceAreas: [],
        preferredLanguages: ['en'],
        primaryContactUserId: null,
        locations: [{ name: 'HQ', address: 'Plot 1', country: 'BW', isRegisteredOffice: true }],
        categories: ['WTR-PUMP'],
      },
    });
    expect(denied.status).toBe(403);
    expect(problemCode(denied)).toBe('FORBIDDEN');
  });

  it('rejects a primary contact who is not a member', async () => {
    const response = await app.callAs(as('tsodilo.admin'), api.updateProfile, {
      tenant: 'tsodilo',
      body: {
        tradingNames: ['Tsodilo Engineering'],
        website: null,
        description: null,
        yearEstablished: 2009,
        employeeCountBand: null,
        annualTurnoverBand: null,
        capacityOverview: null,
        serviceAreas: [],
        preferredLanguages: ['en'],
        primaryContactUserId: 28,
        locations: [{ name: 'HQ', address: 'Plot 1', country: 'BW', isRegisteredOffice: true }],
        categories: ['WTR-PUMP'],
      },
    });
    expect(problemCode(response)).toBe('PRIMARY_CONTACT_NOT_MEMBER');
  });

  it('hides another supplier’s identity change and refuses a second pending change of the same type', async () => {
    expect((await app.callAs(as('tsodilo.admin'), api.getIdentityChange, { tenant: 'tsodilo', params: { changeId: 2 } })).status).toBe(404);
    const pending = await app.callAs(as('chobe-pipe.admin'), api.createIdentityChange, {
      tenant: 'chobe-pipe',
      body: { changeType: 'ownership', proposedValue: 'New owners', reason: 'Sale.', evidenceDocumentId: 5200 },
    });
    expect(problemCode(pending)).toBe('IDENTITY_CHANGE_ALREADY_PENDING');
    const noEvidence = await app.callAs(as('tsodilo.admin'), api.createIdentityChange, {
      tenant: 'tsodilo',
      body: { changeType: 'merger', proposedValue: 'Merged with X', reason: 'Merger.', evidenceDocumentId: null },
    });
    expect(problemCode(noEvidence)).toBe('EVIDENCE_REQUIRED');
  });
});

describe('SUP-05 evidence library', () => {
  it('returns only the supplier’s own evidence and withholds financial evidence without the financial right', async () => {
    const response = await app.callAs(as('tsodilo.admin'), api.listEvidence, { tenant: 'tsodilo', query: { pageSize: 100 } });
    const page = EvidencePage.parse(response.body);
    expect(page.financialRestricted).toBe(true);
    expect(page.items.every((item) => item.id >= 401 && item.id < 500)).toBe(true);
    expect(page.items.some((item) => item.sensitivity === 'financial')).toBe(false);
    expect(page.items.some((item) => item.status === 'replaced')).toBe(false);

    const financial = await app.callAs(as('tsodilo.admin'), api.getEvidence, { tenant: 'tsodilo', params: { evidenceId: 402 } });
    expect(financial.status).toBe(403);
    expect(problemCode(financial)).toBe('FINANCIAL_EVIDENCE_RESTRICTED');
    expect((await app.callAs(as('tsodilo.admin'), api.getEvidence, { tenant: 'tsodilo', params: { evidenceId: 504 } })).status).toBe(404);
  });

  it('shows every edition and where each was formally submitted', async () => {
    const detail = EvidenceDetail.parse((await app.callAs(as('tsodilo.admin'), api.getEvidence, { tenant: 'tsodilo', params: { evidenceId: 404 } })).body);
    expect(detail.editions.map((edition) => [edition.id, edition.editionNo])).toEqual([
      [404, 2],
      [411, 1],
    ]);
    expect(detail.submissions.find((submission) => submission.contextReference === 'QA-2025-0014')).toMatchObject({ evidenceItemId: 411, editionNo: 1 });
    expect(detail.submissions.find((submission) => submission.contextReference === 'QA-2026-0002')).toMatchObject({ evidenceItemId: 404, editionNo: 2 });
    expect(detail.submissions.some((submission) => submission.contextType === 'bid_revision')).toBe(true);
    expect(detail.freshness).toBe('current');
  });

  it('denies the library to a contributor without an evidence right', async () => {
    const response = await app.callAs(as('tsodilo.contributor'), api.listEvidence, { tenant: 'tsodilo' });
    expect(response.status).toBe(403);
  });

  it('renews expiring insurance as a new edition and keeps earlier submissions (AC-09)', async () => {
    const response = await app.callAs(as('chobe-pipe.admin'), api.renewEvidence, {
      tenant: 'chobe-pipe',
      params: { evidenceId: 504 },
      body: { validFrom: '2026-10-10', expiresAt: '2027-10-09', referenceNumber: 'HIB-PL-26-0192', coverage: null, documentId: 4999 },
    });
    expect(response.status).toBe(201);
    const result = EvidenceEditionResult.parse(response.body);
    expect(result.current).toMatchObject({ editionNo: 2, replacesId: 504, status: 'current' });
    expect(result.previous.status).toBe('replaced');
    expect(result.retainedSubmissionCount).toBe(EVIDENCE_SUBMISSIONS.filter((submission) => submission.evidenceItemId === 504).length);
    expect(result.retainedSubmissionCount).toBeGreaterThanOrEqual(3);
    const notLater = await app.callAs(as('chobe-pipe.admin'), api.renewEvidence, {
      tenant: 'chobe-pipe',
      params: { evidenceId: 504 },
      body: { validFrom: '2026-01-01', expiresAt: '2026-06-01', referenceNumber: null, coverage: null, documentId: 4999 },
    });
    expect(problemCode(notLater)).toBe('RENEWAL_NOT_LATER');
  });

  it('shares with a new buyer, refuses a duplicate share, and keeps submissions when sharing is withdrawn', async () => {
    const shareOf = (itemId: number, buyerTenantId: number) =>
      EVIDENCE_SHARES.find((share) => share.evidenceItemId === itemId && share.buyerTenantId === buyerTenantId)?.id ?? 0;
    expect((await app.callAs(as('tsodilo.admin'), api.shareEvidence, { tenant: 'tsodilo', params: { evidenceId: 418 }, body: { buyerTenantId: 3 } })).status).toBe(201);
    const duplicate = await app.callAs(as('tsodilo.admin'), api.shareEvidence, { tenant: 'tsodilo', params: { evidenceId: 401 }, body: { buyerTenantId: 2 } });
    expect(problemCode(duplicate)).toBe('ALREADY_SHARED');
    const replaced = await app.callAs(as('tsodilo.admin'), api.shareEvidence, { tenant: 'tsodilo', params: { evidenceId: 411 }, body: { buyerTenantId: 3 } });
    expect(problemCode(replaced)).toBe('EVIDENCE_NOT_CURRENT');
    const withdrawn = await app.callAs(as('tsodilo.admin'), api.withdrawShare, { tenant: 'tsodilo', params: { evidenceId: 403, shareId: shareOf(403, 2) }, body: {} });
    expect(withdrawn.status).toBe(200);
    expect(api.withdrawShare.response.parse(withdrawn.body).retainedSubmissionCount).toBe(
      EVIDENCE_SUBMISSIONS.filter((submission) => submission.evidenceItemId === 403 && submission.tenantId === 2).length,
    );
    const again = await app.callAs(as('tsodilo.admin'), api.withdrawShare, { tenant: 'tsodilo', params: { evidenceId: 408, shareId: shareOf(408, 2) }, body: {} });
    expect(problemCode(again)).toBe('SHARE_ALREADY_WITHDRAWN');
  });
});

describe('BUY-31 / BUY-32 directory and relationship record', () => {
  it('shows each buyer only its own provisional suppliers and its own relationship status (BR-45)', async () => {
    const kwu = DirectoryPage.parse((await app.callAs(as('tebogo.officer'), api.listDirectory, { tenant: 'kwu', query: { pageSize: 100 } })).body);
    const odc = DirectoryPage.parse((await app.callAs(as('officer.odc'), api.listDirectory, { tenant: 'odc', query: { pageSize: 100 } })).body);
    const ids = (page: typeof kwu) => page.items.map((row) => row.supplierTenantId);
    expect(ids(kwu)).toContain(50);
    expect(ids(kwu)).not.toContain(51);
    expect(ids(odc)).toContain(51);
    expect(ids(odc)).not.toContain(50);
    expect(ids(kwu)).not.toContain(52);
    expect(kwu.items.find((row) => row.supplierTenantId === 6)?.relationship?.status).toBe('prospective');
    expect(odc.items.find((row) => row.supplierTenantId === 6)?.relationship?.status).toBe('suspended');
    expect(odc.items.find((row) => row.supplierTenantId === 6)?.qualification).toEqual([]);
    expect(kwu.items.find((row) => row.supplierTenantId === 6)?.qualification[0]?.effectiveStatus).toBe('not_assessed');
    expect(odc.items.find((row) => row.supplierTenantId === 8)?.qualification[0]?.programName).toBe('Facilities and Cleaning Contractors');
  });

  it('filters by qualification status and by category including descendants', async () => {
    const qualified = DirectoryPage.parse(
      (await app.callAs(as('tebogo.officer'), api.listDirectory, { tenant: 'kwu', query: { qualificationStatus: ['qualified', 'qualified_with_conditions'] } })).body,
    );
    expect(qualified.items.map((row) => row.slug).sort()).toEqual(['chobe-pipe', 'serowe-ict', 'tsodilo']);
    const infra = DirectoryPage.parse((await app.callAs(as('tebogo.officer'), api.listDirectory, { tenant: 'kwu', query: { category: 'WTR-INFRA', pageSize: 100 } })).body);
    expect(infra.items.map((row) => row.slug)).toEqual(expect.arrayContaining(['tsodilo', 'chobe-pipe', 'makgadikgadi']));
    expect(infra.items.map((row) => row.slug)).not.toContain('limpopo-env');
    expect(infra.items.map((row) => row.slug)).not.toContain('gaborone-meter');
  });

  it('redacts shared financial evidence for a buyer without the financial review right', async () => {
    const officer = RelationshipRecord.parse((await app.callAs(as('tebogo.officer'), api.getRelationshipRecord, { tenant: 'kwu', params: { supplierTenantId: 4 } })).body);
    const finance = RelationshipRecord.parse((await app.callAs(as('lesego.finance'), api.getRelationshipRecord, { tenant: 'kwu', params: { supplierTenantId: 4 } })).body);
    expect(officer.sharedEvidence.find((row) => row.evidenceItemId === 402)).toMatchObject({ restricted: true, issuer: null, document: null });
    expect(finance.sharedEvidence.find((row) => row.evidenceItemId === 402)).toMatchObject({ restricted: false, issuer: 'KPMG Botswana' });
    expect(officer.sharedEvidence.some((row) => row.evidenceItemId === 408)).toBe(false);
    expect(officer.relationship?.status).toBe('active');
    expect(officer.contacts.every((contact) => contact.email?.endsWith('.example') === true)).toBe(true);
  });

  it('does not find another buyer’s provisional supplier', async () => {
    expect((await app.callAs(as('tebogo.officer'), api.getRelationshipRecord, { tenant: 'kwu', params: { supplierTenantId: 51 } })).status).toBe(404);
  });

  it('answers qualification requests with the business state the fixtures imply', async () => {
    const request = (supplierTenantId: number, persona = 'tebogo.officer', tenant = 'kwu') =>
      app.callAs(as(persona), api.requestQualification, { tenant, params: { supplierTenantId }, body: { programId: 11 } });
    expect(problemCode(await request(5))).toBe('ALREADY_QUALIFIED');
    expect(problemCode(await request(6))).toBe('APPLICATION_IN_PROGRESS');
    expect(problemCode(await request(50))).toBe('SUPPLIER_NOT_ELIGIBLE_FOR_REQUEST');
    expect((await request(7)).status).toBe(201);
    expect(problemCode(await request(8, 'officer.odc', 'odc'))).toBe('PROGRAM_UNKNOWN');
  });

  it('validates relationship updates, contacts, provisional records and duplicate flags', async () => {
    const unchanged = await app.callAs(as('tebogo.officer'), api.updateRelationship, {
      tenant: 'kwu',
      params: { supplierTenantId: 4 },
      body: {
        status: 'active',
        riskRating: 'low',
        relationshipOwnerUserId: 5,
        restrictionNote: null,
        internalNotes: 'Delivered Lot 1 of the borehole pump programme on schedule; keep on the watch list for the SCADA upgrade.',
        changeReason: 'Review.',
      },
    });
    expect(problemCode(unchanged)).toBe('RELATIONSHIP_UNCHANGED');
    const foreignOwner = await app.callAs(as('tebogo.officer'), api.updateRelationship, {
      tenant: 'kwu',
      params: { supplierTenantId: 4 },
      body: { status: 'restricted', riskRating: 'medium', relationshipOwnerUserId: 23, restrictionNote: 'Hold.', internalNotes: null, changeReason: 'Review.' },
    });
    expect(problemCode(foreignOwner)).toBe('OWNER_NOT_MEMBER');
    const contact = await app.callAs(as('tebogo.officer'), api.createContact, {
      tenant: 'kwu',
      params: { supplierTenantId: 4 },
      body: { name: 'Duplicate', email: 'tumelo.sekgoma@tsodilo-engineering.example', phone: null, roleLabel: null, isPrimary: false, active: true },
    });
    expect(problemCode(contact)).toBe('CONTACT_EMAIL_DUPLICATE');
    const provisional = await app.callAs(as('tebogo.officer'), api.createProvisionalSupplier, {
      tenant: 'kwu',
      body: { legalName: 'Tsodilo Engineering', country: 'BW', contactName: 'X', contactEmail: 'x@example.com', categories: ['WTR-PUMP'] },
    });
    expect(problemCode(provisional)).toBe('POSSIBLE_DUPLICATE_SUPPLIER');
    const flagged = await app.callAs(as('tebogo.officer'), api.flagDuplicate, {
      tenant: 'kwu',
      params: { supplierTenantId: 4 },
      body: { otherSupplierTenantId: 4, detectedReason: 'similar_name', note: 'Same.' },
    });
    expect(problemCode(flagged)).toBe('SAME_SUPPLIER');
  });

  it('denies the directory to a supplier tenant (identical 403) and to a buyer administrator without the permission', async () => {
    const wrongKind = await app.callAs(as('tsodilo.admin'), api.listDirectory, { tenant: 'tsodilo' });
    expect(wrongKind.status).toBe(403);
    expect(problemCode(wrongKind)).toBe('TENANT_ACCESS_DENIED');
    const admin = await app.callAs(as('admin.kwu'), api.listDirectory, { tenant: 'kwu' });
    expect(admin.status).toBe(403);
    expect(problemCode(admin)).toBe('FORBIDDEN');
  });

  it('denies a supplier the evidence library of another supplier by tenant header', async () => {
    const response = await app.callAs(as('tsodilo.admin'), api.listEvidence, { tenant: 'chobe-pipe' });
    expect(response.status).toBe(403);
    expect(problemCode(response)).toBe('TENANT_ACCESS_DENIED');
  });
});

describe('operator reviews', () => {
  it('lists duplicates and registrations for the platform operator only', async () => {
    const duplicates = api.listDuplicates.response.parse((await app.callAs(as('ops.admin'), api.listDuplicates, { tenant: 'tenderiq-ops' })).body);
    expect(duplicates.total).toBe(5);
    const open = api.listDuplicates.response.parse(
      (await app.callAs(as('ops.admin'), api.listDuplicates, { tenant: 'tenderiq-ops', query: { status: 'open' } })).body,
    );
    expect(open.items.every((row) => row.status === 'open')).toBe(true);
    const registrations = api.listRegistrations.response.parse(
      (await app.callAs(as('ops.admin'), api.listRegistrations, { tenant: 'tenderiq-ops', query: { pageSize: 100 } })).body,
    );
    expect(registrations.items.map((row) => row.tenantId)).toEqual(expect.arrayContaining([52, 55, 56, 6]));
    expect(registrations.items.find((row) => row.tenantId === 52)?.verificationEmailStatus).toBe('send_failed');
    const support = await app.callAs(as('support.agent'), api.listDuplicates, { tenant: 'tenderiq-ops' });
    expect(support.status).toBe(403);
    expect((await app.callAs(as('tebogo.officer'), api.listDuplicates, { tenant: 'kwu' })).status).toBe(403);
  });

  it('decides duplicates only once and requires a surviving record among the pair', async () => {
    const decided = await app.callAs(as('ops.admin'), api.decideDuplicate, {
      tenant: 'tenderiq-ops',
      params: { candidateId: 4 },
      body: { decision: 'not_duplicate', reason: 'Checked.' },
    });
    expect(problemCode(decided)).toBe('DUPLICATE_ALREADY_DECIDED');
    const invalid = await app.callAs(as('ops.admin'), api.decideDuplicate, {
      tenant: 'tenderiq-ops',
      params: { candidateId: 1 },
      body: { decision: 'merged', survivingTenantId: 7, reason: 'Same.' },
    });
    expect(problemCode(invalid)).toBe('SURVIVING_TENANT_INVALID');
    const merged = await app.callAs(as('ops.admin'), api.decideDuplicate, {
      tenant: 'tenderiq-ops',
      params: { candidateId: 1 },
      body: { decision: 'not_duplicate', reason: 'Different registration numbers confirmed in CIPA.' },
    });
    expect(merged.status).toBe(200);
  });

  it('verifies identity only after contact verification and closes only pending registrations', async () => {
    expect(problemCode(await app.callAs(as('ops.admin'), api.verifyIdentity, { tenant: 'tenderiq-ops', params: { supplierTenantId: 52 }, body: { evidenceNote: 'CIPA.' } }))).toBe(
      'CONTACT_NOT_VERIFIED',
    );
    const verified = await app.callAs(as('ops.admin'), api.verifyIdentity, { tenant: 'tenderiq-ops', params: { supplierTenantId: 6 }, body: { evidenceNote: 'CIPA extract.' } });
    expect(api.verifyIdentity.response.parse(verified.body).verificationStatus).toBe('identity_verified');
    expect(problemCode(await app.callAs(as('ops.admin'), api.closeRegistration, { tenant: 'tenderiq-ops', params: { supplierTenantId: 57 }, body: { reason: 'Old.' } }))).toBe(
      'REGISTRATION_NOT_PENDING',
    );
  });

  it('reviews identity changes through their states', async () => {
    const started = await app.callAs(as('ops.admin'), api.startIdentityReview, { tenant: 'tenderiq-ops', params: { changeId: 2 } });
    expect(api.startIdentityReview.response.parse(started.body).status).toBe('under_review');
    expect(problemCode(await app.callAs(as('ops.admin'), api.startIdentityReview, { tenant: 'tenderiq-ops', params: { changeId: 3 } }))).toBe(
      'IDENTITY_CHANGE_NOT_SUBMITTED',
    );
    const approved = await app.callAs(as('ops.admin'), api.decideIdentityChange, {
      tenant: 'tenderiq-ops',
      params: { changeId: 3 },
      body: { decision: 'approved', effectiveDate: '2026-10-05', decisionNote: 'Board resolution verified.' },
    });
    expect(api.decideIdentityChange.response.parse(approved.body).effectiveAt).toBe('2026-10-04T22:00:00Z');
    expect(problemCode(await app.callAs(as('ops.admin'), api.decideIdentityChange, { tenant: 'tenderiq-ops', params: { changeId: 1 }, body: { decision: 'rejected', decisionNote: 'No.' } }))).toBe(
      'IDENTITY_CHANGE_ALREADY_DECIDED',
    );
    const detail = api.getOpsIdentityChange.response.parse((await app.callAs(as('ops.admin'), api.getOpsIdentityChange, { tenant: 'tenderiq-ops', params: { changeId: 1 } })).body);
    expect(detail.legalNameHistory).toHaveLength(2);
    expect(detail.historicSubmissionCount).toBeGreaterThan(0);
  });
});

describe('owner and contact choices', () => {
  it('offers only active members of the active organization as relationship owners and primary contacts', async () => {
    const directory = DirectoryPage.parse((await app.callAs(as('tebogo.officer'), api.listDirectory, { tenant: 'kwu' })).body);
    const record = RelationshipRecord.parse(
      (await app.callAs(as('tebogo.officer'), api.getRelationshipRecord, { tenant: 'kwu', params: { supplierTenantId: 5 } })).body,
    );
    const odc = DirectoryPage.parse((await app.callAs(as('officer.odc'), api.listDirectory, { tenant: 'odc' })).body);
    const profile = SupplierProfile.parse((await app.callAs(as('tsodilo.admin'), api.getProfile, { tenant: 'tsodilo' })).body);

    const kwuIds = directory.ownerOptions.map((person) => person.userId);
    expect(kwuIds).toContain(5);
    expect(kwuIds).not.toContain(21);
    expect(kwuIds).not.toContain(23);
    expect(record.ownerOptions).toEqual(directory.ownerOptions);
    expect(odc.ownerOptions.map((person) => person.userId)).toEqual(expect.arrayContaining([22, 23]));
    expect(odc.ownerOptions.map((person) => person.userId)).not.toContain(5);
    expect(profile.memberOptions.map((person) => person.userId)).toEqual(expect.arrayContaining([24, 25]));
    expect(profile.memberOptions.map((person) => person.userId)).not.toContain(28);
  });
});

describe('reference lists and claiming an invited organization (SUP-02)', () => {
  it('serves the countries, evidence currencies and default country without signing in', async () => {
    const response = await app.request('GET', api.referenceOptions.path);
    expect(response.status).toBe(200);
    const options = api.referenceOptions.response.parse(response.body);
    expect(options.defaultCountry).toBe('BW');
    expect(options.countries.map((option) => option.code)).toContain('BW');
    expect(options.currencies.map((option) => option.code)).toEqual(expect.arrayContaining(['BWP', 'ZAR']));
  });

  it('shows the invited contact the provisional organization and the inviting buyer with a masked address', async () => {
    const response = await app.request('GET', '/api/v1/public/supplier-registrations/claims/clm_K4sBoreh0le7Qx2');
    expect(response.status).toBe(200);
    const view = api.getClaimInvitation.response.parse(response.body);
    expect(view).toMatchObject({ state: 'pending', contactName: 'Onkemetse Dube', qualificationStatus: 'not_assessed' });
    expect(view.organization.legalName).toBe('Kasane Borehole Drilling (Pty) Ltd');
    expect(view.invitedBy.tenantName).toContain('Kalahari Water Utilities');
    expect(view.emailHint).toBe('o•••@kasane-drilling.example');
    expect(response.text).not.toContain('onkemetse.dube@');
    expect(response.text).not.toContain('market sounding');
  });

  it('reports an expired invitation and an unknown token', async () => {
    const expired = api.getClaimInvitation.response.parse((await app.request('GET', '/api/v1/public/supplier-registrations/claims/clm_Ch0beVa1ves9Kn')).body);
    expect(expired.state).toBe('expired');
    expect(expired.stateNote).not.toBeNull();
    expect((await app.request('GET', '/api/v1/public/supplier-registrations/claims/clm_Unknown000')).status).toBe(404);
    expect((await app.request('GET', '/api/v1/public/supplier-registrations/claims/not-a-token')).status).toBe(422);
  });

  it('claims with the invited address only, and the result is registered but not qualified', async () => {
    const body = {
      fullName: 'Onkemetse Dube',
      email: 'onkemetse.dube@kasane-drilling.example',
      registrationJurisdiction: 'Botswana — CIPA',
      registrationNumber: 'BW00008877665',
      locations: [{ name: 'Registered office', address: 'Plot 5, Kasane', country: 'BW', isRegisteredOffice: true }],
      categories: ['WTR-PUMP'],
      preferredLanguages: ['en'],
      acceptTerms: true,
    };
    const path = '/api/v1/public/supplier-registrations/claims/clm_K4sBoreh0le7Qx2';
    const mismatch = await app.request('POST', path, { body: { ...body, email: 'someone.else@kasane-drilling.example' } });
    expect(problemCode(mismatch)).toBe('CLAIM_EMAIL_MISMATCH');
    const claimed = await app.request('POST', path, { body });
    expect(claimed.status).toBe(201);
    const result = RegistrationResult.parse(claimed.body);
    expect(result).toMatchObject({ registrationId: 50, organizationStatus: 'pending', verificationStatus: 'unverified', qualificationStatus: 'not_assessed', bankingCollected: false });
    const expired = await app.request('POST', '/api/v1/public/supplier-registrations/claims/clm_Ch0beVa1ves9Kn', { body: { ...body, email: 'kabelo@chobe-valves-kasane.example' } });
    expect(problemCode(expired)).toBe('INVITATION_EXPIRED');
  });

  it('shows the claim invitation only to the buyer that created the provisional record', async () => {
    const kwu = RelationshipRecord.parse((await app.callAs(as('tebogo.officer'), api.getRelationshipRecord, { tenant: 'kwu', params: { supplierTenantId: 50 } })).body);
    expect(kwu.claimInvitation).toMatchObject({ state: 'pending', contactName: 'Onkemetse Dube', claimPath: '/register/claim/clm_K4sBoreh0le7Qx2' });
    const tsodilo = RelationshipRecord.parse((await app.callAs(as('tebogo.officer'), api.getRelationshipRecord, { tenant: 'kwu', params: { supplierTenantId: 4 } })).body);
    expect(tsodilo.claimInvitation).toBeNull();
  });
});

describe('missing identity evidence (SUP-02 resolve missing evidence, OPS-01)', () => {
  it('shows the open request on the supplier profile, requested by the operations team', async () => {
    const profile = SupplierProfile.parse((await app.callAs(as('makgadikgadi.admin'), api.getProfile, { tenant: 'makgadikgadi' })).body);
    expect(profile.statuses).toMatchObject({ registration: 'active', verification: 'contact_verified' });
    const open = profile.verificationRequests.find((request) => request.status === 'open');
    expect(open).toMatchObject({ id: 2, evidenceTypes: ['registration', 'declaration'], requestedBy: 'TenderIQ platform operations' });
  });

  it('answers the request only with current evidence that covers every requested kind', async () => {
    const respond = (evidenceItemIds: number[], requestId = 2) =>
      app.callAs(as('makgadikgadi.admin'), api.respondVerificationRequest, { tenant: 'makgadikgadi', params: { requestId }, body: { evidenceItemIds, note: 'Extract attached.' } });
    expect(problemCode(await respond([601]))).toBe('EVIDENCE_TYPES_NOT_COVERED');
    expect(problemCode(await respond([401]))).toBe('EVIDENCE_NOT_CURRENT');
    const answered = await respond([601, 606]);
    expect(answered.status).toBe(200);
    const request = VerificationRequest.parse(answered.body);
    expect(request.status).toBe('answered');
    expect(request.response?.evidence.map((item) => item.evidenceItemId)).toEqual([601, 606]);
    const other = await app.callAs(as('chobe-pipe.admin'), api.respondVerificationRequest, { tenant: 'chobe-pipe', params: { requestId: 1 }, body: { evidenceItemIds: [501], note: null } });
    expect(problemCode(other)).toBe('VERIFICATION_REQUEST_NOT_OPEN');
    const foreign = await app.callAs(as('chobe-pipe.admin'), api.respondVerificationRequest, { tenant: 'chobe-pipe', params: { requestId: 2 }, body: { evidenceItemIds: [501], note: null } });
    expect(foreign.status).toBe(404);
  });

  it('lets the operator request missing evidence once per organization in the registration queue', async () => {
    const request = (supplierTenantId: number, dueDate: string | null = '2026-10-20') =>
      app.callAs(as('ops.admin'), api.requestVerificationEvidence, {
        tenant: 'tenderiq-ops',
        params: { supplierTenantId },
        body: { reason: 'Upload the incorporation certificate.', evidenceTypes: ['registration'], dueDate },
      });
    expect(problemCode(await request(6))).toBe('VERIFICATION_REQUEST_OPEN');
    expect((await request(7)).status).toBe(404);
    expect(problemCode(await request(55, '2026-09-01'))).toBe('DUE_DATE_IN_PAST');
    const created = await request(55);
    expect(created.status).toBe(200);
    expect(api.requestVerificationEvidence.response.parse(created.body).evidenceRequest).toMatchObject({ status: 'open', evidenceTypes: ['registration'] });
    const registrations = api.listRegistrations.response.parse(
      (await app.callAs(as('ops.admin'), api.listRegistrations, { tenant: 'tenderiq-ops', query: { pageSize: 100 } })).body,
    );
    expect(registrations.items.find((row) => row.tenantId === 6)?.evidenceRequest).toMatchObject({ id: 2, status: 'open' });
  });
});

describe('financial evidence audience on the supplier side (PRD §4.3)', () => {
  it('shows financial statements to a supplier finance member and hides them from the administrator', () => {
    const finance = [...ROLE_TEMPLATES.supplier_finance.permissions];
    const admin = [...ROLE_TEMPLATES.supplier_admin.permissions];
    expect(canViewFinancial(finance)).toBe(true);
    expect(canViewFinancial(admin)).toBe(false);
    expect(visibleEvidence(4, finance).map((item) => item.id)).toEqual(expect.arrayContaining([402, 410]));
    expect(visibleEvidence(4, admin).some((item) => item.sensitivity === 'financial')).toBe(false);
  });
});

describe('BUY-32 contracts and performance', () => {
  it('lists the contracts-domain contracts with their latest performance outcome, never another buyer’s', async () => {
    const record = RelationshipRecord.parse((await app.callAs(as('tebogo.officer'), api.getRelationshipRecord, { tenant: 'kwu', params: { supplierTenantId: 4 } })).body);
    expect(record.contracts.map((row) => [row.contractId, row.reference])).toEqual(
      expect.arrayContaining([
        [1, 'C-2026-0001'],
        [2, 'C-2026-0002'],
        [3, 'C-2026-0003'],
        [8, 'C-2026-0004'],
      ]),
    );
    expect(record.contracts.find((row) => row.reference === 'C-2026-0001')?.performance).toMatchObject({ overallRating: 'partially_meets', supplierDisputes: true });
    const meter = RelationshipRecord.parse((await app.callAs(as('tebogo.officer'), api.getRelationshipRecord, { tenant: 'kwu', params: { supplierTenantId: 9 } })).body);
    expect(meter.contracts).toEqual([expect.objectContaining({ contractId: 4, reference: 'C-2025-0007' })]);
    const odc = RelationshipRecord.parse((await app.callAs(as('officer.odc'), api.getRelationshipRecord, { tenant: 'odc', params: { supplierTenantId: 8 } })).body);
    expect(odc.contracts.map((row) => row.reference)).toEqual(['C-2025-0004']);
    const directory = DirectoryPage.parse((await app.callAs(as('tebogo.officer'), api.listDirectory, { tenant: 'kwu', query: { pageSize: 100 } })).body);
    expect(directory.items.find((row) => row.supplierTenantId === 5)?.contractCount).toBe(1);
  });
});
