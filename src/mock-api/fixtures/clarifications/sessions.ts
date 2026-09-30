/**
 * `sessions` and `session_registrations` of the demo world (FR-10; BUY-18, SUP-11). Every session and
 * registration status appears, plus a mandatory session with a permitted alternative, accessibility requests, a
 * resolved and an unresolved attendance exception, minutes whose material answers were shared, and a site visit
 * held two days ago whose attendance and minutes are still to be recorded (T-2026-0002, 28 Sep 2026).
 *
 * Dates follow the tenders timetable: every session lies between the tender's release and its deadline, and the
 * timetable's own briefing and site-visit milestones (T-2026-0001 optional visit on 1 Jul; T-2026-0007 mandatory
 * briefing on 22 May and site visit on 27 May) are the sessions 46, 71 and 72. The official minutes documents are
 * the documents domain's documents related to the session (`sessionMinutesDocuments`); the shared answers are the
 * questions recorded at the session (`questions.session_id`).
 */
import type { SessionRegistrationsStatus, SessionsSessionType, SessionsStatus } from '../../../contracts/enums.js';
import type { AttendanceExceptionResolution } from '../../../contracts/clarifications.js';
import { TENANT_IDS } from '../platform.js';
import type { HistoryFixture } from './questions.js';

export interface RegistrationFixture {
  readonly id: number;
  readonly supplierTenantId: number;
  readonly registeredBy: number;
  readonly attendeeNames: readonly string[];
  readonly accessibilityNeeds: string | null;
  readonly status: SessionRegistrationsStatus;
  readonly attendanceRecordedBy: number | null;
  readonly attendanceRecordedAt: string | null;
  readonly createdAt: string;
  readonly exceptionResolution: {
    readonly resolution: AttendanceExceptionResolution;
    readonly note: string;
    readonly resolvedAt: string;
    readonly resolvedBy: number;
    readonly alternativeSessionId: number | null;
  } | null;
}

export interface SessionFixture {
  readonly id: number;
  readonly tenantId: number;
  readonly tenderId: number;
  readonly lotId: number | null;
  readonly sessionType: SessionsSessionType;
  readonly title: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly venue: string;
  readonly instructions: string | null;
  readonly capacity: number;
  readonly mandatory: boolean;
  readonly alternativeOfId: number | null;
  readonly accessibilityInfo: string | null;
  readonly registrationDeadline: string | null;
  readonly minutesPublishedAt: string | null;
  readonly status: SessionsStatus;
  readonly cancellationReason: string | null;
  readonly registrations: readonly RegistrationFixture[];
  readonly history: readonly HistoryFixture[];
}

const KWU = TENANT_IDS.kwu;

type RegistrationSpec = Omit<RegistrationFixture, 'attendanceRecordedBy' | 'attendanceRecordedAt' | 'exceptionResolution'> &
  Partial<Pick<RegistrationFixture, 'attendanceRecordedBy' | 'attendanceRecordedAt' | 'exceptionResolution'>>;

function registration(spec: RegistrationSpec): RegistrationFixture {
  return { attendanceRecordedBy: null, attendanceRecordedAt: null, exceptionResolution: null, ...spec };
}

