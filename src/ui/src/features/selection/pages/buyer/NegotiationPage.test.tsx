import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../../test/fetchMock';
import { setDateTime } from '../../testing/interact';
import { negotiationDetail } from '../../testing/data';
import { AUDITOR, OFFICER, renderSelection } from '../../testing/render';
import NegotiationPage from './NegotiationPage';

afterEach(() => vi.unstubAllGlobals());

const PATH = '/buyer/selection/negotiations/:negotiationId';
const ROUTE = '/buyer/selection/negotiations/2';

describe('NegotiationPage', () => {
  it('shows the mandate and round history with minutes and unresolved terms', async () => {
    installFetch({
      'GET /api/v1/buyer/selection/negotiations/2': () => ({ body: negotiationDetail() }),
    });
    renderSelection(<NegotiationPage />, { path: PATH, route: ROUTE, permissions: AUDITOR });
    expect(await screen.findByText('Round 1')).toBeInTheDocument();
    expect(screen.getByText('Discussed service credits within the mandate.')).toBeInTheDocument();
    expect(screen.getByText('Service-credit cap.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record round' })).not.toBeInTheDocument();
  });

  it('shows the topics each round covered and its meeting time in the official zone (DD-33)', async () => {
    installFetch({
      'GET /api/v1/buyer/selection/negotiations/2': () => ({ body: negotiationDetail() }),
    });
    renderSelection(<NegotiationPage />, { path: PATH, route: ROUTE, permissions: AUDITOR });
    expect(await screen.findByText('Service credits · Data ownership')).toBeInTheDocument();
    expect(
      screen.getByText(/20 Sep 2026, 10:00 \(UTC\+02:00\) Africa\/Gaborone/),
    ).toBeInTheDocument();
  });

  it('records a round limited to the authorized topics', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/selection/negotiations/2': () => ({ body: negotiationDetail() }),
      'POST /api/v1/buyer/selection/negotiations/2/rounds': () => ({
        status: 201,
        body: { ...negotiationDetail().rounds[0], roundId: 9001, roundNo: 2 },
      }),
    });
    renderSelection(<NegotiationPage />, { path: PATH, route: ROUTE, permissions: OFFICER });
    fireEvent.click(await screen.findByRole('button', { name: 'Record round' }));
    const dialog = screen.getByRole('dialog');
    setDateTime(dialog, /^Meeting/, '2026-10-06', '10:00');
    fireEvent.change(within(dialog).getByLabelText(/^Participants/), {
      target: { value: 'Both teams' },
    });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Service credits' }));
    fireEvent.change(within(dialog).getByLabelText(/^Minutes/), {
      target: { value: 'Agreed 7.5%.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record round' }));
    expect(await screen.findByText('Round recorded.')).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'POST')?.body).toMatchObject({
      topics: ['Service credits'],
      supplierVisible: true,
    });
  });

  it('explains why rounds cannot be recorded when the mandate is not approved', async () => {
    installFetch({
      'GET /api/v1/buyer/selection/negotiations/2': () => ({
        body: negotiationDetail({
          status: 'planned',
          roundGate: {
            allowed: false,
            blockers: [{ code: 'MANDATE_NOT_APPROVED', message: 'The mandate is not approved.' }],
          },
        }),
      }),
    });
    renderSelection(<NegotiationPage />, { path: PATH, route: ROUTE, permissions: OFFICER });
    expect(await screen.findByText('Rounds cannot be recorded')).toBeInTheDocument();
    expect(document.querySelector('[data-code="MANDATE_NOT_APPROVED"]')).not.toBeNull();
    expect(screen.queryByText(/MANDATE_NOT_APPROVED/)).not.toBeInTheDocument();
  });
});
