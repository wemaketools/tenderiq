/**
 * Records contract: every endpoint is well formed, and the command schemas enforce the ADM-14 rules the UI shows
 * (a records hold must block disposal, disposal approval confirms eligibility, evidence packs name a subject).
 */
import { describe, expect, it } from 'vitest';

import { validateEndpointDefinition } from '../endpoint.js';
import {
  CreateEvidencePackBody,
  CreateHoldBody,
  DisposalDecisionBody,
  ExecuteDisposalBody,
  UpdateRetentionClassBody,
  recordsEndpoints,
} from '../records.js';

const endpoints = Object.values(recordsEndpoints);

describe('recordsEndpoints', () => {
  it('defines every endpoint validly under /api/v1/buyer/records with ADM-14', () => {
    const problems = endpoints.flatMap((endpoint) => validateEndpointDefinition(endpoint));
    expect(problems).toEqual([]);
    expect(endpoints).toHaveLength(16);
    for (const endpoint of endpoints) {
      expect(endpoint.path.startsWith('/api/v1/buyer/records/')).toBe(true);
      expect(endpoint.screens).toContain('ADM-14');
    }
  });

  it('requires the specific records permission on each command', () => {
    expect(recordsEndpoints.approveDisposalRequest.permission).toBe('records.disposal.approve');
    expect(recordsEndpoints.executeDisposalRequest.permission).toBe('records.disposal.approve');
    expect(recordsEndpoints.createHold.permission).toBe('records.hold.manage');
    expect(recordsEndpoints.releaseHold.permission).toBe('records.hold.manage');
    expect(recordsEndpoints.updateRetentionClass.permission).toBe('records.retention.manage');
    expect(recordsEndpoints.createEvidencePack.permission).toBe('export.create');
    expect(recordsEndpoints.listAuditEvents.permission).toBe('audit.view');
  });

  it('declares DISPOSAL_BLOCKED_BY_HOLD on approval and execution (AC-35)', () => {
    expect(recordsEndpoints.approveDisposalRequest.errors).toContain('DISPOSAL_BLOCKED_BY_HOLD');
    expect(recordsEndpoints.executeDisposalRequest.errors).toContain('DISPOSAL_BLOCKED_BY_HOLD');
  });
});

describe('records command schemas', () => {
  const hold = {
    subjectType: 'tender',
    subjectId: 3,
    holdType: 'legal_hold',
    reason: 'Pending claim',
    authorityNote: 'Legal counsel instruction',
    scopeDescription: 'All records of the event',
    reviewDate: '2027-03-31',
    blockedActions: ['disposal'],
  };

  it('rejects a records hold that does not block disposal', () => {
    const result = CreateHoldBody.safeParse({ ...hold, blockedActions: ['publish'] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/^HOLD_MUST_BLOCK_DISPOSAL\|/);
  });

  it('accepts only legal and investigation holds', () => {
    expect(CreateHoldBody.safeParse(hold).success).toBe(true);
    expect(CreateHoldBody.safeParse({ ...hold, holdType: 'complaint_hold' }).success).toBe(false);
  });

  it('requires an explicit eligibility confirmation to approve a disposal', () => {
    expect(DisposalDecisionBody.safeParse({ reason: 'Eligible', confirmEligibility: true }).success).toBe(true);
    const missing = DisposalDecisionBody.safeParse({ reason: 'Eligible', confirmEligibility: false });
    expect(missing.error?.issues[0]?.message).toMatch(/^CONFIRMATION_REQUIRED\|/);
  });

  it('requires a disposition record to execute a disposal', () => {
    const result = ExecuteDisposalBody.safeParse({ dispositionRecord: 'done' });
    expect(result.error?.issues[0]?.message).toMatch(/^DISPOSITION_RECORD_REQUIRED\|/);
  });

  it('bounds the retention duration in whole months', () => {
    const base = { triggerEvent: 'event_closed', ownerUserId: 4, disposition: 'review', purpose: 'Reconstruct decisions', reason: 'Policy review' };
    expect(UpdateRetentionClassBody.safeParse({ ...base, durationMonths: 84 }).success).toBe(true);
    expect(UpdateRetentionClassBody.safeParse({ ...base, durationMonths: 0 }).success).toBe(false);
    expect(UpdateRetentionClassBody.safeParse({ ...base, durationMonths: 12.5 }).success).toBe(false);
  });

  it('builds evidence packs only for supported record types', () => {
    const pack = { subjectType: 'tender', subjectId: 8, purpose: 'Audit', includeAuditTrail: true, includeRestrictedMetadata: false, format: 'html' };
    expect(CreateEvidencePackBody.safeParse(pack).success).toBe(true);
    expect(CreateEvidencePackBody.safeParse({ ...pack, subjectType: 'record_class' }).success).toBe(false);
  });
});
