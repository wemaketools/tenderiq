/**
 * Calendars contract: working calendars, holidays and the impact review of changes on active events (ADM-10;
 * BR-12; blueprint Migration 02 `calendars`, `calendar_holidays`).
 *
 * - Working-day deadline arithmetic uses the event's approved calendar (BR-12). A holiday change on a calendar in
 *   use requires a review of the affected deadlines first: `impact-review` lists them without changing anything.
 *   A calendar change never moves a published deadline by itself; that needs an addendum (BR-16).
 * - Calendars move `draft` → `approved` → `retired`; retired calendars stay interpretable on historic events.
 */
import { z } from 'zod';

import {
  CalendarDate,
  Id,
  IdParam,
  Instant,
  OfficialDeadline,
  PersonRef,
  ReasonText,
  TimeZone,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
  QueryBoolean,
} from './common.js';
import { defineEndpoint } from './endpoint.js';
import type { EndpointPermission } from './endpoint.js';
import {
  CalendarsStatus,
  NoticesPeriodStartBasis,
  NotificationRulesEventType,
  TenderMilestonesMilestone,
  TendersStatus,
} from './enums.js';

/** ISO day of week: 1 = Monday … 7 = Sunday (`calendars.working_days`). */
export const IsoWeekday = z
  .number()
  .int()
  .min(1, issue('INVALID_WEEKDAY', 'Use 1 (Monday) to 7 (Sunday).'))
  .max(7, issue('INVALID_WEEKDAY', 'Use 1 (Monday) to 7 (Sunday).'));

export const WorkingDays = z
  .array(IsoWeekday)
  .min(1, issue('WORKING_DAYS_REQUIRED', 'Choose at least one working day.'))
  .refine((days) => new Set(days).size === days.length, issue('DUPLICATE_WEEKDAY', 'Each day may appear once.'));

/** A holiday (`calendar_holidays`). */
export const CalendarHoliday = z.object({
  id: Id,
  date: CalendarDate,
  name: z.string().min(1),
});
export type CalendarHoliday = z.infer<typeof CalendarHoliday>;

/** A calendar row in the list. */
export const CalendarSummary = z.object({
  id: Id,
  name: z.string().min(1),
  timeZone: TimeZone,
  workingDays: z.array(IsoWeekday),
  isDefault: z.boolean(),
  active: z.boolean(),
  status: CalendarsStatus,
  approvedBy: PersonRef.nullable(),
  approvedAt: Instant.nullable(),
  holidayCount: z.number().int().min(0),
  /** Events not yet closed that use this calendar. */
  activeEventCount: z.number().int().min(0),
  updatedAt: Instant,
  /** Who drafted the calendar; the approver must be someone else (BR-07). */
  createdBy: PersonRef.nullable().optional(),
  /** First and last holiday dates, for the list. */
  coverageFrom: CalendarDate.nullable().optional(),
  coverageTo: CalendarDate.nullable().optional(),
});
export type CalendarSummary = z.infer<typeof CalendarSummary>;

/** An event that uses the calendar. */
export const CalendarUsage = z.object({
  tenderId: Id,
  reference: z.string().min(1),
  title: z.string().min(1),
  status: TendersStatus,
});
export type CalendarUsage = z.infer<typeof CalendarUsage>;

/** What the caller may do with the calendar now. */
export const CalendarCapabilities = z.object({
  canEdit: z.boolean(),
  canApprove: z.boolean(),
  canRetire: z.boolean(),
  canSetDefault: z.boolean(),
  /** Why approval is not available to the caller (for example self-approval, BR-07). */
  approveBlockedReason: z.enum(['not_draft', 'self_approval', 'permission_missing']).nullable().optional(),
});

export const CalendarDetail = CalendarSummary.extend({
  holidays: z.array(CalendarHoliday),
  usedBy: z.array(CalendarUsage),
  capabilities: CalendarCapabilities,
});
export type CalendarDetail = z.infer<typeof CalendarDetail>;

