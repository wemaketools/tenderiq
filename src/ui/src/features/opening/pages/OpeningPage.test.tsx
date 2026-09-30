import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { page, session, stateFor, tenderRow } from '../test/data';
import OpeningPage from './OpeningPage';

function sessionRow() {
  const detail = session();
  return {
    id: detail.id,
    tenderId: detail.tenderId,
    tenderReference: detail.tenderReference,
    tenderTitle: detail.tenderTitle,
    lot: null,
    envelope: detail.envelope,
    status: detail.status,
    scheduledAt: detail.scheduledAt,
    openedAt: null,
    openingOfficer: detail.openingOfficer,
    quorum: { required: 2, confirmed: 1, met: false },
    envelopesOpened: 0,
    publicReleaseApproved: false,
  };
}

describe('OpeningPage (BUY-20)', () => {
  it('lists tenders in opening with their progress, official deadline and next session', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/opening/tenders': () => ({ body: page([tenderRow()]) }),
      'GET /api/v1/buyer/opening/sessions': () => ({ body: page([sessionRow()]) }),
    });
    renderWithProviders(<OpeningPage />, { state: stateFor(['bid.open', 'bid.witness']) });

    const table = await screen.findByRole('table', { name: 'Tenders in opening' });
    const row = within(table).getByRole('row', { name: /T-2026-0008/ });
    expect(within(row).getByText('Awaiting opening')).toBeInTheDocument();
    expect(within(row).getByText('Price gate pending')).toBeInTheDocument();
    expect(within(row).getAllByText(/\(UTC\+02:00\) Africa\/Gaborone/).length).toBeGreaterThan(0);
    expect(requests.some((request) => request.search.includes('progress=awaiting_opening'))).toBe(
      true,
    );
  });

  it('sends the status filter and returns to the first page when a filter changes', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/opening/tenders': () => ({ body: page([tenderRow()]) }),
      'GET /api/v1/buyer/opening/sessions': () => ({ body: page([]) }),
    });
    renderWithProviders(<OpeningPage />, { state: stateFor(['bid.open']) });
    await screen.findByRole('table', { name: 'Tenders in opening' });

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'closed');

    expect(
      requests.some(
        (request) => request.search.includes('status=closed') && request.search.includes('page=1'),
      ),
    ).toBe(true);
  });

  it('shows the sessions tab with quorum confirmations', async () => {
    installFetch({
      'GET /api/v1/buyer/opening/tenders': () => ({ body: page([]) }),
      'GET /api/v1/buyer/opening/sessions': () => ({ body: page([sessionRow()]) }),
    });
    renderWithProviders(<OpeningPage />, {
      state: stateFor(['bid.open']),
      route: '/buyer/opening?tab=sessions',
    });

    const table = await screen.findByRole('table', { name: 'Opening sessions' });
    expect(within(table).getByText('1 of 2 confirmed')).toBeInTheDocument();
    expect(within(table).getByText('Oratile Baitse')).toBeInTheDocument();
  });

  it('shows the restricted state and no tender when the API refuses the role (AC-15)', async () => {
    installFetch({
      'GET /api/v1/buyer/opening/tenders': () => problem(403, 'Forbidden', { code: 'FORBIDDEN' }),
      'GET /api/v1/buyer/opening/sessions': () => problem(403, 'Forbidden', { code: 'FORBIDDEN' }),
    });
    renderWithProviders(<OpeningPage />, { state: stateFor(['bid.open']) });

    expect((await screen.findAllByText('Restricted')).length).toBeGreaterThan(0);
    expect(screen.queryByText('T-2026-0008')).not.toBeInTheDocument();
  });
});
