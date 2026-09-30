/**
 * Awards fixtures, part 4: debrief requests and complaints (BUY-29, SUP-21, SUP-22; FR-17, BR-32; AC-25, AC-27).
 *
 * Debriefs: Chobe on T-2026-0001 (provided), Limpopo on T-2026-0007 (provided, AC-27), Tsodilo on T-2026-0007
 * (scheduled) and Makgadikgadi on T-2026-0010 (declined as late). The T-2026-0007 debrief window closed on
 * 29 Sep 2026, 17:00 (5 working days after the 22 Sep outcome notices), so a request from Chobe on the demo date is
 * refused with DEBRIEF_WINDOW_CLOSED. Each debrief carries ONLY the requesting supplier's own result; the
 * per-criterion weights add up to 100.00 and the own scores add up to the total score.
 *
 * Complaint evidence is held by the documents domain (`related_type = 'complaint'`, related id = complaint id), so
 * the buyer and the complainant read the same documents.
 *
 * Complaints: KWU CMP-2026-0001 (Chobe, T-2026-0001 lot 1: dismissed, appealed, closed), KWU CMP-2026-0002 (Limpopo,
 * T-2026-0007: under investigation with a blocking hold, AC-25), KWU CMP-2026-0003 (Gaborone Metering, T-2026-0002
 * terms: just received) and ODC CMP-2026-0001 (Limpopo, T-2026-0011 terms: received), which proves that each buyer
 * sees only its own cases while the complainant sees both of its cases.
 *
 * Independence (FR-17): `CHALLENGED_CONDUCT` lists the people who took part in the decision a complaint challenges.
 * They are offered as case owners only as NOT independent and cannot be assigned. Mpho Dikgang approved the release
 * of the T-2026-0002 terms that CMP-2026-0003 challenges.
 */
import type { ComplaintDetail, DebriefDetail, DebriefOwnResult } from '../../../contracts/awards.js';
import { TENANT_IDS } from '../platform.js';
import { USERS, deadline, lotRef, person, supplier, tenderBrief } from './base.js';

export interface DebriefFixture {
  readonly tenantId: number;
  readonly supplierTenantId: number;
  readonly detail: DebriefDetail;
}

/** A person who took part in the decision a complaint challenges: never an independent case owner (FR-17). */
export interface ChallengedConductFixture {
  readonly complaintId: number;
  readonly userId: number;
  readonly note: string;
}

export const CHALLENGED_CONDUCT: readonly ChallengedConductFixture[] = Object.freeze([
  {
    complaintId: 94,
    userId: USERS.mpho,
    note: 'Approved the release of the T-2026-0002 tender terms that this complaint challenges; not independent of the challenged decision.',
  },
]);

export interface ComplaintFixture {
  readonly tenantId: number;
  readonly supplierTenantId: number;
  readonly detail: ComplaintDetail;
  /** Appeal window end for a responded complaint (supplier view). */
  readonly appealDeadline: string | null;
}

const KWU_CHALLENGE =
  'You may lodge a complaint about this procurement from the Complaints page within 10 working days of the outcome notice. Complaints are handled by a case owner independent of the evaluation, and a timely complaint can place the award on hold.';

const T7_RESULT_LIMPOPO: DebriefOwnResult = {
  totalScore: '72.40',
  maxScore: '100.00',
  rank: 3,
  criteria: [
    {
      criterion: 'T-1 Relevant reservoir rehabilitation experience',
      weight: '20.00',
      ownScore: '12.00',
      maxScore: '20.00',
      feedback: 'Two comparable projects were evidenced; the third reference did not include a concrete repair scope.',
    },
    {
      criterion: 'T-2 Methodology and programme',
      weight: '25.00',
      ownScore: '12.40',
      maxScore: '25.00',
      feedback: 'The programme did not show how the two reservoirs would stay in service during the works.',
    },
    {
      criterion: 'T-3 Key personnel',
      weight: '15.00',
      ownScore: '11.00',
      maxScore: '15.00',
      feedback: 'Strong site manager and structural engineer CVs; no named concrete repair specialist.',
    },
    {
      criterion: 'T-4 Health, safety and environment',
      weight: '10.00',
      ownScore: '7.00',
      maxScore: '10.00',
      feedback: 'Sound safety plan; the confined-space entry procedure for the reservoir chambers was generic.',
    },
    {
      criterion: 'C-1 Price (lowest-ratio method)',
      weight: '30.00',
      ownScore: '30.00',
      maxScore: '30.00',
      feedback: 'Lowest compliant price: full commercial score under the published lowest-ratio method.',
    },
  ],
  successfulTenderAdvantages:
    'The successful tender scored higher on methodology (phased isolation of each reservoir) and on relevant experience.',
};

