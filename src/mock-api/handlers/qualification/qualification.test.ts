import { beforeAll, describe, expect, it } from 'vitest';

import type { AnyEndpoint } from '../../../contracts/endpoint.js';
import { qualificationEndpoints as q } from '../../../contracts/qualification.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp, TestRequestOptions, TestResponse } from '../../testing/index.js';

/** A fixed request time inside the storyline (Chobe's insurance expires 2026-10-08, Gaborone's decision ended). */
const NOW = new Date('2026-09-30T08:00:00Z');
const FUTURE = '2026-10-20T13:00:00Z';

let api: TestMockApp;
/** The mock app's clock; a test that moves it restores NOW in a `finally` so the suite stays order-independent. */
let clock = NOW;

beforeAll(async () => {
  api = await createTestMockApp({ now: () => clock });
}, 60_000);

/** Runs `act` with the mock app's clock at `at`, then restores the storyline's request time. */
async function at<T>(instant: string, act: () => Promise<T>): Promise<T> {
  clock = new Date(instant);
  try {
    return await act();
  } finally {
    clock = NOW;
  }
}

type CallOptions = Omit<TestRequestOptions, 'token'> & {
  readonly params?: Readonly<Record<string, string | number>>;
};

function as(login: string, endpoint: AnyEndpoint, options: CallOptions = {}): Promise<TestResponse> {
  return api.callAs(`${login}@tenderiq.local`, endpoint, options);
}

function expectProblem(response: TestResponse, status: number, code: string): void {
  expect(response.status, response.text).toBe(status);
  expect((response.body as { code?: string }).code, response.text).toBe(code);
}

function items<T = Record<string, unknown>>(response: TestResponse): T[] {
  return (response.body as { items: T[] }).items;
}

const MONEY = (amount: string) => ({ amount, currency: 'BWP' });

describe('qualification handler module', () => {
  it('loads without registry failures of its own', () => {
    expect(api.failed.filter((failure) => failure.module.startsWith('qualification'))).toEqual([]);
    expect(api.loaded).toContain('qualification/index');
    expect(api.endpointIds).toContain('buyer.qualification.applications.list');
  });
});

describe('buyer tenant filtering and audience rules', () => {
  it('lists only the active buyer’s applications and never drafts', async () => {
    // Act
    const response = await as('neo.assessor', q.listApplications, { tenant: 'kwu', query: { pageSize: 100 } });

    // Assert
    expect(response.status).toBe(200);
    const ids = items<{ id: number; status: string }>(response).map((row) => row.id);
    expect(ids).toContain(503);
    expect(ids).not.toContain(511);
    expect(ids).not.toContain(601);
    expect(ids).not.toContain(602);
    expect(items<{ status: string }>(response).every((row) => row.status !== 'draft')).toBe(true);
    expect((response.body as { total: number }).total).toBe(ids.length);
  });

  it('answers 404 for a draft application, even by id', async () => {
    const response = await as('neo.assessor', q.getApplication, { tenant: 'kwu', params: { applicationId: 511 } });
    expect(response.status).toBe(404);
  });

  it('answers 404 for another buyer’s application', async () => {
    const response = await as('neo.assessor', q.getApplication, { tenant: 'kwu', params: { applicationId: 602 } });
    expect(response.status).toBe(404);
  });

  it('refuses a buyer persona acting in another buyer tenant with the one identical 403', async () => {
    const response = await as('neo.assessor', q.listApplications, { tenant: 'odc' });
    expectProblem(response, 403, 'TENANT_ACCESS_DENIED');
  });

  it('refuses a supplier persona on a buyer endpoint', async () => {
    const response = await as('tsodilo.admin', q.listApplications, { tenant: 'tsodilo' });
    expect(response.status).toBe(403);
  });

  it('refuses a procurement officer without qualification permissions', async () => {
    const response = await as('tebogo.officer', q.listApplications, { tenant: 'kwu' });
    expectProblem(response, 403, 'FORBIDDEN');
  });

  it('refuses the organization administrator on the program register', async () => {
    const response = await as('admin.kwu', q.listPrograms, { tenant: 'kwu' });
    expectProblem(response, 403, 'FORBIDDEN');
  });

  it('refuses the auditor on the review queue', async () => {
    const response = await as('pule.auditor', q.listApplications, { tenant: 'kwu' });
    expectProblem(response, 403, 'FORBIDDEN');
  });
});

describe('financial review restriction (AC-08)', () => {
  it('refuses the qualification assessor', async () => {
    const response = await as('neo.assessor', q.getFinancialReview, { tenant: 'kwu', params: { applicationId: 503 } });
    expectProblem(response, 403, 'FORBIDDEN');
  });

  it('serves the financial reviewer the unclear review with period, currency, consolidation and source', async () => {
    // Act
    const response = await as('lesego.finance', q.getFinancialReview, { tenant: 'kwu', params: { applicationId: 503 } });

    // Assert
    expect(response.status).toBe(200);
    const panel = q.getFinancialReview.response.parse(response.body);
    expect(panel.canRecord).toBe(true);
    expect(panel.reviews[0]).toMatchObject({
      financialPeriodEnd: '2025-12-31',
      reportingCurrency: 'BWP',
      isConsolidated: true,
      conclusion: 'unclear',
    });
    expect(panel.infoRequests.some((request) => request.status === 'open')).toBe(true);
  });

  it('serves the decider read-only access', async () => {
    const response = await as('mpho.manager', q.getFinancialReview, { tenant: 'kwu', params: { applicationId: 503 } });
    expect(response.status).toBe(200);
    expect(q.getFinancialReview.response.parse(response.body).canRecord).toBe(false);
  });

  it('tells the assessor through the detail actions that the panel is restricted', async () => {
    const response = await as('neo.assessor', q.getApplication, { tenant: 'kwu', params: { applicationId: 503 } });
    const detail = q.getApplication.response.parse(response.body);
    expect(detail.actions.canViewFinancialReview).toBe(false);
    expect(detail.financialReviewRecorded).toBe(true);
  });
});

