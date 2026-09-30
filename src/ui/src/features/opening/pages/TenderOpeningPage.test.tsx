import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { overview, stateFor } from '../test/data';
import TenderOpeningPage from './TenderOpeningPage';

const PATH = '/buyer/opening/tenders/:tenderId';
const ROUTE = '/buyer/opening/tenders/8';

describe('TenderOpeningPage (BUY-20)', () => {
  it('shows the staged plan, the unreleased price gate and receipt metadata only (AC-16, BR-17)', async () => {
    installFetch({ 'GET /api/v1/buyer/opening/tenders/8': () => ({ body: overview() }) });
    renderWithProviders(<TenderOpeningPage />, {
      state: stateFor(['bid.open']),
      path: PATH,
      route: ROUTE,
    });

    expect(await screen.findByText('Opening of T-2026-0008')).toBeInTheDocument();
    expect(screen.getByText('Commercial envelopes stay sealed')).toBeInTheDocument();
    expect(screen.getAllByText('Blocked by the price gate').length).toBeGreaterThan(0);
    const bids = screen.getByRole('table', { name: 'Submissions (receipt metadata)' });
    const receipt = within(bids).getByRole('row', { name: /RCPT-2026-000024/ });
    expect(
      within(receipt).getByText('22 Sep 2026, 12:00 (UTC+02:00) Africa/Gaborone'),
    ).toBeInTheDocument();
    expect(within(bids).getByText('Qualification: Sealed')).toBeInTheDocument();
    expect(
      screen.getByText(/The participants must confirm presence for the Qualification stage/),
    ).toBeInTheDocument();
  });

  it('offers scheduling to the opening officer and shows the business error of the API', async () => {
    installFetch({
      'GET /api/v1/buyer/opening/tenders/8': () => ({ body: overview() }),
      'GET /api/v1/buyer/opening/tenders/8/opening-team': () => ({
        body: {
          items: [
            {
              user: { userId: 15, fullName: 'Oratile Baitse' },
              capacity: 'Bid Opening Officer',
              teamRole: 'opening_officer',
              eligibleRoles: ['opening_officer', 'witness'],
            },
            {
              user: { userId: 16, fullName: 'Goitse Mooketsi' },
              capacity: 'Opening Witness',
              teamRole: 'witness',
              eligibleRoles: ['witness'],
            },
          ],
        },
      }),
      'POST /api/v1/buyer/opening/sessions': () =>
        problem(409, 'Conflict', { code: 'PRICE_GATE_NOT_RELEASED', detail: 'Gate.' }),
    });
    renderWithProviders(<TenderOpeningPage />, {
      state: stateFor(['bid.open']),
      path: PATH,
      route: ROUTE,
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Schedule opening' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByLabelText('Goitse Mooketsi');
    await userEvent.selectOptions(within(dialog).getByLabelText(/Stage/), 'commercial');
    await userEvent.selectOptions(
      within(dialog).getByLabelText('Oratile Baitse'),
      'opening_officer',
    );
    await userEvent.selectOptions(within(dialog).getByLabelText('Goitse Mooketsi'), 'witness');
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: '2026-10-20' } });
    fireEvent.change(within(dialog).getByLabelText('Time'), { target: { value: '10:00' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Schedule session' }));

    expect(
      await within(dialog).findByText(/The price gate has not been released/),
    ).toBeInTheDocument();
  });

  it('validates the participants before sending (officer and witness required)', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/opening/tenders/8': () => ({ body: overview() }),
      'GET /api/v1/buyer/opening/tenders/8/opening-team': () => ({ body: { items: [] } }),
    });
    renderWithProviders(<TenderOpeningPage />, {
      state: stateFor(['bid.open']),
      path: PATH,
      route: ROUTE,
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Schedule opening' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Schedule session' }));

    expect(
      await within(dialog).findByText(/Name the opening officer and at least one witness/),
    ).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
  });

  it('hides scheduling from a witness without the opening authority', async () => {
    installFetch({ 'GET /api/v1/buyer/opening/tenders/8': () => ({ body: overview() }) });
    renderWithProviders(<TenderOpeningPage />, {
      state: stateFor(['bid.witness']),
      path: PATH,
      route: ROUTE,
    });

    await screen.findByText('Opening of T-2026-0008');
    expect(screen.queryByRole('button', { name: 'Schedule opening' })).not.toBeInTheDocument();
  });
});