const T1_RESULT_CHOBE: DebriefOwnResult = {
  totalScore: '78.25',
  maxScore: '100.00',
  rank: 2,
  criteria: [
    {
      criterion: 'T-1 Pump efficiency at duty point',
      weight: '25.00',
      ownScore: '17.25',
      maxScore: '25.00',
      feedback: 'Offered pumps met the minimum efficiency but did not exceed it at the lower duty point.',
    },
    {
      criterion: 'T-2 Service network and response time',
      weight: '20.00',
      ownScore: '14.00',
      maxScore: '20.00',
      feedback: 'Response times for the Letlhakeng area depend on the Gaborone workshop.',
    },
    {
      criterion: 'T-3 Delivery programme',
      weight: '25.00',
      ownScore: '17.00',
      maxScore: '25.00',
      feedback: 'Programme realistic; installation crew sizing was not detailed.',
    },
    {
      criterion: 'C-1 Price (lowest-ratio method)',
      weight: '30.00',
      ownScore: '30.00',
      maxScore: '30.00',
      feedback: 'Lowest compliant lot 1 price: full commercial score.',
    },
  ],
  successfulTenderAdvantages: 'The successful tender scored higher on pump efficiency and on the service network.',
};

const T7_RESULT_TSODILO: DebriefOwnResult = {
  totalScore: '80.33',
  maxScore: '100.00',
  rank: 2,
  criteria: [
    {
      criterion: 'T-1 Relevant reservoir rehabilitation experience',
      weight: '20.00',
      ownScore: '12.00',
      maxScore: '20.00',
      feedback: 'Three comparable projects evidenced; two were smaller than 5 megalitres.',
    },
    {
      criterion: 'T-2 Methodology and programme',
      weight: '25.00',
      ownScore: '22.10',
      maxScore: '25.00',
      feedback: 'Detailed isolation and commissioning plan.',
    },
    {
      criterion: 'T-3 Key personnel',
      weight: '15.00',
      ownScore: '10.00',
      maxScore: '15.00',
      feedback: 'Strong team; the concrete specialist is a subcontractor without a signed commitment.',
    },
    {
      criterion: 'T-4 Health, safety and environment',
      weight: '10.00',
      ownScore: '8.00',
      maxScore: '10.00',
      feedback: 'Site-specific safety plan with a confined-space procedure; the waste-water disposal plan was brief.',
    },
    {
      criterion: 'C-1 Price (lowest-ratio method)',
      weight: '30.00',
      ownScore: '28.23',
      maxScore: '30.00',
      feedback: 'Your price scored 28.23 of 30.00 under the published lowest-ratio method.',
    },
  ],
  successfulTenderAdvantages: 'The successful tender offered a lower price and comparable technical merit.',
};

const T10_RESULT_MAKGADIKGADI: DebriefOwnResult = {
  totalScore: '74.80',
  maxScore: '100.00',
  rank: 2,
  criteria: [
    {
      criterion: 'T-1 Workshop capacity and coverage',
      weight: '40.00',
      ownScore: '26.80',
      maxScore: '40.00',
      feedback: 'One workshop in Palapye; no coverage in the western service area.',
    },
    {
      criterion: 'T-2 Response times',
      weight: '30.00',
      ownScore: '18.00',
      maxScore: '30.00',
      feedback: 'Breakdown response time of 24 hours against the preferred 8 hours.',
    },
    {
      criterion: 'C-1 Price',
      weight: '30.00',
      ownScore: '30.00',
      maxScore: '30.00',
      feedback: 'Lowest compliant quotation.',
    },
  ],
  successfulTenderAdvantages: 'The successful quotation offered wider workshop coverage and faster response times.',
};