describe('buyer reads', () => {
  it('filters the queue by status, overdue and renewal', async () => {
    const overdue = await as('neo.assessor', q.listApplications, { tenant: 'kwu', query: { overdue: 'true' } });
    expect(items<{ id: number }>(overdue).map((row) => row.id)).toEqual([509]);
    const renewals = await as('neo.assessor', q.listApplications, { tenant: 'kwu', query: { renewal: 'true' } });
    expect(items<{ id: number }>(renewals).map((row) => row.id)).toEqual([506, 501]);
    const byStatus = await as('neo.assessor', q.listApplications, {
      tenant: 'kwu',
      query: { status: ['under_review', 'more_info_required'], sort: 'reference', dir: 'asc' },
    });
    expect(items<{ reference: string }>(byStatus).map((row) => row.reference)).toEqual([
      'QA-2026-0005',
      'QA-2026-0006',
      'QA-2026-0009',
    ]);
  });

  it('paginates the queue', async () => {
    const response = await as('neo.assessor', q.listApplications, { tenant: 'kwu', query: { pageSize: 5, page: 2 } });
    expect(items(response)).toHaveLength(5);
    expect(response.body).toMatchObject({ page: 2, pageSize: 5, total: 12 });
  });

  it('derives expired and not_assessed statuses from the view rules', async () => {
    const response = await as('mpho.manager', q.listStatuses, {
      tenant: 'kwu',
      query: { effectiveStatus: ['expired', 'suspended'], sort: 'supplierName' },
    });
    const rows = items<{ supplier: { slug: string }; effectiveStatus: string }>(response);
    expect(rows.map((row) => [row.supplier.slug, row.effectiveStatus])).toEqual([
      ['gaborone-meter', 'expired'],
      ['limpopo-env', 'suspended'],
    ]);
  });

  it('shows registration is not qualification for Makgadikgadi and WTR-PUMP (AC-07)', async () => {
    const response = await as('tebogo.officer', q.checkEligibility, {
      tenant: 'kwu',
      query: { supplierTenantId: 6, categoryId: 2 },
    });
    expect(response.status).toBe(200);
    const eligibility = q.checkEligibility.response.parse(response.body);
    expect(eligibility.gate).toBe('pending');
    expect(eligibility.effectiveStatus).toBe('not_assessed');
    expect(eligibility.explanation).toContain('Registered — not qualified for WTR-PUMP');
  });

  it('lets Chobe participate while the award gate stays blocked', async () => {
    const response = await as('neo.assessor', q.checkEligibility, {
      tenant: 'kwu',
      query: { supplierTenantId: 5, categoryId: 3, amount: '1000000.00', currency: 'BWP' },
    });
    expect(q.checkEligibility.response.parse(response.body)).toMatchObject({ gate: 'met', blockedGate: 'award' });
  });

  it('answers the eligibility errors', async () => {
    expectProblem(
      await as('neo.assessor', q.checkEligibility, { tenant: 'kwu', query: { supplierTenantId: 99, categoryId: 2 } }),
      404,
      'SUPPLIER_NOT_FOUND',
    );
    expectProblem(
      await as('neo.assessor', q.checkEligibility, { tenant: 'kwu', query: { supplierTenantId: 6, categoryId: 20 } }),
      422,
      'CATEGORY_NOT_FOUND',
    );
  });

  it('lists the open insurance trigger with its impacted bids (AC-09)', async () => {
    const response = await as('mpho.manager', q.listTriggers, { tenant: 'kwu', query: { status: 'open', sort: 'detectedAt' } });
    const triggers = items<{ id: number; impactedBids: Array<{ reference: string }> }>(response);
    const chobe = triggers.find((trigger) => trigger.id === 901);
    expect(chobe?.impactedBids.map((bid) => bid.reference)).toEqual(['T-2026-0006', 'T-2026-0008']);
  });

  it('keeps superseded decisions in the history of the current one', async () => {
    const response = await as('mpho.manager', q.getDecision, { tenant: 'kwu', params: { decisionId: 706 } });
    const detail = q.getDecision.response.parse(response.body);
    expect(detail.history.map((entry) => entry.id)).toEqual([706, 705]);
    expect(detail.history[1]?.supersededById).toBe(706);
    expect(detail.canSupersede).toBe(true);
  });

  it('shows the decider the supplier’s open reconsideration and updated evidence on the suspension (SUP-24 → BUY-35)', async () => {
    // Act
    const response = await as('mpho.manager', q.getDecision, { tenant: 'kwu', params: { decisionId: 706 } });

    // Assert
    const detail = q.getDecision.response.parse(response.body);
    expect(detail.openReconsideration).toBe(true);
    expect(detail.reconsideration?.requestedAt).toBe('2026-09-19T08:30:00Z');
    expect(detail.reconsideration?.resolvedByDecisionId).toBeNull();
    expect(detail.evidenceUpdates.map((update) => [update.id, update.evidenceItemId])).toEqual([[971, 809]]);
    expect(detail.evidenceUpdateCount).toBe(1);
    expect(detail.triggers.filter((trigger) => trigger.status === 'open').map((trigger) => trigger.sourceType).sort()).toEqual([
      'evidence_submission',
      'reconsideration_request',
    ]);
  });

  it('flags open reconsiderations in the decision list and the summary', async () => {
    // Act
    const list = await as('mpho.manager', q.listDecisions, { tenant: 'kwu', query: { pageSize: 100 } });
    const summary = await as('mpho.manager', q.getQualificationSummary, { tenant: 'kwu' });

    // Assert
    const rows = items<{ id: number; openReconsideration: boolean }>(list);
    expect(rows.filter((row) => row.openReconsideration).map((row) => row.id)).toEqual([706]);
    expect(q.getQualificationSummary.response.parse(summary.body).openReconsiderations).toBe(1);
  });

  it('shows no reconsideration on a decision nobody challenged', async () => {
    const response = await as('mpho.manager', q.getDecision, { tenant: 'kwu', params: { decisionId: 702 } });
    const detail = q.getDecision.response.parse(response.body);
    expect(detail.reconsideration).toBeNull();
    expect(detail.evidenceUpdates).toEqual([]);
    expect(detail.openReconsideration).toBe(false);
  });

  it('refuses a program version that belongs to another program', async () => {
    expectProblem(
      await as('mpho.manager', q.getProgram, { tenant: 'kwu', params: { programId: 11 }, query: { versionId: 121 } }),
      404,
      'PROGRAM_VERSION_NOT_FOUND',
    );
  });

  it('lists only KWU programs to a KWU manager', async () => {
    const response = await as('mpho.manager', q.listPrograms, { tenant: 'kwu', query: { pageSize: 100 } });
    const ids = items<{ id: number }>(response).map((row) => row.id);
    expect(ids).toEqual(expect.arrayContaining([11, 12, 13, 14, 15, 16]));
    expect(ids).not.toContain(21);
  });
});

