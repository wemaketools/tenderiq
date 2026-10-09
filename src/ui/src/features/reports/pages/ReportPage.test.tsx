import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PermissionCode } from '@contracts/permissions';

import { installFetch, problem } from '../../../test/fetchMock';
import type { MockResponse } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { PARTICIPATION } from '../testData';
import { EMPTY_PAGE, buyerState } from '../testSession';
import ReportPage from './ReportPage';

const PERMISSIONS: PermissionCode[] = ['report.view', 'report.manage', 'export.create'];

function routes(run: () => MockResponse = () => ({ body: PARTICIPATION })) {
  return installFetch({
    'GET /api/v1/buyer/reports/participation': run,
    'GET /api/v1/me/saved-views': () => ({ body: EMPTY_PAGE }),
  });
}

function render() {
  renderWithProviders(<ReportPage />, {
    state: buyerState(PERMISSIONS),
    route: '/buyer/reports/participation',
    path: '/buyer/reports/:family',
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ReportPage (REP-01, AC-34)', () => {
  it('labels event and lot rows, totals event rows only and counts organizations once across events', async () => {
    routes();
    render();

    const table = await screen.findByRole('table', {
      name: 'Competition and participation rows',
    });
    expect(within(table).getAllByText('Lot')).toHaveLength(3);
    const total = within(table).getByText('Total (9 rows, lots excluded)').closest('tr');
    const cells = within(total!).getAllByRole('cell');
    const headers = within(table).getAllByRole('columnheader');
    const unique = headers.findIndex(
      (header) => header.textContent === 'Unique bidding organizations',
    );
    expect(cells[unique]).toHaveTextContent('6');
  });

  it('states the counting basis, the currency basis and completeness', async () => {
    routes();
    render();

    expect((await screen.findAllByText('Unique bidding organizations')).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Each organization counts once per event or lot, however many revisions/),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No conversion: all amounts are in BWP as recorded.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Some information is missing')).toBeInTheDocument();
  });

  it('shows missing values as missing, never as zero', async () => {
    routes();
    render();
    const table = await screen.findByRole('table', {
      name: 'Competition and participation rows',
    });
    expect(within(table).getAllByText('Missing').length).toBeGreaterThan(0);
  });

  it('sends the level filter to the API', async () => {
    const { requests } = routes();
    render();
    await screen.findByRole('table', { name: 'Competition and participation rows' });

    await userEvent.selectOptions(screen.getByLabelText('Event or lot level'), 'Event rows only');

    await waitFor(() =>
      expect(requests.some((request) => request.search.includes('level=event'))).toBe(true),
    );
  });

  it('explains a family the role may not run, with no filters, saved views, export or definition action', async () => {
    routes(() =>
      problem(403, 'Forbidden', {
        code: 'REPORT_FAMILY_RESTRICTED',
        detail: 'Your role may not run this report family.',
      }),
    );
    render();
    expect(
      await screen.findByText(
        'Your role may not run this report family. Ask a report manager for access.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Report filters' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Event or lot level')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Save as definition' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /saved views/i })).not.toBeInTheDocument();
  });

  it('shows the filters and actions when the role may run the family', async () => {
    routes();
    render();
    await screen.findByRole('table', { name: 'Competition and participation rows' });
    expect(screen.getByRole('region', { name: 'Report filters' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Save as definition' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /saved views/i })).toBeInTheDocument();
  });

  it('leaves out a column and a highlight the role may not read, with no lock or placeholder', async () => {
    const hidden = { kind: 'restricted', reason: 'Requires report.manage.' } as const;
    routes(() => ({
      body: {
        ...PARTICIPATION,
        highlights: PARTICIPATION.highlights.map((highlight) =>
          highlight.key === 'total_invited' ? { ...highlight, cell: hidden } : highlight,
        ),
        rows: PARTICIPATION.rows.map((row) => ({
          ...row,
          cells: { ...row.cells, registeredInterest: hidden },
        })),
        redactions: [{ field: 'Registered interest', reason: 'Requires report.manage.' }],
      },
    }));
    render();

    const table = await screen.findByRole('table', {
      name: 'Competition and participation rows',
    });
    expect(
      within(table).queryByRole('columnheader', { name: 'Registered interest' }),
    ).not.toBeInTheDocument();
    expect(
      within(table).getByRole('columnheader', { name: 'Invited organizations' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Total invited organizations' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Events' })).toBeInTheDocument();
    expect(screen.queryByText('Restricted')).not.toBeInTheDocument();
    expect(screen.queryByText('Requires report.manage.')).not.toBeInTheDocument();
    expect(screen.queryByText('Fields hidden for your role and why')).not.toBeInTheDocument();
  });

  it('leaves a single restricted cell empty while the rest of its column stays readable', async () => {
    const [first, ...others] = PARTICIPATION.rows;
    routes(() => ({
      body: {
        ...PARTICIPATION,
        rows: [
          {
            ...first!,
            cells: {
              ...first!.cells,
              invited: { kind: 'restricted', reason: 'Requires report.manage.' },
            },
          },
          ...others,
        ],
      },
    }));
    render();

    const table = await screen.findByRole('table', {
      name: 'Competition and participation rows',
    });
    expect(
      within(table).getByRole('columnheader', { name: 'Invited organizations' }),
    ).toBeInTheDocument();
    expect(within(table).queryByText('Restricted')).not.toBeInTheDocument();
  });
});
