import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import { finalApproval, lotOutcome, overview } from '../test/data';
import { renderBuyer } from '../test/render';
import AwardOverviewPage from './AwardOverviewPage';

const GET = 'GET /api/v1/buyer/awards/7';
const FINAL = 'POST /api/v1/buyer/lot-outcomes/71/final-award';
const OPTIONS = { route: '/buyer/awards/7', path: '/buyer/awards/:tenderId' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AwardOverviewPage (BUY-26)', () => {
  it('shows that final award is blocked by the complaint hold and lists the blocking gate (AC-25)', async () => {
    installFetch({ [GET]: () => ({ body: overview() }) });
    renderBuyer(<AwardOverviewPage />, OPTIONS);

    expect(await screen.findByText('Final award is blocked by an active hold')).toBeInTheDocument();
    expect(screen.getByText('1 blocking condition')).toBeInTheDocument();
    expect(screen.getAllByText('No blocking complaint or hold').length).toBeGreaterThan(0);
    expect(screen.getByText('Makgadikgadi Civil Works')).toBeInTheDocument();
  });

  it('explains the partially awarded status when lots follow separate timelines (AC-26)', async () => {
    const data = overview({ tender: { ...overview().tender, status: 'partially_awarded' } });
    installFetch({ [GET]: () => ({ body: data }) });
    renderBuyer(<AwardOverviewPage />, OPTIONS);
    expect(await screen.findByText('Overall status: partially awarded')).toBeInTheDocument();
  });

  it('shows the translated business error when the final award is refused', async () => {
    const { requests } = installFetch({
      [GET]: () => ({ body: overview() }),
      [FINAL]: () =>
        problem(409, 'Conflict', { code: 'FINAL_AWARD_BLOCKED_BY_HOLD', detail: 'On hold.' }),
    });
    renderBuyer(<AwardOverviewPage />, OPTIONS);

    await userEvent.click(await screen.findByRole('button', { name: 'Record final award' }));
    await userEvent.click(screen.getByRole('checkbox', { name: /I confirm that every approval/ }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(
      Array.from(dialog.querySelectorAll('button')).find(
        (button) => button.textContent === 'Record final award',
      ) as HTMLButtonElement,
    );

    expect(
      await screen.findByText('An active complaint hold blocks the final award.'),
    ).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      confirmation: true,
    });
  });

  it('records the final award and shows the lot as final awarded', async () => {
    installFetch({
      [GET]: () => ({
        body: overview({ holds: [], nextStep: 'final_award' }),
      }),
      [FINAL]: () => ({
        body: lotOutcome({ status: 'final_awarded', finalAwardedAt: '2026-10-07T08:00:00Z' }),
      }),
    });
    renderBuyer(<AwardOverviewPage />, OPTIONS);

    await userEvent.click(await screen.findByRole('button', { name: 'Record final award' }));
    await userEvent.click(screen.getByRole('checkbox', { name: /I confirm that every approval/ }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(
      Array.from(dialog.querySelectorAll('button')).find(
        (button) => button.textContent === 'Record final award',
      ) as HTMLButtonElement,
    );

    await waitFor(() => expect(screen.getByText('Final award recorded')).toBeInTheDocument());
  });

  it('labels an intended value as not final and a proposed outcome as not decided (BR-31)', async () => {
    installFetch({ [GET]: () => ({ body: overview() }) });
    const { unmount } = renderBuyer(<AwardOverviewPage />, OPTIONS);
    expect((await screen.findAllByText('Intended award (not final)')).length).toBe(2);
    expect(screen.queryByText('Awarded total')).not.toBeInTheDocument();
    unmount();

    const base = overview();
    const lot = base.lots[0];
    const recon = base.reconciliation;
    if (lot === undefined || recon === null) throw new Error('test data');
    const draft = overview({
      lots: [
        {
          ...lot,
          outcome: lotOutcome({ status: 'recommended' }),
          standstillStatus: null,
          standstillEndsAt: null,
          finalAwardApproval: finalApproval({
            unavailableReason:
              'Available once the recommendation is approved and the intention to award is notified.',
          }),
        },
      ],
      reconciliation: {
        ...recon,
        value: { ...recon.value, basis: 'recommended' },
        lotTotals: recon.lotTotals.map((row) => ({ ...row, status: 'recommended' as const })),
      },
      holds: [],
    });
    installFetch({ [GET]: () => ({ body: draft }) });
    renderBuyer(<AwardOverviewPage />, OPTIONS);

    expect((await screen.findAllByText('Recommended value (not an award)')).length).toBe(2);
    expect(screen.getByText('1 more with a proposed outcome (not approved)')).toBeInTheDocument();
    expect(screen.getByText('Lots with an approved outcome')).toBeInTheDocument();
  });

  it('explains why the final-award approval cannot be requested while the hold is active', async () => {
    installFetch({ [GET]: () => ({ body: overview() }) });
    renderBuyer(<AwardOverviewPage />, OPTIONS);

    expect(
      await screen.findByText('Final-award approval cannot be requested now'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Cannot be requested while the hold on CMP-2026-0002 blocks the final award.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Request final-award approval' }),
    ).not.toBeInTheDocument();
  });

  it('requests the final-award approval of the exact lot outcome version (DD-14)', async () => {
    const base = overview({ holds: [], nextStep: 'final_award' });
    const lot = base.lots[0];
    if (lot === undefined) throw new Error('test data');
    const data = {
      ...base,
      lots: [
        {
          ...lot,
          finalAwardApproval: finalApproval({ requestable: true, unavailableReason: null }),
        },
      ],
    };
    const { requests } = installFetch({
      [GET]: () => ({ body: data }),
      'GET /api/v1/buyer/approvals/subjects/final_award/71': () => ({
        body: {
          subjectType: 'final_award',
          subjectId: 71,
          current: null,
          history: [],
          canRequest: true,
        },
      }),
      'POST /api/v1/buyer/approvals': () =>
        problem(409, 'Conflict', { code: 'APPROVAL_ALREADY_PENDING', detail: 'Pending.' }),
    });
    renderBuyer(<AwardOverviewPage />, OPTIONS);

    const buttons = await screen.findAllByRole('button', { name: 'Request final-award approval' });
    expect(buttons.length).toBeGreaterThan(0);
    await userEvent.click(buttons[0] as HTMLButtonElement);
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(
      within(dialog).getByLabelText(/^Justification/),
      'Standstill ended and no complaint is open.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Request approval' }));

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.body).toMatchObject({
        subjectType: 'final_award',
        subjectId: 71,
        subjectVersion: 1,
        contentHash: 'a'.repeat(64),
        amount: { amount: '7850000.00', currency: 'BWP' },
      }),
    );
  });

  it('hides award commands from a read-only auditor', async () => {
    installFetch({ [GET]: () => ({ body: overview() }) });
    renderBuyer(<AwardOverviewPage />, { ...OPTIONS, permissions: ['audit.view'] });

    await screen.findByRole('heading', { name: 'Lot outcomes' });
    expect(screen.queryByRole('button', { name: 'Record final award' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Prepare recommendation' }),
    ).not.toBeInTheDocument();
  });
});
