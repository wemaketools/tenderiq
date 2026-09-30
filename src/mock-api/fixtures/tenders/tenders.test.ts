/**
 * The tender fixtures: every projection parses against the tenders contract, ids and tenants line up with the
 * platform fixtures and the storyline, and the scenario anchors (AC-06 on T-2026-0005, the authoring warnings of
 * T-2026-0012, the PRD §9.2 plan of T-2026-0003) hold.
 */
import { describe, expect, it } from 'vitest';

import {
  EvaluationPlan,
  Lot,
  PackagePreview,
  PricingSchedule,
  Requirement,
  TenderDetail,
  TenderReadiness,
  TenderRow,
  TenderTimetable,
} from '../../../contracts/tenders.js';
import {
  lotOf,
  planOf,
  readinessOf,
  requirementOf,
  scheduleOf,
  stateOf,
  tenderDetail,
  tenderRow,
  timetableOf,
} from '../../handlers/tenders/model.js';
import { previewOf } from '../../handlers/tenders/preview.js';
import { PERSONAS, TENANT_IDS } from '../platform.js';
import {
  CORRECTIONS,
  ENVELOPES,
  EVALUATION_PLANS,
  LOTS,
  MATERIAL_CHANGES,
  MILESTONES,
  PACKAGE_DOCUMENTS,
  PARTICIPATION_CONDITIONS,
  PRICING_SCHEDULES,
  RELEASE_APPROVALS,
  RELEASE_CHECKS,
  REQUIREMENTS,
  TEAM_MEMBERS,
  TENDERS,
  TENDER_TERMS,
  TENDER_VERSIONS,
  tenderById,
} from './index.js';

const REGISTER = TENDERS.filter((tender) => !tender.isTemplate);

/** The storyline state of each tender (docs/plan/demo-storyline.md). */
const STORYLINE = {
  'T-2026-0001': ['kwu', 'partially_awarded', 'tender', 'open'],
  'T-2026-0002': ['kwu', 'open', 'rfq', 'open'],
  'T-2026-0003': ['kwu', 'under_assessment', 'rfp', 'open'],
  'T-2026-0004': ['kwu', 'information_collected', 'rfi', 'rfi'],
  'T-2026-0005': ['kwu', 'awaiting_release_approval', 'tender', 'open'],
  'T-2026-0006': ['kwu', 'open', 'rfq', 'invitation_only'],
  'T-2026-0007': ['kwu', 'award_pending', 'tender', 'open'],
  'T-2026-0008': ['kwu', 'closed', 'tender', 'open'],
  'T-2026-0009': ['kwu', 'under_assessment', 'rfp', 'restricted'],
  'T-2026-0010': ['kwu', 'awarded', 'rfq', 'open'],
  'T-2026-0011': ['odc', 'open', 'rfq', 'open'],
} as const;

function hasMembership(userId: number, tenantId: number): boolean {
  return PERSONAS.some((persona) => persona.userId === userId && persona.memberships.some((membership) => membership.tenantId === tenantId));
}

describe('tender fixtures parse against the tenders contract', () => {
  it.each(REGISTER.map((tender) => [tender.reference, tender.id] as const))('%s projects onto every read schema', (_reference, id) => {
    // Arrange
    const tender = tenderById(id);
    expect(tender).toBeDefined();
    const state = stateOf(tender ?? REGISTER[0]!);

    // Act + Assert
    expect(() => TenderRow.parse(tenderRow(state))).not.toThrow();
    expect(() => TenderDetail.parse(tenderDetail(state))).not.toThrow();
    expect(() => TenderReadiness.parse(readinessOf(state))).not.toThrow();
    expect(() => TenderTimetable.parse(timetableOf(state))).not.toThrow();
    for (const lot of state.lots) {
      expect(() => Lot.parse(lotOf(state, lot))).not.toThrow();
    }
    for (const requirement of state.requirements) {
      expect(() => Requirement.parse(requirementOf(state, requirement))).not.toThrow();
    }
    for (const schedule of state.schedules) {
      expect(() => PricingSchedule.parse(scheduleOf(state, schedule))).not.toThrow();
    }
    for (const plan of state.plans) {
      expect(() => EvaluationPlan.parse(planOf(state, plan))).not.toThrow();
    }
    expect(() => PackagePreview.parse(previewOf(state, 'supplier'))).not.toThrow();
    expect(() => PackagePreview.parse(previewOf(state, 'public'))).not.toThrow();
  });
});

