import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../../test/fetchMock';
import { renderWithProviders } from '../../../../test/render';
import { BUYER_ALL, buyerState, pageOf, sessionDetail, tenderContext } from '../../testData';
import SessionPage from './SessionPage';

const B = '/api/v1/buyer/clarifications';

function render(session = sessionDetail(), extra: Parameters<typeof installFetch>[0] = {}) {
  const fetch = installFetch({
    [`GET ${B}/sessions/${session.id}`]: () => ({ body: session }),
    [`GET ${B}/tenders/2`]: () => ({ body: tenderContext() }),
    [`GET ${B}/sessions`]: () => ({ body: pageOf([]) }),
    ...extra,
  });
  renderWithProviders(<SessionPage />, {
    state: buyerState(BUYER_ALL),
    route: `/buyer/clarifications/sessions/${session.id}`,
    path: '/buyer/clarifications/sessions/:sessionId',
  });
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SessionPage (BUY-18)', () => {
  it('shows registrations with attendees, accommodations, attendance and the open exception', async () => {
    render();

    const table = await screen.findByRole('table', { name: 'Registered suppliers' });
    expect(within(table).getByText('Gaborone Metering Co.')).toBeInTheDocument();
    expect(within(table).getByText('Wheelchair access')).toBeInTheDocument();
    expect(
      within(table).getByRole('button', { name: 'Resolve for Gaborone Metering Co.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('1 attendance exception to resolve')).toBeInTheDocument();
    expect(screen.getByText('Publish the minutes and shared answers')).toBeInTheDocument();
  });

  it('resolves an attendance exception by offering the alternative session', async () => {
    const { requests } = render(sessionDetail(), {
      [`POST ${B}/sessions/41/registrations/61/exception`]: () => ({
        body: sessionDetail({ openAttendanceExceptions: 0 }),
      }),
    });

    await userEvent.click(
      await screen.findByRole('button', { name: 'Resolve for Gaborone Metering Co.' }),
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(
      within(dialog).getByRole('combobox', { name: /Alternative session/ }),
      '42',
    );
    await userEvent.type(within(dialog).getByLabelText(/Note/), 'Same offer for all absentees');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Resolve exception' }));

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
        resolution: 'offer_alternative',
        alternativeSessionId: 42,
        note: 'Same offer for all absentees',
      }),
    );
    expect(await screen.findByText('Attendance exception resolved.')).toBeInTheDocument();
  });

  it('publishes the minutes with a session minutes document and a shared answer that hides who asked', async () => {
    const withMinutesFile = sessionDetail({
      minutesDocumentOptions: [{ documentId: 71, title: 'Minutes — pre-quotation briefing' }],
    });
    const { requests } = render(withMinutesFile, {
      [`POST ${B}/sessions/41/minutes`]: () => ({
        body: sessionDetail({ minutesPublishedAt: '2026-09-21T09:00:00Z' }),
      }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Publish minutes' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText(/Minutes document/), '71');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add shared answer' }));
    await userEvent.selectOptions(within(dialog).getByLabelText(/Raised by/), '9');
    await userEvent.type(within(dialog).getByLabelText(/Shared wording/), 'Is parking available?');
    await userEvent.type(within(dialog).getByLabelText(/^Answer/), 'Yes, at gate 2.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Publish minutes' }));

    await waitFor(() =>
      expect(requests.find((request) => request.path.endsWith('/minutes'))?.body).toEqual({
        minutesDocumentId: 71,
        audience: 'all_participants',
        sharedAnswers: [
          {
            supplierTenantId: 9,
            sanitizedQuestion: 'Is parking available?',
            answerText: 'Yes, at gate 2.',
          },
        ],
      }),
    );
  });

  it('publishes the shared answers as the minutes record when no minutes file was filed for the session', async () => {
    const { requests } = render(sessionDetail(), {
      [`POST ${B}/sessions/41/minutes`]: () => ({
        body: sessionDetail({ minutesPublishedAt: '2026-09-21T09:00:00Z' }),
      }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Publish minutes' }));
    const dialog = await screen.findByRole('dialog');
    const documentSelect = within(dialog).getByLabelText(/Minutes document/);
    expect(
      within(documentSelect)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['No separate minutes file: the shared answers are the minutes record']);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Publish minutes' }));

    await waitFor(() =>
      expect(requests.find((request) => request.path.endsWith('/minutes'))?.body).toEqual({
        minutesDocumentId: null,
        audience: 'all_participants',
        sharedAnswers: [],
      }),
    );
    expect(
      await screen.findByText(
        'No separate minutes file: the shared answers below are the official minutes record.',
      ),
    ).toBeInTheDocument();
  });

  it('records attendance at a session that took place, then offers to publish its minutes', async () => {
    const held = sessionDetail({
      status: 'scheduled',
      startsAt: '2026-09-28T07:00:00Z',
      endsAt: '2026-09-28T09:00:00Z',
      absent: 0,
      attended: 0,
      openAttendanceExceptions: 0,
      registrations: sessionDetail().registrations.map((registration) => ({
        ...registration,
        status: 'registered' as const,
        attendanceRecordedBy: null,
        attendanceRecordedAt: null,
        attendanceException: false,
      })),
    });
    const { requests } = render(held, {
      [`POST ${B}/sessions/41/attendance`]: () => ({
        body: sessionDetail({ openAttendanceExceptions: 0, absent: 0, attended: 1 }),
      }),
    });

    expect(
      await screen.findByText('Record the attendance of the session that took place'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish minutes' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Record attendance' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record attendance' }));

    await waitFor(() =>
      expect(requests.find((request) => request.path.endsWith('/attendance'))?.body).toEqual({
        entries: [{ registrationId: 61, status: 'attended' }],
      }),
    );
    expect(await screen.findByRole('button', { name: 'Publish minutes' })).toBeInTheDocument();
  });

  it('cancels a scheduled session with a reason', async () => {
    const scheduled = sessionDetail({
      status: 'scheduled',
      startsAt: '2026-12-09T08:00:00Z',
      endsAt: '2026-12-09T10:00:00Z',
      openAttendanceExceptions: 0,
      registrations: [],
    });
    const { requests } = render(scheduled, {
      [`POST ${B}/sessions/41/cancel`]: () => ({
        body: sessionDetail({
          ...scheduled,
          status: 'cancelled',
          cancellationReason: 'Venue flooded',
        }),
      }),
    });

    expect(await screen.findByRole('link', { name: 'Edit session' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record attendance' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel session' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Venue flooded');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel session' }));

    await waitFor(() =>
      expect(requests.find((request) => request.path.endsWith('/cancel'))?.body).toEqual({
        reason: 'Venue flooded',
      }),
    );
    expect(await screen.findByText('This session was cancelled')).toBeInTheDocument();
  });
});