export const SESSIONS: readonly SessionFixture[] = Object.freeze([
  // T-2026-0002 (released 14 Sep 2026) ------------------------------------------------------------------
  {
    id: 41,
    tenantId: KWU,
    tenderId: 2,
    lotId: null,
    sessionType: 'briefing',
    title: 'Pre-quotation briefing',
    startsAt: '2026-09-16T08:00:00Z',
    endsAt: '2026-09-16T09:30:00Z',
    venue: 'Online meeting; the joining link is sent to registered contacts.',
    instructions: 'Questions raised at the briefing are answered in the minutes and shared with every participant.',
    capacity: 40,
    mandatory: false,
    alternativeOfId: null,
    accessibilityInfo: 'Live captions are available on request.',
    registrationDeadline: '2026-09-15T13:00:00Z',
    minutesPublishedAt: '2026-09-17T14:00:00Z',
    status: 'completed',
    cancellationReason: null,
    registrations: [
      registration({
        id: 501,
        supplierTenantId: TENANT_IDS['gaborone-meter'],
        registeredBy: 37,
        attendeeNames: ['Kagiso Metsi', 'Omphile Ditshego'],
        accessibilityNeeds: null,
        status: 'attended',
        attendanceRecordedBy: 5,
        attendanceRecordedAt: '2026-09-16T09:45:00Z',
        createdAt: '2026-09-14T08:10:00Z',
      }),
      registration({
        id: 502,
        supplierTenantId: TENANT_IDS.tsodilo,
        registeredBy: 25,
        attendeeNames: ['Boago Moremi'],
        accessibilityNeeds: null,
        status: 'attended',
        attendanceRecordedBy: 5,
        attendanceRecordedAt: '2026-09-16T09:45:00Z',
        createdAt: '2026-09-14T11:00:00Z',
      }),
      registration({
        id: 503,
        supplierTenantId: TENANT_IDS['chobe-pipe'],
        registeredBy: 29,
        attendeeNames: ['Bakang Chobe'],
        accessibilityNeeds: null,
        status: 'absent',
        attendanceRecordedBy: 5,
        attendanceRecordedAt: '2026-09-16T09:45:00Z',
        createdAt: '2026-09-15T07:30:00Z',
      }),
      registration({
        id: 504,
        supplierTenantId: TENANT_IDS['serowe-ict'],
        registeredBy: 33,
        attendeeNames: ['Otsile Serowe'],
        accessibilityNeeds: 'Live captions for one attendee.',
        status: 'attended',
        attendanceRecordedBy: 5,
        attendanceRecordedAt: '2026-09-16T09:45:00Z',
        createdAt: '2026-09-15T10:15:00Z',
      }),
    ],
    history: [
      { at: '2026-09-14T09:00:00Z', action: 'scheduled', actorUserId: 5, note: null },
      { at: '2026-09-16T09:45:00Z', action: 'attendance_recorded', actorUserId: 5, note: 'Three attended, one absent.' },
      { at: '2026-09-17T14:00:00Z', action: 'minutes_published', actorUserId: 5, note: 'One shared answer.' },
    ],
  },
  {
    id: 49,
    tenantId: KWU,
    tenderId: 2,
    lotId: 201,
    sessionType: 'site_visit',
    title: 'Site visit — Gaborone central stores and meter test bench',
    startsAt: '2026-09-28T07:00:00Z',
    endsAt: '2026-09-28T09:00:00Z',
    venue: 'KWU central stores, Gaborone West industrial, gate 2.',
    instructions: 'Shows the receiving bay, the storage racks and the meter test bench used for acceptance testing.',
    capacity: 12,
    mandatory: false,
    alternativeOfId: null,
    accessibilityInfo: 'The stores and the test laboratory are on the ground floor with step-free access.',
    registrationDeadline: '2026-09-25T13:00:00Z',
    minutesPublishedAt: null,
    status: 'completed',
    cancellationReason: null,
    registrations: [
      registration({
        id: 517,
        supplierTenantId: TENANT_IDS['gaborone-meter'],
        registeredBy: 37,
        attendeeNames: ['Kagiso Metsi'],
        accessibilityNeeds: null,
        status: 'attended',
        attendanceRecordedBy: 5,
        attendanceRecordedAt: '2026-09-28T09:15:00Z',
        createdAt: '2026-09-21T08:30:00Z',
      }),
      registration({
        id: 518,
        supplierTenantId: TENANT_IDS['serowe-ict'],
        registeredBy: 33,
        attendeeNames: ['Otsile Serowe', 'Lame Serowe'],
        accessibilityNeeds: 'One attendee uses crutches; a seat during the test bench demonstration.',
        status: 'attended',
        attendanceRecordedBy: 5,
        attendanceRecordedAt: '2026-09-28T09:15:00Z',
        createdAt: '2026-09-22T12:00:00Z',
      }),
      registration({
        id: 519,
        supplierTenantId: TENANT_IDS['chobe-pipe'],
        registeredBy: 29,
        attendeeNames: ['Bakang Chobe'],
        accessibilityNeeds: null,
        status: 'absent',
        attendanceRecordedBy: 5,
        attendanceRecordedAt: '2026-09-28T09:15:00Z',
        createdAt: '2026-09-24T09:40:00Z',
      }),
    ],
    // Held on 28 Sep, before the storyline "now" (demo-clock.ts): attendance is recorded, the minutes are not yet
    // published (BUY-18 continues with the minutes and their shared answers).
    history: [
      { at: '2026-09-18T08:00:00Z', action: 'scheduled', actorUserId: 5, note: null },
      { at: '2026-09-28T09:15:00Z', action: 'attendance_recorded', actorUserId: 5, note: 'Two attended, one absent.' },
    ],
  },
  {
    id: 42,
    tenantId: KWU,
    tenderId: 2,
    lotId: null,
    sessionType: 'briefing',
    title: 'Addendum 1 information session',
    startsAt: '2026-10-07T08:00:00Z',
    endsAt: '2026-10-07T09:00:00Z',
    venue: 'Online meeting; the joining link is sent to registered contacts.',
    instructions: 'Explains the OIML R49 requirement and how suppliers who already submitted provide the supplement.',
    capacity: 30,
    mandatory: false,
    alternativeOfId: null,
    accessibilityInfo: 'Live captions and a sign language interpreter are available on request.',
    registrationDeadline: '2026-10-06T13:00:00Z',
    minutesPublishedAt: null,
    status: 'scheduled',
    cancellationReason: null,
    registrations: [
      registration({
        id: 505,
        supplierTenantId: TENANT_IDS['gaborone-meter'],
        registeredBy: 37,
        attendeeNames: ['Kagiso Metsi'],
        accessibilityNeeds: null,
        status: 'registered',
        createdAt: '2026-09-25T08:00:00Z',
      }),
      registration({
        id: 506,
        supplierTenantId: TENANT_IDS.tsodilo,
        registeredBy: 25,
        attendeeNames: ['Boago Moremi', 'Ditiro Kebonang'],
        accessibilityNeeds: 'Sign language interpreter for one attendee.',
        status: 'registered',
        createdAt: '2026-09-26T12:30:00Z',
      }),
    ],
    history: [{ at: '2026-09-24T09:00:00Z', action: 'scheduled', actorUserId: 5, note: null }],
  },

  // T-2026-0006 (released 21 Sep 2026, invitation only) --------------------------------------------------
  {
    id: 43,
    tenantId: KWU,
    tenderId: 6,
    lotId: null,
    sessionType: 'site_visit',
    title: 'Mandatory site visit — Mmashoro water treatment works',
    startsAt: '2026-10-08T07:00:00Z',
    endsAt: '2026-10-08T10:00:00Z',
    venue: 'Mmashoro water treatment works, main gatehouse.',
    instructions: 'Safety boots and hard hats are required. Attendance at this visit or its alternative date is a condition of participation.',
    capacity: 4,
    mandatory: true,
    alternativeOfId: null,
    accessibilityInfo: 'The dosing building has a ramp; the clarifier walkway is reached by stairs only.',
    registrationDeadline: '2026-10-06T13:00:00Z',
    minutesPublishedAt: null,
    status: 'scheduled',
    cancellationReason: null,
    registrations: [
      registration({
        id: 507,
        supplierTenantId: TENANT_IDS.tsodilo,
        registeredBy: 25,
        attendeeNames: ['Boago Moremi', 'Ditiro Kebonang'],
        accessibilityNeeds: 'Step-free route for one attendee who uses a wheelchair.',
        status: 'registered',
        createdAt: '2026-09-22T09:00:00Z',
      }),
      registration({
        id: 508,
        supplierTenantId: TENANT_IDS['chobe-pipe'],
        registeredBy: 29,
        attendeeNames: ['Bakang Chobe'],
        accessibilityNeeds: null,
        status: 'registered',
        createdAt: '2026-09-23T14:20:00Z',
      }),
    ],
    history: [{ at: '2026-09-21T09:00:00Z', action: 'scheduled', actorUserId: 5, note: 'Declared mandatory in the invitation.' }],
  },
  {
    id: 44,
    tenantId: KWU,
    tenderId: 6,
    lotId: null,
    sessionType: 'site_visit',
    title: 'Mandatory site visit — Mmashoro water treatment works (alternative date)',
    startsAt: '2026-10-09T07:00:00Z',
    endsAt: '2026-10-09T10:00:00Z',
    venue: 'Mmashoro water treatment works, main gatehouse.',
    instructions: 'Same programme as the visit of 8 October. Attending either date meets the condition.',
    capacity: 4,
    mandatory: true,
    alternativeOfId: 43,
    accessibilityInfo: 'The dosing building has a ramp; the clarifier walkway is reached by stairs only.',
    registrationDeadline: '2026-10-07T13:00:00Z',
    minutesPublishedAt: null,
    status: 'scheduled',
    cancellationReason: null,
    registrations: [],
    history: [{ at: '2026-09-26T09:30:00Z', action: 'scheduled', actorUserId: 5, note: 'Alternative date announced by Addendum 1.' }],
  },

  // T-2026-0008 (released 24 Aug 2026) -------------------------------------------------------------------
  {
    id: 45,
    tenantId: KWU,
    tenderId: 8,
    lotId: null,
    sessionType: 'site_visit',
    title: 'Mandatory site visit — Boteti pipeline valve chambers',
    startsAt: '2026-09-03T07:30:00Z',
    endsAt: '2026-09-03T11:00:00Z',
    venue: 'Boteti pump station, Letlhakane road.',
    instructions: 'Bring a four-wheel-drive vehicle; chambers 7 and 8 are off-road.',
    capacity: 6,
    mandatory: true,
    alternativeOfId: null,
    accessibilityInfo: 'Chamber access is by ladder only; a photographic record is available on request.',
    registrationDeadline: '2026-09-01T13:00:00Z',
    minutesPublishedAt: '2026-09-04T12:00:00Z',
    status: 'completed',
    cancellationReason: null,
    registrations: [
      registration({
        id: 509,
        supplierTenantId: TENANT_IDS['chobe-pipe'],
        registeredBy: 29,
        attendeeNames: ['Bakang Chobe', 'Thabo Maano'],
        accessibilityNeeds: null,
        status: 'attended',
        attendanceRecordedBy: 5,
        attendanceRecordedAt: '2026-09-03T11:15:00Z',
        createdAt: '2026-08-26T08:00:00Z',
      }),
      registration({
        id: 510,
        supplierTenantId: TENANT_IDS.tsodilo,
        registeredBy: 25,
        attendeeNames: ['Boago Moremi'],
        accessibilityNeeds: null,
        status: 'attended',
        attendanceRecordedBy: 5,
        attendanceRecordedAt: '2026-09-03T11:15:00Z',
        createdAt: '2026-08-27T10:00:00Z',
      }),
      registration({
        id: 511,
        supplierTenantId: TENANT_IDS.makgadikgadi,
        registeredBy: 40,
        attendeeNames: ['Sethunya Makgadi'],
        accessibilityNeeds: null,
        status: 'absent',
        attendanceRecordedBy: 5,
        attendanceRecordedAt: '2026-09-03T11:15:00Z',
        createdAt: '2026-08-28T15:45:00Z',
      }),
    ],
    history: [
      { at: '2026-08-24T09:00:00Z', action: 'scheduled', actorUserId: 5, note: 'Declared mandatory in the tender document.' },
      { at: '2026-09-03T11:15:00Z', action: 'attendance_recorded', actorUserId: 5, note: 'Two attended, one absent.' },
      { at: '2026-09-04T12:00:00Z', action: 'minutes_published', actorUserId: 5, note: 'One shared answer.' },
    ],
  },

  // T-2026-0001 (released 15 Jun 2026; timetable: optional visit to the Serowe wellfield on 1 Jul) --------
  {
    id: 46,
    tenantId: KWU,
    tenderId: 1,
    lotId: 101,
    sessionType: 'site_visit',
    title: 'Site visit — Serowe wellfield',
    startsAt: '2026-07-01T07:00:00Z',
    endsAt: '2026-07-01T12:00:00Z',
    venue: 'KWU depot, Serowe; transport to the wellfield leaves the depot at 09:15.',
    instructions: 'Optional visit to the lot 1 boreholes. Bring a copy of the specification schedule.',
    capacity: 8,
    mandatory: false,
    alternativeOfId: null,
    accessibilityInfo: 'Borehole heads are on uneven ground.',
    registrationDeadline: '2026-06-29T13:00:00Z',
    minutesPublishedAt: '2026-07-02T10:00:00Z',
    status: 'completed',
    cancellationReason: null,
    registrations: [
      registration({
        id: 512,
        supplierTenantId: TENANT_IDS.tsodilo,
        registeredBy: 25,
        attendeeNames: ['Boago Moremi'],
        accessibilityNeeds: null,
        status: 'attended',
        attendanceRecordedBy: 5,
        attendanceRecordedAt: '2026-07-01T12:10:00Z',
        createdAt: '2026-06-22T09:00:00Z',
      }),
      registration({
        id: 513,
        supplierTenantId: TENANT_IDS['chobe-pipe'],
        registeredBy: 29,
        attendeeNames: ['Bakang Chobe'],
        accessibilityNeeds: null,
        status: 'absent',
        attendanceRecordedBy: 5,
        attendanceRecordedAt: '2026-07-01T12:10:00Z',
        createdAt: '2026-06-23T09:00:00Z',
      }),
      registration({
        id: 514,
        supplierTenantId: TENANT_IDS.makgadikgadi,
        registeredBy: 40,
        attendeeNames: ['Sethunya Makgadi'],
        accessibilityNeeds: null,
        status: 'attended',
        attendanceRecordedBy: 5,
        attendanceRecordedAt: '2026-07-01T12:10:00Z',
        createdAt: '2026-06-24T12:00:00Z',
      }),
    ],
    history: [
      { at: '2026-06-15T09:00:00Z', action: 'scheduled', actorUserId: 5, note: null },
      { at: '2026-07-01T12:10:00Z', action: 'attendance_recorded', actorUserId: 5, note: null },
      { at: '2026-07-02T10:00:00Z', action: 'minutes_published', actorUserId: 5, note: 'One shared answer.' },
    ],
  },

  // T-2026-0003 (released 20 Jul 2026) -------------------------------------------------------------------
  {
    id: 47,
    tenantId: KWU,
    tenderId: 3,
    lotId: null,
    sessionType: 'briefing',
    title: 'Supplier briefing — SCADA telemetry upgrade',
    startsAt: '2026-07-29T08:00:00Z',
    endsAt: '2026-07-29T10:00:00Z',
    venue: 'KWU head office, Gaborone, boardroom 2.',
    instructions: null,
    capacity: 20,
    mandatory: false,
    alternativeOfId: null,
    accessibilityInfo: 'Step-free access through the main entrance.',
    registrationDeadline: '2026-07-27T13:00:00Z',
    minutesPublishedAt: null,
    status: 'cancelled',
    cancellationReason: 'Replaced by written clarifications after the venue became unavailable.',
    registrations: [
      registration({
        id: 516,
        supplierTenantId: TENANT_IDS['serowe-ict'],
        registeredBy: 33,
        attendeeNames: ['Otsile Serowe'],
        accessibilityNeeds: null,
        status: 'cancelled',
        createdAt: '2026-07-22T08:00:00Z',
      }),
    ],
    history: [
      { at: '2026-07-20T09:00:00Z', action: 'scheduled', actorUserId: 5, note: null },
      { at: '2026-07-24T12:00:00Z', action: 'cancelled', actorUserId: 5, note: 'Registered suppliers notified.' },
    ],
  },

  // T-2026-0007 (released 11 May 2026; timetable: mandatory briefing 22 May, site visit 27 May) ----------
  {
    id: 71,
    tenantId: KWU,
    tenderId: 7,
    lotId: null,
    sessionType: 'briefing',
    title: 'Mandatory briefing — Kgale Hill reservoir',
    startsAt: '2026-05-22T07:00:00Z',
    endsAt: '2026-05-22T09:00:00Z',
    venue: 'Kgale Hill reservoir, valve house.',
    instructions: 'Attendance is a condition of participation. The visit of 27 May repeats the briefing for suppliers who cannot attend.',
    capacity: 15,
    mandatory: true,
    alternativeOfId: null,
    accessibilityInfo: 'The valve house is step-free; the reservoir roof is reached by a steel stair.',
    registrationDeadline: '2026-05-20T13:00:00Z',
    minutesPublishedAt: '2026-05-25T09:00:00Z',
    status: 'completed',
    cancellationReason: null,
    registrations: [
      registration({
        id: 531,
        supplierTenantId: TENANT_IDS.makgadikgadi,
        registeredBy: 40,
        attendeeNames: ['Sethunya Makgadi', 'Kgomotso Moeng'],
        accessibilityNeeds: null,
        status: 'attended',
        attendanceRecordedBy: 5,
        attendanceRecordedAt: '2026-05-22T09:10:00Z',
        createdAt: '2026-05-13T08:00:00Z',
      }),
      registration({
        id: 532,
        supplierTenantId: TENANT_IDS['limpopo-env'],
        registeredBy: 41,
        attendeeNames: ['Mothusi Limpopo'],
        accessibilityNeeds: null,
        status: 'attended',
        attendanceRecordedBy: 5,
        attendanceRecordedAt: '2026-05-22T09:10:00Z',
        createdAt: '2026-05-14T10:30:00Z',
      }),
      registration({
        id: 533,
        supplierTenantId: TENANT_IDS.tsodilo,
        registeredBy: 25,
        attendeeNames: ['Boago Moremi'],
        accessibilityNeeds: null,
        status: 'absent',
        attendanceRecordedBy: 5,
        attendanceRecordedAt: '2026-05-22T09:10:00Z',
        createdAt: '2026-05-15T09:00:00Z',
        exceptionResolution: {
          resolution: 'offer_alternative',
          note: 'Vehicle breakdown reported before the briefing; offered the published repeat on 27 May like any absent supplier.',
          resolvedAt: '2026-05-22T14:00:00Z',
          resolvedBy: 5,
          alternativeSessionId: 72,
        },
      }),
    ],
    history: [
      { at: '2026-05-11T09:00:00Z', action: 'scheduled', actorUserId: 5, note: 'Declared mandatory in the tender document.' },
      { at: '2026-05-22T09:10:00Z', action: 'attendance_recorded', actorUserId: 5, note: 'Two attended, one absent.' },
      {
        at: '2026-05-22T14:00:00Z',
        action: 'attendance_exception_resolved',
        actorUserId: 5,
        note: 'Tsodilo Engineering: offered the repeat briefing on 27 May.',
      },
      { at: '2026-05-25T09:00:00Z', action: 'minutes_published', actorUserId: 5, note: 'One shared answer.' },
    ],
  },
  {
    id: 72,
    tenantId: KWU,
    tenderId: 7,
    lotId: null,
    sessionType: 'site_visit',
    title: 'Site visit with repeat briefing — Kgale Hill reservoir',
    startsAt: '2026-05-27T07:00:00Z',
    endsAt: '2026-05-27T10:00:00Z',
    venue: 'Kgale Hill reservoir, valve house.',
    instructions: 'Repeats the mandatory briefing of 22 May, followed by the inspection of the reservoir roof and inlet chamber.',
    capacity: 10,
    mandatory: true,
    alternativeOfId: 71,
    accessibilityInfo: 'The valve house is step-free; the reservoir roof is reached by a steel stair.',
    registrationDeadline: '2026-05-26T13:00:00Z',
    minutesPublishedAt: '2026-05-28T09:00:00Z',
    status: 'completed',
    cancellationReason: null,
    registrations: [
      registration({
        id: 534,
        supplierTenantId: TENANT_IDS.tsodilo,
        registeredBy: 25,
        attendeeNames: ['Boago Moremi'],
        accessibilityNeeds: null,
        status: 'attended',
        attendanceRecordedBy: 5,
        attendanceRecordedAt: '2026-05-27T10:05:00Z',
        createdAt: '2026-05-22T14:10:00Z',
      }),
      registration({
        id: 535,
        supplierTenantId: TENANT_IDS.makgadikgadi,
        registeredBy: 40,
        attendeeNames: ['Kgomotso Moeng'],
        accessibilityNeeds: null,
        status: 'attended',
        attendanceRecordedBy: 5,
        attendanceRecordedAt: '2026-05-27T10:05:00Z',
        createdAt: '2026-05-23T08:00:00Z',
      }),
    ],
    history: [
      { at: '2026-05-11T09:00:00Z', action: 'scheduled', actorUserId: 5, note: 'Published alternative of the mandatory briefing.' },
      { at: '2026-05-27T10:05:00Z', action: 'attendance_recorded', actorUserId: 5, note: null },
      { at: '2026-05-28T09:00:00Z', action: 'minutes_published', actorUserId: 5, note: 'No questions were raised.' },
    ],
  },

  // T-2026-0011 (ODC, released 16 Sep 2026) ------------------------------------------------------------
  {
    id: 51,
    tenantId: TENANT_IDS.odc,
    tenderId: 11,
    lotId: 1101,
    sessionType: 'site_visit',
    title: 'Site walk-through — Maun council offices',
    startsAt: '2026-10-15T07:00:00Z',
    endsAt: '2026-10-15T09:00:00Z',
    venue: 'Okavango District Council, Maun, main reception.',
    instructions: 'The walk-through covers the main offices and the library annex.',
    capacity: 10,
    mandatory: false,
    alternativeOfId: null,
    accessibilityInfo: 'All floors are reachable by lift.',
    registrationDeadline: '2026-10-13T13:00:00Z',
    minutesPublishedAt: null,
    status: 'scheduled',
    cancellationReason: null,
    registrations: [
      registration({
        id: 521,
        supplierTenantId: TENANT_IDS['limpopo-env'],
        registeredBy: 41,
        attendeeNames: ['Mothusi Limpopo'],
        accessibilityNeeds: null,
        status: 'registered',
        createdAt: '2026-09-22T09:30:00Z',
      }),
    ],
    history: [{ at: '2026-09-20T08:00:00Z', action: 'scheduled', actorUserId: 23, note: null }],
  },
]);
