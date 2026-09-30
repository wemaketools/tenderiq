/**
 * Mock handlers of the calendars contract (`src/contracts/calendars.ts`; ADM-10, BR-11, BR-12, BR-16).
 *
 * - Calendars are per buyer tenant. Working-day counts of the impact review are computed from the fixtures (the
 *   deadline's local date in the calendar's zone, working weekdays, holidays), so a proposed change shows its real
 *   effect. Nothing is changed: a calendar change never moves a published deadline (an addendum does, BR-16).
 * - Commands return the calendar as it would be after the change; the next GET returns the fixture again.
 */
import type {
  CalendarDetail,
  CalendarImpactItem,
  CalendarSummary,
  DeadlineReminderPolicy,
} from '../../../contracts/calendars.js';
import {
  addHoliday,
  approveCalendar,
  createCalendar,
  getCalendar,
  getDeadlinePolicy,
  listCalendars,
  removeHoliday,
  retireCalendar,
  reviewCalendarImpact,
  setDefaultCalendar,
  updateCalendar,
} from '../../../contracts/calendars.js';
import { isMandatoryNotificationEvent } from '../../../contracts/enums.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { RECORDS, storylineInstant } from '../../fixtures/approvals/world.js';
import {
  ACTIVE_TENDER_STATUSES,
  CALENDARS,
  CALENDAR_DEADLINES,
  CALENDAR_USAGE,
  DEADLINE_POLICIES,
  DEADLINE_REMINDER_EVENTS,
  findFixtureCalendar,
} from '../../fixtures/calendars.js';
import type { FixtureCalendar, FixtureHoliday } from '../../fixtures/calendars.js';
import { NOTIFICATION_RULES } from '../../fixtures/notification-rules.js';
import { personRef } from '../../persona.js';

/** Actions are stamped on the storyline clock: never before the fixtures' "as of" instant. */
function iso(date: Date): string {
  return storylineInstant(date);
}

/** The local calendar date of an instant in `timeZone` (`YYYY-MM-DD`). */
function localDate(at: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(at));
  const part = (type: string): string => parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a `YYYY-MM-DD` date. */
