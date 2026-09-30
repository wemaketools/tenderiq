import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PermissionCode } from '@contracts/permissions';

import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { buyerState } from '../../reports/testSession';
import {
  AUDIT,
  DISPOSAL,
  DISPOSALS,
  HOLD,
  HOLDS,
  PACKS,
  RELEASED_HOLD,
  RETENTION,
  SUBJECTS,
  SUMMARY,
} from '../testData';
import AuditEventsPage from './AuditEventsPage';
import DisposalPage from './DisposalPage';
import DisposalsPage from './DisposalsPage';
import EvidencePacksPage from './EvidencePacksPage';
import HoldPage from './HoldPage';
import HoldsPage from './HoldsPage';
import RecordsOverviewPage from './RecordsOverviewPage';
import RetentionPage from './RetentionPage';

const B = '/api/v1/buyer/records';
const LEGAL: PermissionCode[] = ['audit.view', 'records.hold.manage'];
const MANAGER: PermissionCode[] = [
  'audit.view',
  'records.retention.manage',
  'records.disposal.approve',
  'export.create',
];

function routes(overrides: Record<string, () => { status?: number; body?: unknown }> = {}) {
  return installFetch({
    [`GET ${B}/summary`]: () => ({ body: SUMMARY }),
    [`GET ${B}/holds`]: () => ({ body: HOLDS }),
    [`GET ${B}/holds/1`]: () => ({ body: HOLD }),
    [`POST ${B}/holds/1/release`]: () => ({ body: RELEASED_HOLD }),
    [`GET ${B}/disposal-requests`]: () => ({ body: DISPOSALS }),
    [`GET ${B}/disposal-requests/1`]: () => ({ body: DISPOSAL }),
    [`POST ${B}/disposal-requests/1/reject`]: () => ({
      body: { ...DISPOSAL, status: 'rejected' },
    }),
    [`GET ${B}/retention-classes`]: () => ({ body: RETENTION }),
    [`GET ${B}/audit-events`]: () => ({ body: AUDIT }),
    [`GET ${B}/evidence-packs`]: () => ({ body: PACKS }),
    [`GET ${B}/subjects`]: () => ({ body: SUBJECTS }),
    ...overrides,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RecordsOverviewPage (ADM-14)', () => {
  it('summarizes audit, retention, holds, blocked disposals and evidence packs', async () => {
    routes();
    renderWithProviders(<RecordsOverviewPage />, { state: buyerState(MANAGER) });

    const blocked = await screen.findByRole('region', { name: 'Disposals blocked by a hold' });
    expect(within(blocked).getByText('2')).toBeInTheDocument();
    expect(await screen.findByText('Disposal is blocked for held records')).toBeInTheDocument();
    expect(await screen.findByRole('table', { name: 'Active holds' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Blocked by a hold' })).toBeInTheDocument();
  });

  it('shows restricted blocks without counts and hides tabs the role may not open', async () => {
    routes({
      [`GET ${B}/summary`]: () => ({
        body: { ...SUMMARY, audit: null, retention: null, holds: null, disposals: null },
      }),
    });
    renderWithProviders(<RecordsOverviewPage />, { state: buyerState(['export.create']) });

    const holds = await screen.findByRole('region', { name: 'Active holds' });
    expect(within(holds).getByText('Not available in your role')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Audit events' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Evidence packs' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Impose hold' })).not.toBeInTheDocument();
  });
});

describe('HoldPage (AC-35)', () => {
  function renderHold(permissions = LEGAL) {
    renderWithProviders(<HoldPage />, {
      state: buyerState(permissions),
      route: '/buyer/admin/records/holds/1',
      path: '/buyer/admin/records/holds/:holdId',
    });
  }

  it('shows the records it protects past their retention and the disposals it blocks', async () => {
    routes();
    renderHold();

    const records = await screen.findByRole('table', { name: 'Records protected' });
    expect(within(records).getAllByText('Past retention')).toHaveLength(6);
    expect(within(records).getAllByText('Disposal blocked')).toHaveLength(6);
    const blocked = screen.getByRole('table', { name: 'Disposal requests blocked' });
    expect(within(blocked).getAllByText('Blocked')).toHaveLength(2);
  });

  it('releases a hold after confirmation, returning records to ordinary review', async () => {
    const { requests } = routes();
    renderHold();

    await userEvent.click(await screen.findByRole('button', { name: 'Release hold' }));
    const dialog = await screen.findByRole('dialog', { name: 'Release this hold' });
    await userEvent.type(within(dialog).getByLabelText(/Reason for release/), 'Claim settled');
    await userEvent.click(within(dialog).getByRole('checkbox'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Release hold' }));

    expect((await screen.findAllByText('Hold released')).length).toBeGreaterThan(0);
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      reason: 'Claim settled',
    });
  });

  it('shows the hold read-only to records staff without hold management', async () => {
    routes();
    renderHold(['audit.view']);
    await screen.findByRole('table', { name: 'Records protected' });
    expect(screen.queryByRole('button', { name: 'Release hold' })).not.toBeInTheDocument();
  });
});

describe('DisposalPage (AC-35)', () => {
  function renderDisposal() {
    renderWithProviders(<DisposalPage />, {
      state: buyerState(MANAGER),
      route: '/buyer/admin/records/disposals/1',
      path: '/buyer/admin/records/disposals/:disposalRequestId',
    });
  }

  it('prevents approval of disposal while a hold applies and names the hold', async () => {
    routes();
    renderDisposal();

    expect(await screen.findByText('Disposal is prevented by a hold')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve disposal' })).toBeDisabled();
    expect(screen.getByRole('link', { name: /Hold 1 \(Legal hold\)/ })).toHaveAttribute(
      'href',
      '/buyer/admin/records/holds/1',
    );
  });

  it('rejects the request after confirmation and keeps the records', async () => {
    routes();
    renderDisposal();

    await userEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reject disposal' });
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Hold in force');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject disposal' }));

    expect(await screen.findByText('Disposal rejected')).toBeInTheDocument();
  });

  it('shows the hold conflict when approval is refused by the API', async () => {
    routes({
      [`GET ${B}/disposal-requests/1`]: () => ({
        body: { ...DISPOSAL, status: 'proposed', blockingHolds: [], blockedByHoldIds: [] },
      }),
      [`POST ${B}/disposal-requests/1/approve`]: () =>
        problem(409, 'Disposal blocked by hold', {
          code: 'DISPOSAL_BLOCKED_BY_HOLD',
          detail: 'Disposal is blocked by hold 1 (legal hold); release the hold first (BR-40).',
        }),
    });
    renderDisposal();

    await userEvent.click(await screen.findByRole('button', { name: 'Approve disposal' }));
    const dialog = await screen.findByRole('dialog', { name: 'Approve disposal' });
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Eligible');
    await userEvent.click(within(dialog).getByRole('checkbox'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve disposal' }));

    expect(
      await within(dialog).findByText(/an active legal or investigation hold covers these records/),
    ).toBeInTheDocument();
  });
});

describe('ADM-14 lists', () => {
  it('lists audit events with restricted rows as metadata only', async () => {
    const { requests } = routes();
    renderWithProviders(<AuditEventsPage />, { state: buyerState(['audit.view']) });

    const table = await screen.findByRole('table', { name: 'Audit events' });
    expect(within(table).getAllByText('Metadata only').length).toBeGreaterThan(0);
    await userEvent.selectOptions(screen.getByLabelText('Event kind'), 'Access event');
    await waitFor(() =>
      expect(requests.some((request) => request.search.includes('category=access_event'))).toBe(
        true,
      ),
    );
  });

  it('scopes the audit viewer to one record from a drill-through link and clears the scope on request', async () => {
    const { requests } = routes();
    renderWithProviders(<AuditEventsPage />, {
      state: buyerState(['audit.view']),
      route: '/buyer/admin/records/audit?entityType=tender&entityId=2503',
    });

    expect(await screen.findByText('History of one record')).toBeInTheDocument();
    expect(screen.getByText(/tender #2503/)).toBeInTheDocument();
    await waitFor(() =>
      expect(
        requests.some(
          (request) =>
            request.search.includes('entityId=2503') &&
            request.search.includes('entityType=tender'),
        ),
      ).toBe(true),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Show all records' }));
    await waitFor(() => expect(screen.queryByText('History of one record')).toBeNull());
    expect(requests.at(-1)?.search.includes('entityId=')).toBe(false);
  });

  it('lists retention classes and lets a records manager edit one with a reason', async () => {
    routes();
    renderWithProviders(<RetentionPage />, { state: buyerState(MANAGER) });

    const table = await screen.findByRole('table', { name: 'Retention schedules' });
    await userEvent.click(within(table).getAllByRole('button', { name: /^Edit retention of/ })[0]!);
    expect(await screen.findByRole('dialog', { name: /Change retention/ })).toBeInTheDocument();
  });

  it('lists holds and offers imposing one to hold managers', async () => {
    routes();
    renderWithProviders(<HoldsPage />, { state: buyerState(LEGAL) });

    expect(await screen.findByRole('table', { name: 'Holds' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Impose hold' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Impose a legal or investigation hold',
    });
    expect(within(dialog).getByRole('checkbox', { name: 'Disposal' })).toBeDisabled();
  });

  it('lists disposal requests with the holds that block them', async () => {
    routes();
    renderWithProviders(<DisposalsPage />, { state: buyerState(MANAGER) });
    const table = await screen.findByRole('table', { name: 'Disposal requests' });
    expect(within(table).getAllByText('Held by hold 1').length).toBe(2);
  });

  it('lists evidence packs and opens the authorization dialog', async () => {
    routes();
    renderWithProviders(<EvidencePacksPage />, {
      state: buyerState(['audit.view', 'export.create']),
    });
    expect(await screen.findByRole('table', { name: 'Evidence packs' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Authorize evidence pack' }));
    expect(
      await screen.findByRole('dialog', { name: 'Authorize an evidence pack' }),
    ).toBeInTheDocument();
  });
});