describe('program commands (ADM-09)', () => {
  const program = {
    name: 'Laboratory Consumables Suppliers',
    description: null,
    categoryId: 11,
    geography: 'Botswana',
    maxContractValue: MONEY('500000.00'),
    validityMonths: 24,
    renewalNoticeDays: 60,
    decisionRoleCode: 'procurement_manager',
    requiresIndependentApproval: false,
    ownerUserId: 4,
    monitoredTriggerTypes: ['evidence_expiry'],
  };

  it('creates a draft program', async () => {
    const response = await as('mpho.manager', q.createProgram, { tenant: 'kwu', body: program });
    expect(response.status).toBe(201);
    expect(q.createProgram.response.parse(response.body)).toMatchObject({ status: 'draft', draftVersionNo: 1 });
  });

  it('answers every program validation error', async () => {
    const cases: Array<[Record<string, unknown>, number, string]> = [
      [{ name: 'Metering Equipment Suppliers' }, 409, 'PROGRAM_NAME_DUPLICATE'],
      [{ categoryId: 20 }, 422, 'CATEGORY_NOT_FOUND'],
      [{ ownerUserId: 8 }, 422, 'OWNER_NOT_ELIGIBLE'],
      [{ decisionRoleCode: 'evaluator' }, 422, 'DECISION_ROLE_UNKNOWN'],
    ];
    for (const [change, status, code] of cases) {
      expectProblem(await as('mpho.manager', q.createProgram, { tenant: 'kwu', body: { ...program, ...change } }), status, code);
    }
  });

  it('refuses changes to a retired program and empty updates', async () => {
    expectProblem(
      await as('mpho.manager', q.updateProgram, { tenant: 'kwu', params: { programId: 15 }, body: { validityMonths: 12 } }),
      409,
      'PROGRAM_RETIRED',
    );
    const empty = await as('mpho.manager', q.updateProgram, { tenant: 'kwu', params: { programId: 11 }, body: {} });
    expect(empty.status).toBe(422);
  });

  it('opens a revision only when no draft exists and the source version belongs to the program', async () => {
    const body = { changeNote: 'Add OT security questions.', copyFromVersionId: null };
    expectProblem(
      await as('mpho.manager', q.createProgramVersion, { tenant: 'kwu', params: { programId: 11 }, body }),
      409,
      'DRAFT_VERSION_EXISTS',
    );
    expectProblem(
      await as('mpho.manager', q.createProgramVersion, {
        tenant: 'kwu',
        params: { programId: 12 },
        body: { ...body, copyFromVersionId: 111 },
      }),
      404,
      'PROGRAM_VERSION_NOT_FOUND',
    );
    expectProblem(
      await as('mpho.manager', q.createProgramVersion, { tenant: 'kwu', params: { programId: 15 }, body }),
      409,
      'PROGRAM_RETIRED',
    );
    const created = await as('mpho.manager', q.createProgramVersion, { tenant: 'kwu', params: { programId: 12 }, body });
    expect(created.status).toBe(201);
    const detail = q.createProgramVersion.response.parse(created.body);
    expect(detail.draftVersionNo).toBe(2);
    expect(detail.criteria).toHaveLength(9);
  });

  it('edits criteria of a draft version only', async () => {
    const criteria = [
      {
        area: 'corporate',
        question: 'Certificate of incorporation',
        guidance: null,
        responseType: 'document',
        mandatory: true,
        evidenceTypes: ['registration'],
        requiresNaReason: false,
        thresholdDescription: null,
        sortOrder: 10,
      },
    ];
    const saved = await as('mpho.manager', q.saveProgramCriteria, {
      tenant: 'kwu',
      params: { programId: 11, versionId: 113 },
      body: { criteria },
    });
    expect(saved.status).toBe(200);
    expect(q.saveProgramCriteria.response.parse(saved.body).criteria).toHaveLength(1);
    expectProblem(
      await as('mpho.manager', q.saveProgramCriteria, { tenant: 'kwu', params: { programId: 11, versionId: 112 }, body: { criteria } }),
      409,
      'VERSION_NOT_DRAFT',
    );
    expectProblem(
      await as('mpho.manager', q.saveProgramCriteria, { tenant: 'kwu', params: { programId: 11, versionId: 121 }, body: { criteria } }),
      404,
      'PROGRAM_VERSION_NOT_FOUND',
    );
    const invalid = await as('mpho.manager', q.saveProgramCriteria, {
      tenant: 'kwu',
      params: { programId: 11, versionId: 113 },
      body: { criteria: [{ ...criteria[0], evidenceTypes: [] }] },
    });
    expect(invalid.status).toBe(422);
    expect(JSON.stringify(invalid.body)).toContain('EVIDENCE_TYPES_REQUIRED');
  });

  it('approves a complete draft and refuses one without mandatory core areas', async () => {
    const approved = await as('mpho.manager', q.approveProgramVersion, {
      tenant: 'kwu',
      params: { programId: 11, versionId: 113 },
      body: { note: null },
    });
    expect(approved.status).toBe(200);
    expect(q.approveProgramVersion.response.parse(approved.body).currentVersion).toMatchObject({ versionNo: 3, status: 'approved' });
    expectProblem(
      await as('mpho.manager', q.approveProgramVersion, { tenant: 'kwu', params: { programId: 16, versionId: 161 }, body: { note: null } }),
      422,
      'MANDATORY_AREA_MISSING',
    );
    expectProblem(
      await as('mpho.manager', q.approveProgramVersion, { tenant: 'kwu', params: { programId: 11, versionId: 112 }, body: { note: null } }),
      409,
      'VERSION_NOT_DRAFT',
    );
  });

  it('retires a program only without open applications', async () => {
    const reason = { reason: 'Replaced by the framework program.' };
    expectProblem(
      await as('mpho.manager', q.retireProgram, { tenant: 'kwu', params: { programId: 11 }, body: reason }),
      409,
      'PROGRAM_HAS_OPEN_APPLICATIONS',
    );
    expectProblem(
      await as('mpho.manager', q.retireProgram, { tenant: 'kwu', params: { programId: 15 }, body: reason }),
      409,
      'PROGRAM_RETIRED',
    );
    const retired = await as('mpho.manager', q.retireProgram, { tenant: 'kwu', params: { programId: 16 }, body: reason });
    expect(q.retireProgram.response.parse(retired.body).status).toBe('retired');
  });

  it('refuses program commands to the assessor', async () => {
    expectProblem(await as('neo.assessor', q.createProgram, { tenant: 'kwu', body: program }), 403, 'FORBIDDEN');
  });
});

