import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../../test/fetchMock';
import { page, supplierInvite } from '../../testing/data';
import { renderSelection } from '../../testing/render';
import SupplierInvitesPage from './SupplierInvitesPage';

afterEach(() => vi.unstubAllGlobals());

const PATH = '/supplier/assessment-invites';

describe('SupplierInvitesPage', () => {
  it('lists the supplier’s own appointments with the announced basis and preparation time', async () => {
    installFetch({
      'GET /api/v1/supplier/selection/assessment-invites': () => ({
        body: page([supplierInvite()]),
      }),
    });
    renderSelection(<SupplierInvitesPage />, { path: PATH, route: PATH, supplier: true });
    const table = await screen.findByRole('table', { name: 'Assessment appointments' });
    expect(within(table).getByText('Claim verification')).toBeInTheDocument();
    expect(within(table).getByText('5 days to prepare')).toBeInTheDocument();
    expect(screen.getByText(/never reopens or replaces the bid/)).toBeInTheDocument();
  });

  it('confirms participation from the appointment details', async () => {
    const { requests } = installFetch({
      'GET /api/v1/supplier/selection/assessment-invites': () => ({
        body: page([supplierInvite()]),
      }),
      'POST /api/v1/supplier/selection/assessment-invites/6/respond': () => ({
        body: supplierInvite({
          status: 'confirmed',
          supplierConfirmedAt: '2026-09-30T08:00:00Z',
          supplierConfirmedBy: { userId: 41, fullName: 'Mothusi Limpopo' },
          respondGate: {
            allowed: false,
            blockers: [{ code: 'INVITE_NOT_OPEN', message: 'Already answered.' }],
          },
        }),
      }),
    });
    renderSelection(<SupplierInvitesPage />, { path: PATH, route: PATH, supplier: true });
    fireEvent.click(await screen.findByText('Interview'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm participation' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm participation' }));
    expect(await screen.findByText('Participation confirmed.')).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      response: 'confirmed',
      note: null,
    });
  });

  it('marks an invite to a cancelled session as cancelled and leaves it out of the counters', async () => {
    const cancelled = supplierInvite({
      inviteId: 9,
      sessionType: 'presentation',
      sessionStatus: 'cancelled',
      status: 'confirmed',
      scheduledAt: '2026-07-22T09:00:00Z',
      supplierConfirmedAt: '2026-07-15T11:30:00Z',
      supplierConfirmedBy: { userId: 41, fullName: 'Mothusi Limpopo' },
      respondGate: {
        allowed: false,
        blockers: [{ code: 'SESSION_CANCELLED', message: 'The buyer cancelled this session.' }],
      },
    });
    installFetch({
      'GET /api/v1/supplier/selection/assessment-invites': () => ({
        body: page([supplierInvite(), cancelled]),
      }),
    });
    renderSelection(<SupplierInvitesPage />, { path: PATH, route: PATH, supplier: true });
    const table = await screen.findByRole('table', { name: 'Assessment appointments' });
    expect(within(table).getByText('Session cancelled by the buyer')).toBeInTheDocument();
    expect(within(table).queryByText('Confirmed')).not.toBeInTheDocument();
    const kpiValue = (name: string): string | null | undefined =>
      screen.getByRole('region', { name }).querySelector('.tiq-kpi-value')?.textContent;
    await vi.waitFor(() => expect(kpiValue('Confirmed')).toBe('0'));
    expect(kpiValue('Awaiting your response')).toBe('1');

    fireEvent.click(within(table).getByText('Presentation'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('The buyer cancelled this session.')).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Confirm participation' }),
    ).not.toBeInTheDocument();
  });

  it('shows the appointment time with its offset and official time zone (DD-33)', async () => {
    installFetch({
      'GET /api/v1/supplier/selection/assessment-invites': () => ({
        body: page([supplierInvite()]),
      }),
    });
    renderSelection(<SupplierInvitesPage />, { path: PATH, route: PATH, supplier: true });
    const table = await screen.findByRole('table', { name: 'Assessment appointments' });
    expect(
      within(table).getByText('7 Oct 2026, 09:00 (UTC+02:00) Africa/Gaborone'),
    ).toBeInTheDocument();
  });

  it('shows the empty state when no buyer invited the supplier', async () => {
    installFetch({
      'GET /api/v1/supplier/selection/assessment-invites': () => ({ body: page([]) }),
    });
    renderSelection(<SupplierInvitesPage />, { path: PATH, route: PATH, supplier: true });
    expect(await screen.findByText('No assessment appointment.')).toBeInTheDocument();
  });
});
