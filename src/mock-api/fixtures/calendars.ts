/**
 * Calendar fixtures (ADM-10; BR-11, BR-12, BR-16; blueprint `calendars`, `calendar_holidays`): the working calendars
 * of each buyer organization, their holidays, the deadlines of active events that depend on them (for the impact
 * review) and each organization's deadline policy.
 *
 * KWU uses "Botswana Public Holidays 2026" (approved, default), has the 2027 calendar in draft (drafted by Mpho
 * Dikgang, awaiting the administrator's approval), a six-day works calendar the administrator drafted herself
 * (self-approval blocked) and the retired 2025 calendar. ODC has its own approved calendar.
 */
import type { CalendarDate, Instant } from '../../contracts/common.js';
import type { CalendarsStatus, NoticesPeriodStartBasis, NotificationRulesEventType, TenderMilestonesMilestone, TendersStatus } from '../../contracts/enums.js';
import { OFFICIAL_ZONE, RECORDS, tid, uid } from './approvals/world.js';

export interface FixtureHoliday {
  readonly id: number;
  readonly date: CalendarDate;
  readonly name: string;
}

export interface FixtureCalendar {
  readonly id: number;
  readonly tenantId: number;
  readonly name: string;
  readonly timeZone: string;
  readonly workingDays: readonly number[];
  readonly isDefault: boolean;
  readonly active: boolean;
  readonly status: CalendarsStatus;
  readonly createdByUserId: number | null;
  readonly approvedByUserId: number | null;
  readonly approvedAt: Instant | null;
  readonly updatedAt: Instant;
  readonly holidays: readonly FixtureHoliday[];
}

/** A deadline of an event that uses a calendar (the working-day count runs from `countFrom`). */
export interface FixtureCalendarDeadline {
  readonly calendarId: number;
  readonly tenderId: number;
  readonly reference: string;
  readonly title: string;
  readonly status: TendersStatus;
  readonly lotId: number | null;
  readonly milestone: TenderMilestonesMilestone;
  readonly deadline: Instant;
  /** Publication (or the start of the period) from which working days are counted. */
  readonly countFrom: CalendarDate;
}

function holidays(firstId: number, rows: readonly (readonly [CalendarDate, string])[]): FixtureHoliday[] {
  return rows.map(([date, name], index) => ({ id: firstId + index, date, name }));
}

const BOTSWANA_2026 = [
  ['2026-01-01', 'New Year’s Day'],
  ['2026-01-02', 'New Year Holiday'],
  ['2026-04-03', 'Good Friday'],
  ['2026-04-04', 'Holy Saturday'],
  ['2026-04-06', 'Easter Monday'],
  ['2026-05-01', 'Labour Day'],
  ['2026-05-14', 'Ascension Day'],
  ['2026-07-01', 'Sir Seretse Khama Day'],
  ['2026-07-20', 'President’s Day'],
  ['2026-07-21', 'President’s Day Holiday'],
  ['2026-09-30', 'Botswana Day'],
  ['2026-10-01', 'Botswana Day Holiday'],
  ['2026-12-25', 'Christmas Day'],
  ['2026-12-26', 'Family Day'],
  ['2026-12-28', 'Family Day (observed)'],
] as const;

const BOTSWANA_2027 = [
  ['2027-01-01', 'New Year’s Day'],
  ['2027-01-02', 'New Year Holiday'],
  ['2027-03-26', 'Good Friday'],
  ['2027-03-27', 'Holy Saturday'],
  ['2027-03-29', 'Easter Monday'],
  ['2027-05-01', 'Labour Day'],
  ['2027-05-06', 'Ascension Day'],
  ['2027-07-01', 'Sir Seretse Khama Day'],
  ['2027-07-19', 'President’s Day'],
  ['2027-07-20', 'President’s Day Holiday'],
  ['2027-09-30', 'Botswana Day'],
  ['2027-10-01', 'Botswana Day Holiday'],
  ['2027-12-25', 'Christmas Day'],
  ['2027-12-26', 'Family Day'],
  ['2027-12-27', 'Family Day (observed)'],
] as const;

