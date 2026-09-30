/**
 * Timetables, envelopes and participation conditions of the demo tenders (BUY-12; BR-11, BR-12; DD-15).
 *
 * Instants are UTC; the official zone of every KWU and ODC tender is Africa/Gaborone (UTC+02:00), so 10:00Z is
 * 12:00 official time. Id scheme: milestone `tenderId*100 + n`, condition `tenderId*10 + n`.
 * - T-2026-0006 closes on 14 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone.
 * - T-2026-0012 (draft) closes on 28 Dec 2026, a public holiday, 19 days after its planned release (policy: 21),
 *   with a Saturday briefing and a short questions window, so every timetable hint shows.
 */
import { TENANT_IDS } from '../platform.js';
import type { FxCondition, FxEnvelope, FxMilestone } from './types.js';

const KWU = TENANT_IDS.kwu;
const ODC = TENANT_IDS.odc;

type MilestoneSpec = readonly [milestone: FxMilestone['milestone'], at: string, options?: Partial<Pick<FxMilestone, 'lotId' | 'isDisclosed' | 'note'>>];

function milestones(tenderId: number, specs: readonly MilestoneSpec[], tenantId: number = KWU): FxMilestone[] {
  return specs.map(([milestone, at, options = {}], index) => ({
    id: tenderId * 100 + index + 1,
    tenantId,
    tenderId,
    lotId: null,
    milestone,
    at,
    isDisclosed: true,
    note: null,
    ...options,
  }));
}

const INTERNAL = { isDisclosed: false } as const;

