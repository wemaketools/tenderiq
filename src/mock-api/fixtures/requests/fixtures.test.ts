/**
 * Requests domain fixtures (05): the demo storyline anchors, unique keys, tenant-consistent references and valid
 * decimal money (docs/plan/demo-storyline.md "Requests and planning", AC-05, AC-39).
 */
import { describe, expect, it } from 'vitest';

import { Money, Reference } from '../../../contracts/common.js';
import { gt } from '../../../contracts/decimal.js';
import { PROCUREMENT_REQUESTS_STATUS } from '../../../contracts/enums.js';
import { findPersonaById } from '../../persona.js';
import { TENANT_IDS } from '../platform.js';
import {
  ADVANCE_NOTICES,
  CATEGORIES,
  CONTRACTS,
  FAIRNESS_REVIEWS,
  INFO_REQUESTS,
  MARKET_RESEARCH,
  PLAN_ITEMS,
  PROJECTS,
  REQUESTS,
  REQUEST_LINKS,
  STRATEGIES,
  TENDERS,
} from './index.js';

const KWU = TENANT_IDS.kwu;

function byReference(reference: string) {
  const row = REQUESTS.find((request) => request.tenantId === KWU && request.reference === reference);
  if (row === undefined) {
    throw new Error(`Missing ${reference}`);
  }
  return row;
}

describe('request fixtures', () => {
  it('cover every request status among KWU PR-2026-0001…0012', () => {
    const statuses = REQUESTS.filter((row) => row.tenantId === KWU && Number(row.reference.slice(-4)) <= 12).map((row) => row.status);
    expect(new Set(statuses)).toEqual(new Set(PROCUREMENT_REQUESTS_STATUS));
  });

  it('have unique ids and references unique per buyer, with valid money and references', () => {
    expect(new Set(REQUESTS.map((row) => row.id)).size).toBe(REQUESTS.length);
    expect(new Set(REQUESTS.map((row) => `${row.tenantId}:${row.reference}`)).size).toBe(REQUESTS.length);
    for (const row of REQUESTS) {
      expect(Reference.safeParse(row.reference).success, row.reference).toBe(true);
      for (const money of [row.estimatedValue, row.estimatedTotalCommitment, row.approvedValue, row.funding?.confirmedAmount ?? null]) {
        if (money !== null) {
          expect(Money.safeParse(money).success, row.reference).toBe(true);
        }
      }
    }
  });

  it('reference only people, records and contracts of the same tenant', () => {
    for (const row of REQUESTS) {
      for (const userId of [row.requesterUserId, row.sponsorUserId, row.ownerUserId, row.budgetOwnerUserId]) {
        if (userId !== null) {
          expect(findPersonaById(userId)?.memberships.some((membership) => membership.tenantId === row.tenantId), `${row.reference} user ${userId}`).toBe(true);
        }
      }
      if (row.categoryId !== null) {
        expect(CATEGORIES.find((category) => category.id === row.categoryId)?.tenantId, row.reference).toBe(row.tenantId);
      }
      if (row.projectId !== null) {
        expect(PROJECTS.find((project) => project.id === row.projectId)?.tenantId, row.reference).toBe(row.tenantId);
      }
      for (const contractId of [row.replacesContractId, row.routedContractId]) {
        if (contractId !== null) {
          expect(CONTRACTS.find((contract) => contract.id === contractId)?.tenantId, row.reference).toBe(row.tenantId);
        }
      }
      if (row.convertedTenderId !== null) {
        expect(TENDERS.find((tender) => tender.id === row.convertedTenderId)?.tenantId, row.reference).toBe(row.tenantId);
      }
    }
  });

  it('route PR-2026-0003 above the manager’s BWP 2,000,000 limit to the award approver (AC-05)', () => {
    const request = byReference('PR-2026-0003');
    expect(request.estimatedValue?.currency).toBe('BWP');
    expect(gt(request.estimatedValue?.amount ?? '0', '2000000.00')).toBe(true);
    expect(request.approval?.currentApproverUserId).toBe(findPersonaById(18)?.userId);
    expect(findPersonaById(18)?.email).toBe('keabetswe.approver@tenderiq.local');
  });

  it('combine PR-2026-0006 into PR-2026-0005 and keep the original requester and funding', () => {
    const combined = byReference('PR-2026-0006');
    const target = byReference('PR-2026-0005');
    expect(combined.combinedIntoId).toBe(target.id);
    expect(combined.status).toBe('closed');
    expect(combined.requesterUserId).not.toBe(target.requesterUserId);
    expect(REQUEST_LINKS.some((link) => link.fromRequestId === combined.id && link.toRequestId === target.id && link.linkType === 'combined_into')).toBe(true);
    expect(target.approvedValue).toEqual({ amount: '1770000.00', currency: 'BWP' });
  });

  it('show a material change after approval on PR-2026-0013 (BR-10)', () => {
    const request = byReference('PR-2026-0013');
    expect(request.status).toBe('under_review');
    expect(request.approvedRevision).toBeLessThan(request.revision);
    expect(request.materialChange?.changedFields).toContain('estimatedValue');
  });

  it('route every request on its whole contemplated commitment: the total commitment is never below the estimate', () => {
    for (const row of REQUESTS) {
      if (row.estimatedValue !== null && row.estimatedTotalCommitment !== null) {
        expect(gt(row.estimatedValue.amount, row.estimatedTotalCommitment.amount), row.reference).toBe(false);
      }
    }
    expect(byReference('PR-2026-0013').estimatedTotalCommitment).toEqual({ amount: '2475000.00', currency: 'BWP' });
  });

  it('give kagiso a complete draft (PR-2026-0014) besides the incomplete PR-2026-0007, and an approved request without a strategy', () => {
    const complete = byReference('PR-2026-0014');
    expect(complete).toMatchObject({ status: 'draft', requesterUserId: findPersonaById(6)?.userId, fundingStatus: 'indicative' });
    for (const field of ['problemStatement', 'scopeDescription', 'targetDate', 'estimatedValue', 'estimationBasis', 'fundingSourceId', 'budgetOwnerUserId', 'estimatedTotalCommitment'] as const) {
      expect(complete[field], field).not.toBeNull();
    }
    expect(byReference('PR-2026-0007').estimatedValue).toBeNull();
    const approved = byReference('PR-2026-0015');
    expect(approved.status).toBe('approved');
    expect(STRATEGIES.some((strategy) => strategy.requestId === approved.id)).toBe(false);
  });

  it('attach every information request to a request of the same tenant', () => {
    for (const info of INFO_REQUESTS) {
      expect(REQUESTS.find((row) => row.id === info.requestId)?.tenantId).toBe(info.tenantId);
    }
    expect(INFO_REQUESTS.some((info) => info.status === 'open' && info.requestId === byReference('PR-2026-0004').id)).toBe(true);
  });
});