describe('assessment commands (BUY-33, BUY-34)', () => {
  const assignment = {
    assessorUserId: 8,
    financialReviewerUserId: null,
    dueAt: FUTURE,
    priority: 'high',
    riskLevel: 'medium',
  };

  it('assigns the unassigned renewal and moves it under review', async () => {
    const response = await as('neo.assessor', q.assignApplication, {
      tenant: 'kwu',
      params: { applicationId: 506 },
      body: assignment,
    });
    expect(response.status).toBe(200);
    expect(q.assignApplication.response.parse(response.body)).toMatchObject({ status: 'under_review', assessor: { userId: 8 } });
  });

  it('answers every assignment error', async () => {
    const cases: Array<[number, Record<string, unknown>, number, string]> = [
      [501, {}, 409, 'APPLICATION_NOT_ASSIGNABLE'],
      [506, { assessorUserId: 5 }, 422, 'ASSESSOR_NOT_ELIGIBLE'],
      [506, { financialReviewerUserId: 8 }, 422, 'FINANCIAL_REVIEWER_NOT_ELIGIBLE'],
      [506, { riskLevel: 'high' }, 422, 'FINANCIAL_REVIEWER_REQUIRED'],
      [506, { financialReviewerUserId: 9 }, 409, 'ASSIGNEE_CONFLICT_DECLARED'],
      [506, { dueAt: '2026-09-01T10:00:00Z' }, 422, 'DUE_DATE_IN_PAST'],
    ];
    for (const [applicationId, change, status, code] of cases) {
      expectProblem(
        await as('neo.assessor', q.assignApplication, {
          tenant: 'kwu',
          params: { applicationId },
          body: { ...assignment, ...change },
        }),
        status,
        code,
      );
    }
  });

  it('records the financial review of the assigned financial reviewer', async () => {
    const review = {
      financialPeriodEnd: '2025-12-31',
      reportingCurrency: 'BWP',
      isConsolidated: true,
      source: 'Group management accounts FY2025',
      turnover: '18750000.00',
      currentRatio: null,
      debtToEquity: null,
      parentSupportEvidence: 'Signed parent support letter dated 2026-09-29.',
      materialQualifications: 'Parent guarantee limited to BWP 4,000,000.',
      conclusion: 'adequate_with_limitations',
      rationale: 'Adequate with the parent guarantee.',
    };
    const recorded = await as('lesego.finance', q.recordFinancialReview, {
      tenant: 'kwu',
      params: { applicationId: 503 },
      body: review,
    });
    expect(recorded.status).toBe(201);
    const cases: Array<[number, Record<string, unknown>, number, string]> = [
      [501, {}, 409, 'APPLICATION_NOT_UNDER_REVIEW'],
      [508, {}, 403, 'NOT_ASSIGNED_FINANCIAL_REVIEWER'],
      [503, { financialPeriodEnd: '2026-12-31' }, 422, 'FINANCIAL_PERIOD_IN_FUTURE'],
      [503, { parentSupportEvidence: null }, 422, 'PARENT_SUPPORT_REQUIRED'],
    ];
    for (const [applicationId, change, status, code] of cases) {
      expectProblem(
        await as('lesego.finance', q.recordFinancialReview, {
          tenant: 'kwu',
          params: { applicationId },
          body: { ...review, ...change },
        }),
        status,
        code,
      );
    }
    expectProblem(
      await as('neo.assessor', q.recordFinancialReview, { tenant: 'kwu', params: { applicationId: 503 }, body: review }),
      403,
      'FORBIDDEN',
    );
  });

  it('records findings and never lets missing evidence pass', async () => {
    const meets = { finding: 'meets', rationale: 'Two references verified.', evidenceRefs: null };
    const recorded = await as('neo.assessor', q.recordFinding, {
      tenant: 'kwu',
      params: { applicationId: 503, criterionId: 11213 },
      body: meets,
    });
    expect(recorded.status).toBe(200);
    const cases: Array<[string, number, number, Record<string, unknown>, number, string]> = [
      ['neo.assessor', 509, 11201, meets, 409, 'APPLICATION_NOT_UNDER_REVIEW'],
      ['neo.assessor', 503, 12101, meets, 422, 'CRITERION_NOT_IN_VERSION'],
      ['lesego.finance', 503, 11201, meets, 403, 'FINDING_OUTSIDE_ASSIGNMENT'],
      ['lesego.finance', 508, 13102, meets, 403, 'NOT_ASSIGNED_ASSESSOR'],
      ['neo.assessor', 503, 11207, meets, 422, 'MISSING_EVIDENCE_NOT_A_PASS'],
      ['neo.assessor', 503, 11201, { ...meets, finding: 'not_applicable' }, 422, 'NA_NOT_DECLARED'],
    ];
    for (const [login, applicationId, criterionId, body, status, code] of cases) {
      expectProblem(
        await as(login, q.recordFinding, { tenant: 'kwu', params: { applicationId, criterionId }, body }),
        status,
        code,
      );
    }
  });

  it('asks the supplier for information and answers the request errors', async () => {
    const body = { criterionId: 11204, question: 'Provide the entity-level current ratio.', dueAt: FUTURE };
    const asked = await as('lesego.finance', q.requestInformation, { tenant: 'kwu', params: { applicationId: 503 }, body });
    expect(asked.status).toBe(201);
    expect(q.requestInformation.response.parse(asked.body).applicationStatus).toBe('more_info_required');
    const cases: Array<[string, number, Record<string, unknown>, number, string]> = [
      ['neo.assessor', 509, {}, 409, 'APPLICATION_NOT_UNDER_REVIEW'],
      ['neo.assessor', 503, { criterionId: 12101 }, 422, 'CRITERION_NOT_IN_VERSION'],
      ['neo.assessor', 503, { dueAt: '2026-09-01T10:00:00Z' }, 422, 'DUE_DATE_IN_PAST'],
      ['lesego.finance', 512, {}, 403, 'NOT_ASSIGNED_ASSESSOR'],
    ];
    for (const [login, applicationId, change, status, code] of cases) {
      expectProblem(
        await as(login, q.requestInformation, { tenant: 'kwu', params: { applicationId }, body: { ...body, ...change } }),
        status,
        code,
      );
    }
  });

  it('closes an answered information request', async () => {
    const closed = await as('neo.assessor', q.closeInfoRequest, {
      tenant: 'kwu',
      params: { applicationId: 503, infoRequestId: 1402 },
      body: { note: null },
    });
    expect(closed.status).toBe(200);
    expect(q.closeInfoRequest.response.parse(closed.body)).toMatchObject({
      infoRequest: { status: 'closed' },
      applicationStatus: 'more_info_required',
    });
    expectProblem(
      await as('neo.assessor', q.closeInfoRequest, { tenant: 'kwu', params: { applicationId: 503, infoRequestId: 1403 }, body: { note: null } }),
      404,
      'INFO_REQUEST_NOT_FOUND',
    );
    expectProblem(
      await as('neo.assessor', q.closeInfoRequest, { tenant: 'kwu', params: { applicationId: 502, infoRequestId: 1403 }, body: { note: null } }),
      409,
      'INFO_REQUEST_CLOSED',
    );
  });

  it('recommends an outcome only when findings are complete and screenings reviewed', async () => {
    const body = {
      proposedOutcome: 'qualified',
      scopeCategoryId: 5,
      scopeMaxValue: MONEY('1500000.00'),
      scopeGeography: 'Botswana',
      conditions: null,
      allowedActivities: null,
      blockedGate: 'none',
      rationale: 'All criteria met.',
    };
    const recommended = await as('neo.assessor', q.recommendOutcome, { tenant: 'kwu', params: { applicationId: 512 }, body });
    expect(recommended.status).toBe(200);
    expect(q.recommendOutcome.response.parse(recommended.body).status).toBe('decision_pending');
    expectProblem(
      await as('neo.assessor', q.recommendOutcome, { tenant: 'kwu', params: { applicationId: 503 }, body }),
      409,
      'APPLICATION_NOT_UNDER_REVIEW',
    );
    expectProblem(
      await as('neo.assessor', q.recommendOutcome, {
        tenant: 'kwu',
        params: { applicationId: 508 },
        body: { ...body, scopeCategoryId: 4 },
      }),
      409,
      'SCREENING_UNREVIEWED',
    );
    expectProblem(
      await as('neo.assessor', q.recommendOutcome, {
        tenant: 'kwu',
        params: { applicationId: 512 },
        body: { ...body, scopeMaxValue: MONEY('9000000.00') },
      }),
      422,
      'SCOPE_EXCEEDS_PROGRAM',
    );
  });

  it('reviews a screening match once', async () => {
    const body = { disposition: 'Different registration number; not the listed entity.', effect: 'No effect.', raiseTrigger: false };
    const reviewed = await as('neo.assessor', q.reviewScreening, { tenant: 'kwu', params: { screeningId: 951 }, body });
    expect(reviewed.status).toBe(200);
    expectProblem(
      await as('neo.assessor', q.reviewScreening, { tenant: 'kwu', params: { screeningId: 955 }, body }),
      409,
      'SCREENING_ALREADY_REVIEWED',
    );
  });
});

