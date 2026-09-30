import { describe, expect, it } from 'vitest';

import { DeadlinePolicy, UpdateCalendarBody, calendarEndpoints } from '../calendars.js';

describe('calendars contract extensions (ADM-10)', () => {
  it('defaults the impact-review confirmation on update', () => {
    expect(UpdateCalendarBody.parse({ name: 'Botswana 2027', timeZone: 'Africa/Gaborone', workingDays: [1, 2, 3, 4, 5] })).toMatchObject({
      impactReviewed: false,
    });
  });

  it('states that a calendar change never moves a deadline', () => {
    const policy = {
      officialTimeZone: 'Africa/Gaborone',
      defaultCalendar: null,
      reminders: [],
      noticePeriodStartBasis: 'publication',
      minimumAddendumResponseWorkingDays: 5,
      calendarChangesMoveDeadlines: false,
    };
    expect(DeadlinePolicy.parse(policy)).toEqual(policy);
    expect(DeadlinePolicy.safeParse({ ...policy, calendarChangesMoveDeadlines: true }).success).toBe(false);
  });

  it('serves the deadline policy to anyone who may read calendars', () => {
    expect(calendarEndpoints.getDeadlinePolicy.permission).toEqual(calendarEndpoints.listCalendars.permission);
  });
});
