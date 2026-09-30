import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../../test/fetchMock';
import { LocationProbe, renderWithProviders } from '../../../../test/render';
import {
  BUYER_ALL,
  buyerState,
  buyerTender,
  pageOf,
  sessionDetail,
  tenderContext,
} from '../../testData';
import SessionFormPage from './SessionFormPage';

const B = '/api/v1/buyer/clarifications';

function renderNew(extra: Parameters<typeof installFetch>[0] = {}) {
  const fetch = installFetch({
    [`GET ${B}/tenders`]: () => ({ body: pageOf([buyerTender()]) }),
    [`GET ${B}/tenders/2`]: () => ({ body: tenderContext() }),
    [`GET ${B}/sessions`]: () => ({ body: pageOf([]) }),
    ...extra,
  });
  renderWithProviders(<SessionFormPage />, {
    state: buyerState(BUYER_ALL),
    route: '/buyer/clarifications/sessions/new?tenderId=2',
    path: '/buyer/clarifications/sessions/new',
    routes: [
      {
        path: '/buyer/clarifications/sessions/:sessionId',
        element: <LocationProbe label="session page" />,
      },
    ],
  });
  return fetch;
}

async function setDateTime(label: RegExp, date: string, time: string): Promise<void> {
  const group = screen.getByRole('group', { name: label });
  await userEvent.type(within(group).getByLabelText('Date'), date);
  await userEvent.type(within(group).getByLabelText('Time'), time);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SessionFormPage (BUY-18)', () => {
  it('validates the required logistics before scheduling', async () => {
    const { requests } = renderNew();
    await userEvent.click(await screen.findByRole('button', { name: 'Schedule session' }));

    expect(await screen.findByText('Enter a title.')).toBeInTheDocument();
    expect(screen.getByText('Enter the start date and time.')).toBeInTheDocument();
    expect(
      screen.getByText('Enter a whole number of places between 1 and 1000.'),
    ).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
  });

  it('schedules a site visit in the official zone and opens it', async () => {
    const { requests } = renderNew({
      [`POST ${B}/sessions`]: () => ({ status: 201, body: sessionDetail({ id: 900 }) }),
    });
    await userEvent.click(await screen.findByLabelText('Site visit'));
    await userEvent.type(screen.getByLabelText(/^Title/), 'Reservoir site visit');
    await setDateTime(/^Starts/, '2026-12-10', '09:00');
    await setDateTime(/^Ends/, '2026-12-10', '11:00');
    await userEvent.type(screen.getByLabelText(/^Venue/), 'Mogoditshane reservoir gate');
    await userEvent.type(screen.getByLabelText(/^Places/), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Schedule session' }));

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.body).toMatchObject({
        tenderId: 2,
        sessionType: 'site_visit',
        title: 'Reservoir site visit',
        startsAt: '2026-12-10T07:00:00Z',
        endsAt: '2026-12-10T09:00:00Z',
        capacity: 12,
        mandatory: false,
      }),
    );
    expect(await screen.findByTestId('location-probe')).toHaveTextContent('session page');
  });

  it('explains that mandatory attendance after release needs an addendum', async () => {
    renderNew({
      [`POST ${B}/sessions`]: () =>
        problem(409, 'Conflict', { code: 'MANDATORY_REQUIRES_ADDENDUM' }),
    });
    expect(
      await screen.findByText(
        'The tender is released: making attendance mandatory now requires an addendum.',
      ),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Title/), 'Briefing');
    await setDateTime(/^Starts/, '2026-12-10', '09:00');
    await setDateTime(/^Ends/, '2026-12-10', '11:00');
    await userEvent.type(screen.getByLabelText(/^Venue/), 'Head office');
    await userEvent.type(screen.getByLabelText(/^Places/), '10');
    await userEvent.click(screen.getByLabelText(/Attendance is mandatory/));
    await userEvent.click(screen.getByRole('button', { name: 'Schedule session' }));

    expect(
      await screen.findByText(
        'The tender is released: mandatory attendance can only be introduced through an addendum.',
      ),
    ).toBeInTheDocument();
  });
});