describe('decision and monitoring commands (BUY-35)', () => {
  const decision = {
    outcome: 'qualified_with_conditions',
    scopeCategoryId: 2,
    scopeMaxValue: MONEY('3000000.00'),
    scopeGeography: 'Botswana',
    effectiveFrom: '2026-10-01',
    effectiveTo: '2028-09-30',
    reassessmentDate: '2026-10-08',
    conditions: 'Supply the renewed insurance certificate before 8 Oct 2026.',
    allowedActivities: 'Bid for WTR-PUMP work up to BWP 3,000,000.',
    blockedGate: 'award',
    reasons: 'All criteria met; insurance expiring.',
    supplierExplanation: 'Qualified with conditions for WTR-PUMP up to BWP 3,000,000.',
    appealRoute: 'Request reconsideration within 14 days.',
    notifySupplier: true,
  };

  it('records a decision on the pending application', async () => {
    const response = await as('mpho.manager', q.decideApplication, { tenant: 'kwu', params: { applicationId: 509 }, body: decision });
    expect(response.status).toBe(201);
    const detail = q.decideApplication.response.parse(response.body);
    expect(detail).toMatchObject({ outcome: 'qualified_with_conditions', blockedGate: 'award', approver: { userId: 4 } });
    expect(detail.supplierNotifiedAt).not.toBeNull();
  });

  it('answers the decision errors', async () => {
    const cases: Array<[number, Record<string, unknown>, number, string]> = [
      [503, {}, 409, 'APPLICATION_NOT_DECISION_PENDING'],
      [509, { scopeCategoryId: 20 }, 422, 'CATEGORY_NOT_FOUND'],
      [509, { scopeCategoryId: 5 }, 422, 'SCOPE_EXCEEDS_PROGRAM'],
    ];
    for (const [applicationId, change, status, code] of cases) {
      expectProblem(
        await as('mpho.manager', q.decideApplication, { tenant: 'kwu', params: { applicationId }, body: { ...decision, ...change } }),
        status,
        code,
      );
    }
    expectProblem(
      await as('neo.assessor', q.decideApplication, { tenant: 'kwu', params: { applicationId: 509 }, body: decision }),
      403,
      'FORBIDDEN',
    );
  });

  it('supersedes a decision with a new row and keeps the earlier one', async () => {
    const body = {
      ...decision,
      outcome: 'suspended',
      scopeCategoryId: 3,
      scopeMaxValue: MONEY('5000000.00'),
      blockedGate: 'invitation',
      supersedeReason: 'Insurance lapsed without renewal.',
      triggerId: 901,
    };
    const response = await as('mpho.manager', q.supersedeDecision, { tenant: 'kwu', params: { decisionId: 702 }, body });
    expect(response.status).toBe(201);
    const detail = q.supersedeDecision.response.parse(response.body);
    expect(detail.outcome).toBe('suspended');
    expect(detail.history.find((entry) => entry.id === 702)?.supersededById).toBe(detail.id);
    const cases: Array<[number, Record<string, unknown>, number, string]> = [
      [705, {}, 409, 'DECISION_ALREADY_SUPERSEDED'],
      [702, { triggerId: 902 }, 422, 'TRIGGER_NOT_FOUND'],
      [702, { scopeCategoryId: 20 }, 422, 'CATEGORY_NOT_FOUND'],
      [702, { scopeCategoryId: 5 }, 422, 'SCOPE_EXCEEDS_PROGRAM'],
    ];
    for (const [decisionId, change, status, code] of cases) {
      expectProblem(
        await as('mpho.manager', q.supersedeDecision, { tenant: 'kwu', params: { decisionId }, body: { ...body, ...change } }),
        status,
        code,
      );
    }
  });

  it('requests a renewal only once and only for a renewable decision', async () => {
    const body = { message: 'Please renew before the expiry of your qualification.', dueAt: FUTURE };
    const requested = await as('mpho.manager', q.requestRenewal, { tenant: 'kwu', params: { decisionId: 702 }, body });
    expect(requested.status).toBe(200);
    expectProblem(await as('mpho.manager', q.requestRenewal, { tenant: 'kwu', params: { decisionId: 705 }, body }), 409, 'DECISION_NOT_RENEWABLE');
    expectProblem(await as('mpho.manager', q.requestRenewal, { tenant: 'kwu', params: { decisionId: 704 }, body }), 409, 'RENEWAL_ALREADY_REQUESTED');
    expectProblem(
      await as('mpho.manager', q.requestRenewal, { tenant: 'kwu', params: { decisionId: 701 }, body: { ...body, dueAt: '2026-09-01T10:00:00Z' } }),
      422,
      'DUE_DATE_IN_PAST',
    );
  });

  it('initiates a reassessment and answers the trigger creation errors', async () => {
    const body = { supplierTenantId: 4, decisionId: 701, triggerType: 'manual', summary: 'Poor delivery on Lot 1.' };
    const created = await as('neo.assessor', q.createTrigger, { tenant: 'kwu', body });
    expect(created.status).toBe(201);
    expect(q.createTrigger.response.parse(created.body).impactedBids.length).toBeGreaterThan(0);
    expectProblem(await as('neo.assessor', q.createTrigger, { tenant: 'kwu', body: { ...body, decisionId: 801 } }), 404, 'DECISION_NOT_FOUND');
    expectProblem(
      await as('neo.assessor', q.createTrigger, { tenant: 'kwu', body: { ...body, supplierTenantId: 8, decisionId: 705 } }),
      409,
      'DECISION_NOT_CURRENT',
    );
    expectProblem(
      await as('neo.assessor', q.createTrigger, {
        tenant: 'kwu',
        body: { ...body, supplierTenantId: 5, decisionId: 702, triggerType: 'evidence_expiry' },
      }),
      409,
      'TRIGGER_ALREADY_OPEN',
    );
  });

  it('records an explicit trigger disposition after reviewing impacted bids (AC-09)', async () => {
    const body = {
      resultingStatus: 'assessed',
      disposition: 'Renewed certificate received on 2 Oct 2026; no change to eligibility; T-2026-0008 unaffected.',
      activeBidsReviewed: true,
      activeContractsReviewed: true,
      resultingDecisionId: null,
    };
    const assessed = await as('mpho.manager', q.assessTrigger, { tenant: 'kwu', params: { triggerId: 901 }, body });
    expect(assessed.status).toBe(200);
    expect(q.assessTrigger.response.parse(assessed.body)).toMatchObject({ status: 'assessed', assessedBy: { userId: 4 } });
    const cases: Array<[number, Record<string, unknown>, number, string]> = [
      [902, {}, 409, 'TRIGGER_ALREADY_CLOSED'],
      [901, { activeBidsReviewed: false }, 409, 'IMPACT_REVIEW_REQUIRED'],
      [901, { resultingStatus: 'action_taken' }, 422, 'RESULTING_DECISION_REQUIRED'],
      [901, { resultingStatus: 'action_taken', resultingDecisionId: 12345 }, 404, 'DECISION_NOT_FOUND'],
    ];
    for (const [triggerId, change, status, code] of cases) {
      expectProblem(
        await as('mpho.manager', q.assessTrigger, { tenant: 'kwu', params: { triggerId }, body: { ...body, ...change } }),
        status,
        code,
      );
    }
  });
});