/** Anyone who maintains calendars or picks one for an event may read them. */
/** Calendar reads; `support.view` lets an operator under a support grant read this configuration (surface `metadata`). */
const CALENDAR_READ: EndpointPermission = ['org.calendars.manage', 'tender.edit', 'tender.view', 'support.view'];

export const CALENDAR_SORT_FIELDS = ['name', 'status', 'updatedAt'] as const;

export const CalendarListQuery = listQueryWithSort(CALENDAR_SORT_FIELDS).extend({
  status: queryList(CalendarsStatus).optional(),
  active: QueryBoolean.optional(),
});
export type CalendarListQuery = z.input<typeof CalendarListQuery>;

export const CalendarPage = pageOf(CalendarSummary);
export type CalendarPage = z.infer<typeof CalendarPage>;

export const CalendarParams = z.object({ calendarId: IdParam });
export const HolidayParams = z.object({ calendarId: IdParam, holidayId: IdParam });

/** GET /api/v1/buyer/calendars (ADM-10). */
export const listCalendars = defineEndpoint({
  id: 'buyer.calendars.list',
  method: 'GET',
  path: '/api/v1/buyer/calendars',
  audience: 'buyer',
  permission: CALENDAR_READ,
  support: 'metadata',
  query: CalendarListQuery,
  response: CalendarPage,
  errors: [],
  screens: ['ADM-10', 'BUY-08'],
});

/** GET /api/v1/buyer/calendars/:calendarId (ADM-10). */
export const getCalendar = defineEndpoint({
  id: 'buyer.calendars.get',
  method: 'GET',
  path: '/api/v1/buyer/calendars/:calendarId',
  audience: 'buyer',
  permission: CALENDAR_READ,
  support: 'metadata',
  params: CalendarParams,
  response: CalendarDetail,
  errors: ['CALENDAR_NOT_FOUND'],
  screens: ['ADM-10'],
});

export const CreateCalendarBody = z.object({
  name: z.string().trim().min(1, issue('NAME_REQUIRED', 'A name is required.')).max(200),
  timeZone: TimeZone,
  workingDays: WorkingDays,
});
export type CreateCalendarBody = z.infer<typeof CreateCalendarBody>;

/** POST /api/v1/buyer/calendars: a new draft calendar. */
export const createCalendar = defineEndpoint({
  id: 'buyer.calendars.create',
  method: 'POST',
  path: '/api/v1/buyer/calendars',
  audience: 'buyer',
  permission: 'org.calendars.manage',
  body: CreateCalendarBody,
  response: CalendarDetail,
  idempotent: true,
  errors: ['CALENDAR_NAME_TAKEN'],
  screens: ['ADM-10'],
});

export const UpdateCalendarBody = CreateCalendarBody.extend({
  /** Required when an approved calendar used by active events changes its working days: the impact review was seen (BR-12). */
  impactReviewed: z.boolean().default(false),
});
export type UpdateCalendarBody = z.input<typeof UpdateCalendarBody>;

/** PUT /api/v1/buyer/calendars/:calendarId: edits a draft; an approved calendar in use needs an impact review first. */
export const updateCalendar = defineEndpoint({
  id: 'buyer.calendars.update',
  method: 'PUT',
  path: '/api/v1/buyer/calendars/:calendarId',
  audience: 'buyer',
  permission: 'org.calendars.manage',
  params: CalendarParams,
  body: UpdateCalendarBody,
  response: CalendarDetail,
  errors: ['CALENDAR_NOT_FOUND', 'CALENDAR_RETIRED', 'CALENDAR_NAME_TAKEN', 'IMPACT_REVIEW_REQUIRED'],
  screens: ['ADM-10'],
});

export const AddHolidayBody = z.object({
  date: CalendarDate,
  name: z.string().trim().min(1, issue('NAME_REQUIRED', 'A name is required.')).max(200),
  /** Required when the calendar is used by active events: confirms the impact review was seen (BR-12). */
  impactReviewed: z.boolean().default(false),
});
export type AddHolidayBody = z.input<typeof AddHolidayBody>;

