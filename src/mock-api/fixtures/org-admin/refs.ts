/**
 * Org-admin fixtures: references to records owned by other domains (tenders, contracts, qualification
 * applications), by the storyline's natural keys (docs/plan/demo-storyline.md). Ids follow the reference number
 * (`T-2026-0003` → tender id 3). Tender references are projected from the tender register and its timetable
 * (`../tenders/`), so the title, buyer and official submission deadline can never drift from the other screens
 * (DD-33). The cross-fixture consistency test resolves the other references against the owning domains.
 */
import { DEMO_AS_OF } from '../demo-clock.js';
import { PERSONAS, PERSONA_EMAIL_DOMAIN, TENANT_IDS } from '../platform.js';
import { TENDERS } from '../tenders/tenders.js';
import { MILESTONES } from '../tenders/timetable.js';

export interface FixtureTenderRef {
  readonly tenderId: number;
  readonly buyerTenantId: number;
  readonly reference: string;
  readonly title: string;
  /** The tender-level official submission deadline (UTC instant); `null` when the timetable has none. */
  readonly submissionDeadline: string | null;
  /** The IANA official time zone of the event (DD-33). */
  readonly officialTimeZone: string;
}

/** The tenders that org-admin screens reference (supplier tender assignments, access scopes, authority records). */
const REFERENCED_TENDER_IDS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function projectTender(tenderId: number): FixtureTenderRef {
  const tender = TENDERS.find((candidate) => candidate.id === tenderId && !candidate.isTemplate);
  if (tender === undefined) {
    throw new Error(`Tender ${tenderId} is missing from the tender register.`);
  }
  const deadline = MILESTONES.find(
    (milestone) => milestone.tenderId === tenderId && milestone.lotId === null && milestone.milestone === 'submission_deadline',
  );
  return {
    tenderId: tender.id,
    buyerTenantId: tender.tenantId,
    reference: tender.reference,
    title: tender.title,
    submissionDeadline: deadline?.at ?? null,
    officialTimeZone: tender.officialTimeZone,
  };
}

export const TENDER_REFS: readonly FixtureTenderRef[] = Object.freeze(REFERENCED_TENDER_IDS.map(projectTender));

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

/** The fixed "as of" instant the fixtures are written around: the one storyline clock (`../demo-clock.ts`). */
export const FIXTURE_AS_OF = DEMO_AS_OF;
