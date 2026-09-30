import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../test/fetchMock';
import { debrief, supplierOutcome, supplierOutcomePage } from '../../awards/test/data';
import { renderSupplier } from '../../awards/test/render';
import SupplierOutcomePage from './SupplierOutcomePage';
import SupplierOutcomesPage from './SupplierOutcomesPage';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SupplierOutcomesPage (SUP-21)', () => {
  it('lists the supplier’s own outcomes with results per lot and notices to acknowledge', async () => {
    installFetch({ 'GET /api/v1/supplier/outcomes': () => ({ body: supplierOutcomePage() }) });
    renderSupplier(<SupplierOutcomesPage />, {
      route: '/supplier/outcomes',
      path: '/supplier/outcomes',
    });

    expect((await screen.findAllByText('T-2026-0007')).length).toBeGreaterThan(0);
    expect(screen.getByText('Lot 1: Intention to award')).toBeInTheDocument();
    expect(screen.getByText('1 notice to acknowledge')).toBeInTheDocument();
  });

  it('shows the empty state when no notice was issued', async () => {
    installFetch({
      'GET /api/v1/supplier/outcomes': () => ({
        body: { items: [], total: 0, page: 1, pageSize: 25 },
      }),
    });
    renderSupplier(<SupplierOutcomesPage />, {
      route: '/supplier/outcomes',
      path: '/supplier/outcomes',
    });
    expect(await screen.findByText('No outcome yet')).toBeInTheDocument();
  });
});

describe('SupplierOutcomePage (SUP-21)', () => {
  const OPTIONS = { route: '/supplier/outcomes/7', path: '/supplier/outcomes/:tenderId' };
  const GET = 'GET /api/v1/supplier/outcomes/7';

  it('never presents an intention to award as a final award (BR-31)', async () => {
    installFetch({ [GET]: () => ({ body: supplierOutcome() }) });
    renderSupplier(<SupplierOutcomePage />, OPTIONS);

    expect(await screen.findByText('Intention to award — not a final award')).toBeInTheDocument();
    expect(screen.getByText('A procurement hold is active')).toBeInTheDocument();
  });

  it('shows a preferred-bidder status with an explicit not-an-award banner (BR-31)', async () => {
    const base = supplierOutcome();
    const lot = base.lots[0];
    if (lot === undefined) throw new Error('test data');
    installFetch({
      'GET /api/v1/supplier/outcomes/9': () => ({
        body: supplierOutcome({
          tenderId: 9,
          reference: 'T-2026-0009',
          title: 'Acoustic leak detection services',
          result: 'preferred_bidder',
          lots: [{ ...lot, result: 'preferred_bidder', awardedValue: null }],
          standstill: null,
          standstillEndsAt: null,
          procurementHoldActive: false,
        }),
      }),
    });
    renderSupplier(<SupplierOutcomePage />, {
      route: '/supplier/outcomes/9',
      path: '/supplier/outcomes/:tenderId',
    });

    expect(await screen.findByText('Preferred bidder — not an award')).toBeInTheDocument();
    expect(screen.getAllByText('Preferred bidder (not an award)').length).toBeGreaterThan(0);
    expect(screen.queryByText('Intention to award — not a final award')).not.toBeInTheDocument();
    expect(screen.queryByText('Awarded')).not.toBeInTheDocument();
  });

  it('acknowledges receipt of a notice as a distinct, confirmed event', async () => {
    installFetch({
      [GET]: () => ({ body: supplierOutcome() }),
      'POST /api/v1/supplier/outcome-notices/55/acknowledge': () => ({
        body: {
          noticeId: 55,
          acknowledgedAt: '2026-09-30T08:00:00Z',
          acknowledgedBy: { userId: 41, fullName: 'Mothusi Limpopo' },
          termsAcceptedAt: null,
        },
      }),
    });
    renderSupplier(<SupplierOutcomePage />, OPTIONS);

    await userEvent.click(await screen.findByRole('button', { name: 'Acknowledge receipt' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Acknowledge receipt' }),
    );

    expect(await screen.findByText('Notice acknowledged.')).toBeInTheDocument();
    expect(screen.getByText(/Acknowledged .* by Mothusi Limpopo/)).toBeInTheDocument();
  });

  it('requests a debrief and then shows only the supplier’s own result (AC-27)', async () => {
    const provided = debrief({ status: 'provided', writtenResponse: 'Your offer ranked third.' });
    installFetch({
      [GET]: () => ({
        body: supplierOutcome({
          result: 'unsuccessful',
          lots: [
            {
              lot: { lotId: 701, lotNo: 1, title: 'Reservoir rehabilitation works' },
              result: 'unsuccessful',
              awardedValue: null,
              conditions: null,
              reason: 'Ranked third.',
            },
          ],
          canRequestDebrief: true,
          debriefDeadline: { at: '2026-10-06T15:00:00Z', timeZone: 'Africa/Gaborone' },
        }),
      }),
      'POST /api/v1/supplier/outcomes/7/debrief-requests': () => ({
        status: 201,
        body: {
          debriefId: provided.debriefId,
          status: provided.status,
          requestedBy: provided.requestedBy,
          requestedAt: provided.requestedAt,
          dueAt: provided.dueAt,
          meetingAt: null,
          writtenResponse: provided.writtenResponse,
          effectOnDeadlines: 'None.',
          declineReason: null,
          ownResult: provided.ownResult,
        },
      }),
    });
    renderSupplier(<SupplierOutcomePage />, OPTIONS);

    await userEvent.click(await screen.findByRole('button', { name: 'Request debriefing' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Request debriefing' }),
    );

    expect(await screen.findByText('Your own result')).toBeInTheDocument();
    expect(screen.getByText('72.40 of 100.00')).toBeInTheDocument();
  });
});