describe('plan and advance notice fixtures', () => {
  it('seed plan items for 2026 Q4 and 2027 Q1 with two published advance notices', () => {
    const releases = PLAN_ITEMS.filter((item) => item.tenantId === KWU).map((item) => item.plannedReleaseDate ?? '');
    expect(releases.some((date) => date >= '2026-10-01' && date <= '2026-12-31')).toBe(true);
    expect(releases.some((date) => date >= '2027-01-01' && date <= '2027-03-31')).toBe(true);
    expect(ADVANCE_NOTICES.filter((notice) => notice.tenantId === KWU && notice.status === 'published')).toHaveLength(2);
  });

  it('never put a draft request on the plan (PRD §4.3) and keep a publishable draft notice on a scheduled item', () => {
    for (const item of PLAN_ITEMS.filter((candidate) => candidate.requestId !== null)) {
      expect(REQUESTS.find((row) => row.id === item.requestId)?.status, item.title).not.toBe('draft');
    }
    const notice = ADVANCE_NOTICES.find((candidate) => candidate.id === 406);
    expect(notice).toMatchObject({ status: 'draft', planItemId: 201 });
    expect(notice?.eoiInstructions).not.toBeNull();
    expect(PLAN_ITEMS.find((item) => item.id === notice?.planItemId)?.status).toBe('scheduled');
  });

  it('keep dependencies and notices inside one tenant', () => {
    for (const item of PLAN_ITEMS) {
      if (item.dependsOnId !== null) {
        expect(PLAN_ITEMS.find((candidate) => candidate.id === item.dependsOnId)?.tenantId).toBe(item.tenantId);
      }
    }
    for (const notice of ADVANCE_NOTICES) {
      expect(PLAN_ITEMS.find((item) => item.id === notice.planItemId)?.tenantId).toBe(notice.tenantId);
      expect(notice.publishedAt === null, `notice ${notice.id}`).toBe(notice.status === 'draft');
    }
  });
});

describe('strategy fixtures', () => {
  it('conclude the RFI with findings and a linked next event, without an award (AC-39)', () => {
    const rfi = STRATEGIES.find((strategy) => strategy.eventType === 'rfi');
    expect(rfi?.procedure).toBe('rfi');
    expect(rfi?.rfiOutcome?.nextTenderId).toBe(TENDERS.find((tender) => tender.reference === 'T-2026-0009')?.id);
    expect(TENDERS.find((tender) => tender.id === rfi?.rfiOutcome?.rfiTenderId)?.status).toBe('information_collected');
  });

  it('never use framework call-off and open a fairness review for every prior involvement', () => {
    expect(STRATEGIES.every((strategy) => strategy.procedure !== 'framework_calloff')).toBe(true);
    for (const entry of MARKET_RESEARCH.filter((candidate) => candidate.priorSpecificationInvolvement)) {
      expect(
        FAIRNESS_REVIEWS.some((review) => review.strategyId === entry.strategyId && review.supplierTenantId === entry.supplierTenantId),
        `research ${entry.id}`,
      ).toBe(true);
    }
    expect(FAIRNESS_REVIEWS.some((review) => review.outcome === 'pending')).toBe(true);
  });

  it('record direct-procurement grounds for every direct strategy', () => {
    for (const strategy of STRATEGIES.filter((candidate) => candidate.procedure === 'direct')) {
      expect(strategy.directAwardGrounds).not.toBeNull();
    }
  });
});
