/**
 * Records of other domains that the policy fixtures point at, by their storyline natural keys
 * (docs/plan/demo-storyline.md "Tenders", "Contracts"). Only the metadata ADM-06 and ADM-08 display is kept here:
 * reference, title, status and release time. Tender ids follow the reference number (T-2026-0003 → id 3);
 * `policy-cross-fixtures.test.ts` checks them against the tenders fixtures (reference, buyer, title, status, release).
 */
import type { TendersStatus } from '../../../contracts/enums.js';
import { BUYER_CATEGORIES } from '../categories.js';
import { TENANT_IDS } from '../platform.js';

export interface PolicyTenderRef {
  readonly tenderId: number;
  readonly tenantId: number;
  readonly reference: string;
  readonly title: string;
  readonly status: TendersStatus;
  readonly releasedAt: string | null;
}

const kwu = TENANT_IDS.kwu;
const odc = TENANT_IDS.odc;

export const POLICY_TENDER_REFS: readonly PolicyTenderRef[] = Object.freeze([
  { tenderId: 1, tenantId: kwu, reference: 'T-2026-0001', title: 'Borehole pump replacement programme', status: 'partially_awarded', releasedAt: '2026-06-15T07:00:00Z' },
  { tenderId: 2, tenantId: kwu, reference: 'T-2026-0002', title: 'Smart water meter supply', status: 'open', releasedAt: '2026-09-14T07:00:00Z' },
  { tenderId: 3, tenantId: kwu, reference: 'T-2026-0003', title: 'SCADA telemetry upgrade', status: 'under_assessment', releasedAt: '2026-07-20T07:00:00Z' },
  { tenderId: 4, tenantId: kwu, reference: 'T-2026-0004', title: 'Leak-detection market consultation', status: 'information_collected', releasedAt: '2026-05-04T07:00:00Z' },
  { tenderId: 5, tenantId: kwu, reference: 'T-2026-0005', title: 'Water treatment chemicals framework', status: 'awaiting_release_approval', releasedAt: null },
  { tenderId: 6, tenantId: kwu, reference: 'T-2026-0006', title: 'Chlorine dosing equipment', status: 'open', releasedAt: '2026-09-21T07:00:00Z' },
  { tenderId: 7, tenantId: kwu, reference: 'T-2026-0007', title: 'Reservoir rehabilitation works', status: 'award_pending', releasedAt: '2026-05-11T07:00:00Z' },
  { tenderId: 8, tenantId: kwu, reference: 'T-2026-0008', title: 'Pipeline valves bulk supply', status: 'closed', releasedAt: '2026-08-24T07:00:00Z' },
  { tenderId: 9, tenantId: kwu, reference: 'T-2026-0009', title: 'Acoustic leak detection services', status: 'under_assessment', releasedAt: '2026-07-06T07:00:00Z' },
  { tenderId: 10, tenantId: kwu, reference: 'T-2026-0010', title: 'Fleet vehicle maintenance', status: 'awarded', releasedAt: '2026-01-12T07:00:00Z' },
  { tenderId: 11, tenantId: odc, reference: 'T-2026-0011', title: 'Office cleaning services', status: 'open', releasedAt: '2026-09-16T07:00:00Z' },
  { tenderId: 12, tenantId: kwu, reference: 'T-2026-0012', title: 'Treatment works electrical maintenance', status: 'draft', releasedAt: null },
  { tenderId: 13, tenantId: odc, reference: 'T-2026-0013', title: 'Community borehole drilling — Maun cluster', status: 'ready', releasedAt: null },
  { tenderId: 14, tenantId: kwu, reference: 'T-2026-0014', title: 'Water treatment works instrumentation', status: 'under_assessment', releasedAt: '2026-07-15T07:00:00Z' },
]);

export interface PolicyContractRef {
  readonly contractId: number;
  readonly tenantId: number;
  readonly reference: string;
  readonly title: string;
}

/** Contract ids follow the storyline order (C-2026-0001 → 1, C-2026-0002 → 2, C-2025-0007 → 4). */
export const POLICY_CONTRACT_REFS: readonly PolicyContractRef[] = Object.freeze([
  { contractId: 1, tenantId: kwu, reference: 'C-2026-0001', title: 'Fleet vehicle maintenance' },
  { contractId: 2, tenantId: kwu, reference: 'C-2026-0002', title: 'Borehole pumps, Lot 1' },
  { contractId: 4, tenantId: kwu, reference: 'C-2025-0007', title: 'Legacy meter reading' },
]);

export interface PolicyCategoryRef {
  readonly categoryId: number;
  readonly tenantId: number;
  readonly code: string;
  readonly name: string;
}

/** Buyer categories (`categories`), named by their catalog codes. */
export const POLICY_CATEGORY_REFS: readonly PolicyCategoryRef[] = Object.freeze(
  BUYER_CATEGORIES.filter((row) => row.active).map(({ id, tenantId, code, name }) => ({ categoryId: id, tenantId, code, name })),
);

export function tenderRef(tenderId: number): PolicyTenderRef {
  const found = POLICY_TENDER_REFS.find((row) => row.tenderId === tenderId);
  if (found === undefined) throw new Error(`Unknown tender ${tenderId} in the policy fixtures.`);
  return found;
}

export function contractRef(contractId: number): PolicyContractRef {
  const found = POLICY_CONTRACT_REFS.find((row) => row.contractId === contractId);
  if (found === undefined) throw new Error(`Unknown contract ${contractId} in the policy fixtures.`);
  return found;
}

export function categoryRef(categoryId: number): PolicyCategoryRef {
  const found = POLICY_CATEGORY_REFS.find((row) => row.categoryId === categoryId);
  if (found === undefined) throw new Error(`Unknown category ${categoryId} in the policy fixtures.`);
  return found;
}
