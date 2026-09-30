/**
 * Reporting mock handlers with REAL authentication (DD-43): tenant filtering, permission and kind denials, panel
 * restriction without count leaks (BR-43), supplier isolation, the AC-34 report safeguards, report definitions,
 * controlled exports, and global search with saved views across memberships (DD-21).
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { Problem, pageOf } from '../../../contracts/common.js';
import {
  BuyerDashboard,
  ExportDownload,
  ExportRecord,
  ReportDefinition,
  ReportFamilyCatalog,
  ReportPreview,
  ReportResult,
  ReportRun,
  SavedView,
  SearchResponse,
  ReportDefinitionRow,
  SupplierDashboard,
  reportingEndpoints as R,
} from '../../../contracts/reporting.js';
import { getBid } from '../../../contracts/bids.js';
import { TENANT_IDS } from '../../fixtures/platform.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp, TestResponse } from '../../testing/index.js';

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp();
});

const TEBOGO = 'tebogo.officer@tenderiq.local';
const MPHO = 'mpho.manager@tenderiq.local';
const KAGISO = 'kagiso.requester@tenderiq.local';

function ok<T>(response: TestResponse, schema: { parse(value: unknown): T }, status = 200): T {
  expect(response.status, JSON.stringify(response.body)).toBe(status);
  return schema.parse(response.body);
}

function problemCode(response: TestResponse): string | undefined {
  return Problem.parse(response.body).code;
}

const EMPTY_FILTERS = {
  from: null,
  to: null,
  legalEntityIds: [],
  departmentIds: [],
  categoryIds: [],
  ownerUserIds: [],
  stages: [],
  eventTypes: [],
  level: 'both',
};

function definitionBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Participation for the audit committee',
    family: 'participation',
    fields: ['reference', 'scope', 'uniqueBidders', 'submittedRevisions'],
    filters: EMPTY_FILTERS,
    currencyBasis: 'BWP',
    conversionDate: null,
    audiencePermission: 'report.view',
    scheduleCron: '0 6 * * 1',
    recipientUserIds: [4, 20],
    ...overrides,
  };
}

describe('module registration', () => {
  it('loads the reporting and records modules without failures', () => {
    expect(api.loaded).toEqual(expect.arrayContaining(['reporting/index', 'records/index']));
    expect(api.failed.filter((failure) => failure.module.startsWith('reporting') || failure.module.startsWith('records'))).toEqual([]);
  });
});

describe('buyer.dashboard.get (BUY-01)', () => {
  it('returns only the active buyer’s events and deadlines for an officer', async () => {
    // Act
    const dashboard = ok(await api.callAs(TEBOGO, R.getBuyerDashboard, { tenant: 'kwu' }), BuyerDashboard);

    // Assert
    expect(dashboard.deadlines.items.length).toBeGreaterThan(0);
    expect(dashboard.deadlines.items.every((item) => item.reference !== 'T-2026-0011')).toBe(true);
    expect(dashboard.kpis.find((kpi) => kpi.key === 'active_events')?.value).toBe(7);
    expect(dashboard.kpis.find((kpi) => kpi.key === 'closing_within_7_days')?.value).toBe(1);
    expect(dashboard.pipelineByStage.items.some((item) => item.stage === 'draft')).toBe(true);
    expect(dashboard.filterOptions.departments.map((item) => item.label)).toContain('Network Operations');
    expect(dashboard.completeness.complete).toBe(false);
  });

  it('shows Okavango District Council only its own event', async () => {
    const dashboard = ok(await api.callAs('officer.odc@tenderiq.local', R.getBuyerDashboard, { tenant: 'odc' }), BuyerDashboard);
    expect(dashboard.deadlines.items.map((item) => item.reference)).toEqual(['T-2026-0011', 'T-2026-0011']);
    expect(dashboard.kpis.find((kpi) => kpi.key === 'active_events')?.value).toBe(1);
  });

  it('restricts every tender panel for a requester without leaking counts (BR-43)', async () => {
    const dashboard = ok(await api.callAs(KAGISO, R.getBuyerDashboard, { tenant: 'kwu' }), BuyerDashboard);
    expect(dashboard.pipelineByStage).toEqual({ restricted: true, items: [] });
    expect(dashboard.deadlines).toEqual({ restricted: true, items: [] });
    expect(dashboard.pipelineValue).toBeNull();
    expect(dashboard.kpis.every((kpi) => kpi.restricted && kpi.value === null)).toBe(true);
    expect(dashboard.attention).toEqual([]);
  });

  it('narrows panels by department and stage filters', async () => {
    const dashboard = ok(
      await api.callAs(TEBOGO, R.getBuyerDashboard, { tenant: 'kwu', query: { departmentId: 3, stage: ['open', 'closed'] } }),
      BuyerDashboard,
    );
    expect(dashboard.pipelineByStage.items.map((item) => item.stage).sort()).toEqual(['closed', 'open']);
    expect(dashboard.appliedFilters).toMatchObject({ departmentId: 3, stages: ['open', 'closed'] });
    expect(dashboard.kpis.every((kpi) => kpi.delta === null)).toBe(true);
  });

  it('rejects an inverted date range with INVALID_DATE_RANGE', async () => {
    const response = await api.callAs(TEBOGO, R.getBuyerDashboard, { tenant: 'kwu', query: { from: '2026-10-31', to: '2026-10-01' } });
    expect(response.status).toBe(422);
    expect(problemCode(response)).toBe('INVALID_DATE_RANGE');
  });

  it('rejects an inverted value range with INVALID_VALUE_RANGE', async () => {
    const response = await api.callAs(TEBOGO, R.getBuyerDashboard, { tenant: 'kwu', query: { minValue: '5000000.00', maxValue: '1000.00' } });
    expect(response.status).toBe(422);
    expect(problemCode(response)).toBe('INVALID_VALUE_RANGE');
  });

  it('denies the organization administrator, who lacks dashboard.view, with 403 FORBIDDEN', async () => {
    const response = await api.callAs('admin.kwu@tenderiq.local', R.getBuyerDashboard, { tenant: 'kwu' });
    expect(response.status).toBe(403);
    expect(problemCode(response)).toBe('FORBIDDEN');
  });

  it('answers another buyer’s tenant with the identical tenant 403', async () => {
    const response = await api.callAs(TEBOGO, R.getBuyerDashboard, { tenant: 'odc' });
    expect(response.status).toBe(403);
    expect(problemCode(response)).toBe('TENANT_ACCESS_DENIED');
  });

  it('denies a supplier persona on the buyer dashboard (tenant kind)', async () => {
    const response = await api.callAs('tsodilo.bidmanager@tenderiq.local', R.getBuyerDashboard, { tenant: 'tsodilo' });
    expect(response.status).toBe(403);
  });
});

describe('supplier.dashboard.get (SUP-01)', () => {
  it('shows a supplier only its own pursuits and outcomes', async () => {
    const dashboard = ok(await api.callAs('tsodilo.bidmanager@tenderiq.local', R.getSupplierDashboard, { tenant: 'tsodilo' }), SupplierDashboard);
    expect(dashboard.pursuits.items.map((item) => item.reference).sort()).toEqual([
      'T-2026-0001',
      'T-2026-0002',
      'T-2026-0003',
      'T-2026-0006',
      'T-2026-0007',
      'T-2026-0008',
    ]);
    expect(dashboard.invitations.items.every((item) => item.invitationStatus === 'accepted')).toBe(true);
    expect(dashboard.outcomes.items.map((item) => [item.reference, item.successful])).toContainEqual(['T-2026-0007', false]);
  });

  it('opens each pursuit on the supplier’s own bid, which the bids API returns to that supplier', async () => {
    // Arrange
    const tsodilo = ok(await api.callAs('tsodilo.bidmanager@tenderiq.local', R.getSupplierDashboard, { tenant: 'tsodilo' }), SupplierDashboard);
    const t2 = tsodilo.pursuits.items.find((item) => item.reference === 'T-2026-0002');

    // Act
    const bid = await api.callAs('tsodilo.bidmanager@tenderiq.local', getBid, { tenant: 'tsodilo', params: { bidId: t2?.bidId ?? 0 } });

    // Assert
    expect(t2).toMatchObject({ bidId: 6, to: '/supplier/responses/6' });
    expect(bid.status).toBe(200);
    for (const item of tsodilo.pursuits.items) {
      expect(item.to).toBe(item.bidId === null ? `/supplier/opportunities/${item.tenderId}` : `/supplier/responses/${item.bidId}`);
    }
  });

  it('opens sam.dual’s pursuits in Chobe on Chobe’s bids, never on a tender id', async () => {
    const chobe = ok(await api.callAs('sam.dual@tenderiq.local', R.getSupplierDashboard, { tenant: 'chobe-pipe' }), SupplierDashboard);
    const t8 = chobe.pursuits.items.find((item) => item.reference === 'T-2026-0008');
    expect(t8).toMatchObject({ bidId: 19, to: '/supplier/responses/19', submissionState: 'submitted', effectiveReceiptNo: 'RCPT-2026-000024' });
    const bid = await api.callAs('sam.dual@tenderiq.local', getBid, { tenant: 'chobe-pipe', params: { bidId: 19 } });
    expect(bid.status).toBe(200);
  });

  it('shows Tsodilo’s own T-2026-0008 withdrawal without a receipt and never Chobe’s late attempt', async () => {
    const tsodilo = ok(await api.callAs('tsodilo.bidmanager@tenderiq.local', R.getSupplierDashboard, { tenant: 'tsodilo' }), SupplierDashboard);
    expect(tsodilo.pursuits.items.find((item) => item.reference === 'T-2026-0008')).toMatchObject({ bidId: 20, submissionState: 'withdrawn', effectiveReceiptNo: null });
    expect(tsodilo.pursuits.items.some((item) => item.latestRevisionStatus === 'late_rejected')).toBe(false);
    const chobe = ok(await api.callAs('chobe-pipe.admin@tenderiq.local', R.getSupplierDashboard, { tenant: 'chobe-pipe' }), SupplierDashboard);
    expect(chobe.expiringEvidence.items.map((item) => item.evidenceId)).toEqual([202]);
    expect(chobe.kpis.find((kpi) => kpi.key === 'expiring_evidence')?.value).toBe(1);
  });

  it('restricts panels a contributor may not read', async () => {
    const dashboard = ok(await api.callAs('tsodilo.contributor@tenderiq.local', R.getSupplierDashboard, { tenant: 'tsodilo' }), SupplierDashboard);
    expect(dashboard.pursuits.restricted).toBe(false);
    expect(dashboard.contractTasks).toEqual({ restricted: true, items: [] });
    expect(dashboard.expiringEvidence).toEqual({ restricted: true, items: [] });
    expect(dashboard.kpis.find((kpi) => kpi.key === 'open_contract_tasks')).toMatchObject({ restricted: true, value: null });
  });

  it('shows the internally approved Serowe response as not submitted (AC-11)', async () => {
    const dashboard = ok(await api.callAs('serowe-ict.bidmanager@tenderiq.local', R.getSupplierDashboard, { tenant: 'serowe-ict' }), SupplierDashboard);
    expect(dashboard.pursuits.items.find((item) => item.reference === 'T-2026-0002')).toMatchObject({ submissionState: 'not_submitted', effectiveReceiptNo: null });
  });

  it('denies a buyer persona on the supplier dashboard', async () => {
    const response = await api.callAs(TEBOGO, R.getSupplierDashboard, { tenant: 'tsodilo' });
    expect(response.status).toBe(403);
  });
});

describe('management reports (REP-01)', () => {
  it('lists every family and marks the ones the caller may not run', async () => {
    const catalog = ok(await api.callAs(TEBOGO, R.listReportFamilies, { tenant: 'kwu' }), ReportFamilyCatalog);
    expect(catalog.families).toHaveLength(10);
    expect(catalog.families.find((item) => item.family === 'evaluation_integrity')?.restricted).toBe(true);
    expect(catalog.families.find((item) => item.family === 'pipeline')?.restricted).toBe(false);
  });

  it('counts unique organizations per event and per lot separately (AC-34)', async () => {
    // Act
    const report = ok(await api.callAs(MPHO, R.runReport, { tenant: 'kwu', params: { family: 'participation' } }), ReportResult);

    // Assert
    const event = report.rows.find((row) => row.id === 'pa-1');
    const lots = report.rows.filter((row) => row.parentId === 'pa-1');
    expect(event?.cells.uniqueBidders).toEqual({ kind: 'count', value: 3 });
    expect(lots).toHaveLength(3);
    expect(lots.every((row) => row.level === 'lot')).toBe(true);
    expect(report.currencyBasis.currency).toBe('BWP');
    expect(report.highlights.find((item) => item.key === 'distinctBidders')).toBeDefined();
    expect(report.completeness.complete).toBe(false);
  });

  it('totals per-event unique organizations as distinct organizations, never as a sum across events (AC-34)', async () => {
    // Act
    const report = ok(await api.callAs(MPHO, R.runReport, { tenant: 'kwu', params: { family: 'participation' } }), ReportResult);

    // Assert
    const events = report.rows.filter((row) => row.level === 'event');
    const sumOf = (key: string): number => events.reduce((total, row) => total + (row.cells[key]?.kind === 'count' ? (row.cells[key] as { value: number }).value : 0), 0);
    expect(sumOf('uniqueBidders')).toBeGreaterThan(6);
    expect(report.totals?.uniqueBidders).toEqual({ kind: 'count', value: 6 });
    expect(report.highlights.find((item) => item.key === 'distinctBidders')?.cell).toEqual({ kind: 'count', value: 6 });
    const interestTotal = report.totals?.registeredInterest;
    expect(interestTotal?.kind === 'count' ? interestTotal.value : Number.NaN).toBeLessThan(sumOf('registeredInterest'));
    expect(report.totals?.submittedRevisions).toEqual({ kind: 'count', value: sumOf('submittedRevisions') });
  });

  it('counts the multi-stage T-2026-0009 as three organizations with five receipts (AC-34)', async () => {
    const report = ok(await api.callAs(MPHO, R.runReport, { tenant: 'kwu', params: { family: 'participation' } }), ReportResult);
    const t9 = report.rows.find((row) => row.id === 'pa-9');
    expect(t9?.cells.uniqueBidders).toEqual({ kind: 'count', value: 3 });
    expect(t9?.cells.submittedRevisions).toEqual({ kind: 'count', value: 5 });
  });

  it('never shows a recommendation or an intent notice as a final award', async () => {
    const report = ok(await api.callAs(MPHO, R.runReport, { tenant: 'kwu', params: { family: 'awards' } }), ReportResult);
    const t7 = report.rows.find((row) => row.id === 'aw-7');
    const t3 = report.rows.find((row) => row.id === 'aw-3');
    expect(report.columns.find((column) => column.key === 'awardValue')?.label).toBe('Final award value');
    expect(t7?.cells.awardValue?.kind).toBe('missing');
    expect(t7?.cells.awardDate).toEqual({ kind: 'missing', reason: 'Intent notified 22 Sep 2026; final award held by a complaint.' });
    expect(t7?.cells.recommendedValue).toEqual({ kind: 'money', value: { amount: '7850000.00', currency: 'BWP' } });
    expect(t3?.cells.awardValue?.kind).toBe('missing');
    expect(report.totals?.awardValue).toEqual({ kind: 'money', value: { amount: '7190000.00', currency: 'BWP' } });
  });

  it('returns only lot rows when the level filter is lot', async () => {
    const report = ok(await api.callAs(MPHO, R.runReport, { tenant: 'kwu', params: { family: 'participation' }, query: { level: 'lot' } }), ReportResult);
    expect(report.rows.length).toBeGreaterThan(0);
    expect(report.rows.every((row) => row.level === 'lot')).toBe(true);
  });

  it('redacts financial fields for a viewer without contract.financials.view', async () => {
    const report = ok(await api.callAs(MPHO, R.runReport, { tenant: 'kwu', params: { family: 'contract_performance' } }), ReportResult);
    expect(report.rows.every((row) => row.cells.invoiced?.kind === 'restricted')).toBe(true);
    expect(report.redactions.map((item) => item.field)).toEqual(['Invoiced', 'Paid']);
  });

  it('shows the same financial fields to the contract manager', async () => {
    const report = ok(await api.callAs('masego.contracts@tenderiq.local', R.runReport, { tenant: 'kwu', params: { family: 'contract_performance' } }), ReportResult);
    expect(report.rows.find((row) => row.id === 'cp-1')?.cells.invoiced?.kind).toBe('money');
    expect(report.redactions).toEqual([]);
  });

  it('refuses a restricted family with REPORT_FAMILY_RESTRICTED', async () => {
    const response = await api.callAs(TEBOGO, R.runReport, { tenant: 'kwu', params: { family: 'evaluation_integrity' } });
    expect(response.status).toBe(403);
    expect(problemCode(response)).toBe('REPORT_FAMILY_RESTRICTED');
  });

  it('refuses an unavailable currency basis', async () => {
    const response = await api.callAs(MPHO, R.runReport, { tenant: 'kwu', params: { family: 'awards' }, query: { currency: 'USD' } });
    expect(response.status).toBe(422);
    expect(problemCode(response)).toBe('CURRENCY_BASIS_UNAVAILABLE');
  });

  it('keeps each buyer’s report rows apart', async () => {
    const report = ok(await api.callAs('officer.odc@tenderiq.local', R.runReport, { tenant: 'odc', params: { family: 'pipeline' } }), ReportResult);
    expect(report.rows.map((row) => row.id)).toEqual(['pl-11']);
  });
});

describe('report definitions (REP-02, ADM-13)', () => {
  it('lists only definitions whose audience the officer belongs to', async () => {
    const page = ok(await api.callAs(TEBOGO, R.listReportDefinitions, { tenant: 'kwu' }), pageOf(ReportDefinitionRow));
    expect(page.items.map((row) => row.audiencePermission).sort()).toEqual(['contract.view', 'report.view', 'report.view']);
    const all = ok(await api.callAs(MPHO, R.listReportDefinitions, { tenant: 'kwu' }), pageOf(ReportDefinitionRow));
    expect(all.total).toBe(6);
  });

  it('shows run history with recipients excluded at issue time (DD-19)', async () => {
    const definition = ok(await api.callAs(MPHO, R.getReportDefinition, { tenant: 'kwu', params: { definitionId: 1 } }), ReportDefinition);
    expect(definition.runs.some((run) => run.excludedRecipients.length > 0)).toBe(true);
    expect(definition.schedule?.timeZone).toBe('Africa/Gaborone');
  });

  it('hides another buyer’s definition as not found', async () => {
    const response = await api.callAs(MPHO, R.getReportDefinition, { tenant: 'kwu', params: { definitionId: 7 } });
    expect(response.status).toBe(404);
  });

  it('creates a definition for a report manager', async () => {
    const created = ok(await api.callAs(MPHO, R.createReportDefinition, { tenant: 'kwu', body: definitionBody() }), ReportDefinition, 201);
    expect(created).toMatchObject({ id: 900, active: true, family: 'participation' });
    expect(created.recipients.every((recipient) => recipient.authorized)).toBe(true);
  });

  it('refuses a duplicate name, an unknown field and an unauthorized recipient', async () => {
    const duplicate = await api.callAs(MPHO, R.createReportDefinition, { tenant: 'kwu', body: definitionBody({ name: 'Weekly pipeline for ExCo' }) });
    expect(problemCode(duplicate)).toBe('DUPLICATE_REPORT_NAME');
    const field = await api.callAs(MPHO, R.createReportDefinition, { tenant: 'kwu', body: definitionBody({ fields: ['reference', 'invoiced'] }) });
    expect(problemCode(field)).toBe('FIELD_NOT_IN_FAMILY');
    const recipient = await api.callAs(MPHO, R.createReportDefinition, { tenant: 'kwu', body: definitionBody({ audiencePermission: 'contract.view', recipientUserIds: [6] }) });
    expect(problemCode(recipient)).toBe('RECIPIENT_NOT_AUTHORIZED');
  });

  it('denies an officer without report.manage', async () => {
    const response = await api.callAs(TEBOGO, R.createReportDefinition, { tenant: 'kwu', body: definitionBody() });
    expect(response.status).toBe(403);
    expect(problemCode(response)).toBe('FORBIDDEN');
  });

  it('previews scope, redactions and unauthorized recipients before sharing', async () => {
    const preview = ok(
      await api.callAs(MPHO, R.previewReportDefinition, {
        tenant: 'kwu',
        body: definitionBody({ family: 'contract_performance', fields: ['reference', 'invoiced'], audiencePermission: 'contract.view', recipientUserIds: [19, 6] }),
      }),
      ReportPreview,
    );
    expect(preview.estimatedRowCount).toBe(7);
    expect(preview.redactions.map((item) => item.field)).toEqual(['Invoiced']);
    expect(preview.recipients.find((recipient) => recipient.user.userId === 6)?.authorized).toBe(false);
    expect(preview.recipients.find((recipient) => recipient.user.userId === 19)?.authorized).toBe(true);
  });

  it('refuses to activate an active definition and to run an inactive one', async () => {
    const active = await api.callAs(MPHO, R.setReportDefinitionActive, { tenant: 'kwu', params: { definitionId: 1 }, body: { active: true, reason: 'Keep' } });
    expect(problemCode(active)).toBe('DEFINITION_ALREADY_IN_STATE');
    const inactive = await api.callAs(MPHO, R.runReportDefinition, { tenant: 'kwu', params: { definitionId: 5 }, body: { format: 'csv', deliverToRecipients: false } });
    expect(problemCode(inactive)).toBe('DEFINITION_INACTIVE');
  });

  it('runs a definition now and excludes unauthorized recipients', async () => {
    const run = ok(await api.callAs(MPHO, R.runReportDefinition, { tenant: 'kwu', params: { definitionId: 3 }, body: { format: 'csv', deliverToRecipients: true } }), ReportRun, 201);
    expect(run.export?.status).toBe('ready');
    expect(run.excludedRecipients.map((item) => item.user.userId)).toEqual([6]);
  });
});

describe('controlled exports (ADM-13)', () => {
  it('shows an officer only the exports they requested', async () => {
    const page = ok(await api.callAs(TEBOGO, R.listExports, { tenant: 'kwu' }), pageOf(ExportRecord));
    expect(page.items.every((item) => item.requestedBy.userId === 5)).toBe(true);
    expect(page.total).toBe(1);
  });

  it('delivers a ready csv export with its rows', async () => {
    const download = ok(await api.callAs(MPHO, R.downloadExport, { tenant: 'kwu', params: { exportId: 4 } }), ExportDownload);
    expect(download.delivery.kind).toBe('inline');
    if (download.delivery.kind === 'inline') {
      expect(download.delivery.content.split('\r\n')[0]).toContain('Unique bidding organizations');
    }
  });

  it('answers EXPORT_NOT_READY and EXPORT_FAILED for exports without a file', async () => {
    expect(problemCode(await api.callAs(MPHO, R.downloadExport, { tenant: 'kwu', params: { exportId: 3 } }))).toBe('EXPORT_NOT_READY');
    expect(problemCode(await api.callAs(MPHO, R.downloadExport, { tenant: 'kwu', params: { exportId: 6 } }))).toBe('EXPORT_FAILED');
  });

  it('creates a report export with a manifest and serves it afterwards', async () => {
    // Act
    const created = ok(
      await api.callAs(MPHO, R.createReportExport, {
        tenant: 'kwu',
        body: { source: { kind: 'family', family: 'participation', filters: EMPTY_FILTERS, currency: 'BWP' }, format: 'csv', purpose: 'AC-34 check' },
      }),
      ExportRecord,
      201,
    );
    const again = ok(await api.callAs(MPHO, R.getExport, { tenant: 'kwu', params: { exportId: created.id } }), ExportRecord);

    // Assert
    expect(created.status).toBe('ready');
    expect(created.manifest?.contents[0]?.recordCount).toBeGreaterThan(0);
    expect(again.id).toBe(created.id);
    expect((await api.callAs(MPHO, R.downloadExport, { tenant: 'kwu', params: { exportId: created.id } })).status).toBe(200);
  });

  it('refuses an export of a family the caller may not run', async () => {
    const response = await api.callAs(TEBOGO, R.createReportExport, {
      tenant: 'kwu',
      body: { source: { kind: 'family', family: 'audit_records', filters: EMPTY_FILTERS, currency: 'BWP' }, format: 'csv', purpose: 'Check' },
    });
    expect(problemCode(response)).toBe('REPORT_FAMILY_RESTRICTED');
  });
});

describe('me.search.query (COM-08)', () => {
  it('returns only authorized results of the caller’s organizations, labelled, with counts', async () => {
    const result = ok(await api.callAs(TEBOGO, R.search, { query: { q: 'water' } }), SearchResponse);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((item) => item.organization.tenantId === TENANT_IDS.kwu)).toBe(true);
    expect(result.counts.reduce((total, item) => total + item.count, 0)).toBe(result.total);
    expect(result.items.some((item) => item.type === 'task' && item.recordId === 43)).toBe(false);
  });

  it('lets a requester find their own draft request but not the supplier directory', async () => {
    const result = ok(await api.callAs(KAGISO, R.search, { query: { q: 'telephony' } }), SearchResponse);
    expect(result.items.map((item) => item.reference)).toEqual(['PR-2026-0007']);
    const suppliers = ok(await api.callAs(KAGISO, R.search, { query: { q: 'tsodilo' } }), SearchResponse);
    expect(suppliers.total).toBe(0);
  });

  it('spans every active membership of a dual-capacity person and skips pending ones (DD-21)', async () => {
    const result = ok(await api.callAs('sam.dual@tenderiq.local', R.search, { query: { q: 'water', pageSize: 100 } }), SearchResponse);
    const tenants = new Set(result.items.map((item) => item.organization.tenantId));
    expect(tenants.has(TENANT_IDS.kwu)).toBe(true);
    expect(tenants.has(TENANT_IDS.tsodilo)).toBe(true);
    expect(tenants.has(TENANT_IDS['serowe-ict'])).toBe(false);
  });

  it('never returns another supplier’s rows to a supplier', async () => {
    const result = ok(await api.callAs('chobe-pipe.bidmanager@tenderiq.local', R.search, { query: { q: 'water', pageSize: 100 } }), SearchResponse);
    expect(result.items.every((item) => item.organization.tenantId === TENANT_IDS['chobe-pipe'])).toBe(true);
    expect(result.items.some((item) => item.reference === 'T-2026-0003')).toBe(false);
  });

  it('refuses a tenant filter outside the caller’s memberships', async () => {
    const response = await api.callAs(TEBOGO, R.search, { query: { q: 'water', tenantId: TENANT_IDS.odc } });
    expect(response.status).toBe(403);
  });

  it('rejects a one-character query with 422', async () => {
    const response = await api.callAs(TEBOGO, R.search, { query: { q: 'w' } });
    expect(response.status).toBe(422);
  });
});

describe('saved views (COM-08)', () => {
  it('lists only the caller’s own views, labelled with their organization', async () => {
    const page = ok(await api.callAs('sam.dual@tenderiq.local', R.listSavedViews), pageOf(SavedView));
    expect(page.items.map((view) => view.organization.tenantId).sort()).toEqual([TENANT_IDS.kwu, TENANT_IDS.tsodilo].sort());
  });

  it('saves a view in the organization named by X-Tenant-Id', async () => {
    const view = ok(
      await api.callAs('sam.dual@tenderiq.local', R.createSavedView, { tenant: 'chobe-pipe', body: { scope: 'COM-08', name: 'Valves', filters: { q: 'valves' }, isDefault: false } }),
      SavedView,
      201,
    );
    expect(view.organization.tenantId).toBe(TENANT_IDS['chobe-pipe']);
  });

  it('refuses a duplicate name on the same screen', async () => {
    const response = await api.callAs(TEBOGO, R.createSavedView, { tenant: 'kwu', body: { scope: 'COM-08', name: 'Open water tenders', filters: {}, isDefault: false } });
    expect(problemCode(response)).toBe('DUPLICATE_VIEW_NAME');
  });

  it('treats another person’s view as not found', async () => {
    const response = await api.callAs(MPHO, R.updateSavedView, { tenant: 'kwu', params: { viewId: 1 }, body: { scope: 'COM-08', name: 'Mine now', filters: {}, isDefault: false } });
    expect(response.status).toBe(404);
  });

  it('deletes the caller’s own view with 204', async () => {
    const response = await api.callAs(TEBOGO, R.deleteSavedView, { tenant: 'kwu', params: { viewId: 3 } });
    expect(response.status).toBe(204);
  });
});
