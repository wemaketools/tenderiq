import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BidStartOptions } from '@contracts/bids';

import { LocationProbe, renderWithProviders } from '../../../test/render';
import { BID_MANAGER, apiError, bidDetail, bidPage, routeCalls, supplierState } from '../test/data';
import ResponsesPage from './ResponsesPage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  call: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

function startOptions(overrides: Partial<BidStartOptions> = {}): BidStartOptions {
  return {
    tender: {
      tenderId: 11,
      reference: 'T-2026-0011',
      title: 'Office cleaning services',
      eventType: 'rfq',
      status: 'open',
      buyer: { tenantId: 3, name: 'Okavango District Council', slug: 'odc' },
    },
    roundType: 'initial',
    deadline: { at: '2026-10-23T10:00:00Z', timeZone: 'Africa/Gaborone' },
    alternativesAllowed: false,
    lots: [{ lotId: 1101, lotNo: 1, title: 'Council headquarters, Maun' }],
    options: [{ isAlternative: false, canStart: true, blockedBy: null, existingBidId: null }],
    ...overrides,
  };
}

describe('ResponsesPage (SUP-12 entry)', () => {
  it('shows internally approved work as not submitted, separately from its revision status (AC-11)', async () => {
    // Arrange
    const approved = bidDetail({
      id: 7,
      workingRevision: { id: 701, revisionNo: 1, status: 'approved_internally' },
    });
    routeCalls({ 'supplier.bids.list': () => bidPage([approved]) });

    // Act
    renderWithProviders(<ResponsesPage />, { state: supplierState(BID_MANAGER) });

    // Assert
    const table = await screen.findByRole('table', { name: 'Supplier responses' });
    const row = await within(table).findByRole('row', { name: /T-2026-0006/ });
    expect(within(row).getByText('Not submitted')).toBeInTheDocument();
    expect(within(row).getByText('Approved internally')).toBeInTheDocument();
    expect(within(row).getByText('Submit (authorized signatory)')).toBeInTheDocument();
    expect(within(row).getByTestId('official-deadline')).toHaveTextContent('Africa/Gaborone');
  });

  it('passes the tender hand-off from the opportunity workspace as a filter when a tenderId is in the URL', async () => {
    // Arrange
    const calls = routeCalls({ 'supplier.bids.list': () => bidPage([bidDetail()]) });

    // Act
    renderWithProviders(<ResponsesPage />, {
      state: supplierState(BID_MANAGER),
      route: '/supplier/responses?tenderId=6',
    });

    // Assert
    await screen.findByRole('table', { name: 'Supplier responses' });
    const filtered = calls.find(
      (entry) =>
        entry.id === 'supplier.bids.list' &&
        (entry.request.query as Record<string, unknown>).tenderId === 6,
    );
    expect(filtered).toBeDefined();
  });

  it('explains an empty list when the supplier has no responses yet', async () => {
    // Arrange
    routeCalls({ 'supplier.bids.list': () => bidPage([]) });

    // Act
    renderWithProviders(<ResponsesPage />, { state: supplierState(BID_MANAGER) });

    // Assert
    expect(await screen.findByText('No responses yet')).toBeInTheDocument();
  });

  it('shows the error state with a retry when the list fails to load', async () => {
    // Arrange
    routeCalls({ 'supplier.bids.list': () => apiError(500, null, 'server') });

    // Act
    renderWithProviders(<ResponsesPage />, { state: supplierState(BID_MANAGER) });

    // Assert
    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});

describe('ResponsesPage start response (SUP-08 hand-off into SUP-12)', () => {
  it('starts a response after confirming organization, capacity, scope and result, then opens the new workspace', async () => {
    // Arrange
    const user = userEvent.setup();
    const calls = routeCalls({
      'supplier.bids.list': () => bidPage([]),
      'supplier.bids.startOptions': () => startOptions(),
      'supplier.bids.start': () => bidDetail({ id: 5422 }),
    });
    const { router } = renderWithProviders(<ResponsesPage />, {
      state: supplierState(BID_MANAGER),
      route: '/supplier/responses?tenderId=11',
      path: '/supplier/responses',
      routes: [
        {
          path: '/supplier/responses/:bidId/answers',
          element: <LocationProbe label="workspace" />,
        },
      ],
    });

    // Act
    await user.click(await screen.findByRole('button', { name: 'Start response' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('confirm-context')).toHaveTextContent(
      'T-2026-0011 Office cleaning services, Initial, main offer',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Start response' }));

    // Assert
    const start = calls.find((entry) => entry.id === 'supplier.bids.start');
    expect(start?.request.body).toEqual({
      tenderId: 11,
      roundType: 'initial',
      isAlternative: false,
    });
    expect(await screen.findByTestId('location-probe')).toHaveTextContent('workspace');
    expect(router.state.location.pathname).toBe('/supplier/responses/5422/answers');
  });

  it('offers an alternative offer only when the tender accepts alternatives', async () => {
    // Arrange
    routeCalls({
      'supplier.bids.list': () => bidPage([]),
      'supplier.bids.startOptions': () =>
        startOptions({
          alternativesAllowed: true,
          options: [
            { isAlternative: false, canStart: true, blockedBy: null, existingBidId: null },
            { isAlternative: true, canStart: true, blockedBy: null, existingBidId: null },
          ],
        }),
    });

    // Act
    renderWithProviders(<ResponsesPage />, {
      state: supplierState(BID_MANAGER),
      route: '/supplier/responses?tenderId=11',
    });

    // Assert
    expect(await screen.findByRole('button', { name: 'Start alternative offer' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Start response' })).toBeEnabled();
  });

  it('links to the existing response instead of offering a second workspace for the same round', async () => {
    // Arrange
    routeCalls({
      'supplier.bids.list': () => bidPage([bidDetail()]),
      'supplier.bids.startOptions': () =>
        startOptions({
          options: [
            {
              isAlternative: false,
              canStart: false,
              blockedBy: 'BID_ALREADY_EXISTS',
              existingBidId: 14,
            },
          ],
        }),
    });

    // Act
    renderWithProviders(<ResponsesPage />, {
      state: supplierState(BID_MANAGER),
      route: '/supplier/responses?tenderId=6',
    });

    // Assert
    const open = await screen.findByRole('link', { name: 'Open response' });
    expect(open).toHaveAttribute('href', '/supplier/responses/14/answers');
    expect(screen.queryByRole('button', { name: 'Start response' })).not.toBeInTheDocument();
  });

  it('explains why a response cannot be started when the tender is no longer open', async () => {
    // Arrange
    routeCalls({
      'supplier.bids.list': () => bidPage([]),
      'supplier.bids.startOptions': () =>
        startOptions({
          options: [
            {
              isAlternative: false,
              canStart: false,
              blockedBy: 'TENDER_NOT_OPEN',
              existingBidId: null,
            },
          ],
        }),
    });

    // Act
    renderWithProviders(<ResponsesPage />, {
      state: supplierState(BID_MANAGER),
      route: '/supplier/responses?tenderId=8',
    });

    // Assert
    expect(
      await screen.findByText(
        'A main offer cannot be started: the tender is not open for submissions.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the business refusal inside the confirmation when the start is rejected', async () => {
    // Arrange
    const user = userEvent.setup();
    routeCalls({
      'supplier.bids.list': () => bidPage([]),
      'supplier.bids.startOptions': () => startOptions(),
      'supplier.bids.start': () => apiError(409, 'TENDER_NOT_OPEN'),
    });
    renderWithProviders(<ResponsesPage />, {
      state: supplierState(BID_MANAGER),
      route: '/supplier/responses?tenderId=11',
    });

    // Act
    await user.click(await screen.findByRole('button', { name: 'Start response' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Start response' }));

    // Assert
    expect(
      await within(dialog).findByText('The tender is not open for submissions.'),
    ).toBeInTheDocument();
  });

  it('does not show the start panel without a tender hand-off', async () => {
    // Arrange
    const calls = routeCalls({ 'supplier.bids.list': () => bidPage([]) });

    // Act
    renderWithProviders(<ResponsesPage />, { state: supplierState(BID_MANAGER) });

    // Assert
    await screen.findByText('No responses yet');
    expect(screen.queryByText('Start a response')).not.toBeInTheDocument();
    expect(calls.some((entry) => entry.id === 'supplier.bids.startOptions')).toBe(false);
  });
});
