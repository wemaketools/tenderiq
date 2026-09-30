import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { session, stateFor } from '../test/data';
import OpeningSessionPage from './OpeningSessionPage';

const PATH = '/buyer/opening/sessions/:sessionId';
const ROUTE = '/buyer/opening/sessions/180';

describe('OpeningSessionPage (BUY-20)', () => {
  it('separates blocking readiness conditions from passed ones before opening', async () => {
    installFetch({ 'GET /api/v1/buyer/opening/sessions/180': () => ({ body: session() }) });
    renderWithProviders(<OpeningSessionPage />, {
      state: stateFor(['bid.open', 'bid.witness']),
      path: PATH,
      route: ROUTE,
    });

    expect(await screen.findByText('Qualification opening · T-2026-0008')).toBeInTheDocument();
    expect(screen.getByText('1 blocking')).toBeInTheDocument();
    expect(
      screen.getAllByText(/The required witnesses or committee members have not all confirmed/)
        .length,
    ).toBeGreaterThan(0);
    const participants = screen.getByRole('table', { name: 'Required participants' });
    expect(within(participants).getByText('Awaiting confirmation')).toBeInTheDocument();
  });

  it('opens only after the officer confirms having no conflict and shows QUORUM_NOT_MET clearly', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/opening/sessions/180': () => ({ body: session() }),
      'POST /api/v1/buyer/opening/sessions/180/open': () =>
        problem(409, 'Conflict', { code: 'QUORUM_NOT_MET', detail: 'Quorum.' }),
    });
    renderWithProviders(<OpeningSessionPage />, {
      state: stateFor(['bid.open']),
      path: PATH,
      route: ROUTE,
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Open envelopes' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Kalahari Water Utilities (Pilot)')).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: 'Open envelopes' });
    expect(confirm).toBeDisabled();
    await userEvent.click(within(dialog).getByLabelText(/no conflict of interest/));
    await userEvent.click(confirm);

    expect(
      await within(dialog).findByText(/The required officer and witnesses/),
    ).toBeInTheDocument();
    const post = requests.find((request) => request.method === 'POST');
    expect(post?.body).toEqual({ noConflictConfirmed: true });
  });

  it('shows the unseal records returned by a successful opening', async () => {
    installFetch({
      'GET /api/v1/buyer/opening/sessions/180': () => ({
        body: session({
          quorum: { required: 2, confirmed: 2, met: true },
          readiness: [{ code: 'quorum', status: 'passed' }],
        }),
      }),
      'POST /api/v1/buyer/opening/sessions/180/open': () => ({
        body: session({
          status: 'completed',
          openedAt: '2026-09-30T08:04:00Z',
          quorum: { required: 2, confirmed: 2, met: true },
          envelopesOpened: 1,
          openings: [
            {
              id: 990,
              bidId: 8001,
              revisionId: 80011,
              supplier: { tenantId: 4, name: 'Tsodilo Engineering (Pty) Ltd' },
              envelope: 'qualification',
              openedAt: '2026-09-30T08:04:00Z',
            },
          ],
        }),
      }),
    });
    renderWithProviders(<OpeningSessionPage />, {
      state: stateFor(['bid.open']),
      path: PATH,
      route: ROUTE,
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Open envelopes' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText(/no conflict of interest/));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Open envelopes' }));

    const records = await screen.findByRole('table', { name: 'Unseal records' });
    expect(within(records).getByText('Tsodilo Engineering (Pty) Ltd')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('lets a witness confirm presence but never open (BR-05)', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/opening/sessions/180': () => ({
        body: session({ myParticipantId: 1802 }),
      }),
      'POST /api/v1/buyer/opening/sessions/180/participants/1802/confirm': () => ({
        body: {
          sessionId: 180,
          participant: {
            id: 1802,
            user: { userId: 16, fullName: 'Goitse Mooketsi' },
            capacity: 'Opening Witness',
            role: 'witness',
            confirmedAt: '2026-09-30T07:56:00Z',
          },
          sessionStatus: 'awaiting_quorum',
          quorum: { required: 2, confirmed: 2, met: true },
        },
      }),
    });
    renderWithProviders(<OpeningSessionPage />, {
      state: stateFor(['bid.witness'], 16),
      path: PATH,
      route: ROUTE,
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Confirm my presence' }));
    expect(screen.queryByRole('button', { name: 'Open envelopes' })).not.toBeInTheDocument();
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText(/I am present/));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm my presence' }));

    expect(await screen.findByText('2 of 2 confirmed')).toBeInTheDocument();
    expect(requests.some((request) => request.path.endsWith('/participants/1802/confirm'))).toBe(
      true,
    );
  });

  it('records minutes of a completed session and marks them saved', async () => {
    const completed = session({ status: 'completed', openedAt: '2026-09-30T08:04:00Z' });
    const { requests } = installFetch({
      'GET /api/v1/buyer/opening/sessions/180': () => ({ body: completed }),
      'PUT /api/v1/buyer/opening/sessions/180/record': () => ({
        body: { ...completed, minutes: 'Opened one envelope.' },
      }),
    });
    renderWithProviders(<OpeningSessionPage />, {
      state: stateFor(['bid.open']),
      path: PATH,
      route: ROUTE,
    });

    const minutes = await screen.findByLabelText(/^Minutes/);
    await userEvent.type(minutes, 'Opened one envelope.');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save minutes' }));

    expect(await screen.findByText('Saved in the opening record.')).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'PUT')?.body).toEqual({
      minutes: 'Opened one envelope.',
      irregularities: null,
    });
  });
});