describe('supplier isolation (SUP-20, SUP-24)', () => {
  it('lists only the supplier’s own applications, drafts included', async () => {
    const response = await as('gaborone-meter.bidmanager', q.listSupplierApplications, { tenant: 'gaborone-meter' });
    const rows = items<{ id: number; status: string }>(response);
    expect(rows.map((row) => row.id).sort()).toEqual([505, 506, 511]);
  });

  it('answers 404 for another supplier’s application and decision', async () => {
    expect((await as('chobe-pipe.admin', q.getSupplierApplication, { tenant: 'chobe-pipe', params: { applicationId: 503 } })).status).toBe(404);
    expect((await as('chobe-pipe.admin', q.getSupplierDecision, { tenant: 'chobe-pipe', params: { decisionId: 701 } })).status).toBe(404);
  });

  it('never sends findings, financial reviews, screenings or internal reasons to the supplier', async () => {
    const application = await as('makgadikgadi.admin', q.getSupplierApplication, {
      tenant: 'makgadikgadi',
      params: { applicationId: 503 },
    });
    expect(application.status).toBe(200);
    const text = application.text;
    expect(text).not.toContain('"finding"');
    expect(text).not.toContain('financialReview');
    expect(text).not.toContain('screenings');
    const decision = await as('limpopo-env.admin', q.getSupplierDecision, { tenant: 'limpopo-env', params: { decisionId: 706 } });
    expect(decision.text).not.toContain('"reasons"');
    expect(decision.text).not.toContain('trigger');
  });

  it('separates buyer-specific decisions for a supplier qualified at one buyer and suspended at another', async () => {
    const response = await as('limpopo-env.admin', q.listSupplierDecisions, { tenant: 'limpopo-env' });
    const rows = items<{ buyer: { slug: string }; effectiveStatus: string }>(response);
    expect(rows.map((row) => [row.buyer.slug, row.effectiveStatus]).sort()).toEqual([
      ['kwu', 'suspended'],
      ['odc', 'qualified'],
    ]);
  });

  it('shows Makgadikgadi as registered but not assessed for the water infrastructure program (AC-07)', async () => {
    const response = await as('makgadikgadi.admin', q.getSupplierOverview, { tenant: 'makgadikgadi' });
    const overview = q.getSupplierOverview.response.parse(response.body);
    expect(overview.registrationStatus).toBe('active');
    const row = overview.statuses.find((status) => status.program.programId === 11);
    expect(row).toMatchObject({ effectiveStatus: 'not_assessed', applicationInProgress: { status: 'more_info_required' } });
  });

  it('refuses a contributor without the qualification permission', async () => {
    expectProblem(await as('tsodilo.contributor', q.listSupplierApplications, { tenant: 'tsodilo' }), 403, 'FORBIDDEN');
  });

  it('refuses a buyer persona on supplier endpoints', async () => {
    expect((await as('neo.assessor', q.listSupplierApplications, { tenant: 'kwu' })).status).toBe(403);
  });

  it('hides programs of buyers the supplier has no relationship with', async () => {
    const response = await as('chobe-pipe.admin', q.listSupplierPrograms, { tenant: 'chobe-pipe' });
    const buyers = items<{ buyer: { slug: string } }>(response).map((row) => row.buyer.slug);
    expect(new Set(buyers)).toEqual(new Set(['kwu']));
    expect((await as('chobe-pipe.admin', q.getSupplierProgram, { tenant: 'chobe-pipe', params: { programId: 21 } })).status).toBe(404);
  });
});