/** Every debrief request. */
export const DEBRIEFS: readonly DebriefFixture[] = Object.freeze([
  {
    tenantId: TENANT_IDS.kwu,
    supplierTenantId: TENANT_IDS['chobe-pipe'],
    detail: {
      debriefId: 81,
      tender: tenderBrief(1),
      supplier: supplier('chobe-pipe'),
      bidId: 105,
      requestedBy: person(USERS.chobeBidManager),
      requestedAt: '2026-08-07T07:30:00Z',
      dueAt: deadline('2026-08-14T15:00:00Z'),
      meetingAt: deadline('2026-08-11T08:00:00Z'),
      status: 'provided',
      providedBy: person(USERS.tebogo),
      requestNote: 'Please explain the pump efficiency score for lot 1.',
      writtenResponse:
        'Meeting held on 11 Aug 2026. Your lot 1 offer ranked second with 78.25 points. The per-criterion scores and feedback are attached to this debrief. The lot 2 cancellation reason is set out in the cancellation notice.',
      effectOnDeadlines: 'None: the debrief was provided within the standstill period.',
      declineReason: null,
      ownResult: T1_RESULT_CHOBE,
      challengeInstructions: KWU_CHALLENGE,
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    supplierTenantId: TENANT_IDS['limpopo-env'],
    detail: {
      debriefId: 82,
      tender: tenderBrief(7),
      supplier: supplier('limpopo-env'),
      bidId: 708,
      requestedBy: person(USERS.limpopoAdmin),
      requestedAt: '2026-09-22T14:00:00Z',
      dueAt: deadline('2026-09-29T15:00:00Z'),
      meetingAt: deadline('2026-09-24T08:00:00Z'),
      status: 'provided',
      providedBy: person(USERS.tebogo),
      requestNote: 'We would like to understand the methodology score.',
      writtenResponse:
        'Meeting held on 24 Sep 2026. Your offer ranked third with 72.40 points. The feedback per criterion is below. The main gap was the methodology for keeping both reservoirs in service during the works.',
      effectOnDeadlines: 'None: the complaint window closes on 8 Oct 2026 as stated in the outcome notice.',
      declineReason: null,
      ownResult: T7_RESULT_LIMPOPO,
      challengeInstructions: KWU_CHALLENGE,
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    supplierTenantId: TENANT_IDS.tsodilo,
    detail: {
      debriefId: 83,
      tender: tenderBrief(7),
      supplier: supplier('tsodilo'),
      bidId: 704,
      requestedBy: person(USERS.tsodiloBidManager),
      requestedAt: '2026-09-29T09:00:00Z',
      dueAt: deadline('2026-10-06T15:00:00Z'),
      meetingAt: deadline('2026-10-05T08:00:00Z'),
      status: 'scheduled',
      providedBy: null,
      requestNote: 'Written debrief preferred; a short meeting is acceptable.',
      writtenResponse: null,
      effectOnDeadlines: 'None: the meeting is before the complaint window closes on 8 Oct 2026.',
      declineReason: null,
      ownResult: T7_RESULT_TSODILO,
      challengeInstructions: KWU_CHALLENGE,
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    supplierTenantId: TENANT_IDS.makgadikgadi,
    detail: {
      debriefId: 85,
      tender: tenderBrief(10),
      supplier: supplier('makgadikgadi'),
      bidId: 1006,
      requestedBy: person(USERS.makgadikgadiAdmin),
      requestedAt: '2026-04-10T09:00:00Z',
      dueAt: deadline('2026-04-17T15:00:00Z'),
      meetingAt: null,
      status: 'declined',
      providedBy: person(USERS.tebogo),
      requestNote: null,
      writtenResponse: null,
      effectOnDeadlines: 'None.',
      declineReason:
        'Requested after the debrief window stated in the outcome notice closed on 2 Mar 2026. Your score and the reasons were given in the outcome notice.',
      ownResult: T10_RESULT_MAKGADIKGADI,
      challengeInstructions: KWU_CHALLENGE,
    },
  },
]);

// ---------------------------------------------------------------------------------------------------------
// Complaints
// ---------------------------------------------------------------------------------------------------------

/** Every complaint. */
export const COMPLAINTS: readonly ComplaintFixture[] = Object.freeze([
  {
    tenantId: TENANT_IDS.kwu,
    supplierTenantId: TENANT_IDS['chobe-pipe'],
    appealDeadline: '2026-08-28T15:00:00Z',
    detail: {
      complaintId: 91,
      reference: 'CMP-2026-0001',
      tender: tenderBrief(1),
      lot: lotRef(101),
      complainant: supplier('chobe-pipe'),
      subject: 'evaluation',
      status: 'closed',
      receivedAt: '2026-08-14T09:15:00Z',
      withinWindow: true,
      standingConfirmed: true,
      acknowledgedAt: '2026-08-14T13:00:00Z',
      caseOwner: person(USERS.dineo),
      independenceConfirmed: true,
      isBlocking: true,
      holdActive: false,
      outcome: 'dismissed',
      responseDueAt: deadline('2026-08-28T15:00:00Z'),
      grounds:
        'The pump efficiency criterion was scored at a single duty point, although the tender documents referred to the full duty range. Our pumps are more efficient across the range.',
      complainantUser: person(USERS.chobeBidManager),
      hold: null,
      responseText:
        'The evaluation plan published with the tender (section 4.2) fixes the efficiency measurement at the stated duty point. The committee applied it to every offer in the same way. The complaint is dismissed.',
      remedy: null,
      appealGrounds: 'The duty range in the technical specification should prevail over the evaluation plan.',
      appealOutcome:
        'Appeal dismissed by the Procurement Review Committee on 11 Sep 2026: the evaluation plan was published before the deadline and applied consistently.',
      closedAt: '2026-09-14T10:00:00Z',
      publicSummary: 'A complaint about the lot 1 evaluation was dismissed; the appeal was also dismissed.',
      procurementEffect: {
        blockedActions: ['award_final', 'contract_sign'],
        affectedLotOutcomeIds: [121],
        standstillEffect: 'The lot 1 standstill was extended by two working days to 24 Aug 2026.',
      },
      events: [
        {
          eventId: 9101,
          eventType: 'received',
          fromStatus: null,
          toStatus: 'received',
          note: 'Complaint received within the window.',
          actor: person(USERS.chobeBidManager),
          occurredAt: '2026-08-14T09:15:00Z',
          supplierVisible: true,
        },
        {
          eventId: 9102,
          eventType: 'acknowledged',
          fromStatus: 'received',
          toStatus: 'acknowledged',
          note: 'Acknowledged; standing confirmed.',
          actor: person(USERS.dineo),
          occurredAt: '2026-08-14T13:00:00Z',
          supplierVisible: true,
        },
        {
          eventId: 9103,
          eventType: 'hold_placed',
          fromStatus: null,
          toStatus: null,
          note: 'Complaint hold on final award and contract signature for lot 1.',
          actor: person(USERS.dineo),
          occurredAt: '2026-08-14T13:30:00Z',
          supplierVisible: true,
        },
        {
          eventId: 9104,
          eventType: 'status_changed',
          fromStatus: 'acknowledged',
          toStatus: 'under_investigation',
          note: 'Admissible; investigation opened.',
          actor: person(USERS.dineo),
          occurredAt: '2026-08-17T08:00:00Z',
          supplierVisible: true,
        },
        {
          eventId: 9105,
          eventType: 'note',
          fromStatus: null,
          toStatus: null,
          note: 'Evaluation chair interviewed; score sheets reviewed. The duty point was applied to all offers.',
          actor: person(USERS.dineo),
          occurredAt: '2026-08-19T10:00:00Z',
          supplierVisible: false,
        },
        {
          eventId: 9106,
          eventType: 'response_issued',
          fromStatus: 'under_investigation',
          toStatus: 'response_issued',
          note: 'Complaint dismissed.',
          actor: person(USERS.dineo),
          occurredAt: '2026-08-21T14:00:00Z',
          supplierVisible: true,
        },
        {
          eventId: 9107,
          eventType: 'appeal_lodged',
          fromStatus: 'response_issued',
          toStatus: 'appealed',
          note: 'Appeal lodged.',
          actor: person(USERS.chobeBidManager),
          occurredAt: '2026-08-25T08:30:00Z',
          supplierVisible: true,
        },
        {
          eventId: 9108,
          eventType: 'hold_released',
          fromStatus: null,
          toStatus: null,
          note: 'Hold released under policy clause 7.6 (an appeal does not suspend the award).',
          actor: person(USERS.mpho),
          occurredAt: '2026-08-28T10:00:00Z',
          supplierVisible: true,
        },
        {
          eventId: 9109,
          eventType: 'appeal_decided',
          fromStatus: 'appealed',
          toStatus: 'resolved',
          note: 'Appeal dismissed by the Procurement Review Committee.',
          actor: person(USERS.dineo),
          occurredAt: '2026-09-11T12:00:00Z',
          supplierVisible: true,
        },
        {
          eventId: 9110,
          eventType: 'closed',
          fromStatus: 'resolved',
          toStatus: 'closed',
          note: 'Case closed.',
          actor: person(USERS.dineo),
          occurredAt: '2026-09-14T10:00:00Z',
          supplierVisible: true,
        },
      ],
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    supplierTenantId: TENANT_IDS['limpopo-env'],
    appealDeadline: null,
    detail: {
      complaintId: 92,
      reference: 'CMP-2026-0002',
      tender: tenderBrief(7),
      lot: lotRef(701),
      complainant: supplier('limpopo-env'),
      subject: 'evaluation',
      status: 'under_investigation',
      receivedAt: '2026-09-25T07:40:00Z',
      withinWindow: true,
      standingConfirmed: true,
      acknowledgedAt: '2026-09-25T12:00:00Z',
      caseOwner: person(USERS.dineo),
      independenceConfirmed: true,
      isBlocking: true,
      holdActive: true,
      outcome: null,
      responseDueAt: deadline('2026-10-09T15:00:00Z'),
      grounds:
        'The methodology criterion (T-2) was scored against a "service continuity" sub-criterion that is not in the published evaluation plan. Applying an unpublished sub-criterion changed the ranking.',
      complainantUser: person(USERS.limpopoAdmin),
      hold: null,
      responseText: null,
      remedy: null,
      appealGrounds: null,
      appealOutcome: null,
      closedAt: null,
      publicSummary: null,
      procurementEffect: {
        blockedActions: ['award_final', 'contract_sign'],
        affectedLotOutcomeIds: [141],
        standstillEffect: 'None: the hold does not change the standstill end date (8 Oct 2026, 17:00 Africa/Gaborone).',
      },
      events: [
        {
          eventId: 9201,
          eventType: 'received',
          fromStatus: null,
          toStatus: 'received',
          note: 'Complaint received within the window.',
          actor: person(USERS.limpopoAdmin),
          occurredAt: '2026-09-25T07:40:00Z',
          supplierVisible: true,
        },
        {
          eventId: 9202,
          eventType: 'hold_placed',
          fromStatus: null,
          toStatus: null,
          note: 'Complaint hold on final award and contract signature.',
          actor: person(USERS.dineo),
          occurredAt: '2026-09-25T10:00:00Z',
          supplierVisible: true,
        },
        {
          eventId: 9203,
          eventType: 'acknowledged',
          fromStatus: 'received',
          toStatus: 'acknowledged',
          note: 'Acknowledged; standing confirmed (unsuccessful tenderer within the window).',
          actor: person(USERS.dineo),
          occurredAt: '2026-09-25T12:00:00Z',
          supplierVisible: true,
        },
        {
          eventId: 9204,
          eventType: 'owner_assigned',
          fromStatus: null,
          toStatus: null,
          note: 'Case owner Dineo Masire (Legal Counsel); independence from the evaluation confirmed.',
          actor: person(USERS.mpho),
          occurredAt: '2026-09-25T12:05:00Z',
          supplierVisible: false,
        },
        {
          eventId: 9205,
          eventType: 'status_changed',
          fromStatus: 'acknowledged',
          toStatus: 'admissibility_review',
          note: 'Admissibility review started.',
          actor: person(USERS.dineo),
          occurredAt: '2026-09-26T08:00:00Z',
          supplierVisible: true,
        },
        {
          eventId: 9206,
          eventType: 'status_changed',
          fromStatus: 'admissibility_review',
          toStatus: 'under_investigation',
          note: 'Admissible; investigation opened.',
          actor: person(USERS.dineo),
          occurredAt: '2026-09-28T09:00:00Z',
          supplierVisible: true,
        },
        {
          eventId: 9207,
          eventType: 'note',
          fromStatus: null,
          toStatus: null,
          note: 'Requested the evaluator guidance note for T-2 from the evaluation chair.',
          actor: person(USERS.dineo),
          occurredAt: '2026-09-29T10:30:00Z',
          supplierVisible: false,
        },
      ],
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    supplierTenantId: TENANT_IDS['gaborone-meter'],
    appealDeadline: null,
    detail: {
      complaintId: 94,
      reference: 'CMP-2026-0003',
      tender: tenderBrief(2),
      lot: null,
      complainant: supplier('gaborone-meter'),
      subject: 'tender_terms',
      status: 'received',
      receivedAt: '2026-09-29T11:20:00Z',
      withinWindow: true,
      standingConfirmed: false,
      acknowledgedAt: null,
      caseOwner: null,
      independenceConfirmed: false,
      isBlocking: false,
      holdActive: false,
      outcome: null,
      responseDueAt: deadline('2026-10-13T15:00:00Z'),
      grounds:
        'The new mandatory requirement added by addendum 2 (on-site data logger certification) can only be met by one manufacturer and restricts competition.',
      complainantUser: person(USERS.gaboroneBidManager),
      hold: null,
      responseText: null,
      remedy: null,
      appealGrounds: null,
      appealOutcome: null,
      closedAt: null,
      publicSummary: null,
      procurementEffect: { blockedActions: [], affectedLotOutcomeIds: [], standstillEffect: null },
      events: [
        {
          eventId: 9401,
          eventType: 'received',
          fromStatus: null,
          toStatus: 'received',
          note: 'Complaint received.',
          actor: person(USERS.gaboroneBidManager),
          occurredAt: '2026-09-29T11:20:00Z',
          supplierVisible: true,
        },
      ],
    },
  },
  {
    tenantId: TENANT_IDS.odc,
    supplierTenantId: TENANT_IDS['limpopo-env'],
    appealDeadline: null,
    detail: {
      complaintId: 93,
      reference: 'CMP-2026-0001',
      tender: tenderBrief(11),
      lot: null,
      complainant: supplier('limpopo-env'),
      subject: 'tender_terms',
      status: 'received',
      receivedAt: '2026-09-26T08:10:00Z',
      withinWindow: true,
      standingConfirmed: false,
      acknowledgedAt: null,
      caseOwner: null,
      independenceConfirmed: false,
      isBlocking: false,
      holdActive: false,
      outcome: null,
      responseDueAt: deadline('2026-10-10T15:00:00Z'),
      grounds:
        'The requirement for three years of cleaning contracts with district councils excludes experienced commercial cleaning providers without public-sector contracts.',
      complainantUser: person(USERS.limpopoAdmin),
      hold: null,
      responseText: null,
      remedy: null,
      appealGrounds: null,
      appealOutcome: null,
      closedAt: null,
      publicSummary: null,
      procurementEffect: { blockedActions: [], affectedLotOutcomeIds: [], standstillEffect: null },
      events: [
        {
          eventId: 9301,
          eventType: 'received',
          fromStatus: null,
          toStatus: 'received',
          note: 'Complaint received.',
          actor: person(USERS.limpopoAdmin),
          occurredAt: '2026-09-26T08:10:00Z',
          supplierVisible: true,
        },
      ],
    },
  },
]);