/** POST /api/v1/buyer/calendars/:calendarId/holidays. */
export const addHoliday = defineEndpoint({
  id: 'buyer.calendars.addHoliday',
  method: 'POST',
  path: '/api/v1/buyer/calendars/:calendarId/holidays',
  audience: 'buyer',
  permission: 'org.calendars.manage',
  params: CalendarParams,
  body: AddHolidayBody,
  response: CalendarDetail,
  idempotent: true,
  errors: ['CALENDAR_NOT_FOUND', 'CALENDAR_RETIRED', 'HOLIDAY_ALREADY_EXISTS', 'IMPACT_REVIEW_REQUIRED'],
  screens: ['ADM-10'],
});

export const RemoveHolidayQuery = z.object({
  impactReviewed: QueryBoolean.default(false),
});

/** DELETE /api/v1/buyer/calendars/:calendarId/holidays/:holidayId. */
export const removeHoliday = defineEndpoint({
  id: 'buyer.calendars.removeHoliday',
  method: 'DELETE',
  path: '/api/v1/buyer/calendars/:calendarId/holidays/:holidayId',
  audience: 'buyer',
  permission: 'org.calendars.manage',
  params: HolidayParams,
  query: RemoveHolidayQuery,
  response: CalendarDetail,
  errors: ['CALENDAR_NOT_FOUND', 'HOLIDAY_NOT_FOUND', 'CALENDAR_RETIRED', 'IMPACT_REVIEW_REQUIRED'],
  screens: ['ADM-10'],
});

export const ImpactReviewBody = z.object({
  addHolidays: z.array(z.object({ date: CalendarDate, name: z.string().trim().min(1).max(200) })).default([]),
  removeHolidayIds: z.array(Id).default([]),
  workingDays: WorkingDays.optional(),
});
export type ImpactReviewBody = z.input<typeof ImpactReviewBody>;

/** One deadline whose working-day computation the proposed change affects. */
export const CalendarImpactItem = z.object({
  tenderId: Id,
  reference: z.string().min(1),
  title: z.string().min(1),
  status: TendersStatus,
  lotId: Id.nullable(),
  milestone: TenderMilestonesMilestone,
  deadline: OfficialDeadline,
  /** Working days between publication (or now) and the deadline, before and after the change. */
  workingDaysBefore: z.number().int().min(0),
  workingDaysAfter: z.number().int().min(0),
  /** The deadline falls on a day that would no longer be a working day. */
  fallsOnNonWorkingDay: z.boolean(),
});
export type CalendarImpactItem = z.infer<typeof CalendarImpactItem>;

export const CalendarImpact = z.object({
  calendarId: Id,
  items: z.array(CalendarImpactItem),
  /** Deadlines are never moved by a calendar change; an affected event needs its own decision and addendum. */
  requiresReview: z.boolean(),
});
export type CalendarImpact = z.infer<typeof CalendarImpact>;

/** POST /api/v1/buyer/calendars/:calendarId/impact-review: lists affected deadlines; changes nothing (BR-12). */
export const reviewCalendarImpact = defineEndpoint({
  id: 'buyer.calendars.impactReview',
  method: 'POST',
  path: '/api/v1/buyer/calendars/:calendarId/impact-review',
  audience: 'buyer',
  permission: 'org.calendars.manage',
  params: CalendarParams,
  body: ImpactReviewBody,
  response: CalendarImpact,
  errors: ['CALENDAR_NOT_FOUND', 'HOLIDAY_NOT_FOUND'],
  screens: ['ADM-10'],
});

export const ApproveCalendarBody = z.object({
  note: z.string().trim().max(1000).optional(),
});

/** POST /api/v1/buyer/calendars/:calendarId/approve: a draft becomes usable for events. */
export const approveCalendar = defineEndpoint({
  id: 'buyer.calendars.approve',
  method: 'POST',
  path: '/api/v1/buyer/calendars/:calendarId/approve',
  audience: 'buyer',
  permission: 'org.calendars.manage',
  params: CalendarParams,
  body: ApproveCalendarBody,
  response: CalendarDetail,
  errors: ['CALENDAR_NOT_FOUND', 'CALENDAR_NOT_DRAFT', 'SOD_SELF_APPROVAL_BLOCKED'],
  screens: ['ADM-10'],
});

