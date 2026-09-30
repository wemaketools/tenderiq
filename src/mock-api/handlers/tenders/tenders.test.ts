/**
 * The tenders mock handlers with REAL authentication (local Supabase Auth, DD-43): tenant isolation, team-only
 * visibility, 403 for the wrong tenant kind or a missing permission, list filters, the AC-06 release approval
 * state and the declared business errors of the authoring commands.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { Problem } from '../../../contracts/common.js';
import {
  CreatedTender,
  CreationSources,
  PackagePreview,
  PricingScheduleMutationResult,
  ReleaseApprovalRequested,
  RequirementPage,
  TenderDetail,
  TenderPricing,
  TenderPage,
  TenderTimetable,
  TenderUpdateResult,
  tenderEndpoints,
} from '../../../contracts/tenders.js';
import { revisionHash } from '../../fixtures/tenders/index.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp, TestResponse } from '../../testing/index.js';

const TEBOGO = 'tebogo.officer@tenderiq.local';
const MPHO = 'mpho.manager@tenderiq.local';
const THATO = 'thato.eval@tenderiq.local';
const PULE = 'pule.auditor@tenderiq.local';

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp();
});

function problemOf(response: TestResponse): Problem {
  return Problem.parse(response.body);
}

function referencesOf(response: TestResponse): string[] {
  expect(response.status).toBe(200);
  return TenderPage.parse(response.body).items.map((row) => row.reference);
}

describe('module registration', () => {
  it('serves every tenders endpoint from the auto-discovered module', () => {
    expect(JSON.stringify(api.failed)).not.toContain('tenders');
    expect(api.loaded).toContain('tenders/index');
    expect(api.endpointIds).toEqual(expect.arrayContaining(Object.values(tenderEndpoints).map((endpoint) => endpoint.id)));
  });
});

describe('tenant isolation and visibility', () => {
  it('lists only the active buyer’s register for a KWU officer, templates excluded', async () => {
    // Act
    const references = referencesOf(await api.callAs(TEBOGO, tenderEndpoints.list, { tenant: 'kwu', query: { pageSize: 50 } }));

    // Assert
    expect(references).toHaveLength(12);
    expect(references).not.toContain('T-2026-0011');
    expect(references.every((reference) => reference.startsWith('T-2026-'))).toBe(true);
  });

  it('lists only the ODC tenders for the ODC officer', async () => {
    expect([...referencesOf(await api.callAs('officer.odc@tenderiq.local', tenderEndpoints.list, { tenant: 'odc' }))].sort()).toEqual(['T-2026-0011', 'T-2026-0013']);
  });

  it('answers 404 for another organization’s tender, never revealing it', async () => {
    const odcTender = await api.callAs(TEBOGO, tenderEndpoints.get, { tenant: 'kwu', params: { tenderId: 11 } });
    const kwuTender = await api.callAs('officer.odc@tenderiq.local', tenderEndpoints.get, { tenant: 'odc', params: { tenderId: 5 } });
    expect(odcTender.status).toBe(404);
    expect(kwuTender.status).toBe(404);
  });

  it('shows an evaluator only the tenders whose team they are on', async () => {
    const references = referencesOf(await api.callAs(THATO, tenderEndpoints.list, { tenant: 'kwu', query: { pageSize: 50 } }));
    expect([...references].sort()).toEqual(['T-2026-0001', 'T-2026-0003', 'T-2026-0005', 'T-2026-0007', 'T-2026-0008', 'T-2026-0010', 'T-2026-0012', 'T-2026-0014']);
    expect((await api.callAs(THATO, tenderEndpoints.get, { tenant: 'kwu', params: { tenderId: 2 } })).status).toBe(404);
  });

  it('lets the auditor read every tender but not edit one', async () => {
    expect(referencesOf(await api.callAs(PULE, tenderEndpoints.list, { tenant: 'kwu', query: { pageSize: 50 } }))).toHaveLength(12);
    const edit = await api.callAs(PULE, tenderEndpoints.update, {
      tenant: 'kwu',
      params: { tenderId: 5 },
      body: { expectedDraftRevision: 3, title: 'Renamed' },
    });
    expect(edit.status).toBe(403);
    expect(problemOf(edit).code).toBe('FORBIDDEN');
  });

  it('refuses the organization administrator, who holds no tender permission (403 FORBIDDEN)', async () => {
    const response = await api.callAs('admin.kwu@tenderiq.local', tenderEndpoints.list, { tenant: 'kwu' });
    expect(response.status).toBe(403);
    expect(problemOf(response).code).toBe('FORBIDDEN');
  });

  it('refuses a supplier persona in its own tenant and in the buyer’s with the identical tenant 403', async () => {
    const own = await api.callAs('tsodilo.bidmanager@tenderiq.local', tenderEndpoints.list, { tenant: 'tsodilo' });
    const buyer = await api.callAs('tsodilo.bidmanager@tenderiq.local', tenderEndpoints.get, { tenant: 'kwu', params: { tenderId: 5 } });
    expect(own.status).toBe(403);
    expect(buyer.status).toBe(403);
    expect(problemOf(own).code).toBe('TENANT_ACCESS_DENIED');
    expect(problemOf(buyer).code).toBe('TENANT_ACCESS_DENIED');
  });

  it('refuses the support agent’s metadata-only grant and the operator tenant', async () => {
    const support = await api.callAs('support.agent@tenderiq.local', tenderEndpoints.get, { tenant: 'kwu', params: { tenderId: 5 } });
    const operator = await api.callAs('ops.admin@tenderiq.local', tenderEndpoints.list, { tenant: 'tenderiq-ops' });
    expect(support.status).toBe(403);
    expect(problemOf(support).code).toBe('FORBIDDEN');
    expect(operator.status).toBe(403);
  });
});

describe('register filters', () => {
  it('filters by status, phase, text and deadline window, and pages the result', async () => {
    const call = async (query: Record<string, string | number | string[]>) =>
      referencesOf(await api.callAs(TEBOGO, tenderEndpoints.list, { tenant: 'kwu', query }));
    expect(await call({ status: 'open', sort: 'reference' })).toEqual(['T-2026-0002', 'T-2026-0006']);
    expect(await call({ phase: 'preparation', sort: 'reference' })).toEqual(['T-2026-0005', 'T-2026-0012']);
    expect(await call({ q: 'valves' })).toEqual(['T-2026-0008']);
    expect(await call({ deadlineFrom: '2026-10-01', deadlineTo: '2026-10-31', sort: 'submissionDeadline' })).toEqual(['T-2026-0006', 'T-2026-0002']);
    const page = TenderPage.parse((await api.callAs(TEBOGO, tenderEndpoints.list, { tenant: 'kwu', query: { sort: 'reference', pageSize: 5, page: 3 } })).body);
    expect(page.items.map((row) => row.reference)).toEqual(['T-2026-0012', 'T-2026-0014']);
    expect(page.total).toBe(12);
    expect(page.statusCounts.find((row) => row.status === 'open')?.count).toBe(2);
  });

  it('rejects an unknown sort field with a 422 field error', async () => {
    const response = await api.callAs(TEBOGO, tenderEndpoints.list, { tenant: 'kwu', query: { sort: 'budget' } });
    expect(response.status).toBe(422);
    expect(problemOf(response).errors?.[0]?.code).toBe('INVALID_SORT');
  });
});

describe('AC-06 release approval on T-2026-0005', () => {
  it('returns the invalidated approval of revision 2 while the package is at revision 3', async () => {
    const detail = TenderDetail.parse((await api.callAs(MPHO, tenderEndpoints.get, { tenant: 'kwu', params: { tenderId: 5 } })).body);
    expect(detail.releaseApproval).toMatchObject({ approvalId: 31, status: 'invalidated', subjectVersion: 2 });
    expect(detail.draftRevision).toBe(3);
    expect(detail.gate.publicationBlocked).toBe(true);
  });

  it('requests release approval for the exact current revision', async () => {
    const response = await api.callAs(TEBOGO, tenderEndpoints.requestReleaseApproval, {
      tenant: 'kwu',
      params: { tenderId: 5 },
      body: { draftRevision: 3, contentHash: revisionHash(5, 3), justification: 'Lot 3 and the revised estimate are ready for approval.' },
    });
    expect(response.status).toBe(201);
    expect(ReleaseApprovalRequested.parse(response.body)).toMatchObject({ tenderStatus: 'awaiting_release_approval', approval: { status: 'pending', subjectVersion: 3 } });
  });

  it('returns a readiness and gate that show the new approval as pending after a request, not as missing', async () => {
    // Act
    const response = await api.callAs(TEBOGO, tenderEndpoints.requestReleaseApproval, {
      tenant: 'kwu',
      params: { tenderId: 5 },
      body: { draftRevision: 3, contentHash: revisionHash(5, 3), justification: 'Ready for approval.' },
    });

    // Assert
    const result = ReleaseApprovalRequested.parse(response.body);
    const approvalItems = result.readiness.filter((item) => item.section === 'release_approval' && item.code?.startsWith('RELEASE_APPROVAL') === true);
    expect(approvalItems.map((item) => item.code)).toEqual(['RELEASE_APPROVAL_PENDING']);
    expect(approvalItems[0]?.title).toBe(`Release approval #${result.approval.approvalId} for revision 3 is pending.`);
    expect(result.gate.canRequestReleaseApproval).toBe(false);
    expect(result.gate.publicationBlocked).toBe(true);
    expect(result.gate.blockedReasons).toContain(`Release approval #${result.approval.approvalId} for revision 3 is awaiting a decision.`);
    expect(result.gate.blockedReasons.join(' ')).not.toContain('No release approval covers');
    expect(result.summary.warnings).toBe(result.readiness.filter((item) => item.status === 'warning').length);
  });

  it('refuses a request for a superseded revision with REVISION_CONFLICT', async () => {
    const response = await api.callAs(TEBOGO, tenderEndpoints.requestReleaseApproval, {
      tenant: 'kwu',
      params: { tenderId: 5 },
      body: { draftRevision: 2, contentHash: revisionHash(5, 2), justification: 'Old revision.' },
    });
    expect(response.status).toBe(409);
    expect(problemOf(response).code).toBe('REVISION_CONFLICT');
  });

  it('refuses the incomplete T-2026-0012 with RELEASE_NOT_READY', async () => {
    const response = await api.callAs(TEBOGO, tenderEndpoints.requestReleaseApproval, {
      tenant: 'kwu',
      params: { tenderId: 12 },
      body: { draftRevision: 2, contentHash: revisionHash(12, 2), justification: 'Please approve.' },
    });
    expect(response.status).toBe(409);
    expect(problemOf(response).code).toBe('RELEASE_NOT_READY');
  });

  it('reports a material edit as a new revision', async () => {
    const response = await api.callAs(TEBOGO, tenderEndpoints.update, {
      tenant: 'kwu',
      params: { tenderId: 5 },
      body: { expectedDraftRevision: 3, estimatedValue: { amount: '2050000.00', currency: 'BWP' } },
    });
    expect(response.status).toBe(200);
    const result = TenderUpdateResult.parse(response.body);
    expect(result.change).toMatchObject({ material: true, draftRevision: 4, contentHash: revisionHash(5, 4) });
    expect(result.change.releaseChecksReset).toEqual(['scope', 'funding']);
    expect(result.tender.estimatedValue).toEqual({ amount: '2050000.00', currency: 'BWP' });
  });

  it('treats a title-only edit as not material', async () => {
    const response = await api.callAs(TEBOGO, tenderEndpoints.update, {
      tenant: 'kwu',
      params: { tenderId: 5 },
      body: { expectedDraftRevision: 3, title: 'Water treatment chemicals framework 2027–2029' },
    });
    expect(TenderUpdateResult.parse(response.body).change).toMatchObject({ material: false, draftRevision: 3 });
  });
});

describe('authoring commands', () => {
  it('refuses to edit a released tender in place (BR-16) and a stale revision', async () => {
    const released = await api.callAs(TEBOGO, tenderEndpoints.update, { tenant: 'kwu', params: { tenderId: 2 }, body: { expectedDraftRevision: 3, summary: 'x y z' } });
    const stale = await api.callAs(TEBOGO, tenderEndpoints.update, { tenant: 'kwu', params: { tenderId: 5 }, body: { expectedDraftRevision: 1, summary: 'x y z' } });
    expect(problemOf(released).code).toBe('TENDER_NOT_EDITABLE');
    expect(problemOf(stale).code).toBe('REVISION_CONFLICT');
  });

  it('rejects an evaluation plan whose weights total 95 with a 422 on the criteria field', async () => {
    const response = await api.callAs(TEBOGO, tenderEndpoints.updateEvaluationPlan, {
      tenant: 'kwu',
      params: { tenderId: 12, planId: 121 },
      body: {
        expectedVersion: 1,
        scaleMax: 5,
        aggregationMethod: 'consensus',
        priceMethod: 'lowest_ratio',
        priceWeight: '30',
        zeroPriceTreatment: 'Included elsewhere.',
        missingPriceTreatment: 'Non-comparable.',
        thresholdScope: 'none',
        decimalPlacesCalc: 4,
        decimalPlacesDisplay: 2,
        criteria: [
          { code: 'TECH', name: 'Technical capability', maxPoints: '40', envelope: 'technical' },
          { code: 'METH', name: 'Maintenance methodology', maxPoints: '25', envelope: 'technical' },
          { code: 'PRICE', name: 'Price', maxPoints: '30', isPrice: true, envelope: 'commercial' },
        ],
        anchors: [],
        tieBreakRules: [{ sequence: 1, rule: 'highest_non_price' }],
      },
    });
    expect(response.status).toBe(422);
    expect(problemOf(response).errors).toEqual([expect.objectContaining({ field: 'criteria', code: 'WEIGHTS_TOTAL_NOT_100' })]);
  });

  it('refuses to approve a plan with blocking issues, and refuses the officer who lacks release approval', async () => {
    const manager = await api.callAs(MPHO, tenderEndpoints.approveEvaluationPlan, { tenant: 'kwu', params: { tenderId: 12, planId: 121 }, body: { expectedVersion: 1 } });
    const officer = await api.callAs(TEBOGO, tenderEndpoints.approveEvaluationPlan, { tenant: 'kwu', params: { tenderId: 12, planId: 121 }, body: { expectedVersion: 1 } });
    expect(problemOf(manager).code).toBe('PLAN_HAS_BLOCKING_ISSUES');
    expect(officer.status).toBe(403);
  });

  it('creates a draft from an approved template and refuses one under review', async () => {
    const created = await api.callAs(TEBOGO, tenderEndpoints.create, { tenant: 'kwu', body: { source: 'template', templateId: 12, title: 'Laboratory calibration services' } });
    const inReview = await api.callAs(TEBOGO, tenderEndpoints.create, { tenant: 'kwu', body: { source: 'template', templateId: 13, title: 'SCADA consultancy' } });
    expect(created.status).toBe(201);
    expect(CreatedTender.parse(created.body)).toMatchObject({ tender: { reference: 'T-2026-0015', status: 'draft' }, provenance: { source: 'template', sourceId: 12 } });
    expect(problemOf(inReview).code).toBe('TEMPLATE_NOT_APPROVED');
  });

  it('copies structure from a prior event but never its bids, approvals or outcomes', async () => {
    const response = await api.callAs(TEBOGO, tenderEndpoints.create, {
      tenant: 'kwu',
      body: { source: 'prior_event', priorTenderId: 1, title: 'Solar pumping systems re-tender', sections: ['lots', 'requirements'] },
    });
    const created = CreatedTender.parse(response.body);
    expect(created.tender.lotCount).toBe(3);
    expect(created.notCopied).toEqual(expect.arrayContaining(['bids', 'deliberations', 'approvals', 'supplier_outcomes']));
    expect(created.tender.releaseApprovalStatus).toBeNull();
  });

  it('refuses a converted request and a procedure the policy does not permit', async () => {
    const converted = await api.callAs(TEBOGO, tenderEndpoints.create, { tenant: 'kwu', body: { source: 'request', requestId: 1 } });
    const direct = await api.callAs(TEBOGO, tenderEndpoints.create, {
      tenant: 'kwu',
      body: { source: 'blank', title: 'Emergency repair', eventType: 'rfq', procedure: 'direct', participation: 'invitation_only' },
    });
    expect(problemOf(converted).code).toBe('REQUEST_ALREADY_CONVERTED');
    expect(problemOf(direct).code).toBe('PROCEDURE_NOT_PERMITTED');
  });

  it('lists the requirements of T-2026-0012 without an owner, with the whole-tender summary', async () => {
    const response = await api.callAs(TEBOGO, tenderEndpoints.requirements, { tenant: 'kwu', params: { tenderId: 12 }, query: { issue: 'missing_owner' } });
    const page = RequirementPage.parse(response.body);
    expect(page.items.map((row) => row.refCode)).toEqual(['REQ-Q-02', 'REQ-T-02']);
    expect(page.summary).toMatchObject({ total: 7, missingOwner: 2 });
    expect(page.summary.contradictions).toBeGreaterThanOrEqual(3);
  });

  it('refuses a duplicate requirement reference', async () => {
    const response = await api.callAs(TEBOGO, tenderEndpoints.createRequirement, {
      tenant: 'kwu',
      params: { tenderId: 5 },
      body: { section: 'Technical', refCode: 'REQ-T-01', text: 'Duplicate', responseType: 'text', treatment: 'rated', envelope: 'technical', missingConsequence: 'clarify' },
    });
    expect(problemOf(response).code).toBe('REF_CODE_TAKEN');
  });

  it('refuses to remove an envelope that requirements still use', async () => {
    const response = await api.callAs(TEBOGO, tenderEndpoints.updateEnvelopes, {
      tenant: 'kwu',
      params: { tenderId: 5 },
      body: { expectedDraftRevision: 3, openingMode: 'single_stage', envelopes: [{ envelope: 'technical', openOrder: 1 }, { envelope: 'commercial', openOrder: 1 }] },
    });
    expect(problemOf(response).code).toBe('ENVELOPE_IN_USE');
  });

  it('flags the T-2026-0012 deadline on the Boxing Day holiday in the official zone', async () => {
    const timetable = TenderTimetable.parse((await api.callAs(TEBOGO, tenderEndpoints.timetable, { tenant: 'kwu', params: { tenderId: 12 } })).body);
    const submission = timetable.milestones.find((row) => row.milestone === 'submission_deadline' && row.lot === null);
    expect(submission?.deadline).toEqual({ at: '2026-12-28T10:00:00Z', timeZone: 'Africa/Gaborone' });
    expect(submission?.workingDay).toMatchObject({ isWorkingDay: false, reason: 'holiday', nextWorkingDate: '2026-12-29' });
    expect(timetable.issues.map((issue) => issue.code)).toContain('RESPONSE_PERIOD_TOO_SHORT');
  });

  it('writes the T-2026-0012 non-working day warnings with formatted dates and without duplicates', async () => {
    const timetable = TenderTimetable.parse((await api.callAs(TEBOGO, tenderEndpoints.timetable, { tenant: 'kwu', params: { tenderId: 12 } })).body);

    const messages = timetable.issues.filter((issue) => issue.code === 'NON_WORKING_DAY').map((issue) => issue.message);

    expect(messages.length).toBeGreaterThan(0);
    expect(new Set(messages).size).toBe(messages.length);
    expect(messages.join(' ')).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(messages).toContain(
      'The submission deadline for the whole tender and Lot 2 falls on a public holiday (Boxing Day holiday), 28 Dec 2026; the next working day is 29 Dec 2026.',
    );
  });

  it('assigns an evaluation chair, and refuses a role the person lacks the permission for', async () => {
    const chair = await api.callAs(TEBOGO, tenderEndpoints.assignTeamMember, { tenant: 'kwu', params: { tenderId: 12 }, body: { userId: 10, teamRole: 'evaluation_chair' } });
    const opener = await api.callAs(TEBOGO, tenderEndpoints.assignTeamMember, { tenant: 'kwu', params: { tenderId: 12 }, body: { userId: 15, teamRole: 'evaluator' } });
    expect(chair.status).toBe(201);
    expect(problemOf(opener).code).toBe('TEAM_ROLE_NOT_PERMITTED');
  });

  it('refuses to remove the accountable owner (BR-01)', async () => {
    const response = await api.callAs(TEBOGO, tenderEndpoints.removeTeamMember, { tenant: 'kwu', params: { tenderId: 12, memberId: 1201 }, body: { reason: 'Leaving' } });
    expect(problemOf(response).code).toBe('OWNER_REQUIRED');
  });

  it('records a release check only for the current revision', async () => {
    const stale = await api.callAs(MPHO, tenderEndpoints.recordReleaseCheck, { tenant: 'kwu', params: { tenderId: 5, checkArea: 'scope' }, body: { draftRevision: 2, status: 'passed' } });
    const current = await api.callAs(MPHO, tenderEndpoints.recordReleaseCheck, { tenant: 'kwu', params: { tenderId: 5, checkArea: 'scope' }, body: { draftRevision: 3, status: 'passed' } });
    expect(problemOf(stale).code).toBe('CHECK_REVISION_STALE');
    expect(current.status).toBe(200);
  });

  it('previews the invitation-only T-2026-0006 as hidden from the public', async () => {
    const response = await api.callAs(TEBOGO, tenderEndpoints.preview, { tenant: 'kwu', params: { tenderId: 6 }, query: { audience: 'public' } });
    expect(PackagePreview.parse(response.body)).toMatchObject({ visible: false, hiddenReason: 'invitation_only' });
  });
});

describe('pricing discount rules and price entries (BUY-10, PRD §7.4)', () => {
  it('states the discount rules and the accepted price entries of every schedule', async () => {
    // Act
    const pricing = TenderPricing.parse((await api.callAs(TEBOGO, tenderEndpoints.pricing, { tenant: 'kwu', params: { tenderId: 5 } })).body);

    // Assert
    expect(pricing.schedules.map((row) => row.discountsAccepted)).toEqual([
      ['conditional', 'package'],
      ['conditional', 'package'],
      ['conditional', 'package'],
    ]);
    expect(pricing.schedules[0]?.discountEvaluationNote).toContain('award combinations');
    expect(pricing.schedules.every((row) => row.priceEntries.includes('priced'))).toBe(true);
  });

  it('warns on T-2026-0012 that a schedule accepts discounts without a comparison basis', async () => {
    const pricing = TenderPricing.parse((await api.callAs(TEBOGO, tenderEndpoints.pricing, { tenant: 'kwu', params: { tenderId: 12 } })).body);

    const issue = pricing.schedules.flatMap((row) => row.issues).find((row) => row.code === 'DISCOUNT_BASIS_MISSING');

    expect(issue).toMatchObject({ severity: 'warning', field: 'pricing.1251.discountEvaluationNote' });
  });

  it('keeps zero, included and not offered distinct in the T-2026-0007 bill of quantities', async () => {
    const pricing = TenderPricing.parse((await api.callAs(TEBOGO, tenderEndpoints.pricing, { tenant: 'kwu', params: { tenderId: 7 } })).body);

    const boq = pricing.schedules[0];

    expect(boq?.priceEntries).toEqual(['priced', 'zero', 'included']);
    expect(boq?.instructions).not.toMatch(/zero rate means the item is included/i);
  });

  it('shows the discount rules and price entries to participating suppliers in the preview', async () => {
    const preview = PackagePreview.parse(
      (await api.callAs(TEBOGO, tenderEndpoints.preview, { tenant: 'kwu', params: { tenderId: 5 }, query: { audience: 'supplier' } })).body,
    );

    expect(preview.pricingSchedules[0]).toMatchObject({ discountsAccepted: ['conditional', 'package'], priceEntries: ['priced', 'included', 'not_offered'] });
  });

  it('creates a schedule with its discount rules, and rejects accepted discounts without a basis (422)', async () => {
    // Act
    const created = await api.callAs(TEBOGO, tenderEndpoints.createPricingSchedule, {
      tenant: 'kwu',
      params: { tenderId: 12 },
      body: { name: 'Lot 2 — Generators', discountsAccepted: ['unconditional'], discountEvaluationNote: 'Deducted from the evaluated price.', priceEntries: ['priced', 'not_offered'] },
    });
    const rejected = await api.callAs(TEBOGO, tenderEndpoints.createPricingSchedule, {
      tenant: 'kwu',
      params: { tenderId: 12 },
      body: { name: 'Lot 2 — Generators', discountsAccepted: ['unconditional'] },
    });

    // Assert
    expect(created.status).toBe(201);
    expect(PricingScheduleMutationResult.parse(created.body).schedule).toMatchObject({ discountsAccepted: ['unconditional'], priceEntries: ['priced', 'not_offered'] });
    expect(rejected.status).toBe(422);
    expect(problemOf(rejected).errors?.map((error) => error.code)).toContain('DISCOUNT_BASIS_REQUIRED');
  });
});

describe('creation sources currency', () => {
  it('returns the organization default currency and the currencies a new estimate may use', async () => {
    const sources = CreationSources.parse((await api.callAs(TEBOGO, tenderEndpoints.creationSources, { tenant: 'kwu', query: {} })).body);

    expect(sources.defaultCurrency).toBe('BWP');
    expect(sources.currencies[0]).toBe('BWP');
  });
});
