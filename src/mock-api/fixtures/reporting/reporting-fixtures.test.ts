/**
 * Reporting and records fixtures parse against their contract schemas, reference real tenants, personas and
 * storyline records, and carry the storyline anchors: AC-34 (unique organizations, event vs lot) and AC-35 (a
 * legal hold blocks disposal of expired legacy records).
 */
import { describe, expect, it } from 'vitest';

import { AuditAction, AuditEntityType } from '../../../contracts/audit.js';
import { Instant, Money } from '../../../contracts/common.js';
import { EnumRef, ExportManifest, ReportCell, ReportFilters, SavedView } from '../../../contracts/reporting.js';
import { AUDIT_EVENTS, DISPOSAL_REQUESTS, HOLDS, RECORD_SUBJECTS, RETENTION_CLASSES } from '../records/index.js';
import { PERSONAS, TENANTS, TENANT_IDS } from '../platform.js';
import {
  CONTRACT_FACTS,
  DASHBOARD_APPROVALS,
  DASHBOARD_ATTENTION,
  DASHBOARD_DEADLINES,
  EXPORTS,
  LEGACY_TENDER_ID,
  REPORT_DEFINITIONS,
  REPORT_FAMILIES,
  REPORT_ROWS,
  REPORT_RUNS,
  SAVED_VIEWS,
  SEARCH_INDEX,
  SUPPLIER_PURSUITS,
  TENDER_FACTS,
} from './index.js';

const personaIds = new Set(PERSONAS.map((persona) => persona.userId));
const tenantIds = new Set(TENANTS.map((tenant) => tenant.id));
const tenderIds = new Set(TENDER_FACTS.map((tender) => tender.id));

describe('storyline facts', () => {
  it('uses unique natural keys and known owners and tenants', () => {
    expect(new Set(TENDER_FACTS.map((tender) => `${tender.tenantId}:${tender.reference}`)).size).toBe(TENDER_FACTS.length);
    expect(new Set(CONTRACT_FACTS.map((contract) => contract.reference)).size).toBe(CONTRACT_FACTS.length);
    for (const tender of TENDER_FACTS) {
      expect(tenantIds.has(tender.tenantId)).toBe(true);
      expect(personaIds.has(tender.ownerUserId)).toBe(true);
      if (tender.estimatedValue !== null) expect(Money.safeParse(tender.estimatedValue).success).toBe(true);
    }
  });

  it('keeps the invitation-only and draft events out of public visibility (AC-01)', () => {
    expect(TENDER_FACTS.find((tender) => tender.reference === 'T-2026-0006')?.isPublic).toBe(false);
    expect(TENDER_FACTS.find((tender) => tender.reference === 'T-2026-0005')?.isPublic).toBe(false);
  });
});

describe('dashboard fixtures', () => {
  it('points every deadline, approval and attention item at a tender of the same buyer', () => {
    for (const row of DASHBOARD_DEADLINES) {
      expect(TENDER_FACTS.find((tender) => tender.id === row.tenderId)?.tenantId).toBe(row.tenantId);
      expect(Instant.safeParse(row.at).success).toBe(true);
    }
    for (const row of [...DASHBOARD_APPROVALS, ...DASHBOARD_ATTENTION]) {
      if (row.tenderId !== null) expect(TENDER_FACTS.find((tender) => tender.id === row.tenderId)?.tenantId).toBe(row.tenantId);
    }
  });

  it('lists supplier pursuits only for supplier tenants and known tenders', () => {
    for (const pursuit of SUPPLIER_PURSUITS) {
      expect(TENANTS.find((tenant) => tenant.id === pursuit.supplierTenantId)?.kind).toBe('supplier');
      expect(tenderIds.has(pursuit.tenderId)).toBe(true);
    }
  });

  it('shows Serowe’s internally approved response as not submitted (AC-11)', () => {
    const serowe = SUPPLIER_PURSUITS.find((row) => row.supplierTenantId === TENANT_IDS['serowe-ict'] && row.tenderId === 2);
    expect(serowe).toMatchObject({ latestRevisionStatus: 'approved_internally', submissionState: 'not_submitted', effectiveReceiptNo: null });
  });
});

describe('report fixtures', () => {
  it('parses every cell and only uses fields of its family', () => {
    for (const row of REPORT_ROWS) {
      const family = REPORT_FAMILIES.find((item) => item.family === row.family);
      const keys = new Set(family?.fields.map((item) => item.key));
      for (const [key, value] of Object.entries(row.cells)) {
        expect(keys.has(key)).toBe(true);
        expect(ReportCell.safeParse(value).success).toBe(true);
      }
      if (row.tenderId !== null) expect(tenderIds.has(row.tenderId)).toBe(true);
    }
  });

  it('points every lot row at an event row of the same family', () => {
    for (const row of REPORT_ROWS.filter((item) => item.level === 'lot')) {
      const parent = REPORT_ROWS.find((item) => item.id === row.parentId);
      expect(parent).toMatchObject({ level: 'event', family: row.family, tenderId: row.tenderId });
    }
  });

  it('counts unique organizations, not revisions, for the multi-lot and multi-revision events (AC-34)', () => {
    // Arrange
    const event1 = REPORT_ROWS.find((row) => row.id === 'pa-1');
    const lots1 = REPORT_ROWS.filter((row) => row.parentId === 'pa-1');
    const event2 = REPORT_ROWS.find((row) => row.id === 'pa-2');
    const count = (cell: unknown): number => (ReportCell.parse(cell).kind === 'count' ? (cell as { value: number }).value : -1);

    // Act
    const lotBidderSum = lots1.reduce((total, row) => total + count(row.cells.uniqueBidders), 0);

    // Assert
    expect(lots1).toHaveLength(3);
    expect(count(event1?.cells.uniqueBidders)).toBe(event1?.bidderTenantIds.length);
    expect(count(event1?.cells.uniqueBidders)).toBeLessThan(lotBidderSum);
    expect(count(event2?.cells.submittedRevisions)).toBeGreaterThan(count(event2?.cells.uniqueBidders));
  });

  it('keeps missing values as missing cells, never zero', () => {
    const rfi = REPORT_ROWS.find((row) => row.id === 'pl-4');
    expect(rfi?.cells.estimatedValue?.kind).toBe('missing');
    expect(rfi?.missingData).toBe(true);
  });
});