describe('supplier commands', () => {
  const application = {
    programId: 13,
    scopeCategoryId: 4,
    scopeMaxValue: MONEY('1000000.00'),
    scopeGeography: 'Botswana',
    renewalOfDecisionId: null,
  };

  it('starts a draft application and answers the creation errors', async () => {
    const created = await as('makgadikgadi.admin', q.createSupplierApplication, { tenant: 'makgadikgadi', body: application });
    expect(created.status).toBe(201);
    expect(q.createSupplierApplication.response.parse(created.body)).toMatchObject({ status: 'draft', reference: null });
    const cases: Array<[Record<string, unknown>, number, string]> = [
      [{ programId: 11, scopeCategoryId: 2 }, 409, 'APPLICATION_ALREADY_OPEN'],
      [{ programId: 12, scopeCategoryId: 2 }, 422, 'SCOPE_OUTSIDE_PROGRAM'],
      [{ programId: 12, scopeCategoryId: 5, scopeMaxValue: MONEY('9000000.00') }, 422, 'SCOPE_EXCEEDS_PROGRAM'],
      [{ programId: 16 }, 422, 'PROGRAM_NOT_OPEN'],
      [{ renewalOfDecisionId: 701 }, 409, 'DECISION_NOT_RENEWABLE'],
    ];
    for (const [change, status, code] of cases) {
      expectProblem(
        await as('makgadikgadi.admin', q.createSupplierApplication, { tenant: 'makgadikgadi', body: { ...application, ...change } }),
        status,
        code,
      );
    }
  });

  it('saves draft answers and answers the answer errors', async () => {
    const answer = {
      criterionId: 11208,
      applicability: 'applicable',
      naReason: null,
      answerText: null,
      answerNumber: null,
      answerDate: null,
      answerBool: null,
      evidenceItemIds: [905],
    };
    const saved = await as('gaborone-meter.bidmanager', q.saveSupplierAnswers, {
      tenant: 'gaborone-meter',
      params: { applicationId: 511 },
      body: { answers: [answer] },
    });
    expect(saved.status).toBe(200);
    const item = q.saveSupplierAnswers.response.parse(saved.body).items.find((row) => row.criterion.id === 11208);
    expect(item?.evidence.map((evidence) => evidence.evidenceItemId)).toEqual([905]);
    const cases: Array<[number, Record<string, unknown>, number, string]> = [
      [506, {}, 409, 'APPLICATION_NOT_EDITABLE'],
      [511, { criterionId: 12101 }, 422, 'CRITERION_NOT_IN_VERSION'],
      [511, { evidenceItemIds: [401] }, 422, 'EVIDENCE_NOT_FOUND'],
      [511, { evidenceItemIds: [901] }, 422, 'EVIDENCE_TYPE_MISMATCH'],
    ];
    for (const [applicationId, change, status, code] of cases) {
      expectProblem(
        await as('gaborone-meter.bidmanager', q.saveSupplierAnswers, {
          tenant: 'gaborone-meter',
          params: { applicationId },
          body: { answers: [{ ...answer, ...change }] },
        }),
        status,
        code,
      );
    }
    const noReason = await as('gaborone-meter.bidmanager', q.saveSupplierAnswers, {
      tenant: 'gaborone-meter',
      params: { applicationId: 511 },
      body: { answers: [{ ...answer, applicability: 'not_applicable', evidenceItemIds: [] }] },
    });
    expect(noReason.status).toBe(422);
    expect(noReason.text).toContain('NA_REASON_REQUIRED');
  });

  it('submits a complete draft and refuses an incomplete one', async () => {
    const submitted = await as('makgadikgadi.admin', q.submitSupplierApplication, {
      tenant: 'makgadikgadi',
      params: { applicationId: 603 },
      body: { confirmAccuracy: true },
    });
    expect(submitted.status).toBe(200);
    const detail = q.submitSupplierApplication.response.parse(submitted.body);
    expect(detail.status).toBe('submitted');
    expect(detail.reference).toMatch(/^QA-2026-/);
    expectProblem(
      await as('gaborone-meter.bidmanager', q.submitSupplierApplication, {
        tenant: 'gaborone-meter',
        params: { applicationId: 511 },
        body: { confirmAccuracy: true },
      }),
      422,
      'MANDATORY_ANSWERS_MISSING',
    );
    expectProblem(
      await as('gaborone-meter.bidmanager', q.submitSupplierApplication, {
        tenant: 'gaborone-meter',
        params: { applicationId: 506 },
        body: { confirmAccuracy: true },
      }),
      409,
      'APPLICATION_NOT_DRAFT',
    );
  });

  it('withdraws an open application only', async () => {
    const reason = { reason: 'Capacity committed elsewhere.' };
    const withdrawn = await as('tsodilo.bidmanager', q.withdrawSupplierApplication, {
      tenant: 'tsodilo',
      params: { applicationId: 602 },
      body: reason,
    });
    expect(q.withdrawSupplierApplication.response.parse(withdrawn.body).status).toBe('withdrawn');
    expectProblem(
      await as('tsodilo.bidmanager', q.withdrawSupplierApplication, { tenant: 'tsodilo', params: { applicationId: 501 }, body: reason }),
      409,
      'APPLICATION_NOT_WITHDRAWABLE',
    );
  });

  it('answers the open financial information request (AC-08)', async () => {
    const body = { responseText: 'Attached is the signed parent support letter.', evidenceItemIds: [602] };
    const answered = await as('makgadikgadi.admin', q.respondToInfoRequest, {
      tenant: 'makgadikgadi',
      params: { applicationId: 503, infoRequestId: 1401 },
      body,
    });
    expect(answered.status).toBe(200);
    expect(q.respondToInfoRequest.response.parse(answered.body)).toMatchObject({
      infoRequest: { status: 'answered' },
      applicationStatus: 'under_review',
    });
    const cases: Array<[number, Record<string, unknown>, number, string]> = [
      [1402, {}, 409, 'INFO_REQUEST_NOT_OPEN'],
      [1405, {}, 404, 'INFO_REQUEST_NOT_FOUND'],
      [1401, { evidenceItemIds: [401] }, 422, 'EVIDENCE_NOT_FOUND'],
    ];
    for (const [infoRequestId, change, status, code] of cases) {
      expectProblem(
        await as('makgadikgadi.admin', q.respondToInfoRequest, {
          tenant: 'makgadikgadi',
          params: { applicationId: 503, infoRequestId },
          body: { ...body, ...change },
        }),
        status,
        code,
      );
    }
  });

  it('requests reconsideration of a restricting decision once, inside its stated window', async () => {
    // Arrange: decision 702 was decided on 4 May 2026 with a 14-day window; 10 May is inside it.
    const body = { grounds: 'The renewed policy is in place from 9 Oct 2026.', evidenceItemIds: [504] };

    // Act
    const requested = await at('2026-05-10T08:00:00Z', () =>
      as('chobe-pipe.admin', q.requestReconsideration, { tenant: 'chobe-pipe', params: { decisionId: 702 }, body }),
    );
    const unknownEvidence = await at('2026-05-10T08:00:00Z', () =>
      as('chobe-pipe.admin', q.requestReconsideration, { tenant: 'chobe-pipe', params: { decisionId: 702 }, body: { ...body, evidenceItemIds: [401] } }),
    );

    // Assert
    expect(requested.status, requested.text).toBe(201);
    expectProblem(unknownEvidence, 422, 'EVIDENCE_NOT_FOUND');
    expectProblem(
      await as('tsodilo.admin', q.requestReconsideration, { tenant: 'tsodilo', params: { decisionId: 701 }, body: { ...body, evidenceItemIds: [] } }),
      409,
      'DECISION_NOT_RECONSIDERABLE',
    );
    expectProblem(
      await as('limpopo-env.admin', q.requestReconsideration, { tenant: 'limpopo-env', params: { decisionId: 706 }, body: { ...body, evidenceItemIds: [] } }),
      409,
      'RECONSIDERATION_ALREADY_REQUESTED',
    );
  });

  it('refuses reconsideration once the stated 14-day window has closed (SUP-24)', async () => {
    // Arrange: on 30 Sep 2026 Chobe's 4 May decision is months past its window.
    const body = { grounds: 'The renewed policy is in place from 9 Oct 2026.', evidenceItemIds: [504] };

    // Act
    const response = await as('chobe-pipe.admin', q.requestReconsideration, { tenant: 'chobe-pipe', params: { decisionId: 702 }, body });
    const lastMoment = await at('2026-05-18T08:29:59Z', () =>
      as('chobe-pipe.admin', q.getSupplierDecision, { tenant: 'chobe-pipe', params: { decisionId: 702 } }),
    );
    const closedAtDeadline = await at('2026-05-18T08:30:00Z', () =>
      as('chobe-pipe.admin', q.getSupplierDecision, { tenant: 'chobe-pipe', params: { decisionId: 702 } }),
    );

    // Assert
    expectProblem(response, 409, 'RECONSIDERATION_WINDOW_CLOSED');
    const open = q.getSupplierDecision.response.parse(lastMoment.body);
    expect(open.reconsiderationDeadline).toEqual({ at: '2026-05-18T08:30:00.000Z', timeZone: 'Africa/Gaborone' });
    expect(open.canRequestReconsideration).toBe(true);
    expect(q.getSupplierDecision.response.parse(closedAtDeadline.body).canRequestReconsideration).toBe(false);
  });

  it('hides the reconsideration action on a decision past its window today', async () => {
    const response = await as('chobe-pipe.admin', q.getSupplierDecision, { tenant: 'chobe-pipe', params: { decisionId: 702 } });
    const detail = q.getSupplierDecision.response.parse(response.body);
    expect(detail.reconsiderationDeadline.at < NOW.toISOString()).toBe(true);
    expect(detail.canRequestReconsideration).toBe(false);
  });

  it('supplies updated evidence for a current decision without relabelling anything (AC-09)', async () => {
    const supplied = await as('chobe-pipe.admin', q.supplyDecisionEvidence, {
      tenant: 'chobe-pipe',
      params: { decisionId: 702 },
      body: { evidenceItemId: 504, note: 'Current certificate; renewal follows.' },
    });
    expect(supplied.status).toBe(201);
    expectProblem(
      await as('limpopo-env.admin', q.supplyDecisionEvidence, { tenant: 'limpopo-env', params: { decisionId: 705 }, body: { evidenceItemId: 809, note: null } }),
      409,
      'DECISION_SUPERSEDED',
    );
    expectProblem(
      await as('chobe-pipe.admin', q.supplyDecisionEvidence, { tenant: 'chobe-pipe', params: { decisionId: 702 }, body: { evidenceItemId: 401, note: null } }),
      422,
      'EVIDENCE_NOT_FOUND',
    );
    expectProblem(
      await as('limpopo-env.admin', q.supplyDecisionEvidence, { tenant: 'limpopo-env', params: { decisionId: 706 }, body: { evidenceItemId: 803, note: null } }),
      409,
      'EVIDENCE_NOT_CURRENT',
    );
  });
});
