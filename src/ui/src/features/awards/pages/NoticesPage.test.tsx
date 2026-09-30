import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../test/fetchMock';
import { noticePage, overview, publicNoticeState, standstill } from '../test/data';
import { renderBuyer } from '../test/render';
import NoticesPage from './NoticesPage';

const OPTIONS = { route: '/buyer/awards/7/notices', path: '/buyer/awards/:tenderId/notices' };

afterEach(() => {
  vi.unstubAllGlobals();
});

function routes() {
  return {
    'GET /api/v1/buyer/awards/7': () => ({ body: overview() }),
    'GET /api/v1/buyer/awards/7/notices': () => ({ body: noticePage() }),
    'GET /api/v1/buyer/awards/7/standstill': () => ({ body: standstill() }),
    'GET /api/v1/buyer/awards/7/public-notice': () => ({ body: publicNoticeState() }),
  };
}

describe('NoticesPage (BUY-28)', () => {
  it('lists notices with delivery failures and acknowledgments, distinct from a final award', async () => {
    installFetch(routes());
    renderBuyer(<NoticesPage />, OPTIONS);

    expect(await screen.findByText('Intention to award — T-2026-0007')).toBeInTheDocument();
    expect(screen.getByText('An intention to award is not a final award')).toBeInTheDocument();
    expect(screen.getByText('1 delivery failed')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 acknowledged')).toBeInTheDocument();
  });

  it('shows the standstill calendar, official end date and blocked actions', async () => {
    installFetch(routes());
    renderBuyer(<NoticesPage />, OPTIONS);

    await userEvent.click(await screen.findByRole('tab', { name: /Standstill & holds/ }));

    expect(await screen.findByText('Actions currently blocked')).toBeInTheDocument();
    expect(screen.getByText('Botswana Public Holidays 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Extend' })).toBeInTheDocument();
  });

  it('keeps publishing disabled until both reviews and a final award exist', async () => {
    installFetch(routes());
    renderBuyer(<NoticesPage />, OPTIONS);

    await userEvent.click(await screen.findByRole('tab', { name: 'Public award notice' }));

    expect(await screen.findByRole('button', { name: 'Publish' })).toBeDisabled();
    expect(
      screen.getByText('Publishing needs both reviews and at least one final award.'),
    ).toBeInTheDocument();
  });

  it('validates a notice draft with the contract rules before sending', async () => {
    const { requests } = installFetch(routes());
    renderBuyer(<NoticesPage />, OPTIONS);

    await userEvent.click(await screen.findByRole('button', { name: 'Draft notice' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save draft' }));

    expect(await within(dialog).findByText('Choose at least one lot.')).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
  });
});
