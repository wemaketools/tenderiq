import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  ASSESSOR,
  MANAGER,
  decisionDetail,
  options,
  renderPage,
  routeCalls,
  trigger,
} from '../../test/kit';
import TriggerPage from './TriggerPage';

vi.mock('../../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/buyer/qualification/triggers/:triggerId',
  route: '/buyer/qualification/triggers/901',
};

function routes(extra: Record<string, (request: Record<string, unknown>) => unknown> = {}) {
  return routeCalls({
    'buyer.qualification.triggers.get': () => trigger(),
    'buyer.qualification.decisions.get': () => decisionDetail(),
    'buyer.qualification.options': () => options(),
    ...extra,
  });
}

describe('TriggerPage (BUY-35, AC-09)', () => {
  it('shows the insurance expiry with the impacted active bids and the lapse date', async () => {
    routes();
    renderPage(<TriggerPage />, { ...PATH, permissions: MANAGER });
    expect(
      await screen.findByText('Trigger 901 — Chobe Pipe & Valve Supplies'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Public liability insurance expires on 8 Oct 2026.'),
    ).toBeInTheDocument();
    expect(screen.getByText('T-2026-0006')).toBeInTheDocument();
    expect(screen.getByText('T-2026-0008')).toBeInTheDocument();
    expect(screen.getByText('8 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('Historical evidence stays unchanged')).toBeInTheDocument();
  });

  it('refuses a disposition until every impacted bid was reviewed, then records it explicitly', async () => {
    const calls = routes({
      'buyer.qualification.triggers.assess': () =>
        trigger({
          status: 'assessed',
          disposition: 'No award before renewed insurance.',
          activeBidsReviewed: true,
          assessedBy: { userId: 4, fullName: 'Mpho Dikgang' },
          assessedAt: '2026-09-30T08:00:00Z',
        }),
    });
    renderPage(<TriggerPage />, { ...PATH, permissions: MANAGER });
    await screen.findByText('Trigger 901 — Chobe Pipe & Valve Supplies');

    fireEvent.click(screen.getByRole('radio', { name: /^Assessed/ }));
    fireEvent.change(screen.getByLabelText(/^Disposition/), {
      target: { value: 'No award before renewed insurance.' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Record disposition' })[0]!);
    expect(
      await screen.findAllByText(
        'Review every affected active bid and contract before recording the disposition.',
      ),
    ).not.toHaveLength(0);

    fireEvent.click(screen.getByLabelText('I reviewed the 2 affected active bids'));
    fireEvent.click(screen.getByLabelText('I reviewed the 0 affected active contracts'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Record disposition' })[0]!);
    const confirm = await screen.findByRole('dialog', { name: 'Record trigger disposition' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Record disposition' }));

    expect(await screen.findByText('Disposition recorded: Assessed.')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        calls.find((item) => item.id === 'buyer.qualification.triggers.assess')?.request,
      ).toEqual({
        params: { triggerId: 901 },
        body: {
          resultingStatus: 'assessed',
          disposition: 'No award before renewed insurance.',
          activeBidsReviewed: true,
          activeContractsReviewed: true,
          resultingDecisionId: null,
        },
      }),
    );
  });

  it('requires the superseding decision for "action taken"', async () => {
    routes();
    renderPage(<TriggerPage />, { ...PATH, permissions: MANAGER });
    await screen.findByText('Trigger 901 — Chobe Pipe & Valve Supplies');
    fireEvent.click(screen.getByRole('radio', { name: /^Action taken/ }));
    fireEvent.click(screen.getByLabelText('I reviewed the 2 affected active bids'));
    fireEvent.click(screen.getByLabelText('I reviewed the 0 affected active contracts'));
    fireEvent.change(screen.getByLabelText(/^Disposition/), { target: { value: 'Suspended.' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Record disposition' })[0]!);
    expect(
      await screen.findAllByText('Record the new decision before choosing "action taken".'),
    ).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Record the new decision' })).toBeInTheDocument();
  });

  it('leaves the disposition to deciders', async () => {
    routes();
    renderPage(<TriggerPage />, { ...PATH, permissions: ASSESSOR });
    expect(
      await screen.findByText('Only a decider of this program records the disposition.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record disposition' })).not.toBeInTheDocument();
  });
});
