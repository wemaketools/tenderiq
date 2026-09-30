/**
 * Suppliers contract: the endpoint map is well formed (audiences, permissions, screens, errors) and the input
 * schemas enforce the business rules the UI shows (separate registration statuses, no banking fields, evidence
 * rules, decision refinements).
 */
import { describe, expect, it } from 'vitest';

import { endpointPermissions } from '../endpoint.js';
import {
  ClaimInvitationView,
  ClaimOrganizationBody,
  CreateEvidenceBody,
  DecideDuplicateBody,
  DecideIdentityChangeBody,
  DecideMembershipRequestBody,
  DuplicateCheckResult,
  RegistrationBody,
  RenewEvidenceBody,
  RequestVerificationEvidenceBody,
  RespondVerificationRequestBody,
  UpdateRelationshipBody,
  suppliersEndpoints,
} from '../suppliers.js';

const endpoints = Object.values(suppliersEndpoints);

const validRegistration = {
  legalName: 'Letlhakane Solar Installations (Pty) Ltd',
  country: 'BW',
  registrationJurisdiction: 'Botswana — CIPA',
  registrationNumber: 'BW00008123456',
  contact: { fullName: 'Boipelo Seleka', email: 'Boipelo@Letlhakane-Solar.example' },
  locations: [{ name: 'Head office', address: 'Plot 77, Letlhakane', country: 'BW', isRegisteredOffice: true }],
  categories: ['WTR-PUMP'],
  preferredLanguages: ['en'],
  acceptTerms: true,
};

function codesOf(result: { success: boolean; error?: { issues: { message: string }[] } }): string[] {
  return (result.error?.issues ?? []).map((entry) => entry.message.split('|')[0] ?? '');
}

