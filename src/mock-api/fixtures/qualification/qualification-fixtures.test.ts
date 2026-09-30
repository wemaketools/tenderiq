import { describe, expect, it } from 'vitest';

import {
  BuyerApplicationDetail,
  Decision,
  DecisionDetail,
  FinancialReview,
  InfoRequest,
  ProgramDetail,
  Screening,
  StatusRow,
  SupplierApplicationDetail,
  SupplierDecisionDetail,
  SupplierProgramDetail,
  SupplierStatusRow,
  Trigger,
} from '../../../contracts/qualification.js';
import {
  buyerApplicationDetail,
  decisionDetail,
  decisionRow,
  financialReviewRow,
  infoRequestRow,
  programDetail,
  screeningRow,
  statusRows,
  supplierApplicationDetail,
  supplierDecisionDetail,
  supplierProgramDetail,
  supplierStatusRows,
  triggerRow,
  viewContext,
  visibleProgramsForSupplier,
} from '../../handlers/qualification/views.js';
import { TENANT_IDS } from '../platform.js';
import {
  EVIDENCE_ITEMS,
  FINANCIAL_REVIEWS,
  INTEGRITY_SCREENINGS,
  QUALIFICATION_ANSWERS,
  QUALIFICATION_APPLICATIONS,
  QUALIFICATION_CRITERIA,
  QUALIFICATION_DECISIONS,
  QUALIFICATION_FINDINGS,
  QUALIFICATION_INFO_REQUESTS,
  QUALIFICATION_PROGRAMS,
  QUALIFICATION_PROGRAM_VERSIONS,
  EVIDENCE_UPDATES,
  RECONSIDERATIONS,
  REASSESSMENT_TRIGGERS,
  criteriaOf,
  findEvidenceItem,
} from './index.js';
import { TASKS } from '../tasks.js';

const context = viewContext(new Date('2026-09-30T08:00:00Z'));
const ALL_BUYER_PERMISSIONS = ['qualification.review', 'qualification.financial_review', 'qualification.decide'] as const;

describe('qualification fixtures parse against the contract', () => {
  it('builds a valid program detail for every program', () => {
    for (const program of QUALIFICATION_PROGRAMS) {
      expect(ProgramDetail.safeParse(programDetail(program, context, null)).error, program.name).toBeUndefined();
    }
  });

  it('builds a valid buyer detail for every non-draft application', () => {
    for (const application of QUALIFICATION_APPLICATIONS.filter((candidate) => candidate.status !== 'draft')) {
      const detail = buyerApplicationDetail(application, context, ALL_BUYER_PERMISSIONS, 8);
      expect(BuyerApplicationDetail.safeParse(detail).error, String(application.id)).toBeUndefined();
    }
  });

  it('builds a valid supplier detail for every application, drafts included', () => {
    for (const application of QUALIFICATION_APPLICATIONS) {
      const detail = supplierApplicationDetail(application, context);
      expect(SupplierApplicationDetail.safeParse(detail).error, String(application.id)).toBeUndefined();
    }
  });

  it('builds valid decisions, triggers, screenings, info requests and financial reviews', () => {
    for (const decision of QUALIFICATION_DECISIONS) {
      expect(Decision.safeParse(decisionRow(decision, context)).error).toBeUndefined();
      expect(DecisionDetail.safeParse(decisionDetail(decision, context, true)).error).toBeUndefined();
      expect(SupplierDecisionDetail.safeParse(supplierDecisionDetail(decision, context, true)).error).toBeUndefined();
    }
    for (const trigger of REASSESSMENT_TRIGGERS) {
      expect(Trigger.safeParse(triggerRow(trigger, context)).error).toBeUndefined();
    }
    for (const screening of INTEGRITY_SCREENINGS) {
      expect(Screening.safeParse(screeningRow(screening)).error).toBeUndefined();
    }
    for (const request of QUALIFICATION_INFO_REQUESTS) {
      expect(InfoRequest.safeParse(infoRequestRow(request, context)).error).toBeUndefined();
    }
    for (const review of FINANCIAL_REVIEWS) {
      expect(FinancialReview.safeParse(financialReviewRow(review)).error).toBeUndefined();
    }
  });

  it('builds valid status rows for both buyers and every supplier', () => {
    for (const buyer of [TENANT_IDS.kwu, TENANT_IDS.odc]) {
      for (const row of statusRows(buyer, context)) {
        expect(StatusRow.safeParse(row).error).toBeUndefined();
      }
    }
    for (const supplier of [4, 5, 6, 7, 8, 9]) {
      for (const row of supplierStatusRows(supplier, context)) {
        expect(SupplierStatusRow.safeParse(row).error).toBeUndefined();
      }
      for (const program of visibleProgramsForSupplier(supplier)) {
        expect(SupplierProgramDetail.safeParse(supplierProgramDetail(program, supplier, context)).error).toBeUndefined();
      }
    }
  });
});

