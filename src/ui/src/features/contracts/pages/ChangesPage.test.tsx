import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ClientModule from '../../../api/client';

import { changeDetail, changes, contractDetail, disputes } from '../test/data';
import { businessError, callsTo, renderPage, routeCalls } from '../test/harness';
import ChangesPage from './ChangesPage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof ClientModule>()),
  call: vi.fn(),
}));

const OPTIONS = {
  route: '/buyer/contracts/1/changes',
  path: '/buyer/contracts/:contractId/changes',
} as const;

function routes(extra: Record<string, unknown> = {}) {
  return routeCalls({
    'buyer.contracts.get': contractDetail(),
    'buyer.contracts.changes': changes(),
    'buyer.contracts.changeRequest': changeDetail(),
    'buyer.contracts.disputes': disputes(),
    ...extra,
  });
}

describe('ChangesPage (CON-09)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the cumulative exposure and the authority check on the cumulative value (AC-31)', async () => {
    routes();
    renderPage(<ChangesPage />, { ...OPTIONS, permissions: ['contract.view'] });

    expect(await screen.findByText('Cumulative exposure')).toBeInTheDocument();
    expect(
      screen.getByText('Cumulative authority exceeded: Keabetswe Nkwe must approve'),
    ).toBeInTheDocument();
    expect(screen.getByText('Cumulative contract value')).toBeInTheDocument();
    expect(screen.getByText('CR-0003', { selector: '.tiq-ref' })).toBeInTheDocument();
    expect(await screen.findByText('Service credit proposed for June.')).toBeInTheDocument();
    expect(
      screen.getByText('A missed measure never authorizes a deduction by itself.'),
    ).toBeInTheDocument();
  });

  it('shows the cumulative authority refusal when an approver decides beyond the limit', async () => {
    const calls = routes({
      'buyer.contracts.decideChange': businessError('CUMULATIVE_AUTHORITY_EXCEEDED', 403),
    });
    const user = userEvent.setup();
    renderPage(<ChangesPage />, {
      ...OPTIONS,
      permissions: ['contract.view', 'contract.change.approve'],
      userId: 4,
    });

    await user.click(await screen.findByText('CR-0003', { selector: '.tiq-ref' }));
    await user.click(await screen.findByRole('button', { name: 'Decide' }));
    const dialog = await screen.findByRole('dialog', { name: 'Decide on the change' });
    await user.type(within(dialog).getByLabelText(/Reason/), 'Within budget.');
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));

    expect(
      await within(dialog).findByText(/does not cover the cumulative contract value/),
    ).toBeInTheDocument();
    expect(callsTo(calls, 'buyer.contracts.decideChange')[0]?.request).toMatchObject({
      params: { contractId: 1, changeId: 3 },
      body: { decision: 'approve', reason: 'Within budget.' },
    });
  });

  it('requires the contract basis before recording a remedy', async () => {
    const calls = routes();
    const user = userEvent.setup();
    renderPage(<ChangesPage />, { ...OPTIONS, permissions: ['contract.view', 'contract.manage'] });

    await user.click(await screen.findByRole('button', { name: 'Record claim or dispute' }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText(/Type/), 'penalty');
    await user.type(within(dialog).getByLabelText(/Description/), 'Late delivery penalty.');
    await user.click(within(dialog).getByRole('button', { name: 'Record' }));
    expect(
      await within(dialog).findByText('Cite the agreed contract terms that permit this remedy.'),
    ).toBeInTheDocument();
    expect(callsTo(calls, 'buyer.contracts.recordDispute')).toHaveLength(0);
  });
});