export const MILESTONES: readonly FxMilestone[] = Object.freeze([
  ...milestones(1, [
    ['site_visit', '2026-07-01T07:00:00Z', { note: 'Optional visit to the Serowe wellfield; meet at the KWU depot.' }],
    ['questions_deadline', '2026-07-10T13:00:00Z'],
    ['submission_deadline', '2026-07-24T08:00:00Z'],
    ['opening', '2026-07-24T09:00:00Z'],
    ['expected_award', '2026-09-15T08:00:00Z', INTERNAL],
    ['expected_award', '2026-10-30T08:00:00Z', { ...INTERNAL, lotId: 103, note: 'Lot 3 restarted its technical evaluation on the clarified specification.' }],
    ['contract_start', '2026-11-02T06:00:00Z', INTERNAL],
  ]),
  ...milestones(2, [
    ['briefing', '2026-09-16T08:00:00Z', { note: 'Pre-quotation briefing.' }],
    ['site_visit', '2026-09-28T07:00:00Z', { note: 'Gaborone central stores and meter test bench.' }],
    ['questions_deadline', '2026-10-07T13:00:00Z'],
    ['submission_deadline', '2026-10-21T10:00:00Z', { note: 'Moved from 14 Oct 2026 by Addendum 1.' }],
    ['opening', '2026-10-21T12:00:00Z'],
    ['expected_award', '2026-11-13T08:00:00Z', INTERNAL],
    ['contract_start', '2026-12-01T06:00:00Z', INTERNAL],
  ]),
  ...milestones(3, [
    ['questions_deadline', '2026-08-14T13:00:00Z'],
    ['submission_deadline', '2026-08-28T08:00:00Z'],
    ['opening', '2026-08-28T10:00:00Z', { note: 'Qualification and technical envelopes; commercial envelopes after the price gate.' }],
    ['expected_award', '2026-10-30T08:00:00Z', INTERNAL],
    ['contract_start', '2026-12-01T06:00:00Z', INTERNAL],
  ]),
  ...milestones(4, [
    ['questions_deadline', '2026-05-22T13:00:00Z'],
    ['submission_deadline', '2026-06-05T13:00:00Z'],
  ]),
  ...milestones(5, [
    ['questions_deadline', '2026-11-04T13:00:00Z'],
    ['submission_deadline', '2026-11-18T10:00:00Z'],
    ['opening', '2026-11-18T12:00:00Z'],
    ['expected_award', '2026-12-18T08:00:00Z', INTERNAL],
    ['contract_start', '2027-01-04T06:00:00Z', INTERNAL],
  ]),
  ...milestones(6, [
    ['site_visit', '2026-10-08T07:00:00Z', { note: 'Mandatory site visit at the Mmashoro water treatment works (alternative date 9 Oct 2026).' }],
    ['questions_deadline', '2026-10-05T13:00:00Z'],
    ['submission_deadline', '2026-10-14T10:00:00Z'],
    ['opening', '2026-10-14T12:00:00Z'],
    ['expected_award', '2026-11-06T08:00:00Z', INTERNAL],
  ]),
  ...milestones(7, [
    ['briefing', '2026-05-22T07:00:00Z', { note: 'Mandatory briefing at Kgale Hill reservoir.' }],
    ['site_visit', '2026-05-27T07:00:00Z'],
    ['questions_deadline', '2026-06-12T13:00:00Z'],
    ['submission_deadline', '2026-06-26T08:00:00Z'],
    ['opening', '2026-06-26T09:00:00Z'],
    ['expected_award', '2026-09-25T08:00:00Z', INTERNAL],
    ['standstill_end', '2026-10-08T15:00:00Z'],
    ['contract_start', '2026-11-02T06:00:00Z', INTERNAL],
  ]),
  ...milestones(8, [
    ['site_visit', '2026-09-03T07:30:00Z', { note: 'Mandatory site visit at the Boteti pipeline valve chambers.' }],
    ['questions_deadline', '2026-09-11T13:00:00Z'],
    ['submission_deadline', '2026-09-25T08:00:00Z'],
    ['opening', '2026-10-02T08:00:00Z', { note: 'Qualification envelopes at the next opening committee sitting (30 Sep and 1 Oct are public holidays).' }],
    ['expected_award', '2026-11-20T08:00:00Z', INTERNAL],
  ]),
  ...milestones(9, [
    ['questions_deadline', '2026-07-31T13:00:00Z'],
    ['submission_deadline', '2026-08-14T08:00:00Z'],
    ['opening', '2026-08-14T10:00:00Z'],
    ['expected_award', '2026-11-27T08:00:00Z', INTERNAL],
  ]),
  ...milestones(10, [
    ['questions_deadline', '2026-03-20T13:00:00Z'],
    ['submission_deadline', '2026-04-03T08:00:00Z'],
    ['opening', '2026-04-03T09:00:00Z'],
    ['expected_award', '2026-05-15T08:00:00Z', INTERNAL],
    ['contract_start', '2026-07-01T06:00:00Z', INTERNAL],
  ]),
  ...milestones(
    11,
    [
      ['questions_deadline', '2026-10-09T13:00:00Z'],
      ['site_visit', '2026-10-15T07:00:00Z', { lotId: 1101, note: 'Site walk-through of the Maun council offices.' }],
      ['submission_deadline', '2026-10-23T10:00:00Z', { note: 'Moved from 21 Oct 2026 by Addendum 1.' }],
      ['opening', '2026-10-23T12:00:00Z'],
    ],
    ODC,
  ),
  ...milestones(13, [['submission_deadline', '2026-11-18T08:00:00Z'], ['opening', '2026-11-18T10:00:00Z']], ODC),
  ...milestones(14, [
    ['questions_deadline', '2026-08-06T13:00:00Z'],
    ['submission_deadline', '2026-08-20T10:00:00Z'],
    ['opening', '2026-08-21T07:00:00Z', { note: 'Staged opening: technical envelopes first; each lot has its own price gate.' }],
    ['expected_award', '2026-11-13T08:00:00Z', INTERNAL],
  ]),
  ...milestones(12, [
    ['briefing', '2026-12-12T07:00:00Z', { note: 'Walk-through of the Mmamashia switch room.' }],
    ['questions_deadline', '2026-12-23T13:00:00Z'],
    ['submission_deadline', '2026-12-28T10:00:00Z'],
    ['opening', '2026-12-28T12:00:00Z'],
    ['submission_deadline', '2026-12-28T10:00:00Z', { lotId: 1202, note: 'Same as the tender deadline.' }],
  ]),
]);

/** `single`: three envelopes opened together; `staged`: opened in order; `twoEnvelopes`: technical + commercial only. */
function envelopes(tenderId: number, mode: 'single' | 'staged' | 'twoEnvelopes', tenantId: number = KWU): FxEnvelope[] {
  if (mode === 'twoEnvelopes') {
    return [
      { tenantId, tenderId, envelope: 'technical', openOrder: 1 },
      { tenantId, tenderId, envelope: 'commercial', openOrder: 1 },
    ];
  }
  if (mode === 'staged') {
    return [
      { tenantId, tenderId, envelope: 'qualification', openOrder: 1 },
      { tenantId, tenderId, envelope: 'technical', openOrder: 2 },
      { tenantId, tenderId, envelope: 'commercial', openOrder: 3 },
    ];
  }
  return [
    { tenantId, tenderId, envelope: 'qualification', openOrder: 1 },
    { tenantId, tenderId, envelope: 'technical', openOrder: 1 },
    { tenantId, tenderId, envelope: 'commercial', openOrder: 1 },
  ];
}

