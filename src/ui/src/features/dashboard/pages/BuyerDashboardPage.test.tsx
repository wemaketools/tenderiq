import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PermissionCode } from '@contracts/permissions';

import { resetServerClock, syncServerClock } from '../../../lib/clock';
import { PageSlotsContext } from '../../../components/ui';
import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import type { RenderOptions } from '../../../test/render';
import { EMPTY_PAGE, buyerState } from '../../reports/testSession';
import { BUYER_DASHBOARD } from '../testData';
import BuyerDashboardPage from './BuyerDashboardPage';

const MANAGER: PermissionCode[] = ['dashboard.view', 'report.view', 'report.manage'];

function routes(body: unknown = BUYER_DASHBOARD) {
  return installFetch({
    'GET /api/v1/buyer/dashboard': () => ({ body }),
    'GET /api/v1/me/saved-views': () => ({ body: EMPTY_PAGE }),
  });
}

/** The demo clock: the fixture's "as of" instant (7 Oct 2026, 14:00 in Africa/Gaborone). */
const NOW = '2026-10-07T12:00:00Z';

beforeEach(() => {
  syncServerClock(NOW, Date.now());
});

afterEach(() => {
  resetServerClock();
  vi.unstubAllGlobals();
});

/** The page inside the buyer presentation of the shell (content heading), as a buyer organization gets it. */
function renderPage(options: RenderOptions) {
  return renderWithProviders(
    <PageSlotsContext.Provider value={{ presentation: 'buyer', title: null, sectionAction: null }}>
      <BuyerDashboardPage />
    </PageSlotsContext.Provider>,
    options,
  );
}

