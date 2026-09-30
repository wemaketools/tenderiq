/**
 * The opening contract: endpoint definitions, AC-15 permission boundaries and the BR-22 / FR-13 body rules.
 */
import { describe, expect, it } from 'vitest';

import { splitIssueMessage } from '../common.js';
import { endpointPermissions, validateEndpointDefinition } from '../endpoint.js';
import type { AnyEndpoint } from '../endpoint.js';
import {
  ASSESSMENT_REQUEST_VIEW_PERMISSIONS,
  CLARIFICATION_VIEW_PERMISSIONS,
  COMPLIANCE_VIEW_PERMISSIONS,
  ConsistentComplianceCheck,
  OPENING_VIEW_PERMISSIONS,
  ProposeExclusionBody,
  RecordCheckBody,
  RespondAssessmentRequestBody,
  ScheduleOpeningSessionBody,
  openingEndpoints,
} from '../opening.js';
import { ROLE_TEMPLATES, SUPPORT_GRANT_PERMISSIONS, templatePermissions } from '../permissions.js';
import type { PermissionCode } from '../permissions.js';

const ENDPOINTS: AnyEndpoint[] = Object.values(openingEndpoints);

function codesOf(result: { success: boolean; error?: { issues: Array<{ message: string }> } }): string[] {
  return result.success ? [] : (result.error?.issues ?? []).map((item) => splitIssueMessage(item.message).code);
}

describe('openingEndpoints', () => {
  it('defines 30 valid endpoints with unique ids and routes', () => {
    // Assert
    expect(ENDPOINTS).toHaveLength(30);
    for (const endpoint of ENDPOINTS) {
      expect(validateEndpointDefinition(endpoint)).toEqual([]);
    }
    expect(new Set(ENDPOINTS.map((endpoint) => endpoint.id)).size).toBe(ENDPOINTS.length);
    expect(new Set(ENDPOINTS.map((endpoint) => `${endpoint.method} ${endpoint.path}`)).size).toBe(ENDPOINTS.length);
  });

  it('covers every screen of the domain', () => {
    // Act
    const screens = new Set(ENDPOINTS.flatMap((endpoint) => [...endpoint.screens]));

    // Assert
    expect([...screens].sort()).toEqual(['BUY-20', 'BUY-21', 'EVA-03', 'SUP-18']);
  });

  it('marks record-creating commands idempotent with status 201', () => {
    // Assert
    for (const endpoint of [openingEndpoints.scheduleSession, openingEndpoints.raiseClarification, openingEndpoints.proposeExclusion]) {
      expect(endpoint.idempotent).toBe(true);
      expect(endpoint.status).toBe(201);
    }
  });

  it('declares the business error codes the UI shows for opening, gates and exclusions', () => {
    // Assert
    expect(openingEndpoints.openSession.errors).toEqual(
      expect.arrayContaining(['QUORUM_NOT_MET', 'PRICE_GATE_NOT_RELEASED', 'STAGE_OUT_OF_ORDER', 'NOT_OPENING_OFFICER']),
    );
    expect(openingEndpoints.proposeExclusion.errors).toEqual(expect.arrayContaining(['CHECKS_NOT_FAILED', 'EXCLUSION_ALREADY_ACTIVE']));
    expect(openingEndpoints.respondAssessmentRequest.errors).toEqual(['REQUEST_NOT_OPEN', 'RESPONSE_DEADLINE_PASSED']);
  });
});

describe('permission boundaries (AC-15, BR-26)', () => {
  const restricted: Array<[string, readonly PermissionCode[]]> = [
    ['org_admin', templatePermissions('org_admin')],
    ['auditor', templatePermissions('auditor')],
    ['support grant', SUPPORT_GRANT_PERMISSIONS],
  ];

  it.each(restricted)('gives %s no buyer opening, compliance or clarification endpoint', (_name, granted) => {
    // Act
    const reachable = ENDPOINTS.filter(
      (endpoint) => endpoint.audience === 'buyer' && endpointPermissions(endpoint).some((code) => granted.includes(code)),
    );

    // Assert
    expect(reachable.map((endpoint) => endpoint.id)).toEqual([]);
  });

  it('lets the opening officer and the witness read sessions but only the officer open them', () => {
    // Arrange
    const officer = ROLE_TEMPLATES.opening_officer.permissions as readonly PermissionCode[];

    // Assert
    expect(OPENING_VIEW_PERMISSIONS.some((code) => officer.includes(code))).toBe(true);
    expect(endpointPermissions(openingEndpoints.openSession)).toEqual(['bid.open']);
    expect(endpointPermissions(openingEndpoints.confirmParticipant)).toEqual(['bid.open', 'bid.witness']);
  });

  it('keeps compliance and clarification reads away from supplier permissions', () => {
    // Assert
    expect(COMPLIANCE_VIEW_PERMISSIONS.every((code) => !code.startsWith('supplier.'))).toBe(true);
    expect(CLARIFICATION_VIEW_PERMISSIONS.every((code) => !code.startsWith('supplier.'))).toBe(true);
    expect(ASSESSMENT_REQUEST_VIEW_PERMISSIONS.every((code) => code.startsWith('supplier.'))).toBe(true);
  });
});

