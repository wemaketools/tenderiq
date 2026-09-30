/**
 * The clarifications contract: endpoint definitions (audiences, permissions, statuses, screens) and the validation
 * rules of its request bodies (FR-10, BR-16, DD-39).
 */
import { describe, expect, it } from 'vitest';

import {
  AcknowledgeAddendumBody,
  AskQuestionBody,
  BuyerQuestionListQuery,
  CreateAddendumBody,
  CreateSessionBody,
  PrivateAnswerBody,
  RegisterSessionBody,
  clarificationsEndpoints,
} from '../clarifications.js';
import { endpointPermissions } from '../endpoint.js';
import { permissionTenantKind } from '../permissions.js';

const endpoints = Object.values(clarificationsEndpoints);

function codesOf(result: { success: boolean; error?: { issues: Array<{ message: string }> } }): string[] {
  return (result.error?.issues ?? []).map((item) => item.message.split('|')[0] ?? '');
}

describe('clarificationsEndpoints', () => {
  it('defines 46 endpoints with unique ids and unique method + path pairs', () => {
    expect(endpoints).toHaveLength(46);
    expect(new Set(endpoints.map((endpoint) => endpoint.id)).size).toBe(46);
    expect(new Set(endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`)).size).toBe(46);
  });

  it('covers every screen of the domain', () => {
    const screens = new Set(endpoints.flatMap((endpoint) => endpoint.screens));
    for (const screen of ['BUY-16', 'BUY-17', 'BUY-18', 'SUP-10', 'SUP-11', 'PUB-04']) {
      expect(screens.has(screen)).toBe(true);
    }
  });

  it('requires a permission of the matching tenant kind on every buyer and supplier endpoint', () => {
    for (const endpoint of endpoints.filter((candidate) => candidate.audience !== 'public')) {
      const permissions = endpointPermissions(endpoint);
      expect(permissions.length, endpoint.id).toBeGreaterThan(0);
      for (const code of permissions) {
        expect(permissionTenantKind(code), endpoint.id).toBe(endpoint.audience);
      }
    }
  });

  it('makes the public edition the only public endpoint, without a permission', () => {
    const publicEndpoints = endpoints.filter((endpoint) => endpoint.audience === 'public');
    expect(publicEndpoints.map((endpoint) => endpoint.id)).toEqual(['public.clarifications.edition']);
    expect(publicEndpoints[0]?.permission).toBeUndefined();
  });

  it('marks record-creating commands idempotent with status 201', () => {
    const idempotent = endpoints.filter((endpoint) => endpoint.idempotent === true).map((endpoint) => endpoint.id);
    expect(idempotent.sort()).toEqual(
      [
        'buyer.clarifications.addendaCreate',
        'buyer.clarifications.sessionsCreate',
        'supplier.clarifications.addendaAcknowledge',
        'supplier.clarifications.questionsAsk',
        'supplier.clarifications.sessionsRegister',
      ].sort(),
    );
    for (const endpoint of endpoints.filter((candidate) => candidate.idempotent === true)) {
      expect(endpoint.status, endpoint.id).toBe(201);
    }
  });

  it('issues addenda with the publish permission and acknowledges with the notices permission', () => {
    expect(clarificationsEndpoints.addendaIssue.permission).toBe('tender.publish');
    expect(clarificationsEndpoints.supplierAddendaAcknowledge.permission).toBe('supplier.notices.acknowledge');
  });
});

describe('request validation', () => {
  it('rejects an empty question with QUESTION_REQUIRED', () => {
    const result = AskQuestionBody.safeParse({ tenderId: 2, lotId: null, requirementId: null, documentId: null, questionText: '  ' });
    expect(codesOf(result)).toContain('QUESTION_REQUIRED');
  });

  it('requires the explicit non-material confirmation for a private answer', () => {
    const result = PrivateAnswerBody.safeParse({ answerText: 'Section 6.2 applies.', reason: 'Supplier-specific.', notMaterialConfirmed: false });
    expect(codesOf(result)).toContain('CONFIRMATION_REQUIRED');
  });

  it('requires a title, description and reason on an addendum', () => {
    const result = CreateAddendumBody.safeParse({
      tenderId: 2,
      title: '',
      changeDescription: '',
      reason: '',
      materiality: 'material',
      changesScope: false,
      changesTerms: false,
      changesSubmission: true,
      changesEvaluation: false,
      newSubmissionDeadline: null,
      responseTimeAssessment: null,
      existingSubmissionAction: 'supplement',
      lotIds: [],
      requirementChanges: [],
      sourceQuestionIds: [],
    });
    expect(codesOf(result)).toEqual(expect.arrayContaining(['TITLE_REQUIRED', 'CHANGE_DESCRIPTION_REQUIRED', 'REASON_REQUIRED']));
  });

  it('rejects a session without places', () => {
    const result = CreateSessionBody.safeParse({
      tenderId: 2,
      lotId: null,
      sessionType: 'briefing',
      title: 'Briefing',
      startsAt: '2026-10-12T08:00:00Z',
      endsAt: '2026-10-12T09:00:00Z',
      venue: 'Online',
      instructions: null,
      capacity: 0,
      mandatory: false,
      alternativeOfId: null,
      accessibilityInfo: null,
      registrationDeadline: null,
    });
    expect(codesOf(result)).toContain('CAPACITY_INVALID');
  });

  it('requires at least one attendee to register', () => {
    expect(codesOf(RegisterSessionBody.safeParse({ attendeeNames: [], accessibilityNeeds: null }))).toContain('ATTENDEE_REQUIRED');
  });

  it('requires the acknowledgment confirmation', () => {
    expect(AcknowledgeAddendumBody.safeParse({ confirmed: true }).success).toBe(true);
    expect(codesOf(AcknowledgeAddendumBody.safeParse({ confirmed: false }))).toContain('CONFIRMATION_REQUIRED');
  });

  it('parses repeated status filters and boolean flags from the query string', () => {
    const query = BuyerQuestionListQuery.parse({ status: ['received', 'assigned'], unassigned: 'true', tenderId: '2' });
    expect(query).toMatchObject({ status: ['received', 'assigned'], unassigned: true, tenderId: 2, page: 1, pageSize: 25 });
  });
});
