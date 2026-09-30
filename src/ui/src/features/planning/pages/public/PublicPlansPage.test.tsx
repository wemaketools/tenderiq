import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../../test/fetchMock';
import { renderWithProviders } from '../../../../test/render';
import { publicNotices, publicSummary } from '../../testing/data';
import PublicNoticePage from './PublicNoticePage';
import PublicPlansPage from './PublicPlansPage';

const first = publicNotices.items[0];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PublicPlansPage (PUB-06)', () => {
  it('states that forecasts are not invitations and lists planned categories and notices', async () => {
    installFetch({
      'GET /api/v1/public/procurement-plans': () => ({ body: publicSummary }),
      'GET /api/v1/public/advance-notices': () => ({ body: publicNotices }),
    });
    renderWithProviders(<PublicPlansPage />, { route: '/plans' });

    expect(screen.getByText('Forecasts, not invitations to bid')).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Advance notices' });
    expect(within(table).getAllByRole('row')).toHaveLength(publicNotices.items.length + 1);
    expect(screen.getByRole('list', { name: 'Planned categories' })).toBeInTheDocument();
  });

  it('shows the empty state when no buyer publishes notices', async () => {
    installFetch({
      'GET /api/v1/public/procurement-plans': () => ({ body: { buyers: [] } }),
      'GET /api/v1/public/advance-notices': () => ({
        body: { items: [], total: 0, page: 1, pageSize: 25 },
      }),
    });
    renderWithProviders(<PublicPlansPage />, { route: '/plans' });

    expect(
      await screen.findByText('No buyer has published advance notices yet.'),
    ).toBeInTheDocument();
  });
});

describe('PublicNoticePage (PUB-06)', () => {
  if (first === undefined) throw new Error('fixture has a published notice');
  const path = `/api/v1/public/advance-notices/${first.buyer.slug}/${first.id}`;

  function render(routes: Parameters<typeof installFetch>[0]) {
    const fetch = installFetch({ [`GET ${path}`]: () => ({ body: first }), ...routes });
    renderWithProviders(<PublicNoticePage />, {
      route: `/plans/${first?.buyer.slug}/${first?.id}`,
      path: '/plans/:buyerSlug/:noticeId',
    });
    return fetch;
  }

  it('follows the opportunity by email and shows the confirmation message', async () => {
    const { requests } = render({
      [`POST ${path}/follow`]: () => ({
        status: 202,
        body: {
          noticeId: first.id,
          status: 'confirmation_sent',
          message: 'We sent a confirmation link.',
        },
      }),
    });

    await userEvent.type(await screen.findByLabelText(/^Email address/), 'bids@example.org');
    await userEvent.click(screen.getByRole('button', { name: 'Follow' }));

    await waitFor(() =>
      expect(requests.find((item) => item.method === 'POST')?.body).toEqual({
        email: 'bids@example.org',
        organizationName: null,
      }),
    );
    expect(await screen.findByText('We sent a confirmation link.')).toBeInTheDocument();
  });

  it('refuses an invalid email without calling the API', async () => {
    const { requests } = render({});

    await userEvent.type(await screen.findByLabelText(/^Email address/), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Follow' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(requests.some((item) => item.method === 'POST')).toBe(false);
  });

  it('explains NOTICE_NOT_AVAILABLE when the notice was withdrawn meanwhile', async () => {
    render({
      [`POST ${path}/follow`]: () =>
        problem(409, 'Not available', { code: 'NOTICE_NOT_AVAILABLE' }),
    });

    await userEvent.type(await screen.findByLabelText(/^Email address/), 'bids@example.org');
    await userEvent.click(screen.getByRole('button', { name: 'Follow' }));

    expect(await screen.findByText('This notice is no longer published.')).toBeInTheDocument();
  });
});
