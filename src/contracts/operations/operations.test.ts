/**
 * Operations contract: the endpoint map is complete for OPS-01..07, ADM-15..17 and COM-09, every endpoint is
 * well-formed and routable, and the schemas enforce the business rules the UI relies on (support grants, support
 * as a non-submission channel, confirmations, import decisions).
 */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { endpointPermissions } from '../endpoint.js';
import {
  AuthorizeSupportGrantBody,
  BID_SUBMISSION_IN_TEXT,
  CreateCustomerBody,
  DecideImportRecordBody,
  LiveContract,
  LiveEvent,
  OpenMySupportCaseBody,
  RequestSupportGrantBody,
  ResolveExceptionBody,
  SupportGrant,
  SupportRecordRef,
  TENDER_OWNER_EXCEPTION_RECORD_TYPES,
  TENDER_REFERENCE_IN_TEXT,
  TransitionOffboardingPlanBody,
  UpdateEntitlementBody,
  isSealedRecordRef,
  operationsEndpoints,
} from '../operations.js';

const endpoints = Object.values(operationsEndpoints);
const REQUIRED_SCREENS = ['OPS-01', 'OPS-02', 'OPS-03', 'OPS-04', 'OPS-05', 'OPS-06', 'OPS-07', 'ADM-15', 'ADM-16', 'ADM-17', 'COM-09'];

function issueCodes(result: { success: boolean; error?: { issues: Array<{ message: string }> } }): string[] {
  return (result.error?.issues ?? []).map((issue) => issue.message.split('|')[0] ?? '');
}