export const ENVELOPES: readonly FxEnvelope[] = Object.freeze([
  ...envelopes(1, 'staged'),
  ...envelopes(2, 'single'),
  ...envelopes(3, 'staged'),
  ...envelopes(4, 'twoEnvelopes'),
  ...envelopes(5, 'single'),
  ...envelopes(6, 'single'),
  ...envelopes(7, 'single'),
  ...envelopes(8, 'staged'),
  ...envelopes(9, 'single'),
  ...envelopes(10, 'single'),
  ...envelopes(11, 'single', ODC),
  ...envelopes(12, 'twoEnvelopes'),
  ...envelopes(13, 'single', ODC),
  ...envelopes(14, 'staged'),
]);

function condition(tenderId: number, n: number, fields: Omit<FxCondition, 'id' | 'tenantId' | 'tenderId'>, tenantId: number = KWU): FxCondition {
  return { id: tenderId * 10 + n, tenantId, tenderId, ...fields };
}

export const PARTICIPATION_CONDITIONS: readonly FxCondition[] = Object.freeze([
  condition(1, 1, {
    conditionType: 'registration',
    description: 'Register on TenderIQ and accept the tender terms before downloading the documents.',
    qualificationProgramId: null,
    sessionId: null,
    blocking: true,
  }),
  condition(1, 2, {
    conditionType: 'qualification_required',
    description: 'Qualification in the WTR-PUMP category is required before award.',
    qualificationProgramId: 1,
    sessionId: null,
    blocking: false,
  }),
  condition(2, 1, {
    conditionType: 'registration',
    description: 'Register on TenderIQ before downloading the documents.',
    qualificationProgramId: null,
    sessionId: null,
    blocking: true,
  }),
  condition(3, 1, {
    conditionType: 'confidentiality_undertaking',
    description: 'Sign the confidentiality undertaking to access network drawings.',
    qualificationProgramId: null,
    sessionId: null,
    blocking: true,
  }),
  condition(5, 1, {
    conditionType: 'registration',
    description: 'Register on TenderIQ and accept the framework terms before downloading the documents.',
    qualificationProgramId: null,
    sessionId: null,
    blocking: true,
  }),
  condition(5, 2, {
    conditionType: 'eligibility_review',
    description: 'Distributors must show the manufacturer’s authorization; KWU reviews it before the deadline.',
    qualificationProgramId: null,
    sessionId: null,
    blocking: false,
  }),
  condition(6, 1, {
    conditionType: 'qualification_required',
    description: 'Only suppliers qualified in Water Infrastructure Suppliers — Category A are invited.',
    qualificationProgramId: 1,
    sessionId: null,
    blocking: true,
  }),
  condition(6, 2, {
    conditionType: 'confidentiality_undertaking',
    description: 'Sign the confidentiality undertaking for the works drawings.',
    qualificationProgramId: null,
    sessionId: null,
    blocking: true,
  }),
  condition(7, 1, {
    conditionType: 'mandatory_briefing',
    description: 'Attend the mandatory briefing at Kgale Hill reservoir on 22 May 2026.',
    qualificationProgramId: null,
    sessionId: 1,
    blocking: true,
  }),
  condition(9, 1, {
    conditionType: 'eligibility_review',
    description: 'Stage 1 applicants are shortlisted on financial standing and experience before stage 2 invitations.',
    qualificationProgramId: null,
    sessionId: null,
    blocking: true,
  }),
  condition(
    11,
    1,
    {
      conditionType: 'registration',
      description: 'Register on TenderIQ before downloading the documents.',
      qualificationProgramId: null,
      sessionId: null,
      blocking: true,
    },
    ODC,
  ),
  condition(12, 1, {
    conditionType: 'mandatory_briefing',
    description: 'Attend the switch-room walk-through at Mmamashia.',
    qualificationProgramId: null,
    sessionId: null,
    blocking: true,
  }),
]);