describe('RecordCheckBody (FR-13)', () => {
  it('rejects a not applicable result without a reason', () => {
    // Act
    const result = RecordCheckBody.safeParse({ result: 'not_applicable', findingClass: 'none' });

    // Assert
    expect(codesOf(result)).toEqual(['REASON_REQUIRED']);
  });

  it('rejects a failure without evidence, reason or a failure class', () => {
    // Act
    const result = RecordCheckBody.safeParse({ result: 'fail', findingClass: 'clarifiable' });

    // Assert
    expect(codesOf(result)).toEqual(expect.arrayContaining(['EVIDENCE_REQUIRED', 'REASON_REQUIRED', 'FINDING_CLASS_MISMATCH']));
  });

  it('accepts a cited substantive failure', () => {
    // Act
    const result = RecordCheckBody.safeParse({
      result: 'fail',
      findingClass: 'substantive_noncompliance',
      reason: 'No valid certificate at closing.',
      evidenceRef: 'Qualification envelope, item 4.',
    });

    // Assert
    expect(result.success).toBe(true);
  });

  it('only sends clarifiable matters for clarification', () => {
    // Act
    const result = RecordCheckBody.safeParse({ result: 'clarification_required', findingClass: 'substantive_noncompliance', evidenceRef: 'Form C' });

    // Assert
    expect(codesOf(result)).toEqual(['FINDING_CLASS_MISMATCH']);
  });

  it('refuses to reset a check to pending', () => {
    // Act
    const result = RecordCheckBody.safeParse({ result: 'pending', findingClass: 'none' });

    // Assert
    expect(result.success).toBe(false);
  });

  it('validates stored checks with the same rules', () => {
    // Act
    const result = ConsistentComplianceCheck.safeParse({
      id: 1,
      bidId: 1,
      revisionId: 11,
      checkType: 'securities',
      requirement: null,
      findingClass: 'none',
      result: 'not_applicable',
      reason: null,
      evidenceRef: null,
      assessedBy: null,
      assessedAt: null,
    });

    // Assert
    expect(codesOf(result)).toEqual(['REASON_REQUIRED']);
  });
});

describe('ScheduleOpeningSessionBody', () => {
  const base = { tenderId: 8, envelope: 'qualification', scheduledAt: '2026-10-02T08:00:00Z', quorumRequired: 2 };

  it('requires exactly one opening officer and a witness or committee member', () => {
    // Act
    const result = ScheduleOpeningSessionBody.safeParse({
      ...base,
      participants: [
        { userId: 15, role: 'observer' },
        { userId: 10, role: 'observer' },
      ],
    });

    // Assert
    expect(codesOf(result)).toEqual(expect.arrayContaining(['OPENING_OFFICER_REQUIRED', 'WITNESS_REQUIRED', 'QUORUM_EXCEEDS_PARTICIPANTS']));
  });

  it('rejects the same person twice', () => {
    // Act
    const result = ScheduleOpeningSessionBody.safeParse({
      ...base,
      participants: [
        { userId: 15, role: 'opening_officer' },
        { userId: 15, role: 'witness' },
      ],
    });

    // Assert
    expect(codesOf(result)).toEqual(['DUPLICATE_PARTICIPANT']);
  });

  it('accepts an officer and a witness with a quorum of two', () => {
    // Act
    const result = ScheduleOpeningSessionBody.safeParse({
      ...base,
      participants: [
        { userId: 15, role: 'opening_officer' },
        { userId: 16, role: 'witness' },
      ],
    });

    // Assert
    expect(result.success).toBe(true);
  });
});

describe('supplier and exclusion bodies (BR-22, AC-17)', () => {
  it('requires the supplier to confirm that a response does not change its offer', () => {
    // Act
    const result = RespondAssessmentRequestBody.safeParse({ responseText: 'Confirmed.', offerUnchangedConfirmed: false });

    // Assert
    expect(codesOf(result)).toEqual(['OFFER_UNCHANGED_CONFIRMATION_REQUIRED']);
  });

  it('requires grounds, cited checks and a challenge route for an exclusion', () => {
    // Act
    const result = ProposeExclusionBody.safeParse({ bidId: 3003, grounds: 'short', checkIds: [], challengeRoute: '' });

    // Assert
    expect(codesOf(result)).toEqual(expect.arrayContaining(['GROUNDS_REQUIRED', 'CHECKS_REQUIRED', 'CHALLENGE_ROUTE_REQUIRED']));
  });
});
