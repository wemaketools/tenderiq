import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../../test/fetchMock';
import { renderWithProviders } from '../../../../test/render';
import { BUYER_ALL, buyerState, buyerTender, pageOf, sessionDetail } from '../../testData';
import SessionsPage from './SessionsPage';

const B = '/api/v1/buyer/clarifications';

function routes(
  rows = [
    sessionDetail(),
    sessionDetail({
      id: 42,
      title: 'Alternative briefing',
      status: 'scheduled',
      mandatory: false,
      openAttendanceExceptions: 0,
      minutesPublishedAt: null,
    }),
  ],
) {
  return installFetch({
    [`GET ${B}/tenders`]: () => ({ body: pageOf([buyerTender()]) }),
    [`GET ${B}/sessions`]: () => ({ body: pageOf(rows) }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SessionsPage (BUY-18)', () => {
  it('lists sessions with logistics, places, mandatory status, attendance, accommodations and minutes', async () => {
    routes();
    renderWithProviders(<SessionsPage />, { state: buyerState(BUYER_ALL) });

    const table = await screen.findByRole('table', { name: 'Sessions' });
    expect(await within(table).findByText('Pre-bid briefing')).toBeInTheDocument();
    expect(within(table).getAllByText('KWU head office, Gaborone')).toHaveLength(2);
    expect(within(table).getByText('Mandatory')).toBeInTheDocument();
    expect(within(table).getByText('1 attended · 1 absent')).toBeInTheDocument();
    expect(within(table).getByText('1 exception open')).toBeInTheDocument();
    expect(within(table).getByText('Not held yet')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Attendance exceptions' })).toHaveTextContent('1');
  });

  it('sends the mandatory filter to the API', async () => {
    const { requests } = routes();
    renderWithProviders(<SessionsPage />, { state: buyerState(BUYER_ALL) });
    await screen.findByText('Pre-bid briefing');

    await userEvent.click(screen.getByLabelText('Mandatory only'));

    await waitFor(() =>
      expect(requests.some((request) => request.search.includes('mandatory=true'))).toBe(true),
    );
  });

  it('shows the empty state', async () => {
    routes([]);
    renderWithProviders(<SessionsPage />, { state: buyerState(BUYER_ALL) });
    expect(await screen.findByText('No sessions match these filters')).toBeInTheDocument();
  });

  it('shows the error state with a retry', async () => {
    installFetch({
      [`GET ${B}/tenders`]: () => ({ body: pageOf([]) }),
      [`GET ${B}/sessions`]: () => problem(500, 'Server error'),
    });
    renderWithProviders(<SessionsPage />, { state: buyerState(BUYER_ALL) });
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
