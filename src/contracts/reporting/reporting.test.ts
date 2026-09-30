/**
 * Reporting contract: every endpoint is well formed (audience, permission kind, screens), and the schemas enforce
 * the rules the UI relies on (restricted KPIs carry no value, report cells and enum references are typed, search
 * needs a real query, report definitions validate fields and schedules).
 */
import { describe, expect, it } from 'vitest';

import { validateEndpointDefinition } from '../endpoint.js';
import { permissionTenantKind } from '../permissions.js';
import {
  BUYER_DASHBOARD_KPIS,
  BuyerDashboard,
  EnumRef,
  ReportCell,
  ReportDefinitionBody,
  SavedViewBody,
  SearchQuery,
  reportingEndpoints,
} from '../reporting.js';

const endpoints = Object.values(reportingEndpoints);

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
} as const;

describe('reportingEndpoints', () => {
  it('defines every endpoint validly with a unique id and route', () => {
    // Act
    const problems = endpoints.flatMap((endpoint) => validateEndpointDefinition(endpoint));
    const ids = new Set(endpoints.map((endpoint) => endpoint.id));
    const routes = new Set(endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`));

    // Assert
    expect(problems).toEqual([]);
    expect(ids.size).toBe(endpoints.length);
    expect(routes.size).toBe(endpoints.length);
    expect(endpoints).toHaveLength(21);
  });

  it('uses buyer permissions on buyer routes and supplier permissions on supplier routes', () => {
    for (const endpoint of endpoints) {
      const permissions = endpoint.permission === undefined ? [] : typeof endpoint.permission === 'string' ? [endpoint.permission] : endpoint.permission;
      for (const code of permissions) {
        const kind = permissionTenantKind(code);
        if (endpoint.audience === 'buyer') expect(kind).toBe('buyer');
        if (endpoint.audience === 'supplier') expect(kind).toBe('supplier');
      }
    }
  });

  it('covers every screen of the domain', () => {
    const screens = new Set(endpoints.flatMap((endpoint) => endpoint.screens));
    for (const screen of ['BUY-01', 'SUP-01', 'REP-01', 'REP-02', 'ADM-13', 'COM-08']) {
      expect(screens.has(screen)).toBe(true);
    }
  });

  it('marks record-creating commands idempotent with status 201', () => {
    const creating = [
      reportingEndpoints.createReportDefinition,
      reportingEndpoints.runReportDefinition,
      reportingEndpoints.createReportExport,
      reportingEndpoints.createSavedView,
    ];
    for (const endpoint of creating) {
      expect(endpoint.idempotent).toBe(true);
      expect(endpoint.status).toBe(201);
    }
  });

  it('serves search and saved views under /me with the row tenant only on commands', () => {
    expect(reportingEndpoints.search.audience).toBe('me');
    expect(reportingEndpoints.listSavedViews.rowTenant).toBeUndefined();
    expect(reportingEndpoints.createSavedView.rowTenant).toBe(true);
    expect(reportingEndpoints.deleteSavedView.status).toBe(204);
  });
});

describe('dashboard schemas', () => {
  const kpi = (restricted: boolean, value: number | null) => ({ key: 'active_events', value, restricted, delta: null, hint: null, to: null });

  it('rejects a restricted KPI that still carries a count (BR-43)', () => {
    // Arrange
    const base = BuyerDashboard.shape.kpis.element;

    // Act + Assert
    expect(base.safeParse(kpi(true, 3)).success).toBe(false);
    expect(base.safeParse(kpi(true, null)).success).toBe(true);
    expect(base.safeParse(kpi(false, null)).success).toBe(false);
  });

  it('lists the six BUY-01 KPI cards in display order', () => {
    expect(BUYER_DASHBOARD_KPIS).toEqual([
      'active_events',
      'pending_approvals',
      'closing_within_7_days',
      'open_complaints',
      'renewals_within_90_days',
      'overdue_obligations',
    ]);
  });
});

describe('report schemas', () => {
  it('accepts typed cells and never a bare number for money', () => {
    expect(ReportCell.safeParse({ kind: 'money', value: { amount: '1500000.00', currency: 'BWP' } }).success).toBe(true);
    expect(ReportCell.safeParse({ kind: 'money', value: 1500000 }).success).toBe(false);
    expect(ReportCell.safeParse({ kind: 'missing', reason: 'Not opened yet.' }).success).toBe(true);
    expect(ReportCell.safeParse({ kind: 'count', value: -1 }).success).toBe(false);
  });

  it('rejects an enum reference whose value is not in the enumeration', () => {
    expect(EnumRef.safeParse({ enum: 'tenders.status', value: 'open' }).success).toBe(true);
    expect(EnumRef.safeParse({ enum: 'tenders.status', value: 'sealed' }).success).toBe(false);
  });

  it('requires at least one field and a valid five-field schedule on a definition', () => {
    // Arrange
    const valid = {
      name: 'Weekly pipeline',
      family: 'pipeline',
      fields: ['reference'],
      filters: EMPTY_FILTERS,
      currencyBasis: 'BWP',
      conversionDate: null,
      audiencePermission: 'report.view',
      scheduleCron: '0 6 * * 1',
      recipientUserIds: [4],
    };

    // Act
    const noFields = ReportDefinitionBody.safeParse({ ...valid, fields: [] });
    const badCron = ReportDefinitionBody.safeParse({ ...valid, scheduleCron: 'every monday' });

    // Assert
    expect(ReportDefinitionBody.safeParse(valid).success).toBe(true);
    expect(noFields.success).toBe(false);
    expect(noFields.error?.issues[0]?.message).toMatch(/^FIELDS_REQUIRED\|/);
    expect(badCron.error?.issues[0]?.message).toMatch(/^INVALID_SCHEDULE\|/);
  });

  it('limits the audience permission to reporting audiences', () => {
    const result = ReportDefinitionBody.shape.audiencePermission.safeParse('tender.edit');
    expect(result.success).toBe(false);
  });
});

describe('search schemas', () => {
  it('rejects a one-character query with SEARCH_QUERY_TOO_SHORT', () => {
    const result = SearchQuery.safeParse({ q: 'w' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/^SEARCH_QUERY_TOO_SHORT\|/);
  });

  it('turns a single type into a list and applies paging defaults', () => {
    const parsed = SearchQuery.parse({ q: 'water', type: 'tender' });
    expect(parsed.type).toEqual(['tender']);
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(25);
  });

  it('scopes a saved view to a screen id', () => {
    expect(SavedViewBody.safeParse({ scope: 'COM-08', name: 'Water', filters: {}, isDefault: false }).success).toBe(true);
    expect(SavedViewBody.safeParse({ scope: 'search', name: 'Water', filters: {}, isDefault: false }).success).toBe(false);
  });
});