describe('operations endpoint map', () => {
  it('defines 90 endpoints with unique ids and unique method-path pairs', () => {
    expect(endpoints).toHaveLength(90);
    expect(new Set(endpoints.map((endpoint) => endpoint.id)).size).toBe(endpoints.length);
    expect(new Set(endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`)).size).toBe(endpoints.length);
  });

  it('covers every screen of the domain', () => {
    const screens = new Set(endpoints.flatMap((endpoint) => [...endpoint.screens]));
    expect([...REQUIRED_SCREENS].filter((screen) => !screens.has(screen))).toEqual([]);
  });

  it('keeps every id in the operations namespace of its audience', () => {
    for (const endpoint of endpoints) {
      expect(endpoint.id.startsWith(`${endpoint.audience}.operations.`)).toBe(true);
    }
  });

  it('never grants support.view on any operations endpoint', () => {
    expect(endpoints.flatMap((endpoint) => endpointPermissions(endpoint)).filter((code) => code === 'support.view')).toEqual([]);
  });

  it('lets the tender owner, not only the integrations administrator, resolve a failed publication (AC-33)', () => {
    expect(endpointPermissions(operationsEndpoints.resolveIntegrationException)).toEqual(['org.integrations.manage', 'tender.publish']);
  });
});

describe('support rules', () => {
  it('recognizes text that tries to deliver a bid through support', () => {
    expect(BID_SUBMISSION_IN_TEXT.test('Please submit our bid for T-2026-0002.')).toBe(true);
    expect(BID_SUBMISSION_IN_TEXT.test('Attached is our offer for the meters.')).toBe(true);
    expect(BID_SUBMISSION_IN_TEXT.test('How do I submit a bid?')).toBe(false);
  });

  it('treats bids and evaluation records as never grantable', () => {
    expect(isSealedRecordRef('bid:T-2026-0002')).toBe(true);
    expect(isSealedRecordRef('evaluation:T-2026-0003')).toBe(true);
    expect(isSealedRecordRef('tender:T-2026-0002')).toBe(false);
    expect(SupportRecordRef.safeParse('tender T-2026-0002').success).toBe(false);
  });

  it('requires a whole number of days for a grant request and defaults the record list', () => {
    const parsed = RequestSupportGrantBody.parse({ businessNeed: 'Check metadata', scope: 'metadata_only', requestedDays: 3 });
    expect(parsed.recordRefs).toEqual([]);
    expect(issueCodes(RequestSupportGrantBody.safeParse({ businessNeed: 'x', scope: 'metadata_only', requestedDays: 0.5 }))).toContain(
      'INVALID_DURATION',
    );
  });

  it('requires the explicit customer acknowledgement to authorize a grant', () => {
    const result = AuthorizeSupportGrantBody.safeParse({ expiresAt: '2026-10-05T10:00:00Z', acknowledgement: false });
    expect(issueCodes(result)).toContain('ACKNOWLEDGEMENT_REQUIRED');
  });

  it('requires the acknowledgement that support is not a submission channel', () => {
    const result = OpenMySupportCaseBody.safeParse({
      category: 'usage',
      subject: 'Help please',
      description: 'How do I invite a colleague?',
      acknowledgesNotSubmissionChannel: false,
    });
    expect(issueCodes(result)).toContain('NOT_SUBMISSION_CHANNEL_ACK_REQUIRED');
  });

  it('never offers accessibility in the general case form (it has its own request)', () => {
    const result = OpenMySupportCaseBody.safeParse({
      category: 'accessibility',
      subject: 'Help please',
      description: 'Need large print',
      acknowledgesNotSubmissionChannel: true,
    });
    expect(issueCodes(result)).toContain('INVALID_CATEGORY');
  });
});

describe('content and command schemas', () => {
  it('detects tender references that must not appear in announcements', () => {
    expect(TENDER_REFERENCE_IN_TEXT.test('T-2026-0002 closes later')).toBe(true);
    expect(TENDER_REFERENCE_IN_TEXT.test('Maintenance on Sunday')).toBe(false);
  });

  it('rejects an unknown plan with PLAN_UNKNOWN', () => {
    const result = CreateCustomerBody.safeParse({
      legalName: 'Kweneng Land Board',
      slug: 'klb',
      country: 'BW',
      officialTimeZone: 'Africa/Gaborone',
      defaultCurrency: 'BWP',
      planCode: 'gold',
      serviceOwnerUserId: 1,
      administratorName: 'Neo',
      administratorEmail: 'neo@klb.example',
    });
    expect(issueCodes(result)).toContain('PLAN_UNKNOWN');
  });

  it('accepts an unmetered entitlement and rejects a negative limit', () => {
    expect(UpdateEntitlementBody.safeParse({ limitValue: null, reason: 'Enterprise' }).success).toBe(true);
    expect(issueCodes(UpdateEntitlementBody.safeParse({ limitValue: -1, reason: 'x' }))).toContain('INVALID_LIMIT');
  });

  it('limits import decisions to accept or reject with a reason', () => {
    expect(issueCodes(DecideImportRecordBody.safeParse({ decision: 'pending', reason: 'x' }))).toContain('INVALID_DECISION');
    expect(issueCodes(DecideImportRecordBody.safeParse({ decision: 'rejected', reason: '' }))).toContain('REASON_REQUIRED');
  });

  it('limits exception outcomes to resolved states', () => {
    expect(issueCodes(ResolveExceptionBody.safeParse({ outcome: 'open', resolution: 'x' }))).toContain('INVALID_RESOLUTION');
  });
});

describe('coded field errors (brief §5.3)', () => {
  const PROBE_VALUES: readonly unknown[] = ['§not-valid§', 42, ['x'], { nested: 1 }, true, '', null];
  const CODED = /^[A-Z_]+\|/;

  it('gives every body field of every endpoint a "CODE|message" error for invalid input', () => {
    const uncoded: string[] = [];
    for (const endpoint of endpoints) {
      const body = (endpoint as { body?: z.ZodType }).body;
      if (body === undefined) continue;
      const shape = (body as unknown as { shape?: Record<string, unknown> }).shape ?? {};
      const probes: unknown[] = [{}];
      for (const key of Object.keys(shape)) for (const value of PROBE_VALUES) probes.push({ [key]: value });
      for (const probe of probes) {
        const result = body.safeParse(probe);
        if (result.success) continue;
        for (const issue of result.error.issues) {
          if (!CODED.test(issue.message)) uncoded.push(`${endpoint.id} ${issue.path.join('.')}: ${issue.message}`);
        }
      }
    }
    expect(uncoded).toEqual([]);
  });

  it('rejects an unknown offboarding target status with INVALID_STATUS, not the option list', () => {
    const result = TransitionOffboardingPlanBody.safeParse({ toStatus: 'finished' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('INVALID_STATUS|Choose draft, agreed, in progress or completed.');
  });
});

describe('integration exception scope (ADM-15, AC-33)', () => {
  it('limits tender owners to publication and notice exceptions and says so on every exception endpoint', () => {
    expect([...TENDER_OWNER_EXCEPTION_RECORD_TYPES]).toEqual(['publication', 'notice']);
    const exceptionEndpoints = [
      operationsEndpoints.listIntegrationExceptions,
      operationsEndpoints.getIntegrationException,
      operationsEndpoints.investigateIntegrationException,
      operationsEndpoints.resolveIntegrationException,
    ];
    for (const endpoint of exceptionEndpoints) {
      expect(endpointPermissions(endpoint)).toEqual(['org.integrations.manage', 'tender.publish']);
      expect(endpoint.summary).toContain('only see publication and notice exceptions');
    }
    expect(endpointPermissions(operationsEndpoints.assignIntegrationException)).toEqual(['org.integrations.manage']);
  });
});

describe('operator views of live obligations (PRD §4.3)', () => {
  it('accepts a withheld event title and a withheld contract title and supplier', () => {
    expect(
      LiveEvent.safeParse({ tenderId: 6, reference: 'T-2026-0006', title: null, withheld: true, status: 'open', submissionDeadline: null }).success,
    ).toBe(true);
    expect(
      LiveContract.safeParse({
        contractId: 1,
        reference: 'C-2026-0001',
        title: null,
        withheld: true,
        status: 'active',
        supplierName: null,
        termEnd: null,
      }).success,
    ).toBe(true);
  });

  it('lets a support grant carry the case reference for the operator grants list', () => {
    expect(SupportGrant.shape.caseReference.safeParse('SC-2026-0001').success).toBe(true);
    expect(SupportGrant.shape.caseReference.safeParse('Case 1').success).toBe(false);
  });
});
