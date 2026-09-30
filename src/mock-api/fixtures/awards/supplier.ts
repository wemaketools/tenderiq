/**
 * Awards fixtures, part 6: supplier-facing outcome records (SUP-21; BR-31, BR-41; AC-27).
 *
 * One row per (buyer, supplier, tender) where the supplier has received an outcome notice. The notices, the
 * debrief and the complaints are joined by the handler from the buyer-side fixtures, filtered to this supplier;
 * this file holds only what is specific to the supplier view (its own lot results, instructions, deadlines).
 *
 * - Tsodilo: T-2026-0001 (lot 1 awarded, lot 3 pending → mixed), T-2026-0007 (unsuccessful), T-2026-0010 (awarded).
 * - Chobe: T-2026-0001 (lot 1 unsuccessful, lot 2 cancelled, lot 3 pending → mixed), T-2026-0007 (unsuccessful).
 * - Makgadikgadi: T-2026-0007 (intention to award, NOT a final award: BR-31), T-2026-0010 (unsuccessful).
 * - Limpopo: T-2026-0007 (unsuccessful; debrief provided, AC-27; complaint with a hold, AC-25) and T-2026-0009
 *   (preferred bidder under the declared contingency: NOT an award, BR-31).
 * - Serowe ICT: T-2026-0009 (preferred bidder, withdrawn after failed due diligence; no award was ever made).
 * - Gaborone Metering has no outcome notice yet (empty state).
 *
 * T-2026-0007 dates follow the Botswana Public Holidays 2026 calendar (see notices.ts): the debrief window closed on
 * 29 Sep 2026, 17:00 (5 working days after the 22 Sep notices), so Chobe can no longer request one; the complaint
 * window and the standstill end on 8 Oct 2026, 17:00 (10 working days; 30 Sep and 1 Oct are holidays).
 */
import type { SupplierOutcomeDetail } from '../../../contracts/awards.js';
import { TENANT_IDS } from '../platform.js';
import { buyer, bwp, deadline, lotRef } from './base.js';

/** The supplier-specific part of an outcome record; notices, debrief and complaints are joined by the handler. */
export type SupplierOutcomeCore = Omit<
  SupplierOutcomeDetail,
  'notices' | 'debrief' | 'complaints' | 'latestNoticeAt' | 'awaitingAcknowledgment' | 'debriefStatus' | 'openComplaintCount'
>;

export interface SupplierOutcomeFixture {
  readonly tenantId: number;
  readonly supplierTenantId: number;
  /** Outcome notices this supplier received (by notice id). */
  readonly noticeIds: readonly number[];
  /** When the supplier's first outcome notice was delivered (the debrief window starts there). */
  readonly core: SupplierOutcomeCore;
}

const DEBRIEF_KWU =
  'Request a debriefing from this page within 5 working days of the outcome notice. The debrief explains your own result against the published criteria; it never discloses another supplier’s offer or scores.';
const CHALLENGE_KWU =
  'If you believe the procurement rules were not followed, lodge a complaint from the Complaints page within 10 working days of the outcome notice. A timely complaint may place the award on hold. Complaints are decided by a case owner independent of the evaluation.';
const DEBRIEF_WINNER = 'Debriefings are offered to unsuccessful suppliers. As the recommended supplier, you will be contacted about the next steps.';
const DEBRIEF_PREFERRED =
  'A debriefing can be requested once the award outcome is notified. Preferred-bidder status is not an award, so no outcome notice has been issued yet.';