describe('definitions, runs and exports', () => {
  it('parses filters and manifests and references real people and runs', () => {
    for (const definition of REPORT_DEFINITIONS) {
      expect(ReportFilters.safeParse(definition.filters).success).toBe(true);
      expect(personaIds.has(definition.ownerUserId)).toBe(true);
      const family = REPORT_FAMILIES.find((item) => item.family === definition.family);
      for (const key of definition.fields) expect(family?.fields.some((item) => item.key === key)).toBe(true);
    }
    for (const run of REPORT_RUNS) {
      expect(REPORT_DEFINITIONS.some((definition) => definition.id === run.definitionId && definition.tenantId === run.tenantId)).toBe(true);
      if (run.exportId !== null) expect(EXPORTS.some((record) => record.id === run.exportId)).toBe(true);
    }
    for (const record of EXPORTS) {
      if (record.manifest !== null) expect(ExportManifest.safeParse(record.manifest).success).toBe(true);
      expect(personaIds.has(record.requestedBy)).toBe(true);
      expect(record.status === 'ready').toBe(record.fileName !== null);
    }
  });

  it('covers every export status', () => {
    expect(new Set(EXPORTS.map((record) => record.status))).toEqual(new Set(['ready', 'running', 'queued', 'failed']));
  });
});

describe('search and saved views', () => {
  it('uses valid enum references and in-app links', () => {
    for (const entry of SEARCH_INDEX) {
      if (entry.status !== null) expect(EnumRef.safeParse(entry.status).success).toBe(true);
      expect(entry.to.startsWith('/')).toBe(true);
      expect(tenantIds.has(entry.tenantId)).toBe(true);
    }
  });

  it('never gives a supplier tenant another organization’s supplier-private rows', () => {
    const supplierRows = SEARCH_INDEX.filter((entry) => TENANTS.find((tenant) => tenant.id === entry.tenantId)?.kind === 'supplier');
    for (const entry of supplierRows) {
      expect(entry.to.startsWith('/supplier/')).toBe(true);
    }
  });

  it('parses saved views owned by members of their organization', () => {
    for (const view of SAVED_VIEWS) {
      const persona = PERSONAS.find((item) => item.userId === view.userId);
      expect(persona?.memberships.some((membership) => membership.tenantId === view.tenantId)).toBe(true);
      const { tenantId, userId: _userId, ...rest } = view;
      expect(SavedView.safeParse({ ...rest, organization: { tenantId, tenantName: 'x', tenantKind: 'buyer' } }).success).toBe(true);
    }
  });
});

describe('records fixtures', () => {
  it('has one retention class per record class and known owners', () => {
    expect(new Set(RETENTION_CLASSES.map((row) => `${row.tenantId}:${row.recordClass}`)).size).toBe(RETENTION_CLASSES.length);
    for (const row of RETENTION_CLASSES) expect(personaIds.has(row.ownerUserId)).toBe(true);
  });

  it('blocks disposal of the expired legacy records under the active legal hold (AC-35)', () => {
    // Arrange
    const hold = HOLDS.find((row) => row.subjectId === LEGACY_TENDER_ID && row.holdType === 'legal_hold');
    const blocked = DISPOSAL_REQUESTS.filter((row) => row.blockedByHoldIds.includes(hold?.id ?? -1));

    // Assert
    expect(hold?.releasedAt).toBeNull();
    expect(hold?.blockedActions).toContain('disposal');
    expect(hold?.records.every((record) => record.retentionEndedOn !== null && record.retentionEndedOn < '2026-10-07')).toBe(true);
    expect(blocked.length).toBeGreaterThanOrEqual(2);
    expect(blocked.every((row) => row.status === 'blocked')).toBe(true);
  });

  it('keeps the audit history of the held legacy records', () => {
    expect(AUDIT_EVENTS.some((event) => event.entityReference === 'T-2025-0003' && event.action === 'import.accepted')).toBe(true);
  });

  it('uses dotted actions, snake_case entity types and metadata-only restricted rows', () => {
    for (const event of AUDIT_EVENTS) {
      expect(AuditAction.safeParse(event.action).success).toBe(true);
      expect(AuditEntityType.safeParse(event.entityType).success).toBe(true);
      if (event.sensitivity === 'restricted') {
        expect(event.beforeState).toBeNull();
        expect(event.afterState).toBeNull();
      }
      if (event.actorUserId !== null) expect(personaIds.has(event.actorUserId)).toBe(true);
    }
  });

  it('names a known record for every hold', () => {
    for (const hold of HOLDS) {
      expect(RECORD_SUBJECTS.some((subject) => subject.subjectType === hold.subjectType && subject.subjectId === hold.subjectId)).toBe(true);
    }
  });
});