describe('suppliers endpoint map', () => {
  it('defines 47 endpoints with unique ids and METHOD path pairs', () => {
    expect(endpoints).toHaveLength(47);
    expect(new Set(endpoints.map((endpoint) => endpoint.id)).size).toBe(endpoints.length);
    expect(new Set(endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`)).size).toBe(endpoints.length);
  });

  it('names the suppliers domain in every id and references the domain screens', () => {
    for (const endpoint of endpoints) {
      expect(endpoint.id.split('.')[1]).toBe('suppliers');
      expect(endpoint.screens.length).toBeGreaterThan(0);
    }
    const screens = new Set(endpoints.flatMap((endpoint) => endpoint.screens));
    for (const screen of ['SUP-02', 'SUP-03', 'SUP-05', 'BUY-31', 'BUY-32', 'OPS-01']) {
      expect(screens).toContain(screen);
    }
  });

  it('requires a permission of the right kind on every tenant audience and none on public endpoints', () => {
    for (const endpoint of endpoints) {
      const permissions = endpointPermissions(endpoint);
      if (endpoint.audience === 'public' || endpoint.audience === 'me') {
        expect(permissions, endpoint.id).toHaveLength(0);
      } else {
        expect(permissions.length, endpoint.id).toBeGreaterThan(0);
      }
    }
    expect(suppliersEndpoints.listDirectory.permission).toBe('supplier.directory.view');
    expect(suppliersEndpoints.updateRelationship.permission).toBe('supplier.relationship.manage');
    expect(suppliersEndpoints.flagDuplicate.permission).toBe('supplier.duplicates.review');
    expect(suppliersEndpoints.shareEvidence.permission).toBe('supplier.evidence.share');
  });

  it('marks record-creating commands idempotent (DD-39)', () => {
    for (const endpoint of [
      suppliersEndpoints.register,
      suppliersEndpoints.claimOrganization,
      suppliersEndpoints.createEvidence,
      suppliersEndpoints.replaceEvidence,
      suppliersEndpoints.renewEvidence,
      suppliersEndpoints.createIdentityChange,
      suppliersEndpoints.createProvisionalSupplier,
    ]) {
      expect(endpoint.idempotent, endpoint.id).toBe(true);
      expect(endpoint.status).toBe(201);
    }
  });
});

describe('registration schemas', () => {
  it('accepts a complete registration and normalizes the e-mail, without any banking field', () => {
    const parsed = RegistrationBody.parse(validRegistration);
    expect(parsed.contact.email).toBe('boipelo@letlhakane-solar.example');
    expect(Object.keys(RegistrationBody.shape)).not.toContain('bankAccount');
    expect(Object.keys(RegistrationBody.shape).some((key) => key.toLowerCase().includes('bank'))).toBe(false);
  });

  it('rejects a registration without accepted terms, categories or a single registered office', () => {
    const result = RegistrationBody.safeParse({
      ...validRegistration,
      acceptTerms: false,
      categories: [],
      locations: [{ ...validRegistration.locations[0], isRegisteredOffice: false }],
    });
    expect(result.success).toBe(false);
    expect(codesOf(result)).toEqual(expect.arrayContaining(['TERMS_REQUIRED', 'CATEGORY_REQUIRED', 'REGISTERED_OFFICE_REQUIRED']));
  });

  it('lets the duplicate check disclose only an outcome, a token and a message', () => {
    expect(Object.keys(DuplicateCheckResult.shape).sort()).toEqual(['matchToken', 'message', 'outcome']);
  });
});

describe('evidence and decision schemas', () => {
  const evidence = {
    evidenceType: 'insurance',
    sensitivity: 'general',
    title: 'Public liability insurance',
    issuer: 'Hollard',
    referenceNumber: null,
    periodStart: null,
    periodEnd: null,
    reportingCurrency: null,
    isConsolidated: null,
    coverage: null,
    validFrom: '2026-10-01',
    expiresAt: '2026-09-01',
    documentId: 4001,
  };

  it('requires insurance coverage and an expiry after the start of validity', () => {
    expect(codesOf(CreateEvidenceBody.safeParse(evidence))).toEqual(expect.arrayContaining(['EXPIRY_BEFORE_START', 'COVERAGE_REQUIRED']));
  });

  it('requires the reporting period and currency for financial statements', () => {
    const result = CreateEvidenceBody.safeParse({ ...evidence, evidenceType: 'financial_statement', sensitivity: 'financial', expiresAt: null });
    expect(codesOf(result)).toContain('REPORTING_PERIOD_REQUIRED');
  });

  it('requires a renewal to end after it starts', () => {
    const result = RenewEvidenceBody.safeParse({ validFrom: '2026-10-10', expiresAt: '2026-10-09', referenceNumber: null, coverage: null, documentId: 1 });
    expect(codesOf(result)).toContain('EXPIRY_BEFORE_START');
  });

  it('requires a capacity to approve and a note to reject a membership request', () => {
    expect(codesOf(DecideMembershipRequestBody.safeParse({ decision: 'approved' }))).toContain('CAPACITY_REQUIRED');
    expect(codesOf(DecideMembershipRequestBody.safeParse({ decision: 'rejected' }))).toContain('DECISION_NOTE_REQUIRED');
  });

  it('requires a surviving organization to merge and an effective date to approve an identity change', () => {
    expect(codesOf(DecideDuplicateBody.safeParse({ decision: 'merged', reason: 'Same company.' }))).toContain('SURVIVING_TENANT_REQUIRED');
    expect(codesOf(DecideIdentityChangeBody.safeParse({ decision: 'approved', decisionNote: 'Verified.' }))).toContain('EFFECTIVE_DATE_REQUIRED');
  });

  it('requires a restriction note when a relationship is restricted or suspended', () => {
    const result = UpdateRelationshipBody.safeParse({
      status: 'suspended',
      riskRating: 'high',
      relationshipOwnerUserId: 5,
      restrictionNote: null,
      internalNotes: null,
      changeReason: 'Safety incident.',
    });
    expect(codesOf(result)).toContain('RESTRICTION_NOTE_REQUIRED');
  });
});

describe('claim and verification schemas', () => {
  const claim = {
    fullName: 'Onkemetse Dube',
    email: 'Onkemetse.Dube@kasane-drilling.example',
    registrationJurisdiction: 'Botswana — CIPA',
    registrationNumber: 'BW00008877665',
    locations: [{ name: 'Registered office', address: 'Plot 5, Kasane', country: 'BW', isRegisteredOffice: true }],
    categories: ['WTR-PUMP'],
    preferredLanguages: ['en'],
    acceptTerms: true,
  };

  it('accepts a complete claim with a normalized e-mail and collects no banking details', () => {
    const parsed = ClaimOrganizationBody.parse(claim);
    expect(parsed.email).toBe('onkemetse.dube@kasane-drilling.example');
    expect(Object.keys(ClaimOrganizationBody.shape).some((key) => key.toLowerCase().includes('bank'))).toBe(false);
  });

  it('rejects a claim without accepted terms or a registration number', () => {
    const result = ClaimOrganizationBody.safeParse({ ...claim, acceptTerms: false, registrationNumber: ' ' });
    expect(codesOf(result)).toEqual(expect.arrayContaining(['TERMS_REQUIRED', 'REGISTRATION_NUMBER_REQUIRED']));
  });

  it('shows the claim page no assessment, only a masked address and the not-assessed qualification status', () => {
    expect(Object.keys(ClaimInvitationView.shape)).not.toContain('email');
    expect(Object.keys(ClaimInvitationView.shape)).toContain('emailHint');
    expect(ClaimInvitationView.shape.qualificationStatus.options).toContain('not_assessed');
  });

  it('requires a reason and distinct evidence kinds to request missing evidence', () => {
    const result = RequestVerificationEvidenceBody.safeParse({ reason: '', evidenceTypes: ['registration', 'registration'], dueDate: null });
    expect(codesOf(result)).toEqual(expect.arrayContaining(['REASON_REQUIRED', 'DUPLICATE_EVIDENCE_TYPE']));
    expect(codesOf(RequestVerificationEvidenceBody.safeParse({ reason: 'Missing.', evidenceTypes: [], dueDate: null }))).toContain('EVIDENCE_TYPE_REQUIRED');
  });

  it('requires at least one evidence item to answer a verification request', () => {
    expect(codesOf(RespondVerificationRequestBody.safeParse({ evidenceItemIds: [], note: null }))).toContain('EVIDENCE_REQUIRED');
  });
});
