/**
 * Publication fixtures for supplier discovery (SUP-06): the supplier profile facts used for matching
 * (`supplier_categories`, `supplier_profiles.service_areas`), each supplier's qualification status for the
 * Category A program (`v_qualification_status`, as the qualification domain decides it), and the per-user
 * `saved_searches`, `watchlist_items`, `notice_subscriptions` and dismissed suggestions.
 */
import type { TendersProcedure, VQualificationStatusEffectiveStatus } from '../../../contracts/enums.js';
import { TENANT_IDS } from '../platform.js';

export interface FixtureSupplierProfile {
  readonly tenantId: number;
  readonly catalogCodes: readonly string[];
  readonly serviceAreas: readonly string[];
}

export const SUPPLIER_PROFILES: readonly FixtureSupplierProfile[] = Object.freeze([
  { tenantId: TENANT_IDS.tsodilo, catalogCodes: ['WTR-PUMP', 'WTR-DOSE', 'ICT-SCADA'], serviceAreas: ['South-East District', 'Kweneng', 'Central District', 'North-East District'] },
  { tenantId: TENANT_IDS['chobe-pipe'], catalogCodes: ['WTR-PIPE', 'WTR-DOSE', 'WTR-METER'], serviceAreas: ['Chobe', 'North-West', 'Central District'] },
  { tenantId: TENANT_IDS.makgadikgadi, catalogCodes: ['CIV-RES', 'CIV-GEN', 'WTR-PUMP'], serviceAreas: ['Central District', 'Boteti'] },
  { tenantId: TENANT_IDS['serowe-ict'], catalogCodes: ['ICT-SCADA', 'ICT-NET', 'WTR-METER'], serviceAreas: ['Central District', 'South-East District', 'Kgatleng'] },
  { tenantId: TENANT_IDS['limpopo-env'], catalogCodes: ['ENV-LEAK', 'ENV-CONS', 'CIV-RES'], serviceAreas: ['Bobirwa', 'Selebi-Phikwe', 'Central District', 'Ngamiland'] },
  { tenantId: TENANT_IDS['gaborone-meter'], catalogCodes: ['WTR-METER'], serviceAreas: ['South-East District', 'Kweneng', 'Southern District'] },
]);

export interface FixtureQualificationStatus {
  readonly buyerTenantId: number;
  readonly supplierTenantId: number;
  readonly programName: string;
  readonly effectiveStatus: VQualificationStatusEffectiveStatus;
  readonly effectiveTo: string | null;
  readonly conditions: string | null;
}

const CATEGORY_A = 'Water Infrastructure Suppliers — Category A';

/** KWU's Category A program status per supplier (qualification domain storyline). */
export const QUALIFICATION_STATUSES: readonly FixtureQualificationStatus[] = Object.freeze([
  { buyerTenantId: TENANT_IDS.kwu, supplierTenantId: TENANT_IDS.tsodilo, programName: CATEGORY_A, effectiveStatus: 'qualified', effectiveTo: '2028-04-14', conditions: null },
  {
    buyerTenantId: TENANT_IDS.kwu,
    supplierTenantId: TENANT_IDS['chobe-pipe'],
    programName: CATEGORY_A,
    effectiveStatus: 'qualified_with_conditions',
    effectiveTo: '2028-05-03',
    conditions: 'Supply a renewed public liability insurance certificate (cover of at least BWP 5,000,000) before the current policy expires on 8 Oct 2026.',
  },
  { buyerTenantId: TENANT_IDS.kwu, supplierTenantId: TENANT_IDS.makgadikgadi, programName: CATEGORY_A, effectiveStatus: 'not_assessed', effectiveTo: null, conditions: null },
  { buyerTenantId: TENANT_IDS.kwu, supplierTenantId: TENANT_IDS['serowe-ict'], programName: CATEGORY_A, effectiveStatus: 'not_assessed', effectiveTo: null, conditions: null },
  { buyerTenantId: TENANT_IDS.kwu, supplierTenantId: TENANT_IDS['limpopo-env'], programName: CATEGORY_A, effectiveStatus: 'not_assessed', effectiveTo: null, conditions: null },
  { buyerTenantId: TENANT_IDS.kwu, supplierTenantId: TENANT_IDS['gaborone-meter'], programName: CATEGORY_A, effectiveStatus: 'not_assessed', effectiveTo: null, conditions: null },
]);