describe('BuyerDashboardPage (BUY-01)', () => {
  it('shows the KPI cards, pipeline, deadlines, approvals, attention and renewals of the buyer', async () => {
    routes();
    renderPage({ state: buyerState(MANAGER) });

    const active = await screen.findByRole('region', { name: 'Active events' });
    expect(within(active).getByText('7')).toBeInTheDocument();
    for (const label of [
      'Pending approvals',
      'Closing within 7 days',
      'Open complaints',
      'Renewals within 90 days',
      'Overdue obligations',
    ]) {
      expect(screen.getAllByRole('region', { name: label }).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole('list', { name: 'Pipeline by stage' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Pending approvals' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Requires attention' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Upcoming renewals' })).toBeInTheDocument();
    const deadlines = screen.getByRole('list', { name: 'Upcoming deadlines' });
    expect(within(deadlines).getAllByTestId('official-deadline').length).toBeGreaterThan(0);
    const glance = screen.getByRole('table', { name: 'Tenders with their next deadline' });
    expect(within(glance).getAllByTestId('official-deadline').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('heading', { level: 1, name: 'A clear view of today.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Overview · Wed, 7 Oct 2026')).toHaveClass('tiq-hero-eyebrow');
    expect(document.title).toBe('Overview · TenderIQ');
  });

  it('counts the decisions from the approvals and exceptions and never claims everything is moving while something is not', async () => {
    routes();
    renderPage({ state: buyerState(MANAGER) });
    // 9 approvals waiting + 10 attention items, each counted once.
    expect(await screen.findByText('19 decisions need you.')).toBeInTheDocument();
    expect(screen.getByText('Deadlines and exceptions are listed below.')).toBeInTheDocument();
    expect(screen.queryByText('Everything else is moving.')).not.toBeInTheDocument();
  });

  it('says everything else is moving only when nothing needs attention, nothing is overdue and the data is complete', async () => {
    routes({
      ...BUYER_DASHBOARD,
      attention: [],
      approvals: {
        restricted: false,
        items: BUYER_DASHBOARD.approvals.items.filter((item) => !item.overdue).slice(0, 2),
      },
      completeness: { complete: true, note: null },
    });
    renderPage({ state: buyerState(MANAGER) });
    expect(await screen.findByText('2 decisions need you.')).toBeInTheDocument();
    expect(screen.getByText('Everything else is moving.')).toBeInTheDocument();
  });

  it('lists up next by due instant, approvals and deadlines merged, each approval once, five at most', async () => {
    routes({
      ...BUYER_DASHBOARD,
      approvals: {
        restricted: false,
        items: [
          ...BUYER_DASHBOARD.approvals.items,
          // The same approval reported twice must show once.
          BUYER_DASHBOARD.approvals.items[2]!,
        ],
      },
    });
    renderPage({ state: buyerState(MANAGER) });

    const list = await screen.findByRole('list', { name: 'Up next' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    const titles = rows.map((row) => row.querySelector('.tiq-row-title')?.textContent);
    expect(titles).toEqual([
      // Overdue since 3 Oct, then the questions deadline today at 15:00, then the 15:00 and 17:00 approvals.
      'Exclude Makgadikgadi Civil Works from T-2026-0003 (REQ-Q-03)',
      'Questions deadline',
      'Confirm funding for PR-2026-0003',
      'Late submission exception — Chobe Pipe & Valve Supplies on T-2026-0002',
      'Approve PR-2026-0002 Chlorine analyser replacement',
    ]);
    expect(within(rows[0]!).getByText('Overdue')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Today')).toBeInTheDocument();
    expect(within(rows[1]!).getByTestId('official-deadline')).toHaveTextContent(
      '7 Oct 2026, 15:00 (UTC+02:00) Africa/Gaborone',
    );
    expect(within(rows[4]!).getByText('Tomorrow')).toBeInTheDocument();
    expect(within(rows[0]!).getByRole('link', { name: /^Open Exclude/ })).toHaveAttribute(
      'href',
      '/me/approvals/37',
    );
    // 9 approvals (one of them reported twice) and the 8 deadlines still ahead.
    expect(screen.getByText('17 items')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All approvals' })).toHaveAttribute(
      'href',
      '/me/approvals',
    );
  });

  it('marks today and the days with deadlines on the week strip, in the official zone', async () => {
    routes();
    renderPage({ state: buyerState(MANAGER) });

    const strip = await screen.findByRole('list', { name: 'This week' });
    const days = within(strip).getAllByRole('listitem');
    expect(days.map((day) => day.getAttribute('data-date'))).toEqual([
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
    ]);
    expect(days[0]).toHaveClass('tiq-daystrip-item--today', 'tiq-daystrip-item--busy');
    expect(days[0]?.querySelector('.tiq-visually-hidden')).toHaveTextContent(
      'Today, Wed 7 1 deadline',
    );
    // 9 Oct 23:59 Gaborone (21:59Z) stays on the 9th in the official zone.
    expect(days[2]).toHaveClass('tiq-daystrip-item--busy');
    expect(days[1]).not.toHaveClass('tiq-daystrip-item--busy');
    expect(screen.getByText('BWP 22.4M')).toBeInTheDocument();
    expect(screen.getByText('in your procurement pipeline')).toBeInTheDocument();
    expect(screen.getByText('3 contract renewals to plan')).toBeInTheDocument();
  });

  it('labels the first column of the workload table as the owner, not a generic category', async () => {
    routes();
    renderPage({ state: buyerState(MANAGER) });

    const workload = await screen.findByRole('table', { name: 'Workload by owner' });
    expect(within(workload).getByRole('columnheader', { name: 'Owner' })).toBeInTheDocument();
    expect(
      within(workload).queryByRole('columnheader', { name: 'Category' }),
    ).not.toBeInTheDocument();
  });

  it('states that data is incomplete instead of counting missing values as zero', async () => {
    routes();
    renderPage({ state: buyerState(MANAGER) });
    expect(await screen.findByText('Some information is incomplete')).toBeInTheDocument();
  });

  it('leaves out a KPI and the workload card the role may not read, with no lock or explanation', async () => {
    routes({
      ...BUYER_DASHBOARD,
      kpis: BUYER_DASHBOARD.kpis.map((kpi) =>
        kpi.key === 'overdue_obligations'
          ? { ...kpi, value: null, restricted: true, delta: null }
          : kpi,
      ),
      workload: { restricted: true, items: [] },
    });
    renderPage({ state: buyerState(MANAGER) });

    expect(await screen.findByRole('region', { name: 'Active events' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Overdue obligations' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Workload by owner' })).not.toBeInTheDocument();
    expect(screen.queryByText(/limited to procurement managers/)).not.toBeInTheDocument();
    expect(screen.queryByText('Not available in your role')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Pipeline by stage' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'This week' })).toBeInTheDocument();
  });

  it('leaves out every card and the pipeline value the role may not read, so no link leads to a forbidden page', async () => {
    routes({
      ...BUYER_DASHBOARD,
      pipelineValue: null,
      pipelineByStage: { restricted: true, items: [] },
      deadlines: { restricted: true, items: [] },
      approvals: { restricted: true, items: [] },
      renewals: { restricted: true, items: [] },
    });
    renderPage({ state: buyerState(MANAGER) });

    expect(await screen.findByRole('list', { name: 'Requires attention' })).toBeInTheDocument();
    for (const heading of [
      'Your tenders, at a glance',
      'This week',
      'Pending approvals',
      'Upcoming renewals',
      'Looking ahead',
    ]) {
      expect(screen.queryByRole('heading', { name: heading })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('list', { name: 'Pipeline by stage' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Upcoming deadlines' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Open pipeline value' })).not.toBeInTheDocument();
    expect(screen.queryByText('in your procurement pipeline')).not.toBeInTheDocument();
    for (const name of ['View all tenders', 'All approvals', 'Open my tasks', 'View contracts']) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/your role/i)).not.toBeInTheDocument();
    // Nothing to decide and nothing to show: the lede says so without a fabricated figure.
    expect(screen.getByText('Up next')).toBeInTheDocument();
    expect(screen.getByText('0 items')).toBeInTheDocument();
  });

  it('gives the attention card the full width when the approvals card is left out', async () => {
    routes({ ...BUYER_DASHBOARD, approvals: { restricted: true, items: [] } });
    renderPage({ state: buyerState(MANAGER) });

    const attention = await screen.findByRole('list', { name: 'Requires attention' });
    expect(attention.closest('.tiq-grid')).toBeNull();
    expect(screen.queryByRole('link', { name: 'All approvals' })).not.toBeInTheDocument();
    // Up next still lists the deadlines ahead (the approvals contribute nothing).
    const upNext = screen.getByRole('list', { name: 'Up next' });
    expect(within(upNext).getAllByRole('listitem')).toHaveLength(5);
    expect(within(upNext).queryByText(/Approve PR-/)).not.toBeInTheDocument();
  });

  it('lays the approvals and attention cards out beside each other when both may be read', async () => {
    routes({ ...BUYER_DASHBOARD, workload: { restricted: true, items: [] } });
    renderPage({ state: buyerState(MANAGER) });

    const attention = await screen.findByRole('list', { name: 'Requires attention' });
    expect(attention.closest('.tiq-grid')).toHaveClass('tiq-grid--sidebar');
    expect(screen.queryByRole('heading', { name: 'Workload by owner' })).not.toBeInTheDocument();
  });

  it('keeps every filter behind the Filters disclosure and sends the chosen department to the API', async () => {
    const { requests } = routes();
    renderPage({ state: buyerState(MANAGER) });
    await screen.findByRole('region', { name: 'Active events' });

    expect(screen.queryByLabelText('Department')).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Filters' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide filters' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    for (const label of ['Date from', 'Date to', 'Legal entity', 'Owner', 'Category', 'Stage']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('group', { name: 'Quick date ranges' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Department'), 'Network Operations');

    await waitFor(() =>
      expect(requests.some((request) => request.search.includes('departmentId=3'))).toBe(true),
    );
  });

  it('offers management reports only to report holders', async () => {
    routes();
    renderPage({ state: buyerState(['dashboard.view']) });
    await screen.findByRole('region', { name: 'Active events' });
    expect(screen.queryByRole('link', { name: 'Management reports' })).not.toBeInTheDocument();
  });

  it('explains a failed load with a retry', async () => {
    installFetch({
      'GET /api/v1/buyer/dashboard': () => problem(500, 'Internal Server Error'),
      'GET /api/v1/me/saved-views': () => ({ body: EMPTY_PAGE }),
    });
    renderPage({ state: buyerState(MANAGER) });
    expect(await screen.findByText('The dashboard could not be loaded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