export const RetireCalendarBody = z.object({
  reason: ReasonText,
});

/** POST /api/v1/buyer/calendars/:calendarId/retire: no new events may use it; historic events keep it. */
export const retireCalendar = defineEndpoint({
  id: 'buyer.calendars.retire',
  method: 'POST',
  path: '/api/v1/buyer/calendars/:calendarId/retire',
  audience: 'buyer',
  permission: 'org.calendars.manage',
  params: CalendarParams,
  body: RetireCalendarBody,
  response: CalendarDetail,
  errors: ['CALENDAR_NOT_FOUND', 'CALENDAR_RETIRED', 'CALENDAR_IS_DEFAULT', 'CALENDAR_IN_USE'],
  screens: ['ADM-10'],
});

/** POST /api/v1/buyer/calendars/:calendarId/set-default: the organization default (`org_settings.default_calendar_id`). */
export const setDefaultCalendar = defineEndpoint({
  id: 'buyer.calendars.setDefault',
  method: 'POST',
  path: '/api/v1/buyer/calendars/:calendarId/set-default',
  audience: 'buyer',
  permission: 'org.calendars.manage',
  params: CalendarParams,
  response: CalendarDetail,
  errors: ['CALENDAR_NOT_FOUND', 'CALENDAR_NOT_APPROVED'],
  screens: ['ADM-10'],
});

/** One deadline reminder policy: when reminders go out before a deadline and when overdue work escalates. */
export const DeadlineReminderPolicy = z.object({
  eventType: NotificationRulesEventType,
  ruleId: Id.nullable(),
  mandatory: z.boolean(),
  active: z.boolean(),
  /** Hours before the deadline at which reminders are sent, largest first. */
  reminderOffsetsHours: z.array(z.number().int().min(1)),
  escalateAfterHours: z.number().int().min(1).nullable(),
  escalationRole: z.string().nullable(),
});
export type DeadlineReminderPolicy = z.infer<typeof DeadlineReminderPolicy>;

/** The organization's deadline policy (ADM-10): official zone, default calendar, reminder periods and notice rules. */
export const DeadlinePolicy = z.object({
  /** Authoritative on the tenant (DD-10); every deadline renders in this zone with its offset (BR-11, DD-33). */
  officialTimeZone: TimeZone,
  defaultCalendar: CalendarSummary.nullable(),
  reminders: z.array(DeadlineReminderPolicy),
  /** What starts a notice period under the adopted policy (PRD §14.3). */
  noticePeriodStartBasis: NoticesPeriodStartBasis,
  /** Minimum working days between an addendum that changes requirements and the submission deadline. */
  minimumAddendumResponseWorkingDays: z.number().int().min(0),
  /** A calendar change never moves a published deadline; affected events need an addendum (BR-12, BR-16). */
  calendarChangesMoveDeadlines: z.literal(false),
});
export type DeadlinePolicy = z.infer<typeof DeadlinePolicy>;

/** GET /api/v1/buyer/deadline-policy: the reminder periods and notice rules that apply with the calendars (ADM-10). */
export const getDeadlinePolicy = defineEndpoint({
  id: 'buyer.calendars.deadlinePolicy',
  method: 'GET',
  path: '/api/v1/buyer/deadline-policy',
  audience: 'buyer',
  permission: CALENDAR_READ,
  support: 'metadata',
  response: DeadlinePolicy,
  errors: [],
  screens: ['ADM-10'],
  summary: 'Reminder periods come from the notification rules (ADM-12); the official zone comes from the organization (ADM-01).',
});

/** The calendars endpoint map. */
export const calendarEndpoints = {
  listCalendars,
  getCalendar,
  createCalendar,
  updateCalendar,
  addHoliday,
  removeHoliday,
  reviewCalendarImpact,
  approveCalendar,
  retireCalendar,
  setDefaultCalendar,
  getDeadlinePolicy,
} as const;