export interface FixtureSavedSearch {
  readonly id: number;
  readonly tenantId: number;
  readonly userId: number;
  readonly name: string;
  readonly keywords: string | null;
  readonly catalogCodes: readonly string[];
  readonly buyerTenantIds: readonly number[];
  readonly regions: readonly string[];
  readonly procedures: readonly TendersProcedure[];
  readonly notify: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const SAVED_SEARCHES: readonly FixtureSavedSearch[] = Object.freeze([
  { id: 1, tenantId: TENANT_IDS.tsodilo, userId: 25, name: 'Pumps and pipework — south', keywords: null, catalogCodes: ['WTR-INFRA'], buyerTenantIds: [], regions: ['Central District', 'Kgalagadi', 'Kweneng', 'Southern District'], procedures: ['open'], notify: true, createdAt: '2026-05-04T08:00:00Z', updatedAt: '2026-08-12T08:00:00Z' },
  { id: 2, tenantId: TENANT_IDS.tsodilo, userId: 25, name: 'KWU dosing and treatment', keywords: null, catalogCodes: ['WTR-TREAT'], buyerTenantIds: [TENANT_IDS.kwu], regions: [], procedures: [], notify: false, createdAt: '2026-06-01T08:00:00Z', updatedAt: '2026-06-01T08:00:00Z' },
  { id: 3, tenantId: TENANT_IDS.tsodilo, userId: 24, name: 'All KWU notices', keywords: null, catalogCodes: [], buyerTenantIds: [TENANT_IDS.kwu], regions: [], procedures: [], notify: true, createdAt: '2026-03-02T08:00:00Z', updatedAt: '2026-03-02T08:00:00Z' },
  { id: 4, tenantId: TENANT_IDS['chobe-pipe'], userId: 29, name: 'Valves and meters', keywords: null, catalogCodes: ['WTR-PIPE', 'WTR-METER'], buyerTenantIds: [], regions: [], procedures: [], notify: true, createdAt: '2026-04-20T08:00:00Z', updatedAt: '2026-04-20T08:00:00Z' },
  { id: 5, tenantId: TENANT_IDS['serowe-ict'], userId: 33, name: 'SCADA and telemetry', keywords: 'telemetry', catalogCodes: ['ICT'], buyerTenantIds: [], regions: [], procedures: [], notify: true, createdAt: '2026-05-02T08:00:00Z', updatedAt: '2026-05-02T08:00:00Z' },
  { id: 6, tenantId: TENANT_IDS['limpopo-env'], userId: 41, name: 'Leak detection and facilities', keywords: null, catalogCodes: ['ENV-LEAK', 'FAC-CLEAN'], buyerTenantIds: [], regions: [], procedures: [], notify: true, createdAt: '2026-04-11T08:00:00Z', updatedAt: '2026-09-01T08:00:00Z' },
  { id: 7, tenantId: TENANT_IDS['gaborone-meter'], userId: 37, name: 'Metering', keywords: 'meter', catalogCodes: ['WTR-METER'], buyerTenantIds: [], regions: [], procedures: [], notify: true, createdAt: '2026-04-01T08:00:00Z', updatedAt: '2026-04-01T08:00:00Z' },
  { id: 8, tenantId: TENANT_IDS.makgadikgadi, userId: 40, name: 'Civil works', keywords: null, catalogCodes: ['CIV'], buyerTenantIds: [], regions: ['Central District', 'South-East District'], procedures: [], notify: false, createdAt: '2026-03-20T08:00:00Z', updatedAt: '2026-03-20T08:00:00Z' },
]);

export interface FixtureWatchlistItem {
  readonly id: number;
  readonly tenantId: number;
  readonly userId: number;
  readonly tenderId: number;
  readonly addedAt: string;
}

export const WATCHLIST_ITEMS: readonly FixtureWatchlistItem[] = Object.freeze([
  { id: 11, tenantId: TENANT_IDS.tsodilo, userId: 25, tenderId: 2, addedAt: '2026-09-14T08:00:00Z' },
  { id: 12, tenantId: TENANT_IDS.tsodilo, userId: 25, tenderId: 6, addedAt: '2026-09-21T09:00:00Z' },
  { id: 13, tenantId: TENANT_IDS.tsodilo, userId: 25, tenderId: 3, addedAt: '2026-07-21T08:00:00Z' },
  { id: 14, tenantId: TENANT_IDS.tsodilo, userId: 25, tenderId: 8, addedAt: '2026-08-24T08:00:00Z' },
  { id: 15, tenantId: TENANT_IDS.tsodilo, userId: 24, tenderId: 2, addedAt: '2026-09-15T08:00:00Z' },
  { id: 16, tenantId: TENANT_IDS['chobe-pipe'], userId: 29, tenderId: 2, addedAt: '2026-09-14T10:00:00Z' },
  { id: 17, tenantId: TENANT_IDS['chobe-pipe'], userId: 29, tenderId: 6, addedAt: '2026-09-21T11:30:00Z' },
  { id: 18, tenantId: TENANT_IDS['serowe-ict'], userId: 33, tenderId: 2, addedAt: '2026-09-15T08:00:00Z' },
  { id: 19, tenantId: TENANT_IDS['limpopo-env'], userId: 41, tenderId: 11, addedAt: '2026-09-16T12:00:00Z' },
  { id: 20, tenantId: TENANT_IDS.makgadikgadi, userId: 40, tenderId: 11, addedAt: '2026-09-17T08:00:00Z' },
  { id: 21, tenantId: TENANT_IDS['gaborone-meter'], userId: 37, tenderId: 2, addedAt: '2026-09-14T12:00:00Z' },
]);

export interface FixtureSubscription {
  readonly id: number;
  readonly tenantId: number;
  readonly userId: number;
  readonly buyerTenantId: number | null;
  readonly catalogCode: string | null;
  readonly active: boolean;
  readonly createdAt: string;
}

export const SUBSCRIPTIONS: readonly FixtureSubscription[] = Object.freeze([
  { id: 1, tenantId: TENANT_IDS.tsodilo, userId: 25, buyerTenantId: TENANT_IDS.kwu, catalogCode: 'WTR-PUMP', active: true, createdAt: '2026-03-10T08:00:00Z' },
  { id: 2, tenantId: TENANT_IDS.tsodilo, userId: 25, buyerTenantId: null, catalogCode: 'WTR-PIPE', active: true, createdAt: '2026-03-10T08:05:00Z' },
  { id: 3, tenantId: TENANT_IDS.tsodilo, userId: 25, buyerTenantId: TENANT_IDS.odc, catalogCode: null, active: false, createdAt: '2026-04-02T08:00:00Z' },
  { id: 4, tenantId: TENANT_IDS['chobe-pipe'], userId: 29, buyerTenantId: TENANT_IDS.kwu, catalogCode: null, active: true, createdAt: '2026-03-15T08:00:00Z' },
  { id: 5, tenantId: TENANT_IDS['serowe-ict'], userId: 33, buyerTenantId: null, catalogCode: 'ICT-SCADA', active: true, createdAt: '2026-03-20T08:00:00Z' },
  { id: 6, tenantId: TENANT_IDS['limpopo-env'], userId: 41, buyerTenantId: TENANT_IDS.odc, catalogCode: null, active: true, createdAt: '2026-04-11T08:00:00Z' },
  { id: 7, tenantId: TENANT_IDS.makgadikgadi, userId: 40, buyerTenantId: null, catalogCode: 'CIV', active: true, createdAt: '2026-03-20T08:00:00Z' },
  { id: 8, tenantId: TENANT_IDS['gaborone-meter'], userId: 37, buyerTenantId: null, catalogCode: 'WTR-METER', active: true, createdAt: '2026-03-25T08:00:00Z' },
]);

/** Suggestions a user dismissed from discovery (SUP-06). */
export interface FixtureDismissal {
  readonly tenantId: number;
  readonly userId: number;
  readonly tenderId: number;
  readonly dismissedAt: string;
}

export const DISMISSALS: readonly FixtureDismissal[] = Object.freeze([
  { tenantId: TENANT_IDS.tsodilo, userId: 25, tenderId: 11, dismissedAt: '2026-09-17T08:00:00Z' },
  { tenantId: TENANT_IDS['chobe-pipe'], userId: 29, tenderId: 4, dismissedAt: '2026-05-12T08:00:00Z' },
]);
