import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AdvanceNoticeRow, PlanItemRow } from '@contracts/requests';

import { installFetch } from '../../../test/fetchMock';
import { options } from '../../requests/testing/data';
import { renderPage } from '../../requests/testing/render';
import { calendar, demand, notice, planItem } from '../testing/data';
import PlanningPage from './PlanningPage';

const {
  dependents: _d,
  advanceNotices: _n,
  createdAt: _c,
  updatedAt: _u,
  allowedActions: _a,
  ...itemRow
} = planItem;
const row: PlanItemRow = itemRow;
const {
  withdrawnReason: _w,
  publishReadiness: _r,
  portalShowsAdvanceNotices: _p,
  allowedActions: _na,
  ...noticeRow
} = notice;
const noticeListRow: AdvanceNoticeRow = noticeRow;

afterEach(() => {
  vi.unstubAllGlobals();
});

function render() {
  return installFetch({
    'GET /api/v1/buyer/plan-items': () => ({
      body: { items: [row], total: 1, page: 1, pageSize: 25 },
    }),
    'GET /api/v1/buyer/advance-notices': () => ({
      body: { items: [noticeListRow], total: 1, page: 1, pageSize: 25 },
    }),
    'GET /api/v1/buyer/request-options': () => ({ body: options }),
    'GET /api/v1/buyer/plan-calendar': () => ({ body: calendar }),
    'GET /api/v1/buyer/plan-resource-demand': () => ({ body: demand }),
  });
}

describe('PlanningPage (BUY-05)', () => {
  it('lists plan items with owner, budget period, release, demand, dependency and warnings', async () => {
    render();
    renderPage(<PlanningPage />, { route: '/buyer/planning' });

    const table = await screen.findByRole('table', { name: 'Plan items' });
    const cells = within(table).getByText(planItem.title).closest('tr') as HTMLElement;
    expect(within(cells).getByText(planItem.budgetPeriod)).toBeInTheDocument();
    expect(within(cells).getByText(`${planItem.resourceDemandDays} days`)).toBeInTheDocument();
    if (planItem.dependsOn !== null) {
      expect(within(cells).getByText(`Depends on ${planItem.dependsOn.title}`)).toBeInTheDocument();
    }
    expect(screen.getByText('Scheduling warnings').closest('.tiq-kpi')).toBeInTheDocument();
  });

  it('places planned events on the month calendar and flags the owner over capacity', async () => {
    render();
    renderPage(<PlanningPage />, {
      route: '/buyer/planning',
      filters: {
        'BUY-05': { tab: 'calendar' },
        'BUY-05.calendar': { month: '2026-11', owner: '' },
      },
    });

    const grid = await screen.findByRole('table', {
      name: 'Procurement calendar for November 2026',
    });
    expect(
      within(grid).getByTitle('Planned release: Mobile water tanker hire for drought relief'),
    ).toBeInTheDocument();
    const demandTable = screen.getByRole('table', { name: 'Resource demand in November 2026' });
    expect(within(demandTable).getByText('41 / 18 d')).toBeInTheDocument();
    expect(within(demandTable).getByText('Over capacity')).toBeInTheDocument();
  });

  it('moves to the next month when Next is pressed', async () => {
    const { requests } = render();
    renderPage(<PlanningPage />, {
      route: '/buyer/planning',
      filters: {
        'BUY-05': { tab: 'calendar' },
        'BUY-05.calendar': { month: '2026-11', owner: '' },
      },
    });
    await screen.findByRole('table', { name: 'Procurement calendar for November 2026' });

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(
      await screen.findByRole('table', { name: 'Procurement calendar for December 2026' }),
    ).toBeInTheDocument();
    expect(requests.some((item) => item.search.includes('month=2026-12'))).toBe(true);
  });

  it('shows resource demand per owner and month', async () => {
    render();
    renderPage(<PlanningPage />, {
      route: '/buyer/planning',
      filters: { 'BUY-05': { tab: 'demand' } },
    });

    const table = await screen.findByRole('table', { name: /Resource demand,/ });
    expect(within(table).getByText('Mpho Dikgang')).toBeInTheDocument();
    expect(within(table).getByText('Capacity 8 days a month')).toBeInTheDocument();
  });

  it('lists advance notices with status and plan item', async () => {
    render();
    renderPage(<PlanningPage />, {
      route: '/buyer/planning',
      filters: { 'BUY-05': { tab: 'notices' } },
    });

    const table = await screen.findByRole('table', { name: 'Advance notices' });
    expect(within(table).getByText(notice.indicativeTiming)).toBeInTheDocument();
    expect(within(table).getByText('Not published')).toBeInTheDocument();
  });

  it('hides the create actions from a reader without plan.manage', async () => {
    render();
    renderPage(<PlanningPage />, { route: '/buyer/planning', permissions: ['request.view_all'] });

    await screen.findByRole('table', { name: 'Plan items' });
    expect(screen.queryByRole('link', { name: /New plan item/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /New advance notice/ })).not.toBeInTheDocument();
  });
});
