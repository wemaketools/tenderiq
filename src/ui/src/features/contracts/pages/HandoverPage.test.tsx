import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ClientModule from '../../../api/client';

import { contractDetail, handover } from '../test/data';
import { businessError, callsTo, renderPage, routeCalls } from '../test/harness';
import HandoverPage from './HandoverPage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof ClientModule>()),
  call: vi.fn(),
}));

const OPTIONS = {
  route: '/buyer/contracts/8/handover',
  path: '/buyer/contracts/:contractId/handover',
} as const;

const detail = contractDetail({ id: 8, reference: 'C-2026-0004', status: 'draft' });

describe('HandoverPage (CON-04)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the package of the winning offer only and the blocked procurement closeout (AC-29)', async () => {
    routeCalls({ 'buyer.contracts.get': detail, 'buyer.contracts.handover': handover() });
    renderPage(<HandoverPage />, { ...OPTIONS, permissions: ['contract.view'] });

    expect(
      await screen.findByText(
        'The handover is not accepted: closeout of T-2026-0001 stays blocked',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Only the winning offer is handed over')).toBeInTheDocument();
    expect(screen.getByText('Spare impeller')).toBeInTheDocument();
    expect(screen.getByText('Delivery within 6 weeks')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept handover' })).not.toBeInTheDocument();
  });

  it('returns the handover with omissions as the named contract manager', async () => {
    const calls = routeCalls({
      'buyer.contracts.get': detail,
      'buyer.contracts.handover': handover(),
      'buyer.contracts.returnHandover': {
        contractId: 8,
        handoverId: 3,
        status: 'returned',
        submittedAt: '2026-09-25T09:00:00Z',
        acceptedAt: null,
        returnedAt: '2026-09-30T09:00:00Z',
        omissions: 'Risk register missing.',
        message: 'The handover is returned to procurement.',
      },
    });
    const user = userEvent.setup();
    renderPage(<HandoverPage />, {
      ...OPTIONS,
      permissions: ['contract.view', 'contract.manage'],
      userId: 19,
    });

    await user.click(await screen.findByRole('button', { name: 'Return with omissions' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Return with omissions' }));
    expect(
      await within(dialog).findByText('List what is missing from the handover.'),
    ).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/Omissions/), 'Risk register missing.');
    await user.click(within(dialog).getByRole('button', { name: 'Return with omissions' }));
    expect(await screen.findByText('The handover is returned to procurement.')).toBeInTheDocument();
    expect(callsTo(calls, 'buyer.contracts.returnHandover')[0]?.request).toMatchObject({
      body: { omissions: 'Risk register missing.' },
    });
  });

  it('leaves acceptance out for a member who is not the named contract manager (DD-49)', async () => {
    routeCalls({ 'buyer.contracts.get': detail, 'buyer.contracts.handover': handover() });
    renderPage(<HandoverPage />, {
      ...OPTIONS,
      permissions: ['contract.view', 'contract.manage'],
      userId: 5,
    });
    expect(await screen.findByText('Delivery within 6 weeks')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept handover' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Return with omissions' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Only the named contract manager/)).not.toBeInTheDocument();
  });

  it('explains when a contract has no procurement handover', async () => {
    routeCalls({
      'buyer.contracts.get': detail,
      'buyer.contracts.handover': businessError(
        'HANDOVER_NOT_APPLICABLE',
        409,
        'Imported contract.',
      ),
    });
    renderPage(<HandoverPage />, { ...OPTIONS, permissions: ['contract.view'] });
    expect(
      await screen.findByText('No procurement handover for this contract'),
    ).toBeInTheDocument();
  });
});
