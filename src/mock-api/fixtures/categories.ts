/**
 * The buyer category trees of the demo organizations (blueprint `categories`), defined once for every fixture
 * domain (docs/plan/demo-storyline.md: one demo world).
 *
 * Tenders, requests, strategies, plans, policy rules, qualification programs, authority limits, the dashboards and
 * the reports all name a category by this id, code and name, so a category filter on one screen matches the
 * category shown on every other (BUY-01, BUY-06, BUY-07, BUY-14, BUY-31, BUY-33). Domains project these rows into
 * their own fixture shapes; they never define a category of their own.
 *
 * `catalogCode` maps the category to the shared platform taxonomy (`category_catalog`, owned by the suppliers
 * fixtures) that supplier discovery and subscriptions use; `null` when the taxonomy has no matching entry.
 */
import { TENANT_IDS } from './platform.js';

export interface BuyerCategory {
  readonly id: number;
  readonly tenantId: number;
  readonly code: string;
  readonly name: string;
  readonly parentId: number | null;
  readonly catalogCode: string | null;
  /** Retired categories stay on their historical records but cannot be chosen for new work. */
  readonly active: boolean;
}

const KWU = TENANT_IDS.kwu;
const ODC = TENANT_IDS.odc;

export const BUYER_CATEGORIES: readonly BuyerCategory[] = Object.freeze([
  { id: 1, tenantId: KWU, code: 'WTR-INFRA', name: 'Water infrastructure', parentId: null, catalogCode: 'WTR-INFRA', active: true },
  { id: 2, tenantId: KWU, code: 'WTR-PUMP', name: 'Pumps and mechanical equipment', parentId: 1, catalogCode: 'WTR-PUMP', active: true },
  { id: 3, tenantId: KWU, code: 'WTR-PIPE', name: 'Pipes, valves and fittings', parentId: 1, catalogCode: 'WTR-PIPE', active: true },
  { id: 4, tenantId: KWU, code: 'WTR-METER', name: 'Water meters and metering', parentId: null, catalogCode: 'WTR-METER', active: true },
  { id: 5, tenantId: KWU, code: 'ICT-SCADA', name: 'SCADA and telemetry', parentId: null, catalogCode: 'ICT-SCADA', active: true },
  { id: 6, tenantId: KWU, code: 'WTR-CHEM', name: 'Water treatment chemicals and dosing', parentId: null, catalogCode: 'WTR-CHEM', active: true },
  { id: 7, tenantId: KWU, code: 'ENV-LEAK', name: 'Leak detection services', parentId: null, catalogCode: 'ENV-LEAK', active: true },
  { id: 8, tenantId: KWU, code: 'CIV-WORKS', name: 'Civil works', parentId: null, catalogCode: 'CIV', active: true },
  { id: 9, tenantId: KWU, code: 'FLEET-SVC', name: 'Fleet maintenance services', parentId: null, catalogCode: 'FLT-MAINT', active: true },
  { id: 10, tenantId: KWU, code: 'ELEC-MAINT', name: 'Electrical maintenance services', parentId: null, catalogCode: null, active: true },
  { id: 11, tenantId: KWU, code: 'ENV-SVC', name: 'Environmental and laboratory services', parentId: null, catalogCode: 'ENV', active: true },
  { id: 12, tenantId: KWU, code: 'FAC-SVC', name: 'Facilities and office', parentId: null, catalogCode: 'FAC', active: true },
  { id: 13, tenantId: KWU, code: 'LAB-EQP', name: 'Laboratory equipment', parentId: null, catalogCode: null, active: true },
  { id: 14, tenantId: KWU, code: 'PPE', name: 'Protective clothing and equipment', parentId: null, catalogCode: null, active: true },
  { id: 15, tenantId: KWU, code: 'ICT-COMMS', name: 'Communications ICT', parentId: null, catalogCode: 'ICT-NET', active: true },
  { id: 16, tenantId: KWU, code: 'ENG-SVC', name: 'Engineering services', parentId: null, catalogCode: null, active: true },
  { id: 17, tenantId: KWU, code: 'ENERGY', name: 'Energy and power', parentId: null, catalogCode: null, active: true },
  { id: 18, tenantId: KWU, code: 'OFF-LEG', name: 'Office stationery (legacy)', parentId: null, catalogCode: null, active: false },
  { id: 20, tenantId: ODC, code: 'FAC-CLEAN', name: 'Cleaning services', parentId: null, catalogCode: 'FAC-CLEAN', active: true },
  { id: 21, tenantId: ODC, code: 'CIV-WORKS', name: 'Roads and civil works', parentId: null, catalogCode: 'CIV-GEN', active: true },
  { id: 22, tenantId: ODC, code: 'FUEL', name: 'Fuel supply', parentId: null, catalogCode: null, active: true },
  { id: 23, tenantId: ODC, code: 'FAC-MAINT', name: 'Building maintenance', parentId: null, catalogCode: 'FAC', active: true },
] satisfies BuyerCategory[]);

/** The category of `id` (throws for an unknown id: a fixture naming one is a fixture bug). */
export function buyerCategory(id: number): BuyerCategory {
  const found = BUYER_CATEGORIES.find((row) => row.id === id);
  if (found === undefined) {
    throw new Error(`Unknown buyer category ${id}.`);
  }
  return found;
}

/** The categories of the given ids, in the order given. */
export function buyerCategories(ids: readonly number[]): BuyerCategory[] {
  return ids.map(buyerCategory);
}
