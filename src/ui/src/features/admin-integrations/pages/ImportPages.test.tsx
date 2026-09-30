import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { PEOPLE, buyerState, importBatch, importRecord, pageOf } from '../testData';
import ImportBatchPage from './ImportBatchPage';
import ImportsPage from './ImportsPage';

const B = '/api/v1/buyer';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ImportsPage (ADM-16)', () => {
  it('lists batches with origin, record type, status and decision counts', async () => {
    installFetch({
      [`GET ${B}/imports`]: () => ({ body: pageOf([importBatch()]) }),
      [`GET ${B}/operations-people`]: () => ({ body: PEOPLE }),
    });
    renderWithProviders(<ImportsPage />, {
      state: buyerState(),
      route: '/buyer/admin/service/imports',
    });

    const table = await screen.findByRole('table', { name: 'Import batches' });
    expect(within(table).getByText('Supplier list 2025')).toBeInTheDocument();
    expect(
      within(table).getByText('2 rows · 2 pending · 0 accepted · 0 rejected'),
    ).toBeInTheDocument();
    expect(within(table).getByText('In review')).toBeInTheDocument();
  });

  it('explains when no batch exists', async () => {
    installFetch({
      [`GET ${B}/imports`]: () => ({ body: pageOf([]) }),
      [`GET ${B}/operations-people`]: () => ({ body: PEOPLE }),
    });
    renderWithProviders(<ImportsPage />, {
      state: buyerState(),
      route: '/buyer/admin/service/imports',
    });

    expect(await screen.findByText('No imports match')).toBeInTheDocument();
  });
});

describe('ImportBatchPage (ADM-16)', () => {
  function render(extra: Parameters<typeof installFetch>[0] = {}) {
    const fetch = installFetch({
      [`GET ${B}/imports/2`]: () => ({ body: importBatch() }),
      [`GET ${B}/imports/2/records`]: () => ({
        body: pageOf([
          importRecord(),
          importRecord({
            id: 22,
            rowNo: 2,
            label: 'Maun Plumbing',
            duplicateCandidate: null,
            duplicateReason: null,
            qualityIssues: ['Missing tax clearance evidence'],
          }),
        ]),
      }),
      ...extra,
    });
    renderWithProviders(<ImportBatchPage />, {
      state: buyerState(),
      route: '/buyer/admin/service/imports/2',
      path: '/buyer/admin/service/imports/:batchId',
    });
    return fetch;
  }

  it('shows provenance, quality issues, duplicate candidates and original business dates', async () => {
    render();

    expect(
      await screen.findByText('Exported from the finance vendor master on 1 Sep 2026.'),
    ).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Proposed records' });
    expect(within(table).getByText('Missing tax clearance evidence')).toBeInTheDocument();
    expect(within(table).getByText('Chobe Pipe & Valve Supplies')).toBeInTheDocument();
    expect(within(table).getAllByText(/Original business date/)).toHaveLength(2);
  });

  it('requires a duplicate resolution before accepting a possible duplicate', async () => {
    const { requests } = render({
      [`POST ${B}/imports/2/records/21/decide`]: () => ({
        body: importRecord({ decision: 'accepted' }),
      }),
    });
    const table = await screen.findByRole('table', { name: 'Proposed records' });
    const [accept] = await within(table).findAllByRole('button', { name: 'Accept' });
    await userEvent.click(accept!);
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/^Reason/), 'Matches the vendor master.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Accept' }));
    expect(
      await within(dialog).findByText(/Link it to the existing record or confirm a new record/),
    ).toBeInTheDocument();

    await userEvent.click(within(dialog).getByLabelText(/Link to the existing organization/));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Accept' }));

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
        decision: 'accepted',
        reason: 'Matches the vendor master.',
        duplicateResolution: 'link_existing',
      }),
    );
  });

  it('explains that pending rows block completing the batch', async () => {
    render({
      [`POST ${B}/imports/2/complete`]: () =>
        problem(409, 'Records pending', { code: 'RECORDS_PENDING' }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Complete review' }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('2 rows still need a decision; the batch cannot be completed yet.'),
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Complete review' }));

    expect(
      await within(dialog).findByText('Decide every row before completing the batch.'),
    ).toBeInTheDocument();
  });
});