const BOTSWANA_2025 = [
  ['2025-01-01', 'New Year’s Day'],
  ['2025-01-02', 'New Year Holiday'],
  ['2025-04-18', 'Good Friday'],
  ['2025-04-19', 'Holy Saturday'],
  ['2025-04-21', 'Easter Monday'],
  ['2025-05-01', 'Labour Day'],
  ['2025-05-29', 'Ascension Day'],
  ['2025-07-01', 'Sir Seretse Khama Day'],
  ['2025-07-21', 'President’s Day'],
  ['2025-07-22', 'President’s Day Holiday'],
  ['2025-09-30', 'Botswana Day'],
  ['2025-10-01', 'Botswana Day Holiday'],
  ['2025-12-25', 'Christmas Day'],
  ['2025-12-26', 'Family Day'],
] as const;

const MON_FRI = [1, 2, 3, 4, 5] as const;

export const CALENDARS: readonly FixtureCalendar[] = Object.freeze([
  {
    id: 1,
    tenantId: tid('kwu'),
    name: 'Botswana Public Holidays 2026',
    timeZone: OFFICIAL_ZONE,
    workingDays: MON_FRI,
    isDefault: true,
    active: true,
    status: 'approved',
    createdByUserId: uid('admin.kwu'),
    approvedByUserId: uid('mpho.manager'),
    approvedAt: '2025-11-20T09:00:00Z',
    updatedAt: '2025-11-20T09:00:00Z',
    holidays: holidays(101, BOTSWANA_2026),
  },
  {
    id: 2,
    tenantId: tid('kwu'),
    name: 'Botswana Public Holidays 2027',
    timeZone: OFFICIAL_ZONE,
    workingDays: MON_FRI,
    isDefault: false,
    active: true,
    status: 'draft',
    createdByUserId: uid('mpho.manager'),
    approvedByUserId: null,
    approvedAt: null,
    updatedAt: '2026-10-02T09:00:00Z',
    holidays: holidays(201, BOTSWANA_2027),
  },
  {
    id: 3,
    tenantId: tid('kwu'),
    name: 'Northern depots — six-day works calendar 2026',
    timeZone: OFFICIAL_ZONE,
    workingDays: [1, 2, 3, 4, 5, 6],
    isDefault: false,
    active: true,
    status: 'draft',
    createdByUserId: uid('admin.kwu'),
    approvedByUserId: null,
    approvedAt: null,
    updatedAt: '2026-09-18T12:00:00Z',
    holidays: holidays(301, BOTSWANA_2026.filter(([date]) => date >= '2026-07-01')),
  },
  {
    id: 4,
    tenantId: tid('kwu'),
    name: 'Botswana Public Holidays 2025',
    timeZone: OFFICIAL_ZONE,
    workingDays: MON_FRI,
    isDefault: false,
    active: false,
    status: 'retired',
    createdByUserId: uid('admin.kwu'),
    approvedByUserId: uid('mpho.manager'),
    approvedAt: '2024-11-15T09:00:00Z',
    updatedAt: '2026-01-05T08:00:00Z',
    holidays: holidays(401, BOTSWANA_2025),
  },
  {
    id: 5,
    tenantId: tid('odc'),
    name: 'Okavango District working calendar 2026',
    timeZone: OFFICIAL_ZONE,
    workingDays: MON_FRI,
    isDefault: true,
    active: true,
    status: 'approved',
    createdByUserId: uid('officer.odc'),
    approvedByUserId: uid('admin.odc'),
    approvedAt: '2026-01-12T08:00:00Z',
    updatedAt: '2026-01-12T08:00:00Z',
    holidays: holidays(501, [...BOTSWANA_2026, ['2026-11-06', 'District council day'] as const]),
  },
] satisfies FixtureCalendar[]);

function deadline(
  key: keyof typeof RECORDS,
  status: TendersStatus,
  milestone: TenderMilestonesMilestone,
  at: Instant,
  countFrom: CalendarDate,
  calendarId = 1,
  lotId: number | null = null,
): FixtureCalendarDeadline {
  const record = RECORDS[key];
  return { calendarId, tenderId: record.id, reference: record.reference, title: record.title, status, lotId, milestone, deadline: at, countFrom };
}

