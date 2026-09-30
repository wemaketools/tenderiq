/**
 * Awards fixtures, part 1: helpers and the tenders the award screens show (docs/plan/demo-storyline.md).
 *
 * Natural keys follow the storyline: tender `T-2026-000N` has id N; lot ids are `N * 100 + lotNo` (T-2026-0001
 * lot 2 = 102); bid ids are `N * 100 + supplierTenantId` (Tsodilo on T-2026-0001 = 104); contract `C-2026-000N`
 * has id N. Every instant is a fixed ISO string around the storyline dates (the demo clock is 30 Sep 2026).
 *
 * Static data only: nothing here is mutated at runtime.
 */
import type { OfficialDeadline, PersonRef } from '../../../contracts/common.js';
import type { AwardTenderRef, BuyerRef, LotRef, StandstillPolicy, SupplierRef, TenderBrief } from '../../../contracts/awards.js';
import type { LotsStage, TendersAwardModel } from '../../../contracts/enums.js';
import { TENANTS, TENANT_IDS } from '../platform.js';
import type { TenantSlug } from '../platform.js';
import { personRef } from '../../persona.js';

/** The official time zone of both demo buyers. */
export const GABORONE = 'Africa/Gaborone';

/** An official deadline in Africa/Gaborone. */
export function deadline(at: string): OfficialDeadline {
  return { at, timeZone: GABORONE };
}

/** A person reference for a fixture persona id. */
export function person(userId: number): PersonRef {
  return personRef(userId);
}

function tenantOf(slug: TenantSlug) {
  const tenant = TENANTS.find((row) => row.slug === slug);
  if (tenant === undefined) {
    throw new Error(`Unknown tenant ${slug}.`);
  }
  return tenant;
}

/** A supplier organization reference by slug. */
export function supplier(slug: TenantSlug): SupplierRef {
  const tenant = tenantOf(slug);
  return { supplierTenantId: tenant.id, name: tenant.name };
}

/** A buyer organization reference by slug. */
export function buyer(slug: TenantSlug): BuyerRef {
  const tenant = tenantOf(slug);
  return { tenantId: tenant.id, name: tenant.name, slug: tenant.slug };
}

/** Money in BWP. */
export function bwp(amount: string): { amount: string; currency: string } {
  return { amount, currency: 'BWP' };
}

/** Persona user ids used by the award fixtures (platform fixture ids). */
export const USERS = {
  mpho: 4,
  tebogo: 5,
  onalenna: 7,
  boitumelo: 10,
  dineo: 17,
  keabetswe: 18,
  masego: 19,
  officerOdc: 23,
  tsodiloBidManager: 25,
  tsodiloSignatory: 27,
  chobeBidManager: 29,
  chobeSignatory: 31,
  seroweBidManager: 33,
  makgadikgadiAdmin: 40,
  limpopoAdmin: 41,
  gaboroneBidManager: 37,
} as const;

export interface AwardLotFixture {
  readonly lotId: number;
  readonly lotNo: number;
  readonly title: string;
  readonly stage: LotsStage;
}

export interface AwardTenderFixture {
  readonly tenantId: number;
  readonly buyerSlug: TenantSlug;
  readonly ref: AwardTenderRef;
  readonly ownerUserId: number;
  readonly awardModel: TendersAwardModel;
  readonly lots: readonly AwardLotFixture[];
  readonly policy: StandstillPolicy;
  /** Suppliers with an effective (non-withdrawn) bid, by bid id. */
  readonly bidders: readonly { readonly bidId: number; readonly supplierSlug: TenantSlug; readonly lotNos: readonly number[] }[];
}

const KWU_POLICY: StandstillPolicy = {
  standstillRequired: true,
  standstillLength: 10,
  standstillDayType: 'working',
  calendarName: 'Botswana Public Holidays 2026',
  complaintWindowDays: 10,
  policyLabel: 'KWU Procurement Policy 2026, version 3',
};

const KWU_RFQ_POLICY: StandstillPolicy = {
  ...KWU_POLICY,
  standstillLength: 10,
  standstillDayType: 'calendar',
};

const ODC_POLICY: StandstillPolicy = {
  standstillRequired: true,
  standstillLength: 14,
  standstillDayType: 'calendar',
  calendarName: 'Okavango District Council Calendar 2026',
  complaintWindowDays: 14,
  policyLabel: 'ODC Procurement Regulations, version 1',
};

function tenderRef(
  tenderId: number,
  title: string,
  eventType: AwardTenderRef['eventType'],
  procedure: AwardTenderRef['procedure'],
  status: AwardTenderRef['status'],
): AwardTenderRef {
  return {
    tenderId,
    reference: `T-2026-${String(tenderId).padStart(4, '0')}`,
    title,
    eventType,
    procedure,
    status,
    officialTimeZone: GABORONE,
    currency: 'BWP',
  };
}