describe('qualification fixtures are internally consistent', () => {
  it('uses unique ids per record kind', () => {
    const unique = (ids: number[]): boolean => new Set(ids).size === ids.length;
    expect(unique(QUALIFICATION_CRITERIA.map((row) => row.id))).toBe(true);
    expect(unique(QUALIFICATION_ANSWERS.map((row) => row.id))).toBe(true);
    expect(unique(QUALIFICATION_FINDINGS.map((row) => row.id))).toBe(true);
    expect(unique(EVIDENCE_ITEMS.map((row) => row.id))).toBe(true);
    expect(unique(QUALIFICATION_ANSWERS.flatMap((row) => row.evidence.map((citation) => citation.evidenceSubmissionId)))).toBe(
      true,
    );
  });

  it('cites only evidence of the applying supplier, valid on the submission date', () => {
    for (const answer of QUALIFICATION_ANSWERS) {
      const application = QUALIFICATION_APPLICATIONS.find((candidate) => candidate.id === answer.applicationId);
      for (const citation of answer.evidence) {
        const item = findEvidenceItem(citation.evidenceItemId);
        expect(item?.supplierTenantId).toBe(application?.supplierTenantId);
        if (application?.submittedAt != null) {
          expect((item?.validFrom ?? '') <= application.submittedAt.slice(0, 10)).toBe(true);
        }
      }
    }
  });

  it('keeps answers, findings and info requests on criteria of the application’s own version', () => {
    for (const row of [...QUALIFICATION_ANSWERS, ...QUALIFICATION_FINDINGS, ...QUALIFICATION_INFO_REQUESTS]) {
      if (row.criterionId === null) {
        continue;
      }
      const application = QUALIFICATION_APPLICATIONS.find((candidate) => candidate.id === row.applicationId);
      const ids = criteriaOf(application?.programVersionId ?? 0).map((criterion) => criterion.id);
      expect(ids, `${row.applicationId}/${row.criterionId}`).toContain(row.criterionId);
    }
  });

  it('links every decision to an application of the same buyer, supplier and version', () => {
    for (const decision of QUALIFICATION_DECISIONS) {
      const application = QUALIFICATION_APPLICATIONS.find((candidate) => candidate.id === decision.applicationId);
      expect(application?.tenantId).toBe(decision.tenantId);
      expect(application?.supplierTenantId).toBe(decision.supplierTenantId);
      expect(application?.programVersionId).toBe(decision.programVersionId);
      if (decision.supersededById !== null) {
        expect(QUALIFICATION_DECISIONS.some((candidate) => candidate.id === decision.supersededById)).toBe(true);
        expect(decision.supersedeReason).not.toBeNull();
      }
    }
  });

  it('gives each program at most one draft version and a current version that is approved', () => {
    for (const program of QUALIFICATION_PROGRAMS) {
      const versions = QUALIFICATION_PROGRAM_VERSIONS.filter((version) => version.programId === program.id);
      expect(versions.filter((version) => version.status === 'draft').length).toBeLessThanOrEqual(1);
      const current = versions.find((version) => version.id === program.currentVersionId);
      if (program.status === 'active') {
        expect(current?.status).toBe('approved');
      }
    }
  });

  it('never gives a draft application a reference or a buyer assignee', () => {
    for (const application of QUALIFICATION_APPLICATIONS.filter((candidate) => candidate.status === 'draft')) {
      expect(application.reference).toBeNull();
      expect(application.assessorUserId).toBeNull();
      expect(application.submittedAt).toBeNull();
    }
  });
});

