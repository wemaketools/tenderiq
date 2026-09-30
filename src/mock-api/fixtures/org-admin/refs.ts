/**
 * Org-admin fixtures: references to records owned by other domains (tenders, contracts, qualification
 * applications), by the storyline's natural keys (docs/plan/demo-storyline.md). Ids follow the reference number
 * (`T-2026-0003` → tender id 3). The cross-fixture consistency test resolves them against the owning domains.
 */
import { PERSONAS, PERSONA_EMAIL_DOMAIN, TENANT_IDS } from '../platform.js';

export interface FixtureTenderRef {
  readonly tenderId: number;
  readonly buyerTenantId: number;
  readonly reference: string;
  readonly title: string;
  /** Submission deadline (Africa/Gaborone official zone); `null` for an RFI without a bid deadline. */
  readonly submissionDeadline: string | null;
}

export const TENDER_REFS: readonly FixtureTenderRef[] = Object.freeze([
  { tenderId: 1, buyerTenantId: TENANT_IDS.kwu, reference: 'T-2026-0001', title: 'Borehole pump replacement programme', submissionDeadline: '2026-07-15T10:00:00Z' },
  { tenderId: 2, buyerTenantId: TENANT_IDS.kwu, reference: 'T-2026-0002', title: 'Smart water meter supply', submissionDeadline: '2026-10-21T10:00:00Z' },
  { tenderId: 3, buyerTenantId: TENANT_IDS.kwu, reference: 'T-2026-0003', title: 'SCADA telemetry upgrade', submissionDeadline: '2026-08-28T10:00:00Z' },
  { tenderId: 4, buyerTenantId: TENANT_IDS.kwu, reference: 'T-2026-0004', title: 'Leak-detection market consultation', submissionDeadline: null },
  { tenderId: 5, buyerTenantId: TENANT_IDS.kwu, reference: 'T-2026-0005', title: 'Water treatment chemicals framework', submissionDeadline: null },
  { tenderId: 6, buyerTenantId: TENANT_IDS.kwu, reference: 'T-2026-0006', title: 'Chlorine dosing equipment', submissionDeadline: '2026-10-22T10:00:00Z' },
  { tenderId: 7, buyerTenantId: TENANT_IDS.kwu, reference: 'T-2026-0007', title: 'Reservoir rehabilitation works', submissionDeadline: '2026-06-30T10:00:00Z' },
  { tenderId: 8, buyerTenantId: TENANT_IDS.kwu, reference: 'T-2026-0008', title: 'Pipeline valves bulk supply', submissionDeadline: '2026-09-24T10:00:00Z' },
  { tenderId: 9, buyerTenantId: TENANT_IDS.kwu, reference: 'T-2026-0009', title: 'Acoustic leak detection services', submissionDeadline: '2026-08-14T10:00:00Z' },
  { tenderId: 10, buyerTenantId: TENANT_IDS.kwu, reference: 'T-2026-0010', title: 'Fleet vehicle maintenance', submissionDeadline: '2026-05-20T10:00:00Z' },
  { tenderId: 11, buyerTenantId: TENANT_IDS.odc, reference: 'T-2026-0011', title: 'Office cleaning services', submissionDeadline: '2026-10-23T10:00:00Z' },
] satisfies FixtureTenderRef[]);

export interface FixtureRecordRef {
  readonly id: number;
  readonly tenantId: number;
  readonly reference: string;
  readonly title: string;
}

export const CONTRACT_REFS: readonly FixtureRecordRef[] = Object.freeze([
  { id: 1, tenantId: TENANT_IDS.kwu, reference: 'C-2026-0001', title: 'Fleet maintenance' },
  { id: 2, tenantId: TENANT_IDS.kwu, reference: 'C-2026-0002', title: 'Borehole pumps Lot 1' },
] satisfies FixtureRecordRef[]);

export const QUALIFICATION_APPLICATION_REFS: readonly FixtureRecordRef[] = Object.freeze([
  { id: 503, tenantId: TENANT_IDS.kwu, reference: 'QA-2026-0006', title: 'Makgadikgadi Civil Works — Water Infrastructure Suppliers, Category A' },
] satisfies FixtureRecordRef[]);

export function tenderRef(tenderId: number): FixtureTenderRef {
  const tender = TENDER_REFS.find((candidate) => candidate.tenderId === tenderId);
  if (tender === undefined) {
    throw new Error(`Unknown tender ${tenderId}.`);
  }
  return tender;
}

/** The user id of a persona by the local part of its e-mail (`tebogo.officer`). */
export function uid(localPart: string): number {
  const persona = PERSONAS.find((candidate) => candidate.email === `${localPart}@${PERSONA_EMAIL_DOMAIN}`);
  if (persona === undefined) {
    throw new Error(`Unknown persona ${localPart}.`);
  }
  return persona.userId;
}

/** The fixed "as of" instant the fixtures are written around (storyline, end of September 2026). */
export const FIXTURE_AS_OF = '2026-09-30T06:00:00Z';