describe('tender fixtures follow the storyline and the platform fixtures', () => {
  it('holds every storyline tender in its storyline tenant, state, type and procedure, with id = reference number', () => {
    for (const [reference, [slug, status, eventType, procedure]] of Object.entries(STORYLINE)) {
      const tender = REGISTER.find((row) => row.reference === reference);
      expect(tender, reference).toMatchObject({ tenantId: TENANT_IDS[slug], status, eventType, procedure });
      expect(tender?.id).toBe(Number(reference.slice(-4)));
    }
  });

  it('keeps every child row in its tender’s tenant', () => {
    const children: readonly { tenderId: number; tenantId: number }[] = [
      ...LOTS,
      ...TEAM_MEMBERS,
      ...REQUIREMENTS,
      ...PRICING_SCHEDULES,
      ...TENDER_TERMS,
      ...EVALUATION_PLANS,
      ...MILESTONES,
      ...ENVELOPES,
      ...PARTICIPATION_CONDITIONS,
      ...RELEASE_CHECKS,
      ...RELEASE_APPROVALS,
      ...MATERIAL_CHANGES,
      ...CORRECTIONS,
      ...PACKAGE_DOCUMENTS,
      ...TENDER_VERSIONS,
    ];
    for (const row of children) {
      expect(tenderById(row.tenderId)?.tenantId, `tender ${row.tenderId}`).toBe(row.tenantId);
    }
  });

  it('names only people who are (or were) members of the tender’s organization', () => {
    const references: [number | null, number][] = [
      ...REGISTER.map((row) => [row.ownerUserId, row.tenantId] as [number, number]),
      ...TEAM_MEMBERS.map((row) => [row.userId, row.tenantId] as [number, number]),
      ...REQUIREMENTS.map((row) => [row.ownerUserId, row.tenantId] as [number | null, number]),
      ...LOTS.map((row) => [row.ownerUserId, row.tenantId] as [number | null, number]),
      ...RELEASE_CHECKS.map((row) => [row.reviewerUserId, row.tenantId] as [number | null, number]),
      ...RELEASE_APPROVALS.flatMap((row) => [[row.requestedBy, row.tenantId] as [number, number], [row.decidedBy, row.tenantId] as [number | null, number]]),
      ...CORRECTIONS.flatMap((row) => [[row.assigneeUserId, row.tenantId] as [number, number], [row.requestedBy, row.tenantId] as [number, number]]),
    ];
    for (const [userId, tenantId] of references) {
      if (userId !== null) {
        expect(hasMembership(userId, tenantId), `user ${userId} in tenant ${tenantId}`).toBe(true);
      }
    }
  });

  it('links requirements only to lots and criteria of their own tender', () => {
    for (const requirement of REQUIREMENTS) {
      if (requirement.lotId !== null) {
        expect(LOTS.find((lot) => lot.id === requirement.lotId)?.tenderId).toBe(requirement.tenderId);
      }
      if (requirement.criterionId !== null) {
        const plan = EVALUATION_PLANS.find((row) => row.criteria.some((criterion) => criterion.id === requirement.criterionId));
        expect(plan?.tenderId, requirement.refCode).toBe(requirement.tenderId);
      }
    }
  });

  it('uses unique ids for approvals, lots, requirements and documents', () => {
    for (const ids of [
      RELEASE_APPROVALS.map((row) => row.approvalId),
      LOTS.map((row) => row.id),
      REQUIREMENTS.map((row) => row.id),
      PACKAGE_DOCUMENTS.map((row) => row.documentId),
      TEAM_MEMBERS.map((row) => row.id),
      RELEASE_CHECKS.map((row) => row.id),
    ]) {
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('fixture content quality', () => {
  /** The storyline clock: nothing that has already happened may be later than the demo date. */
  const DEMO_DATE_END = '2026-09-30T23:59:59Z';

  it('never records a tender update or an issued version after the demo date', () => {
    const late = [
      ...TENDERS.filter((tender) => tender.updatedAt > DEMO_DATE_END).map((tender) => `${tender.reference} updatedAt`),
      ...TENDER_VERSIONS.filter((version) => version.issuedAt > DEMO_DATE_END).map((version) => `tender ${version.tenderId} v${version.versionNo}`),
    ];

    expect(late).toEqual([]);
  });

  it('states a real applicability for lot-bound requirements instead of repeating the lot', () => {
    const repeated = REQUIREMENTS.filter((row) => row.applicability !== null && /^Lot \d+$/.test(row.applicability)).map(
      (row) => `${row.tenderId}/${row.refCode}`,
    );

    expect(repeated).toEqual([]);
  });

  it('never merges a zero price with included or not offered in pricing or plan texts', () => {
    const texts = [
      ...PRICING_SCHEDULES.map((row) => row.instructions ?? ''),
      ...EVALUATION_PLANS.map((row) => row.zeroPriceTreatment ?? ''),
    ];

    expect(texts.filter((text) => /zero (price|rate)[^.]*(means|treated as)[^.]*included/i.test(text))).toEqual([]);
  });

  it('declares priced on every schedule and a comparison basis wherever discounts are accepted, except the T-2026-0012 warning', () => {
    expect(PRICING_SCHEDULES.every((row) => row.priceEntries.includes('priced'))).toBe(true);
    const withoutBasis = PRICING_SCHEDULES.filter((row) => row.discountsAccepted.length > 0 && row.discountEvaluationNote === null).map(
      (row) => row.tenderId,
    );
    expect(withoutBasis).toEqual([12]);
  });
});

describe('scenario anchors', () => {
  it('shows the release approval of T-2026-0005 invalidated by the revision 3 scope and value edit (AC-06)', () => {
    // Arrange
    const state = stateOf(tenderById(5)!);

    // Act
    const detail = tenderDetail(state);

    // Assert
    expect(detail.draftRevision).toBe(3);
    expect(detail.releaseApproval).toMatchObject({ approvalId: 31, status: 'invalidated', subjectVersion: 2, coversCurrentRevision: false });
    expect(detail.gate.publicationBlocked).toBe(true);
    expect(detail.gate.canRequestReleaseApproval).toBe(true);
    expect(detail.readiness.blocking).toBe(0);
    expect(detail.editability).toEqual({ editable: true, editInvalidatesApproval: false, lockedReason: null });
    expect(MATERIAL_CHANGES.filter((row) => row.invalidatedApprovalId === 31)).toHaveLength(2);
  });

  it('shows every authoring warning on the T-2026-0012 draft and keeps its publication blocked', () => {
    const state = stateOf(tenderById(12)!);
    const readiness = readinessOf(state);
    const codes = readiness.items.map((item) => item.code);
    expect(readiness.gate.publicationBlocked).toBe(true);
    expect(readiness.gate.canRequestReleaseApproval).toBe(false);
    expect(codes).toEqual(
      expect.arrayContaining([
        'REQUIREMENT_OWNER_MISSING',
        'MANDATORY_GATE_ONLY_WARNS',
        'RATED_WITHOUT_CRITERION',
        'INFORMATION_ONLY_REJECTS',
        'LOT_OWNER_MISSING',
        'WEIGHTS_NOT_100',
        'RESPONSE_PERIOD_TOO_SHORT',
        'NON_WORKING_DAY',
        'EVALUATION_CHAIR_NOT_ASSIGNED',
        'PRICING_SCHEDULE_EMPTY',
        'ESTIMATE_EXCEEDS_BUDGET',
        'RELEASE_CHECK_FAILED',
      ]),
    );
  });

  it('reproduces the PRD §9.2 weighted model on T-2026-0003', () => {
    const plan = planOf(stateOf(tenderById(3)!), EVALUATION_PLANS.find((row) => row.tenderId === 3)!);
    expect(plan.weightsTotal).toBe('100.00');
    expect(plan.criteria.map((row) => [row.name, row.maxPoints])).toEqual([
      ['Solution quality', '35'],
      ['Delivery approach', '20'],
      ['Relevant experience', '15'],
      ['Price', '30'],
    ]);
    expect(plan.priceMethod).toBe('lowest_ratio');
  });

  it('hides the invitation-only T-2026-0006 from the public preview and withholds internal content from suppliers', () => {
    const invited = stateOf(tenderById(6)!);
    expect(previewOf(invited, 'public')).toMatchObject({ visible: false, hiddenReason: 'invitation_only', notice: null });
    const supplier = previewOf(stateOf(tenderById(5)!), 'supplier');
    expect(supplier.documents.some((doc) => doc.title === 'Internal cost estimate')).toBe(false);
    expect(JSON.stringify(supplier)).not.toContain('1920000.00');
  });
});
