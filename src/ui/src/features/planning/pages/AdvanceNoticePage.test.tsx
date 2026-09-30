import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AdvanceNoticeDetail, PlanItemRow } from '@contracts/requests';

import { installFetch } from '../../../test/fetchMock';
import { options } from '../../requests/testing/data';
import { renderPage } from '../../requests/testing/render';
import { notice, planItem } from '../testing/data';
import AdvanceNoticeFormPage from './AdvanceNoticeFormPage';
import AdvanceNoticePage from './AdvanceNoticePage';

const ready: AdvanceNoticeDetail = {
  ...notice,
  eoiInstructions: 'Register under category LAB-EQP.',
  publishReadiness: notice.publishReadiness.map((item) => ({ ...item, status: 'passed' as const })),
  allowedActions: ['edit', 'publish'],
};
const published: AdvanceNoticeDetail = {
  ...ready,
  status: 'published',
  publishedAt: '2026-09-30T08:00:00Z',
  publishedBy: { userId: 5, fullName: 'Tebogo Molefe' },
  publicPath: '/plans/kwu/403',
  allowedActions: ['withdraw'],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function render(detail: AdvanceNoticeDetail, routes: Parameters<typeof installFetch>[0] = {}) {
  const fetch = installFetch({
    [`GET /api/v1/buyer/advance-notices/${detail.id}`]: () => ({ body: detail }),
    'GET /api/v1/buyer/request-options': () => ({ body: options }),
    ...routes,
  });
  renderPage(<AdvanceNoticePage />, {
    route: `/buyer/planning/notices/${detail.id}`,
    path: '/buyer/planning/notices/:noticeId',
  });
  return fetch;
}

describe('AdvanceNoticePage (BUY-05 → PUB-06)', () => {
  it('separates blocking readiness items from passed ones and offers no publication while blocked', async () => {
    render(notice);

    expect(await screen.findByText('2 blocking items')).toBeInTheDocument();
    expect(screen.getByText('Plan item scheduled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish notice' })).not.toBeInTheDocument();
    expect(screen.getByText(/never an invitation to submit a bid/)).toBeInTheDocument();
  });

  it('publishes only after the forecast acknowledgement is ticked', async () => {
    const { requests } = render(ready, {
      [`POST /api/v1/buyer/advance-notices/${ready.id}/publish`]: () => ({ body: published }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Publish notice' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Publish notice' });
    expect(confirm).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('checkbox'));
    await userEvent.click(confirm);

    await waitFor(() => expect(requests.some((item) => item.method === 'POST')).toBe(true));
    expect(await screen.findByText('Advance notice published.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View public page' })).toHaveAttribute(
      'href',
      '/plans/kwu/403',
    );
  });

  it('withdraws a published notice with the reason given', async () => {
    const { requests } = render(published, {
      [`POST /api/v1/buyer/advance-notices/${published.id}/withdraw`]: () => ({
        body: {
          ...published,
          status: 'withdrawn',
          withdrawnReason: 'Plan changed.',
          allowedActions: [],
        },
      }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Withdraw notice' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Plan changed.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Withdraw notice' }));

    await waitFor(() =>
      expect(requests.find((item) => item.method === 'POST')?.body).toEqual({
        reason: 'Plan changed.',
      }),
    );
    expect(await screen.findByText('Advance notice withdrawn.')).toBeInTheDocument();
  });
});

describe('AdvanceNoticeFormPage (BUY-05)', () => {
  it('creates a draft notice for the plan item given in the link', async () => {
    const {
      dependents: _d,
      advanceNotices: _n,
      createdAt: _c,
      updatedAt: _u,
      allowedActions: _a,
      ...rest
    } = planItem;
    const row: PlanItemRow = rest;
    const { requests } = installFetch({
      'GET /api/v1/buyer/request-options': () => ({ body: options }),
      'GET /api/v1/buyer/plan-items': () => ({
        body: { items: [row], total: 1, page: 1, pageSize: 100 },
      }),
      'POST /api/v1/buyer/advance-notices': () => ({ status: 201, body: { ...notice, id: 900 } }),
    });
    renderPage(<AdvanceNoticeFormPage />, {
      route: `/buyer/planning/notices/new?planItemId=${planItem.id}`,
      path: '/buyer/planning/notices/new',
    });

    await userEvent.type(await screen.findByLabelText(/^Notice title/), 'Pipeline extension');
    await userEvent.type(
      screen.getByLabelText(/^Summary of the planned procurement/),
      'Supply and laying of 14 km of pipeline.',
    );
    await userEvent.type(screen.getByLabelText(/^Indicative timing/), 'Q1 2027');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(requests.find((item) => item.method === 'POST')).toBeDefined());
    expect(requests.find((item) => item.method === 'POST')?.body).toMatchObject({
      planItemId: planItem.id,
      title: 'Pipeline extension',
      indicativeTiming: 'Q1 2027',
    });
    expect(await screen.findByText('Draft saved, not published')).toBeInTheDocument();
  });
});
