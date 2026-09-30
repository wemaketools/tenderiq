/**
 * Awards contract: the endpoint map covers every screen of the domain with the right audiences and permissions,
 * and the request schemas enforce the rules the UI shows as field errors.
 */
import { describe, expect, it } from 'vitest';

import {
  AWARD_READ_PERMISSIONS,
  CreateComplaintBody,
  DecideRecommendationBody,
  GATE_CHECK_CODES,
  LotOutcomeInput,
  PublicAwardListQuery,
  RespondComplaintBody,
  SUPPLIER_LOT_RESULTS,
  SUPPLIER_OUTCOME_RESULTS,
  awardEndpoints,
  awardValueBasisOf,
} from '../awards.js';
import { splitIssueMessage } from '../common.js';
import { ENUMS } from '../enums.js';
import { templatePermissions } from '../permissions.js';
import type { PermissionCode } from '../permissions.js';

const endpoints = Object.values(awardEndpoints);

function issueCodes(result: { success: boolean; error?: { issues: { message: string }[] } }): string[] {
  return (result.error?.issues ?? []).map((item) => splitIssueMessage(item.message).code);
}

describe('awardEndpoints', () => {
  it('declares 53 endpoints with unique ids and METHOD path pairs', () => {
    expect(endpoints).toHaveLength(53);
    expect(new Set(endpoints.map((endpoint) => endpoint.id)).size).toBe(endpoints.length);
    expect(new Set(endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`)).size).toBe(endpoints.length);
  });

  it('covers every screen of the domain', () => {
    const screens = new Set(endpoints.flatMap((endpoint) => endpoint.screens));
    for (const screen of ['BUY-26', 'BUY-28', 'BUY-29', 'BUY-30', 'SUP-21', 'SUP-22', 'PUB-05']) {
      expect(screens.has(screen)).toBe(true);
    }
  });

  it('prefixes every path with its audience and guards every tenant endpoint with a permission', () => {
    for (const endpoint of endpoints) {
      expect(endpoint.path.startsWith(`/api/v1/${endpoint.audience}/`)).toBe(true);
      if (endpoint.audience === 'public') {
        expect(endpoint.permission).toBeUndefined();
      } else {
        expect(endpoint.permission).toBeDefined();
      }
    }
  });

  it('keeps the award approval decision on award.approve and supplier writes on supplier permissions', () => {
    expect(awardEndpoints.decideRecommendation.permission).toBe('award.approve');
    expect(awardEndpoints.createComplaint.permission).toBe('supplier.complaint.submit');
    expect(awardEndpoints.acceptOutcomeNoticeTerms.permission).toBe('supplier.response.submit');
    expect(AWARD_READ_PERMISSIONS).toContain('audit.view');
  });

  it('declares the business errors the storyline scenarios need', () => {
    expect(awardEndpoints.finalAwardLotOutcome.errors).toContain('FINAL_AWARD_BLOCKED_BY_HOLD');
    expect(awardEndpoints.issueOutcomeNotice.errors).toContain('FINAL_AWARD_BLOCKED_BY_HOLD');
    expect(awardEndpoints.closeEvent.errors).toContain('HANDOVER_NOT_ACCEPTED');
    expect(awardEndpoints.closeEvent.errors).toContain('RFI_FINDINGS_REQUIRED');
    expect(awardEndpoints.decideRecommendation.errors).toContain('DILIGENCE_BLOCKING');
    expect(awardEndpoints.publishPublicNotice.errors).toContain('PUBLIC_NOTICE_REVIEW_INCOMPLETE');
  });

  it('marks record-creating commands idempotent (201)', () => {
    for (const endpoint of [
      awardEndpoints.createRecommendation,
      awardEndpoints.createOutcomeNotice,
      awardEndpoints.requestDebrief,
      awardEndpoints.createComplaint,
      awardEndpoints.requestEvidencePack,
    ]) {
      expect(endpoint.idempotent).toBe(true);
      expect(endpoint.status).toBe(201);
    }
  });
});

describe('award request schemas', () => {
  it('requires an offer and a value for an awarding lot outcome', () => {
    const result = LotOutcomeInput.safeParse({ lotId: 1, outcome: 'award', bidId: null, awardedValue: null, conditions: null, reason: null });
    expect(issueCodes(result)).toEqual(['AWARDED_BID_REQUIRED', 'AWARDED_VALUE_REQUIRED']);
  });

  it('requires a reason and no offer for a no-award or cancelled lot', () => {
    const result = LotOutcomeInput.safeParse({ lotId: 1, outcome: 'cancelled', bidId: 7, awardedValue: null, conditions: null, reason: null });
    expect(issueCodes(result)).toEqual(['NO_BID_FOR_NO_AWARD', 'OUTCOME_REASON_REQUIRED']);
  });

  it('requires conditions for a conditional award and for an approval with conditions', () => {
    const conditional = LotOutcomeInput.safeParse({
      lotId: 1,
      outcome: 'conditional_award',
      bidId: 7,
      awardedValue: { amount: '10.00', currency: 'BWP' },
      conditions: null,
      reason: null,
    });
    expect(issueCodes(conditional)).toEqual(['CONDITIONS_REQUIRED']);
    const decision = DecideRecommendationBody.safeParse({ decision: 'approve_with_conditions', rationale: 'ok' });
    expect(issueCodes(decision)).toEqual(['CONDITIONS_REQUIRED']);
  });

  it('requires a remedy when a complaint is upheld', () => {
    const result = RespondComplaintBody.safeParse({ outcome: 'partially_upheld', responseText: 'Partially upheld after investigation.' });
    expect(issueCodes(result)).toEqual(['REMEDY_REQUIRED']);
  });

  it('rejects short complaint grounds and accepts a repeated public outcome filter', () => {
    expect(issueCodes(CreateComplaintBody.safeParse({ tenderId: 7, subject: 'award', grounds: 'Too short' }))).toEqual(['GROUNDS_TOO_SHORT']);
    const query = PublicAwardListQuery.parse({ outcome: ['award', 'cancelled'] });
    expect(query.outcome).toEqual(['award', 'cancelled']);
  });

  it('lists each gate check code once', () => {
    expect(new Set(GATE_CHECK_CODES).size).toBe(GATE_CHECK_CODES.length);
  });

  it('labels a value by the least advanced status of its lot outcomes, so a proposed value is never an award (BR-31)', () => {
    expect(awardValueBasisOf([])).toBeNull();
    expect(awardValueBasisOf(['final_awarded', 'recommended'])).toBe('recommended');
    expect(awardValueBasisOf(['withdrawn'])).toBe('recommended');
    expect(awardValueBasisOf(['intent_notified', 'approved'])).toBe('approved');
    expect(awardValueBasisOf(['final_awarded', 'intent_notified'])).toBe('intended');
    expect(awardValueBasisOf(['final_awarded'])).toBe('final_awarded');
  });

  it('distinguishes preferred-bidder states from awards in the supplier results', () => {
    for (const results of [SUPPLIER_LOT_RESULTS, SUPPLIER_OUTCOME_RESULTS]) {
      expect(results).toEqual(expect.arrayContaining(['preferred_bidder', 'preferred_withdrawn', 'intent_to_award', 'awarded']));
    }
  });

  it('uses the enumerations of enums.ts for award records', () => {
    expect(ENUMS['lot_outcomes.outcome']).toEqual(['award', 'partial_award', 'conditional_award', 'no_award', 'cancelled']);
  });
});

describe('accepting award notice terms (PRD §4.1: only an authorized signatory accepts commitments)', () => {
  const required = awardEndpoints.acceptOutcomeNoticeTerms.permission;
  const requiredList: readonly PermissionCode[] =
    required === undefined ? [] : typeof required === 'string' ? [required] : required;
  const holds = (codes: readonly PermissionCode[]): boolean => requiredList.some((code) => codes.includes(code));

  it('is not open to a supplier_finance member, whose only contract permission is supplier.contract.participate', () => {
    expect(requiredList).not.toContain('supplier.contract.participate');
    expect(holds(templatePermissions('supplier_finance'))).toBe(false);
    expect(holds(templatePermissions('bid_manager'))).toBe(false);
  });

  it('is open to the authorized signatory template', () => {
    expect(holds(templatePermissions('authorized_signatory'))).toBe(true);
  });
});
