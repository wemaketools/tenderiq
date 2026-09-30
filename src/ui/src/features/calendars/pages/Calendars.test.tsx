import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  ADMIN_PERMISSIONS,
  businessError,
  callsTo,
  renderPage,
  routeCalls,
} from '../../tasks/test/kit';
import {
  calendarDetail,
  calendarSummary,
  deadlinePolicy,
  page,
} from '../../tasks/test/workspaceData';
import CalendarNewPage from './CalendarNewPage';
import CalendarPage from './CalendarPage';
import CalendarsPage from './CalendarsPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const ADMIN = { permissions: ADMIN_PERMISSIONS, capacity: 'Organization Administrator' };
const DETAIL = {
  path: '/buyer/admin/calendars/:calendarId',
  route: '/buyer/admin/calendars/1',
  ...ADMIN,
};

const impact = {
  calendarId: 1,
  requiresReview: true,
  items: [
    {
      tenderId: 2,
      reference: 'T-2026-0002',
      title: 'Smart water meter supply',
      status: 'open' as const,
      lotId: null,
      milestone: 'submission_deadline' as const,
      deadline: { at: '2026-10-20T10:00:00Z', timeZone: 'Africa/Gaborone' },
      workingDaysBefore: 12,
      workingDaysAfter: 11,
      fallsOnNonWorkingDay: false,
    },
  ],
};

describe('CalendarsPage (ADM-10)', () => {
  it('lists calendars and the deadline policy', async () => {
    routeCalls({
      'buyer.calendars.deadlinePolicy': () => deadlinePolicy(),
      'buyer.calendars.list': () =>
        page([
          calendarSummary(),
          calendarSummary({
            id: 2,
            name: 'Botswana Public Holidays 2027',
            status: 'draft',
            isDefault: false,
            approvedAt: null,
            approvedBy: null,
          }),
        ]),
    });
    renderPage(<CalendarsPage />, {
      path: '/buyer/admin/calendars',
      route: '/buyer/admin/calendars',
      ...ADMIN,
    });
    expect(await screen.findByText('Botswana Public Holidays 2027')).toBeInTheDocument();
    expect(screen.getAllByText('Mon–Fri').length).toBeGreaterThan(0);
    expect(await screen.findByText('Deadline policy')).toBeInTheDocument();
    expect(screen.getByText('7 days, 2 days')).toBeInTheDocument();
    expect(screen.getByText(/Never moved automatically/)).toBeInTheDocument();
  });
});

describe('CalendarPage (ADM-10)', () => {
  it('reviews the impact on active events before adding a holiday', async () => {
    const calls = routeCalls({
      'buyer.calendars.get': () => calendarDetail(),
      'buyer.calendars.impactReview': () => impact,
      'buyer.calendars.addHoliday': () =>
        calendarDetail({
          holidays: [
            { id: 101, date: '2026-12-25', name: 'Christmas Day' },
            { id: 900, date: '2026-10-19', name: 'Extra day' },
          ],
        }),
    });
    renderPage(<CalendarPage />, DETAIL);
    fireEvent.change(await screen.findByLabelText(/Holiday date/), {
      target: { value: '2026-10-19' },
    });
    fireEvent.change(screen.getByLabelText(/Holiday name/), { target: { value: 'Extra day' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add holiday' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('12 → 11')).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: 'Add holiday' });
    expect(confirm).toBeDisabled();
    fireEvent.click(
      within(dialog).getByRole('checkbox', { name: /I reviewed the affected deadlines/ }),
    );
    fireEvent.click(confirm);
    await waitFor(() => expect(callsTo(calls, 'buyer.calendars.addHoliday')).toHaveLength(1));
    expect(callsTo(calls, 'buyer.calendars.impactReview')[0]?.request).toMatchObject({
      body: { addHolidays: [{ date: '2026-10-19', name: 'Extra day' }] },
    });
    expect(callsTo(calls, 'buyer.calendars.addHoliday')[0]?.request).toMatchObject({
      body: { date: '2026-10-19', name: 'Extra day', impactReviewed: true },
    });
    expect(await screen.findByText('Extra day')).toBeInTheDocument();
  });

  it('explains why the author cannot approve a draft (BR-07)', async () => {
    routeCalls({
      'buyer.calendars.get': () =>
        calendarDetail({
          status: 'draft',
          isDefault: false,
          approvedAt: null,
          approvedBy: null,
          activeEventCount: 0,
          usedBy: [],
          capabilities: {
            canEdit: true,
            canApprove: false,
            canRetire: true,
            canSetDefault: false,
            approveBlockedReason: 'self_approval',
          },
        }),
    });
    renderPage(<CalendarPage />, DETAIL);
    expect(await screen.findByText(/You drafted this calendar/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.getByText(/Saved as a draft/)).toBeInTheDocument();
  });

  it('retires with a reason and explains a refusal', async () => {
    routeCalls({
      'buyer.calendars.get': () =>
        calendarDetail({
          capabilities: {
            canEdit: true,
            canApprove: false,
            canRetire: true,
            canSetDefault: false,
            approveBlockedReason: 'not_draft',
          },
        }),
      'buyer.calendars.retire': () => {
        throw businessError('buyer.calendars.retire', 'CALENDAR_IS_DEFAULT');
      },
    });
    renderPage(<CalendarPage />, DETAIL);
    fireEvent.click(await screen.findByRole('button', { name: 'Retire' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Why is it retired/), {
      target: { value: 'Replaced' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retire' }));
    expect(
      await within(dialog).findByText(/The default calendar cannot be retired/),
    ).toBeInTheDocument();
  });
});

describe('CalendarNewPage (ADM-10)', () => {
  it('validates and creates a draft calendar', async () => {
    const calls = routeCalls({
      'buyer.calendars.create': () =>
        calendarDetail({ id: 900, name: 'Depots 2027', status: 'draft', isDefault: false }),
    });
    const { router } = renderPage(<CalendarNewPage />, {
      path: '/buyer/admin/calendars/new',
      route: '/buyer/admin/calendars/new',
      ...ADMIN,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create draft' }));
    expect(await screen.findByText('A name is required.')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /^Name/ }), {
      target: { value: 'Depots 2027' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Saturday' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create draft' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create draft' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/buyer/admin/calendars/900'));
    expect(callsTo(calls, 'buyer.calendars.create')[0]?.request).toMatchObject({
      body: { name: 'Depots 2027', timeZone: 'Africa/Gaborone', workingDays: [1, 2, 3, 4, 5, 6] },
    });
  });
});