/** Every tender the award screens know about, by id. */
export const AWARD_TENDERS: readonly AwardTenderFixture[] = Object.freeze([
  {
    tenantId: TENANT_IDS.kwu,
    buyerSlug: 'kwu',
    ref: tenderRef(1, 'Borehole pump replacement programme (3 lots)', 'tender', 'open', 'partially_awarded'),
    ownerUserId: USERS.tebogo,
    awardModel: 'per_lot',
    lots: [
      { lotId: 101, lotNo: 1, title: 'Submersible borehole pumps — Central District', stage: 'awarded' },
      { lotId: 102, lotNo: 2, title: 'Solar pumping systems — Kgalagadi', stage: 'cancelled' },
      { lotId: 103, lotNo: 3, title: 'Pump controls and telemetry panels', stage: 'under_assessment' },
    ],
    policy: KWU_POLICY,
    bidders: [
      { bidId: 104, supplierSlug: 'tsodilo', lotNos: [1, 3] },
      { bidId: 105, supplierSlug: 'chobe-pipe', lotNos: [1, 2, 3] },
      { bidId: 109, supplierSlug: 'gaborone-meter', lotNos: [3] },
    ],
  },
  {
    tenantId: TENANT_IDS.kwu,
    buyerSlug: 'kwu',
    ref: tenderRef(2, 'Smart water meter supply', 'rfq', 'open', 'open'),
    ownerUserId: USERS.tebogo,
    awardModel: 'single',
    lots: [{ lotId: 201, lotNo: 1, title: 'Smart meters with AMR modules', stage: 'open' }],
    policy: KWU_RFQ_POLICY,
    bidders: [],
  },
  {
    tenantId: TENANT_IDS.kwu,
    buyerSlug: 'kwu',
    ref: tenderRef(3, 'SCADA telemetry upgrade', 'rfp', 'open', 'under_assessment'),
    ownerUserId: USERS.tebogo,
    awardModel: 'single',
    lots: [{ lotId: 301, lotNo: 1, title: 'SCADA telemetry upgrade', stage: 'under_assessment' }],
    policy: KWU_POLICY,
    bidders: [
      { bidId: 304, supplierSlug: 'tsodilo', lotNos: [1] },
      { bidId: 307, supplierSlug: 'serowe-ict', lotNos: [1] },
      { bidId: 306, supplierSlug: 'makgadikgadi', lotNos: [1] },
    ],
  },
  {
    tenantId: TENANT_IDS.kwu,
    buyerSlug: 'kwu',
    ref: tenderRef(4, 'Leak-detection market consultation', 'rfi', 'rfi', 'information_collected'),
    ownerUserId: USERS.tebogo,
    awardModel: 'single',
    lots: [],
    policy: KWU_POLICY,
    bidders: [],
  },
  {
    tenantId: TENANT_IDS.kwu,
    buyerSlug: 'kwu',
    ref: tenderRef(7, 'Reservoir rehabilitation works', 'tender', 'open', 'award_pending'),
    ownerUserId: USERS.tebogo,
    awardModel: 'single',
    lots: [{ lotId: 701, lotNo: 1, title: 'Reservoir rehabilitation works', stage: 'award_pending' }],
    policy: KWU_POLICY,
    bidders: [
      { bidId: 706, supplierSlug: 'makgadikgadi', lotNos: [1] },
      { bidId: 704, supplierSlug: 'tsodilo', lotNos: [1] },
      { bidId: 708, supplierSlug: 'limpopo-env', lotNos: [1] },
    ],
  },
  {
    tenantId: TENANT_IDS.kwu,
    buyerSlug: 'kwu',
    ref: tenderRef(9, 'Acoustic leak detection services', 'rfp', 'multi_stage', 'under_assessment'),
    ownerUserId: USERS.tebogo,
    awardModel: 'single',
    lots: [{ lotId: 901, lotNo: 1, title: 'Acoustic leak detection services', stage: 'under_assessment' }],
    policy: KWU_POLICY,
    bidders: [
      { bidId: 907, supplierSlug: 'serowe-ict', lotNos: [1] },
      { bidId: 908, supplierSlug: 'limpopo-env', lotNos: [1] },
    ],
  },
  {
    tenantId: TENANT_IDS.kwu,
    buyerSlug: 'kwu',
    ref: tenderRef(10, 'Fleet vehicle maintenance', 'rfq', 'open', 'awarded'),
    ownerUserId: USERS.tebogo,
    awardModel: 'single',
    lots: [{ lotId: 1001, lotNo: 1, title: 'Fleet vehicle maintenance', stage: 'awarded' }],
    policy: KWU_RFQ_POLICY,
    bidders: [
      { bidId: 1004, supplierSlug: 'tsodilo', lotNos: [1] },
      { bidId: 1006, supplierSlug: 'makgadikgadi', lotNos: [1] },
    ],
  },
  {
    tenantId: TENANT_IDS.odc,
    buyerSlug: 'odc',
    ref: tenderRef(11, 'Office cleaning services', 'rfq', 'open', 'open'),
    ownerUserId: USERS.officerOdc,
    awardModel: 'per_lot',
    lots: [
      { lotId: 1101, lotNo: 1, title: 'Council headquarters, Maun', stage: 'open' },
      { lotId: 1102, lotNo: 2, title: 'District clinics', stage: 'open' },
    ],
    policy: ODC_POLICY,
    bidders: [],
  },
]);

/** The tender fixture by id (throws for an unknown id: a fixture bug). */
export function awardTender(tenderId: number): AwardTenderFixture {
  const tender = AWARD_TENDERS.find((row) => row.ref.tenderId === tenderId);
  if (tender === undefined) {
    throw new Error(`No award tender fixture ${tenderId}.`);
  }
  return tender;
}

/** A lot reference by lot id. */
export function lotRef(lotId: number): LotRef {
  for (const tender of AWARD_TENDERS) {
    const lot = tender.lots.find((row) => row.lotId === lotId);
    if (lot !== undefined) {
      return { lotId: lot.lotId, lotNo: lot.lotNo, title: lot.title };
    }
  }
  throw new Error(`No lot fixture ${lotId}.`);
}

/** A short tender reference by id. */
export function tenderBrief(tenderId: number): TenderBrief {
  const { ref } = awardTender(tenderId);
  return { tenderId: ref.tenderId, reference: ref.reference, title: ref.title };
}