function isoWeekday(date: string): number {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function nextDate(date: string): string {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function isWorkingDay(date: string, workingDays: readonly number[], holidayDates: ReadonlySet<string>): boolean {
  return workingDays.includes(isoWeekday(date)) && !holidayDates.has(date);
}

/** Working days after `from` up to and including `to`. */
function workingDaysBetween(from: string, to: string, workingDays: readonly number[], holidayDates: ReadonlySet<string>): number {
  let count = 0;
  for (let date = nextDate(from); date <= to; date = nextDate(date)) {
    if (isWorkingDay(date, workingDays, holidayDates)) {
      count += 1;
    }
  }
  return count;
}

function activeEvents(calendarId: number): number {
  return (CALENDAR_USAGE[calendarId] ?? []).filter((usage) => ACTIVE_TENDER_STATUSES.includes(usage.status)).length;
}

function toSummary(calendar: FixtureCalendar): CalendarSummary {
  const dates = calendar.holidays.map((holiday) => holiday.date).sort();
  return {
    id: calendar.id,
    name: calendar.name,
    timeZone: calendar.timeZone,
    workingDays: [...calendar.workingDays],
    isDefault: calendar.isDefault,
    active: calendar.active,
    status: calendar.status,
    approvedBy: calendar.approvedByUserId === null ? null : personRef(calendar.approvedByUserId),
    approvedAt: calendar.approvedAt,
    holidayCount: calendar.holidays.length,
    activeEventCount: activeEvents(calendar.id),
    updatedAt: calendar.updatedAt,
    createdBy: calendar.createdByUserId === null ? null : personRef(calendar.createdByUserId),
    coverageFrom: dates[0] ?? null,
    coverageTo: dates[dates.length - 1] ?? null,
  };
}

function toDetail(calendar: FixtureCalendar, viewer: { userId: number; permissions: readonly PermissionCode[] }): CalendarDetail {
  const manage = viewer.permissions.includes('org.calendars.manage');
  const selfApproval = calendar.createdByUserId === viewer.userId;
  const approveBlockedReason =
    calendar.status !== 'draft' ? 'not_draft' : !manage ? 'permission_missing' : selfApproval ? 'self_approval' : null;
  return {
    ...toSummary(calendar),
    holidays: [...calendar.holidays].sort((a, b) => a.date.localeCompare(b.date)).map((holiday) => ({ ...holiday })),
    usedBy: (CALENDAR_USAGE[calendar.id] ?? []).map((usage) => {
      const record = RECORDS[usage.key];
      return { tenderId: record.id, reference: record.reference, title: record.title, status: usage.status };
    }),
    capabilities: {
      canEdit: manage && calendar.status !== 'retired',
      canApprove: approveBlockedReason === null,
      canRetire: manage && calendar.status !== 'retired' && !calendar.isDefault && activeEvents(calendar.id) === 0,
      canSetDefault: manage && calendar.status === 'approved' && !calendar.isDefault,
      approveBlockedReason,
    },
  };
}

function inUse(calendar: FixtureCalendar): boolean {
  return calendar.status === 'approved' && activeEvents(calendar.id) > 0;
}

export function register(app: MockApp): void {
  /** The calendar of the active tenant, or the 404 of the endpoint. */
  function calendarIn(tenantId: number, calendarId: number, fail: (status: number, code: string, detail?: string) => never): FixtureCalendar {
    const calendar = findFixtureCalendar(calendarId);
    if (calendar === undefined || calendar.tenantId !== tenantId) {
      return fail(404, 'CALENDAR_NOT_FOUND');
    }
    return calendar;
  }

  mockRoute(app, listCalendars, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const q = query.q?.toLowerCase();
    const rows = CALENDARS.filter(
      (calendar) =>
        calendar.tenantId === tenant.id &&
        (q === undefined || calendar.name.toLowerCase().includes(q)) &&
        (query.status === undefined || query.status.includes(calendar.status)) &&
        (query.active === undefined || calendar.active === query.active),
    );
    const sortKey = query.sort ?? 'name';
    const factor = query.dir === 'desc' ? -1 : 1;
    const value = (calendar: FixtureCalendar): string | number =>
      sortKey === 'status' ? calendar.status : sortKey === 'updatedAt' ? Date.parse(calendar.updatedAt) : calendar.name.toLowerCase();
    const ordered = [...rows].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      return factor * (left < right ? -1 : left > right ? 1 : 0);
    });
    return fixtures.page(ordered.map(toSummary));
  });

  mockRoute(app, getCalendar, ({ requireTenant, requirePersona, params, fail }) => {
    const { tenant, permissions } = requireTenant();
    return toDetail(calendarIn(tenant.id, params.calendarId, fail), { userId: requirePersona().userId, permissions });
  });

  mockRoute(app, createCalendar, ({ requireTenant, requirePersona, body, now, fail }) => {
    const { tenant, permissions } = requireTenant();
    const persona = requirePersona();
    if (CALENDARS.some((calendar) => calendar.tenantId === tenant.id && calendar.name.toLowerCase() === body.name.toLowerCase())) {
      return fail(409, 'CALENDAR_NAME_TAKEN', 'Another calendar already has this name.');
    }
    const created: FixtureCalendar = {
      id: 900,
      tenantId: tenant.id,
      name: body.name,
      timeZone: body.timeZone,
      workingDays: [...body.workingDays].sort(),
      isDefault: false,
      active: true,
      status: 'draft',
      createdByUserId: persona.userId,
      approvedByUserId: null,
      approvedAt: null,
      updatedAt: iso(now),
      holidays: [],
    };
    return toDetail(created, { userId: persona.userId, permissions });
  });

  mockRoute(app, updateCalendar, ({ requireTenant, requirePersona, params, body, now, fail }) => {
    const { tenant, permissions } = requireTenant();
    const calendar = calendarIn(tenant.id, params.calendarId, fail);
    if (calendar.status === 'retired') {
      return fail(409, 'CALENDAR_RETIRED', 'A retired calendar cannot change.');
    }
    if (CALENDARS.some((other) => other.tenantId === tenant.id && other.id !== calendar.id && other.name.toLowerCase() === body.name.toLowerCase())) {
      return fail(409, 'CALENDAR_NAME_TAKEN', 'Another calendar already has this name.');
    }
    const workingDays = [...body.workingDays].sort();
    const changesWorkingDays = workingDays.join(',') !== [...calendar.workingDays].sort().join(',') || body.timeZone !== calendar.timeZone;
    if (changesWorkingDays && inUse(calendar) && body.impactReviewed !== true) {
      return fail(409, 'IMPACT_REVIEW_REQUIRED', 'Active events use this calendar: review the affected deadlines first.');
    }
    return toDetail(
      { ...calendar, name: body.name, timeZone: body.timeZone, workingDays, updatedAt: iso(now) },
      { userId: requirePersona().userId, permissions },
    );
  });

  mockRoute(app, addHoliday, ({ requireTenant, requirePersona, params, body, now, fail }) => {
    const { tenant, permissions } = requireTenant();
    const calendar = calendarIn(tenant.id, params.calendarId, fail);
    if (calendar.status === 'retired') {
      return fail(409, 'CALENDAR_RETIRED', 'A retired calendar cannot change.');
    }
    if (calendar.holidays.some((holiday) => holiday.date === body.date)) {
      return fail(409, 'HOLIDAY_ALREADY_EXISTS', 'This date is already a holiday in the calendar.');
    }
    if (inUse(calendar) && body.impactReviewed !== true) {
      return fail(409, 'IMPACT_REVIEW_REQUIRED', 'Active events use this calendar: review the affected deadlines first.');
    }
    const added: FixtureHoliday = { id: 900, date: body.date, name: body.name };
    return toDetail(
      { ...calendar, holidays: [...calendar.holidays, added], updatedAt: iso(now) },
      { userId: requirePersona().userId, permissions },
    );
  });

  mockRoute(app, removeHoliday, ({ requireTenant, requirePersona, params, query, now, fail }) => {
    const { tenant, permissions } = requireTenant();
    const calendar = calendarIn(tenant.id, params.calendarId, fail);
    if (!calendar.holidays.some((holiday) => holiday.id === params.holidayId)) {
      return fail(404, 'HOLIDAY_NOT_FOUND');
    }
    if (calendar.status === 'retired') {
      return fail(409, 'CALENDAR_RETIRED', 'A retired calendar cannot change.');
    }
    if (inUse(calendar) && !query.impactReviewed) {
      return fail(409, 'IMPACT_REVIEW_REQUIRED', 'Active events use this calendar: review the affected deadlines first.');
    }
    return toDetail(
      { ...calendar, holidays: calendar.holidays.filter((holiday) => holiday.id !== params.holidayId), updatedAt: iso(now) },
      { userId: requirePersona().userId, permissions },
    );
  });

  mockRoute(app, reviewCalendarImpact, ({ requireTenant, params, body, fail }) => {
    const { tenant } = requireTenant();
    const calendar = calendarIn(tenant.id, params.calendarId, fail);
    for (const holidayId of body.removeHolidayIds) {
      if (!calendar.holidays.some((holiday) => holiday.id === holidayId)) {
        return fail(404, 'HOLIDAY_NOT_FOUND', `Holiday ${holidayId} is not in this calendar.`);
      }
    }
    const before = new Set(calendar.holidays.map((holiday) => holiday.date));
    const after = new Set(
      calendar.holidays.filter((holiday) => !body.removeHolidayIds.includes(holiday.id)).map((holiday) => holiday.date),
    );
    for (const holiday of body.addHolidays) {
      after.add(holiday.date);
    }
    const workingDaysAfter = body.workingDays ?? calendar.workingDays;
    const items: CalendarImpactItem[] = [];
    for (const row of CALENDAR_DEADLINES.filter((candidate) => candidate.calendarId === calendar.id)) {
      const day = localDate(row.deadline, calendar.timeZone);
      const countBefore = workingDaysBetween(row.countFrom, day, calendar.workingDays, before);
      const countAfter = workingDaysBetween(row.countFrom, day, workingDaysAfter, after);
      const fallsOnNonWorkingDay = !isWorkingDay(day, workingDaysAfter, after);
      if (countBefore === countAfter && !fallsOnNonWorkingDay) {
        continue;
      }
      items.push({
        tenderId: row.tenderId,
        reference: row.reference,
        title: row.title,
        status: row.status,
        lotId: row.lotId,
        milestone: row.milestone,
        deadline: { at: row.deadline, timeZone: calendar.timeZone },
        workingDaysBefore: countBefore,
        workingDaysAfter: countAfter,
        fallsOnNonWorkingDay,
      });
    }
    return { calendarId: calendar.id, items, requiresReview: items.length > 0 };
  });

  mockRoute(app, approveCalendar, ({ requireTenant, requirePersona, params, now, fail }) => {
    const { tenant, permissions } = requireTenant();
    const persona = requirePersona();
    const calendar = calendarIn(tenant.id, params.calendarId, fail);
    if (calendar.status !== 'draft') {
      return fail(409, 'CALENDAR_NOT_DRAFT', 'Only a draft calendar can be approved.');
    }
    if (calendar.createdByUserId === persona.userId) {
      return fail(403, 'SOD_SELF_APPROVAL_BLOCKED', 'You drafted this calendar; another administrator must approve it.');
    }
    const at = iso(now);
    return toDetail(
      { ...calendar, status: 'approved', approvedByUserId: persona.userId, approvedAt: at, updatedAt: at },
      { userId: persona.userId, permissions },
    );
  });

  mockRoute(app, retireCalendar, ({ requireTenant, requirePersona, params, now, fail }) => {
    const { tenant, permissions } = requireTenant();
    const calendar = calendarIn(tenant.id, params.calendarId, fail);
    if (calendar.status === 'retired') {
      return fail(409, 'CALENDAR_RETIRED', 'This calendar is already retired.');
    }
    if (calendar.isDefault) {
      return fail(409, 'CALENDAR_IS_DEFAULT', 'Choose another default calendar first.');
    }
    if (activeEvents(calendar.id) > 0) {
      return fail(409, 'CALENDAR_IN_USE', 'Active events use this calendar.');
    }
    return toDetail(
      { ...calendar, status: 'retired', active: false, updatedAt: iso(now) },
      { userId: requirePersona().userId, permissions },
    );
  });

  mockRoute(app, setDefaultCalendar, ({ requireTenant, requirePersona, params, now, fail }) => {
    const { tenant, permissions } = requireTenant();
    const calendar = calendarIn(tenant.id, params.calendarId, fail);
    if (calendar.status !== 'approved') {
      return fail(409, 'CALENDAR_NOT_APPROVED', 'Only an approved calendar can be the default.');
    }
    return toDetail({ ...calendar, isDefault: true, updatedAt: iso(now) }, { userId: requirePersona().userId, permissions });
  });

  mockRoute(app, getDeadlinePolicy, ({ requireTenant }) => {
    const { tenant } = requireTenant();
    const policy = DEADLINE_POLICIES.find((candidate) => candidate.tenantId === tenant.id);
    const defaultCalendar = CALENDARS.find((calendar) => calendar.tenantId === tenant.id && calendar.isDefault);
    const reminders: DeadlineReminderPolicy[] = DEADLINE_REMINDER_EVENTS.map((eventType) => {
      const rule = NOTIFICATION_RULES.find((candidate) => candidate.tenantId === tenant.id && candidate.eventType === eventType);
      return {
        eventType,
        ruleId: rule?.id ?? null,
        mandatory: rule?.mandatory ?? isMandatoryNotificationEvent(eventType),
        active: rule?.active ?? false,
        reminderOffsetsHours: [...(rule?.reminderOffsetsHours ?? [])].sort((a, b) => b - a),
        escalateAfterHours: rule?.escalateAfterHours ?? null,
        escalationRole: rule?.escalationRole ?? null,
      };
    });
    return {
      officialTimeZone: tenant.officialTimeZone,
      defaultCalendar: defaultCalendar === undefined ? null : toSummary(defaultCalendar),
      reminders,
      noticePeriodStartBasis: policy?.noticePeriodStartBasis ?? 'publication',
      minimumAddendumResponseWorkingDays: policy?.minimumAddendumResponseWorkingDays ?? 5,
      calendarChangesMoveDeadlines: false as const,
    };
  });
}
