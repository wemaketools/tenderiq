import { beforeAll, describe, expect, it } from 'vitest';

import { CalendarDetail, calendarEndpoints } from '../../../contracts/calendars.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp } from '../../testing/index.js';
import { register } from './index.js';

const ADMIN = 'admin.kwu@tenderiq.local';
const OFFICER = 'tebogo.officer@tenderiq.local';

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp({ modules: [{ name: 'calendars', register }] });
});

describe('calendars module', () => {
  it('loads without skipped modules', () => {
    expect(api.failed).toEqual([]);
    expect(api.loaded).toContain('calendars');
  });
});

describe('support access (DD-11, ADR 0013)', () => {
  it('lets support.agent under the authorized metadata grant read the KWU calendars, and refuses its commands', async () => {
    // Act
    const list = await api.callAs('support.agent@tenderiq.local', calendarEndpoints.listCalendars, { tenant: 'kwu' });
    const create = await api.callAs('support.agent@tenderiq.local', calendarEndpoints.createCalendar, {
      tenant: 'kwu',
      body: { name: 'Support-created calendar', timeZone: 'Africa/Gaborone', workingDays: [1, 2, 3, 4, 5] },
    });

    // Assert
    expect(list.status).toBe(200);
    expect(calendarEndpoints.listCalendars.response.parse(list.body).items.length).toBeGreaterThan(0);
    expect(create.status).toBe(403);
    expect(create.body).toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('buyer.calendars.list / get', () => {
  it('lists only the active buyer’s calendars', async () => {
    const kwu = await api.callAs(ADMIN, calendarEndpoints.listCalendars, { tenant: 'kwu' });
    expect(calendarEndpoints.listCalendars.response.parse(kwu.body).items.map((row) => row.id).sort()).toEqual([1, 2, 3, 4]);
    const odc = await api.callAs('admin.odc@tenderiq.local', calendarEndpoints.listCalendars, { tenant: 'odc' });
    expect(calendarEndpoints.listCalendars.response.parse(odc.body).items.map((row) => row.id)).toEqual([5]);
  });

  it('filters by status', async () => {
    const response = await api.callAs(ADMIN, calendarEndpoints.listCalendars, { tenant: 'kwu', query: { status: 'draft' } });
    expect(calendarEndpoints.listCalendars.response.parse(response.body).items.map((row) => row.id).sort()).toEqual([2, 3]);
  });

  it('hides another buyer’s calendar and refuses supplier personas', async () => {
    expect((await api.callAs(ADMIN, calendarEndpoints.getCalendar, { tenant: 'kwu', params: { calendarId: 5 } })).body).toMatchObject({
      code: 'CALENDAR_NOT_FOUND',
    });
    const supplier = await api.callAs('tsodilo.admin@tenderiq.local', calendarEndpoints.listCalendars, { tenant: 'tsodilo' });
    expect(supplier.body).toMatchObject({ code: 'TENANT_ACCESS_DENIED' });
  });

  it('shows the calendar in use with holidays and active events, read-only for an officer', async () => {
    const detail = CalendarDetail.parse((await api.callAs(OFFICER, calendarEndpoints.getCalendar, { tenant: 'kwu', params: { calendarId: 1 } })).body);
    expect(detail.holidayCount).toBe(15);
    expect(detail.activeEventCount).toBeGreaterThan(0);
    expect(detail.capabilities).toMatchObject({ canEdit: false, canApprove: false, canRetire: false });
  });

  it('blocks self-approval of a calendar the administrator drafted', async () => {
    const detail = CalendarDetail.parse((await api.callAs(ADMIN, calendarEndpoints.getCalendar, { tenant: 'kwu', params: { calendarId: 3 } })).body);
    expect(detail.capabilities).toMatchObject({ canApprove: false, approveBlockedReason: 'self_approval' });
    const response = await api.callAs(ADMIN, calendarEndpoints.approveCalendar, { tenant: 'kwu', params: { calendarId: 3 }, body: {} });
    expect(response.body).toMatchObject({ code: 'SOD_SELF_APPROVAL_BLOCKED' });
  });
});

describe('calendar commands', () => {
  it('answers 403 FORBIDDEN to a member without org.calendars.manage', async () => {
    const response = await api.callAs(OFFICER, calendarEndpoints.approveCalendar, { tenant: 'kwu', params: { calendarId: 2 }, body: {} });
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('approves a draft drafted by someone else', async () => {
    const response = await api.callAs(ADMIN, calendarEndpoints.approveCalendar, { tenant: 'kwu', params: { calendarId: 2 }, body: {} });
    expect(CalendarDetail.parse(response.body)).toMatchObject({ status: 'approved', approvedBy: { fullName: 'Lorato Kgosi' } });
  });

  it('requires the impact review before a holiday changes a calendar in use (BR-12)', async () => {
    const blocked = await api.callAs(ADMIN, calendarEndpoints.addHoliday, {
      tenant: 'kwu',
      params: { calendarId: 1 },
      body: { date: '2026-10-05', name: 'Water Week holiday' },
    });
    expect(blocked.body).toMatchObject({ code: 'IMPACT_REVIEW_REQUIRED' });
    const reviewed = await api.callAs(ADMIN, calendarEndpoints.addHoliday, {
      tenant: 'kwu',
      params: { calendarId: 1 },
      body: { date: '2026-10-05', name: 'Water Week holiday', impactReviewed: true },
    });
    expect(CalendarDetail.parse(reviewed.body).holidays.some((holiday) => holiday.date === '2026-10-05')).toBe(true);
  });

  it('lists the deadlines a proposed holiday affects without moving them', async () => {
    const response = await api.callAs(ADMIN, calendarEndpoints.reviewCalendarImpact, {
      tenant: 'kwu',
      params: { calendarId: 1 },
      body: { addHolidays: [{ date: '2026-10-05', name: 'Water Week holiday' }] },
    });
    const impact = calendarEndpoints.reviewCalendarImpact.response.parse(response.body);
    expect(impact.requiresReview).toBe(true);
    const questions = impact.items.find((item) => item.reference === 'T-2026-0006' && item.milestone === 'questions_deadline');
    expect(questions).toMatchObject({ fallsOnNonWorkingDay: true, deadline: { at: '2026-10-05T13:00:00Z', timeZone: 'Africa/Gaborone' } });
    expect((questions?.workingDaysBefore ?? 0) - (questions?.workingDaysAfter ?? 0)).toBe(1);
    expect(impact.items.every((item) => item.workingDaysAfter <= item.workingDaysBefore)).toBe(true);
  });

  it('reports no impact for a change that touches no active deadline', async () => {
    const response = await api.callAs(ADMIN, calendarEndpoints.reviewCalendarImpact, {
      tenant: 'kwu',
      params: { calendarId: 1 },
      body: { addHolidays: [{ date: '2026-12-31', name: 'Year-end closure' }] },
    });
    expect(calendarEndpoints.reviewCalendarImpact.response.parse(response.body)).toMatchObject({ items: [], requiresReview: false });
  });

  it.each([
    ['CALENDAR_IS_DEFAULT', 'retire', 1],
    ['CALENDAR_RETIRED', 'retire', 4],
    ['CALENDAR_NOT_APPROVED', 'setDefault', 2],
    ['CALENDAR_NOT_DRAFT', 'approve', 1],
  ] as const)('answers %s', async (code, action, calendarId) => {
    const response =
      action === 'retire'
        ? await api.callAs(ADMIN, calendarEndpoints.retireCalendar, { tenant: 'kwu', params: { calendarId }, body: { reason: 'Superseded' } })
        : action === 'setDefault'
          ? await api.callAs(ADMIN, calendarEndpoints.setDefaultCalendar, { tenant: 'kwu', params: { calendarId } })
          : await api.callAs(ADMIN, calendarEndpoints.approveCalendar, { tenant: 'kwu', params: { calendarId }, body: {} });
    expect(response.body).toMatchObject({ code });
  });

  it('refuses a duplicate calendar name and creates a draft otherwise', async () => {
    const duplicate = await api.callAs(ADMIN, calendarEndpoints.createCalendar, {
      tenant: 'kwu',
      body: { name: 'Botswana Public Holidays 2026', timeZone: 'Africa/Gaborone', workingDays: [1, 2, 3, 4, 5] },
    });
    expect(duplicate.body).toMatchObject({ code: 'CALENDAR_NAME_TAKEN' });
    const created = await api.callAs(ADMIN, calendarEndpoints.createCalendar, {
      tenant: 'kwu',
      body: { name: 'Botswana Public Holidays 2028', timeZone: 'Africa/Gaborone', workingDays: [1, 2, 3, 4, 5] },
    });
    expect(created.status).toBe(201);
    expect(CalendarDetail.parse(created.body)).toMatchObject({ status: 'draft', capabilities: { approveBlockedReason: 'self_approval' } });
  });

  it('requires the impact review before working days of a calendar in use change', async () => {
    const response = await api.callAs(ADMIN, calendarEndpoints.updateCalendar, {
      tenant: 'kwu',
      params: { calendarId: 1 },
      body: { name: 'Botswana Public Holidays 2026', timeZone: 'Africa/Gaborone', workingDays: [1, 2, 3, 4, 5, 6] },
    });
    expect(response.body).toMatchObject({ code: 'IMPACT_REVIEW_REQUIRED' });
  });
});

describe('buyer.calendars.deadlinePolicy', () => {
  it('shows the official zone, default calendar and reminder periods from the notification rules', async () => {
    const response = await api.callAs(OFFICER, calendarEndpoints.getDeadlinePolicy, { tenant: 'kwu' });
    const policy = calendarEndpoints.getDeadlinePolicy.response.parse(response.body);
    expect(policy).toMatchObject({ officialTimeZone: 'Africa/Gaborone', defaultCalendar: { id: 1 }, calendarChangesMoveDeadlines: false });
    expect(policy.reminders.find((reminder) => reminder.eventType === 'closing_approaching')?.reminderOffsetsHours).toEqual([168, 48, 4]);
  });
});
