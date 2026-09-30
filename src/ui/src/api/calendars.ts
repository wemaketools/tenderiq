/**
 * Calendars client (the `calendars` contract, ADM-10): working calendars, holidays, the impact review of active
 * events and the deadline policy of the active buyer organization.
 */
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
} from '@contracts/calendars';
import type {
  AddHolidayBody,
  CalendarDetail,
  CalendarImpact,
  CalendarPage,
  CreateCalendarBody,
  DeadlinePolicy,
  ImpactReviewBody,
  UpdateCalendarBody,
} from '@contracts/calendars';
import type { EndpointQuery } from '@contracts/endpoint';

import { call } from './client';

/** GET /api/v1/buyer/calendars. */
export function fetchCalendars(
  query: EndpointQuery<typeof listCalendars> = {},
): Promise<CalendarPage> {
  return call(listCalendars, { query });
}

/** GET /api/v1/buyer/calendars/:calendarId. */
export function fetchCalendar(calendarId: number): Promise<CalendarDetail> {
  return call(getCalendar, { params: { calendarId } });
}

/** POST /api/v1/buyer/calendars (idempotent): a new draft. */
export function createDraftCalendar(body: CreateCalendarBody): Promise<CalendarDetail> {
  return call(createCalendar, { body });
}

/** PUT /api/v1/buyer/calendars/:calendarId. */
export function saveCalendar(
  calendarId: number,
  body: UpdateCalendarBody,
): Promise<CalendarDetail> {
  return call(updateCalendar, { params: { calendarId }, body });
}

/** POST /api/v1/buyer/calendars/:calendarId/holidays (idempotent). */
export function addCalendarHoliday(
  calendarId: number,
  body: AddHolidayBody,
): Promise<CalendarDetail> {
  return call(addHoliday, { params: { calendarId }, body });
}

/** DELETE /api/v1/buyer/calendars/:calendarId/holidays/:holidayId. */
export function removeCalendarHoliday(
  calendarId: number,
  holidayId: number,
  impactReviewed: boolean,
): Promise<CalendarDetail> {
  return call(removeHoliday, { params: { calendarId, holidayId }, query: { impactReviewed } });
}

/** POST /api/v1/buyer/calendars/:calendarId/impact-review: the deadlines a proposed change affects. */
export function reviewImpact(calendarId: number, body: ImpactReviewBody): Promise<CalendarImpact> {
  return call(reviewCalendarImpact, { params: { calendarId }, body });
}

/** POST /api/v1/buyer/calendars/:calendarId/approve. */
export function approveDraftCalendar(calendarId: number, note?: string): Promise<CalendarDetail> {
  return call(approveCalendar, {
    params: { calendarId },
    body: note === undefined ? {} : { note },
  });
}

/** POST /api/v1/buyer/calendars/:calendarId/retire. */
export function retire(calendarId: number, reason: string): Promise<CalendarDetail> {
  return call(retireCalendar, { params: { calendarId }, body: { reason } });
}

/** POST /api/v1/buyer/calendars/:calendarId/set-default. */
export function makeDefault(calendarId: number): Promise<CalendarDetail> {
  return call(setDefaultCalendar, { params: { calendarId } });
}

/** GET /api/v1/buyer/deadline-policy. */
export function fetchDeadlinePolicy(): Promise<DeadlinePolicy> {
  return call(getDeadlinePolicy, {});
}