/** Every supplier outcome record. */
export const SUPPLIER_OUTCOMES: readonly SupplierOutcomeFixture[] = Object.freeze([
  {
    tenantId: TENANT_IDS.kwu,
    supplierTenantId: TENANT_IDS.tsodilo,
    noticeIds: [51, 54, 56],
    core: {
      tenderId: 1,
      buyer: buyer('kwu'),
      reference: 'T-2026-0001',
      title: 'Borehole pump replacement programme (3 lots)',
      result: 'mixed',
      lots: [
        { lot: lotRef(101), result: 'awarded', awardedValue: bwp('5340000.00'), conditions: null, reason: 'Highest-ranked compliant offer.' },
        { lot: lotRef(103), result: 'pending', awardedValue: null, conditions: null, reason: 'Lot 3 is still under evaluation.' },
      ],
      standstillEndsAt: null,
      officialTimeZone: 'Africa/Gaborone',
      standstill: {
        status: 'completed',
        endsAt: deadline('2026-08-20T15:00:00Z'),
        extendedTo: deadline('2026-08-24T15:00:00Z'),
        effectiveEndsAt: deadline('2026-08-24T15:00:00Z'),
        dayType: 'working',
        extensionReason: 'Extended by two working days while a complaint was answered.',
      },
      procurementHoldActive: false,
      canRequestDebrief: false,
      debriefDeadline: null,
      debriefInstructions: DEBRIEF_WINNER,
      challengeInstructions: CHALLENGE_KWU,
      complaintDeadline: null,
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    supplierTenantId: TENANT_IDS.tsodilo,
    noticeIds: [57, 58, 59],
    core: {
      tenderId: 7,
      buyer: buyer('kwu'),
      reference: 'T-2026-0007',
      title: 'Reservoir rehabilitation works',
      result: 'unsuccessful',
      lots: [
        {
          lot: lotRef(701),
          result: 'unsuccessful',
          awardedValue: null,
          conditions: null,
          reason: 'Your compliant offer ranked second (80.33 points). The intended award is to Makgadikgadi Civil Works at BWP 7,850,000.00.',
        },
      ],
      standstillEndsAt: deadline('2026-10-08T15:00:00Z'),
      officialTimeZone: 'Africa/Gaborone',
      standstill: {
        status: 'running',
        endsAt: deadline('2026-10-08T15:00:00Z'),
        extendedTo: null,
        effectiveEndsAt: deadline('2026-10-08T15:00:00Z'),
        dayType: 'working',
        extensionReason: null,
      },
      procurementHoldActive: true,
      canRequestDebrief: false,
      debriefDeadline: deadline('2026-09-29T15:00:00Z'),
      debriefInstructions: DEBRIEF_KWU,
      challengeInstructions: CHALLENGE_KWU,
      complaintDeadline: deadline('2026-10-08T15:00:00Z'),
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    supplierTenantId: TENANT_IDS.tsodilo,
    noticeIds: [65, 67],
    core: {
      tenderId: 10,
      buyer: buyer('kwu'),
      reference: 'T-2026-0010',
      title: 'Fleet vehicle maintenance',
      result: 'awarded',
      lots: [
        { lot: lotRef(1001), result: 'awarded', awardedValue: bwp('1850000.00'), conditions: null, reason: 'Highest-ranked compliant quotation.' },
      ],
      standstillEndsAt: null,
      officialTimeZone: 'Africa/Gaborone',
      standstill: {
        status: 'completed',
        endsAt: deadline('2026-02-26T15:00:00Z'),
        extendedTo: null,
        effectiveEndsAt: deadline('2026-02-26T15:00:00Z'),
        dayType: 'calendar',
        extensionReason: null,
      },
      procurementHoldActive: false,
      canRequestDebrief: false,
      debriefDeadline: null,
      debriefInstructions: DEBRIEF_WINNER,
      challengeInstructions: CHALLENGE_KWU,
      complaintDeadline: null,
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    supplierTenantId: TENANT_IDS['chobe-pipe'],
    noticeIds: [51, 52, 53, 54, 55, 56],
    core: {
      tenderId: 1,
      buyer: buyer('kwu'),
      reference: 'T-2026-0001',
      title: 'Borehole pump replacement programme (3 lots)',
      result: 'mixed',
      lots: [
        {
          lot: lotRef(101),
          result: 'unsuccessful',
          awardedValue: null,
          conditions: null,
          reason: 'Your compliant offer ranked second (78.25 points). Lot 1 was awarded to Tsodilo Engineering at BWP 5,340,000.00.',
        },
        {
          lot: lotRef(102),
          result: 'cancelled',
          awardedValue: null,
          conditions: null,
          reason:
            'Lot 2 was cancelled because no compliant offer was received: the only offer failed mandatory requirement REQ-T-02 (solar array sizing for each site).',
        },
        { lot: lotRef(103), result: 'pending', awardedValue: null, conditions: null, reason: 'Lot 3 is still under evaluation.' },
      ],
      standstillEndsAt: null,
      officialTimeZone: 'Africa/Gaborone',
      standstill: {
        status: 'completed',
        endsAt: deadline('2026-08-20T15:00:00Z'),
        extendedTo: deadline('2026-08-24T15:00:00Z'),
        effectiveEndsAt: deadline('2026-08-24T15:00:00Z'),
        dayType: 'working',
        extensionReason: 'Extended by two working days while your complaint was answered.',
      },
      procurementHoldActive: false,
      canRequestDebrief: false,
      debriefDeadline: deadline('2026-08-13T15:00:00Z'),
      debriefInstructions: DEBRIEF_KWU,
      challengeInstructions: CHALLENGE_KWU,
      complaintDeadline: deadline('2026-08-20T15:00:00Z'),
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    supplierTenantId: TENANT_IDS['chobe-pipe'],
    noticeIds: [57, 58, 59],
    core: {
      tenderId: 7,
      buyer: buyer('kwu'),
      reference: 'T-2026-0007',
      title: 'Reservoir rehabilitation works',
      result: 'unsuccessful',
      lots: [
        {
          lot: lotRef(701),
          result: 'unsuccessful',
          awardedValue: null,
          conditions: null,
          reason: 'Your compliant offer ranked fourth (69.99 points). The intended award is to Makgadikgadi Civil Works at BWP 7,850,000.00.',
        },
      ],
      standstillEndsAt: deadline('2026-10-08T15:00:00Z'),
      officialTimeZone: 'Africa/Gaborone',
      standstill: {
        status: 'running',
        endsAt: deadline('2026-10-08T15:00:00Z'),
        extendedTo: null,
        effectiveEndsAt: deadline('2026-10-08T15:00:00Z'),
        dayType: 'working',
        extensionReason: null,
      },
      procurementHoldActive: true,
      canRequestDebrief: false,
      debriefDeadline: deadline('2026-09-29T15:00:00Z'),
      debriefInstructions: DEBRIEF_KWU,
      challengeInstructions: CHALLENGE_KWU,
      complaintDeadline: deadline('2026-10-08T15:00:00Z'),
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    supplierTenantId: TENANT_IDS.makgadikgadi,
    noticeIds: [57, 59],
    core: {
      tenderId: 7,
      buyer: buyer('kwu'),
      reference: 'T-2026-0007',
      title: 'Reservoir rehabilitation works',
      result: 'intent_to_award',
      lots: [
        {
          lot: lotRef(701),
          result: 'intent_to_award',
          awardedValue: bwp('7850000.00'),
          conditions: null,
          reason:
            'Kalahari Water Utilities intends to award this contract to you. This is not a final award and no contract is formed; the final award is on hold while a complaint is decided.',
        },
      ],
      standstillEndsAt: deadline('2026-10-08T15:00:00Z'),
      officialTimeZone: 'Africa/Gaborone',
      standstill: {
        status: 'running',
        endsAt: deadline('2026-10-08T15:00:00Z'),
        extendedTo: null,
        effectiveEndsAt: deadline('2026-10-08T15:00:00Z'),
        dayType: 'working',
        extensionReason: null,
      },
      procurementHoldActive: true,
      canRequestDebrief: false,
      debriefDeadline: null,
      debriefInstructions: DEBRIEF_WINNER,
      challengeInstructions: CHALLENGE_KWU,
      complaintDeadline: null,
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    supplierTenantId: TENANT_IDS.makgadikgadi,
    noticeIds: [65, 66, 67],
    core: {
      tenderId: 10,
      buyer: buyer('kwu'),
      reference: 'T-2026-0010',
      title: 'Fleet vehicle maintenance',
      result: 'unsuccessful',
      lots: [
        {
          lot: lotRef(1001),
          result: 'unsuccessful',
          awardedValue: null,
          conditions: null,
          reason: 'Your compliant quotation ranked second (74.80 points). The contract was awarded to Tsodilo Engineering at BWP 1,850,000.00.',
        },
      ],
      standstillEndsAt: null,
      officialTimeZone: 'Africa/Gaborone',
      standstill: {
        status: 'completed',
        endsAt: deadline('2026-02-26T15:00:00Z'),
        extendedTo: null,
        effectiveEndsAt: deadline('2026-02-26T15:00:00Z'),
        dayType: 'calendar',
        extensionReason: null,
      },
      procurementHoldActive: false,
      canRequestDebrief: false,
      debriefDeadline: deadline('2026-03-02T15:00:00Z'),
      debriefInstructions: DEBRIEF_KWU,
      challengeInstructions: CHALLENGE_KWU,
      complaintDeadline: deadline('2026-03-02T15:00:00Z'),
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    supplierTenantId: TENANT_IDS['limpopo-env'],
    noticeIds: [57, 58, 59],
    core: {
      tenderId: 7,
      buyer: buyer('kwu'),
      reference: 'T-2026-0007',
      title: 'Reservoir rehabilitation works',
      result: 'unsuccessful',
      lots: [
        {
          lot: lotRef(701),
          result: 'unsuccessful',
          awardedValue: null,
          conditions: null,
          reason: 'Your compliant offer ranked third (72.40 points). The intended award is to Makgadikgadi Civil Works at BWP 7,850,000.00.',
        },
      ],
      standstillEndsAt: deadline('2026-10-08T15:00:00Z'),
      officialTimeZone: 'Africa/Gaborone',
      standstill: {
        status: 'running',
        endsAt: deadline('2026-10-08T15:00:00Z'),
        extendedTo: null,
        effectiveEndsAt: deadline('2026-10-08T15:00:00Z'),
        dayType: 'working',
        extensionReason: null,
      },
      procurementHoldActive: true,
      canRequestDebrief: false,
      debriefDeadline: deadline('2026-09-29T15:00:00Z'),
      debriefInstructions: DEBRIEF_KWU,
      challengeInstructions: CHALLENGE_KWU,
      complaintDeadline: deadline('2026-10-08T15:00:00Z'),
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    supplierTenantId: TENANT_IDS['serowe-ict'],
    noticeIds: [68, 69],
    core: {
      tenderId: 9,
      buyer: buyer('kwu'),
      reference: 'T-2026-0009',
      title: 'Acoustic leak detection services',
      result: 'preferred_withdrawn',
      lots: [
        {
          lot: lotRef(901),
          result: 'preferred_withdrawn',
          awardedValue: null,
          conditions: null,
          reason:
            'You were selected as the preferred bidder on 8 Sep 2026, conditional on due diligence. The status was withdrawn on 18 Sep 2026 because due diligence on your financial position was not satisfied. No award was made to you.',
        },
      ],
      standstillEndsAt: null,
      officialTimeZone: 'Africa/Gaborone',
      standstill: null,
      procurementHoldActive: false,
      canRequestDebrief: false,
      debriefDeadline: null,
      debriefInstructions: DEBRIEF_PREFERRED,
      challengeInstructions: CHALLENGE_KWU,
      complaintDeadline: null,
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    supplierTenantId: TENANT_IDS['limpopo-env'],
    noticeIds: [70],
    core: {
      tenderId: 9,
      buyer: buyer('kwu'),
      reference: 'T-2026-0009',
      title: 'Acoustic leak detection services',
      result: 'preferred_bidder',
      lots: [
        {
          lot: lotRef(901),
          result: 'preferred_bidder',
          awardedValue: null,
          conditions:
            'Professional indemnity insurance verified with the insurer; availability of the lead acoustic engineer confirmed at the interview of 7 Oct 2026.',
          reason:
            'You are the preferred bidder under the contingency declared in the stage-two conditions. This is not an award and no contract is formed: an award needs an approved recommendation and an intention-to-award notice.',
        },
      ],
      standstillEndsAt: null,
      officialTimeZone: 'Africa/Gaborone',
      standstill: null,
      procurementHoldActive: false,
      canRequestDebrief: false,
      debriefDeadline: null,
      debriefInstructions: DEBRIEF_PREFERRED,
      challengeInstructions: CHALLENGE_KWU,
      complaintDeadline: null,
    },
  },
]);