describe('qualification fixtures demonstrate the storyline', () => {
  it('shows Makgadikgadi registered but not qualified, with an unclear financial review and an open request (AC-07, AC-08)', () => {
    // Arrange
    const application = QUALIFICATION_APPLICATIONS.find((candidate) => candidate.reference === 'QA-2026-0006');

    // Assert
    expect(application?.status).toBe('more_info_required');
    expect(application?.supplierTenantId).toBe(TENANT_IDS.makgadikgadi);
    expect(FINANCIAL_REVIEWS.find((review) => review.applicationId === application?.id)?.conclusion).toBe('unclear');
    expect(
      QUALIFICATION_INFO_REQUESTS.some(
        (request) => request.applicationId === application?.id && request.status === 'open' && request.requestedByUserId === 9,
      ),
    ).toBe(true);
    const kwuRow = statusRows(TENANT_IDS.kwu, context).find(
      (row) => row.supplier.slug === 'makgadikgadi' && row.program.programId === 11,
    );
    expect(kwuRow?.effectiveStatus).toBe('not_assessed');
  });

  it('records a missing ISO 9001 certificate as does_not_meet, never as a pass', () => {
    const finding = QUALIFICATION_FINDINGS.find((row) => row.applicationId === 503 && row.criterionId === 11207);
    expect(finding?.finding).toBe('does_not_meet');
  });

  it('shows Chobe qualified with conditions and an open insurance-expiry trigger with impacted bids (AC-09)', () => {
    const trigger = REASSESSMENT_TRIGGERS.find((row) => row.id === 901);
    if (trigger === undefined) {
      throw new Error('Trigger 901 is missing.');
    }
    const row = triggerRow(trigger, context);
    expect(row.status).toBe('open');
    expect(row.decisionEffectiveStatus).toBe('qualified_with_conditions');
    expect(row.impactedBids.map((bid) => bid.reference)).toEqual(['T-2026-0006', 'T-2026-0008']);
    expect(findEvidenceItem(504)?.expiresAt).toBe('2026-10-08');
  });

  it('derives expired for the Gaborone Metering decision without writing an expired decision (DD-20)', () => {
    expect(QUALIFICATION_DECISIONS.some((decision) => decision.outcome === 'expired')).toBe(false);
    const row = statusRows(TENANT_IDS.kwu, context).find(
      (status) => status.supplier.slug === 'gaborone-meter' && status.program.programId === 13,
    );
    expect(row?.effectiveStatus).toBe('expired');
  });

  it('keeps one suspended decision that superseded an earlier qualified one', () => {
    const suspended = QUALIFICATION_DECISIONS.find((decision) => decision.outcome === 'suspended');
    expect(suspended?.id).toBe(706);
    expect(QUALIFICATION_DECISIONS.find((decision) => decision.id === 705)?.supersededById).toBe(706);
  });

  it('flags screening matches for review only (BR-48)', () => {
    const flags = QUALIFICATION_FINDINGS.filter((finding) => finding.flagOnly);
    expect(flags.length).toBeGreaterThan(0);
    expect(flags.every((finding) => finding.finding !== 'does_not_meet')).toBe(true);
  });

  it('links the trigger alerts to tasks of the tasks fixtures that name the trigger (AC-09)', () => {
    const linked = REASSESSMENT_TRIGGERS.filter((trigger) => trigger.taskId !== null);
    expect(linked.map((trigger) => trigger.id)).toEqual([901, 905]);
    for (const trigger of linked) {
      const task = TASKS.find((candidate) => candidate.id === trigger.taskId);
      expect(task, `trigger ${trigger.id}`).toMatchObject({ sourceType: 'reassessment_trigger', sourceId: trigger.id, tenantId: trigger.tenantId });
    }
  });

  it('raises an open manual trigger for every supplier reconsideration and evidence update on a current decision', () => {
    for (const request of RECONSIDERATIONS) {
      const trigger = REASSESSMENT_TRIGGERS.find(
        (candidate) => candidate.sourceType === 'reconsideration_request' && candidate.sourceId === request.id,
      );
      expect(trigger?.decisionId, `reconsideration ${request.id}`).toBe(request.decisionId);
      expect(trigger?.triggerType).toBe('manual');
    }
    for (const update of EVIDENCE_UPDATES) {
      const trigger = REASSESSMENT_TRIGGERS.find(
        (candidate) => candidate.sourceType === 'evidence_submission' && candidate.sourceId === update.id,
      );
      expect(trigger?.decisionId, `evidence update ${update.id}`).toBe(update.decisionId);
    }
  });

  it('dates Chobe’s insurance expiry on the trigger as on the evidence item (AC-09)', () => {
    const trigger = REASSESSMENT_TRIGGERS.find((candidate) => candidate.id === 901);
    expect(trigger?.lapsesOn).toBe('2026-10-08');
    expect(findEvidenceItem(504)?.expiresAt).toBe('2026-10-08');
  });
});
