import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../../test/fetchMock';
import { renderWithProviders } from '../../../../test/render';
import { SUPPLIER_ALL, supplierSession, supplierState } from '../../testData';
import SupplierSessionPage from './SupplierSessionPage';

const S = '/api/v1/supplier/clarifications';

const booking = {
  id: 61,
  status: 'registered' as const,
  attendeeNames: ['Kagiso Metsi'],
  accessibilityNeeds: null,
  registeredBy: { userId: 37, fullName: 'Kagiso Metsi' },
  createdAt: '2026-10-01T08:00:00Z',
  attendanceRecordedAt: null,
};

function render(session = supplierSession(), extra: Parameters<typeof installFetch>[0] = {}) {
  const fetch = installFetch({
    [`GET ${S}/sessions/${session.id}`]: () => ({ body: session }),
    ...extra,
  });
  renderWithProviders(<SupplierSessionPage />, {
    state: supplierState(SUPPLIER_ALL),
    route: `/supplier/briefings/${session.id}`,
    path: '/supplier/briefings/:sessionId',
  });
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SupplierSessionPage (SUP-11)', () => {
  it('shows the logistics, places, accessibility information and the mandatory warning', async () => {
    render();
    expect(await screen.findByText('KWU head office, Gaborone')).toBeInTheDocument();
    expect(screen.getByText('18 of 20 places left')).toBeInTheDocument();
    expect(screen.getByText('Step-free access.')).toBeInTheDocument();
    expect(screen.getByText('Attendance at this session is mandatory')).toBeInTheDocument();
    expect(screen.getByText('Register: attendance is mandatory')).toBeInTheDocument();
  });

  it('registers attendees with an accommodation request', async () => {
    const { requests } = render(supplierSession(), {
      [`POST ${S}/sessions/41/registrations`]: () => ({
        status: 201,
        body: supplierSession({ ownRegistration: { ...booking, accessibilityNeeds: 'Ramp' } }),
      }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Register' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(
      within(dialog).getByLabelText(/Attendee names/),
      'Kagiso Metsi{enter}Lame Ntshole',
    );
    await userEvent.type(within(dialog).getByLabelText(/Accommodation request/), 'Ramp');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Register' }));

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
        attendeeNames: ['Kagiso Metsi', 'Lame Ntshole'],
        accessibilityNeeds: 'Ramp',
      }),
    );
    expect(await screen.findByText('Registered.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change booking' })).toBeInTheDocument();
  });

  it('explains a full session', async () => {
    render(supplierSession(), {
      [`POST ${S}/sessions/41/registrations`]: () =>
        problem(409, 'Conflict', { code: 'SESSION_FULL' }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Register' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Attendee names/), 'Kagiso Metsi');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Register' }));
    expect(await within(dialog).findByText('The session has no places left.')).toBeInTheDocument();
  });

  it('cancels a booking and warns about mandatory attendance', async () => {
    const { requests } = render(supplierSession({ ownRegistration: booking }), {
      [`POST ${S}/registrations/61/cancel`]: () => ({
        body: supplierSession({ ownRegistration: { ...booking, status: 'cancelled' } }),
      }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel booking' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Attendance is mandatory/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel booking' }));

    await waitFor(() => expect(requests.some((request) => request.method === 'POST')).toBe(true));
    expect(await screen.findByText('Booking cancelled.')).toBeInTheDocument();
  });

  it('shows the official minutes and shared answers after the session', async () => {
    render(
      supplierSession({
        status: 'completed',
        registrationOpen: false,
        minutesDocument: { documentId: 71, title: 'Briefing minutes' },
        minutesPublishedAt: '2026-09-21T09:00:00Z',
        sharedAnswers: [
          {
            questionId: 220,
            sanitizedQuestion: 'Is parking available?',
            answerText: 'Yes, at gate 2.',
            audience: 'all_participants',
            publishedAt: '2026-09-21T09:00:00Z',
            lot: null,
            requirement: null,
            sessionId: 41,
          },
        ],
      }),
    );
    expect(await screen.findByRole('link', { name: 'Briefing minutes' })).toBeInTheDocument();
    expect(screen.getByText('Is parking available?')).toBeInTheDocument();
    expect(screen.getByText('Read the official minutes')).toBeInTheDocument();
  });
});