/** Deadlines of events that are not closed yet, per calendar. */
export const CALENDAR_DEADLINES: readonly FixtureCalendarDeadline[] = Object.freeze([
  deadline('t2', 'open', 'questions_deadline', '2026-10-07T13:00:00Z', '2026-09-14'),
  deadline('t2', 'open', 'submission_deadline', '2026-10-21T10:00:00Z', '2026-09-14'),
  deadline('t3', 'under_assessment', 'expected_award', '2026-10-30T08:00:00Z', '2026-09-15'),
  deadline('t5', 'awaiting_release_approval', 'submission_deadline', '2026-11-18T10:00:00Z', '2026-10-19'),
  deadline('t6', 'open', 'questions_deadline', '2026-10-05T13:00:00Z', '2026-09-21'),
  deadline('t6', 'open', 'submission_deadline', '2026-10-14T10:00:00Z', '2026-09-21'),
  deadline('t7', 'award_pending', 'standstill_end', '2026-10-08T15:00:00Z', '2026-09-22'),
  deadline('t8', 'closed', 'opening', '2026-10-07T10:00:00Z', '2026-09-25'),
  deadline('t9', 'under_assessment', 'expected_award', '2026-11-27T08:00:00Z', '2026-10-01'),
  deadline('t1', 'partially_awarded', 'expected_award', '2026-10-30T08:00:00Z', '2026-09-15', 1, 103),
  deadline('t11', 'open', 'site_visit', '2026-10-15T07:00:00Z', '2026-09-21', 5, 1101),
  deadline('t11', 'open', 'submission_deadline', '2026-10-23T10:00:00Z', '2026-09-21', 5),
] satisfies FixtureCalendarDeadline[]);

/** Tenders (any status) that used each calendar, for the "used by" list. */
export const CALENDAR_USAGE: Readonly<Record<number, readonly { key: keyof typeof RECORDS; status: TendersStatus }[]>> = {
  1: [
    { key: 't1', status: 'partially_awarded' },
    { key: 't2', status: 'open' },
    { key: 't3', status: 'under_assessment' },
    { key: 't4', status: 'information_collected' },
    { key: 't5', status: 'awaiting_release_approval' },
    { key: 't6', status: 'open' },
    { key: 't7', status: 'award_pending' },
    { key: 't8', status: 'closed' },
    { key: 't9', status: 'under_assessment' },
    { key: 't10', status: 'awarded' },
  ],
  2: [],
  3: [],
  4: [],
  5: [{ key: 't11', status: 'open' }],
};

/** Tender statuses of events still in progress (a calendar change could affect them). */
export const ACTIVE_TENDER_STATUSES: readonly TendersStatus[] = [
  'awaiting_release_approval',
  'ready',
  'open',
  'closed',
  'under_assessment',
  'award_pending',
  'partially_awarded',
];

/** Deadline-related reminder events shown on ADM-10 (their offsets are maintained on ADM-12). */
export const DEADLINE_REMINDER_EVENTS: readonly NotificationRulesEventType[] = [
  'closing_approaching',
  'clarification_requested',
  'evaluation_assigned',
  'evaluation_overdue',
  'approval_needed',
  'evidence_expiring',
  'contract_milestone_due',
  'contract_expiry',
  'renewal_window',
  'task_overdue',
];

export interface FixtureDeadlinePolicy {
  readonly tenantId: number;
  readonly noticePeriodStartBasis: NoticesPeriodStartBasis;
  readonly minimumAddendumResponseWorkingDays: number;
}

export const DEADLINE_POLICIES: readonly FixtureDeadlinePolicy[] = Object.freeze([
  { tenantId: tid('kwu'), noticePeriodStartBasis: 'publication', minimumAddendumResponseWorkingDays: 5 },
  { tenantId: tid('odc'), noticePeriodStartBasis: 'transmission', minimumAddendumResponseWorkingDays: 3 },
] satisfies FixtureDeadlinePolicy[]);

/** The calendar with `id`, or `undefined`. */
export function findFixtureCalendar(id: number): FixtureCalendar | undefined {
  return CALENDARS.find((calendar) => calendar.id === id);
}
