import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ClientModule from '../../../api/client';

import { ApiError } from '../../../api/client';
import { assignees, contractDetail, obligationList, obligationRow } from '../test/data';
import { callsTo, renderPage, routeCalls } from '../test/harness';
import ContractOverviewPage from './ContractOverviewPage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof ClientModule>()),
  call: vi.fn(),
}));

const OPTIONS = { route: '/buyer/contracts/1', path: '/buyer/contracts/:contractId' } as const;

function routes(extra: Record<string, unknown> = {}) {
  return routeCalls({
    'buyer.contracts.get': contractDetail(),
    'buyer.contracts.obligations': obligationList([
      obligationRow(),
      obligationRow({
        id: 14705,
        title: 'Roadworthiness certificates',
        kind: 'deliverable',
        status: 'overdue',
        isOverdue: true,
        isPaymentMilestone: false,
        amount: null,
        latestDecision: null,
      }),
    ]),
    'buyer.contracts.assignees': assignees(),
    ...extra,
  });
}

describe('ContractOverviewPage (CON-05)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the record context, agreed scope, contacts, securities and obligations', async () => {
    routes();
    renderPage(<ContractOverviewPage />, { ...OPTIONS, permissions: ['contract.view'] });

    expect(
      await screen.findByText('Contract overview and obligations', { selector: 'h1' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('C-2026-0001').length).toBeGreaterThan(0);
    expect(screen.getByText(/Scheduled servicing/)).toBeInTheDocument();
    expect(screen.getByText('masego.contracts@tenderiq.local')).toBeInTheDocument();
    expect(screen.getByText('Performance bond')).toBeInTheDocument();
    expect(await screen.findByText('Q3 service report (July to September)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add obligation' })).not.toBeInTheDocument();
  });

  it('shows a restricted state when the contract may not be read', async () => {
    routeCalls({
      'buyer.contracts.get': new ApiError({
        kind: 'forbidden',
        status: 403,
        title: 'Forbidden',
        endpointId: 'buyer.contracts.get',
      }),
    });
    const { container } = renderPage(<ContractOverviewPage />, {
      ...OPTIONS,
      permissions: ['contract.view'],
    });
    await waitFor(() =>
      expect(container.querySelector('[data-state="restricted"]')).not.toBeNull(),
    );
  });

  it('escalates an overdue commitment with a confirmed reason', async () => {
    const calls = routes({
      'buyer.contracts.escalateObligation': {
        obligationId: 14705,
        escalatedTo: { userId: 4, fullName: 'Mpho Dikgang' },
        escalatedAt: '2026-09-30T08:00:00Z',
        message: 'Escalated to Mpho Dikgang.',
      },
    });
    const user = userEvent.setup();
    renderPage(<ContractOverviewPage />, {
      ...OPTIONS,
      permissions: ['contract.view', 'contract.manage'],
    });

    await user.click(
      await screen.findByRole('button', { name: 'Escalate Roadworthiness certificates' }),
    );
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Reason/), 'Certificates are three weeks late.');
    await user.click(within(dialog).getByRole('button', { name: 'Escalate' }));

    expect(await screen.findByText('Escalated to Mpho Dikgang.')).toBeInTheDocument();
    expect(callsTo(calls, 'buyer.contracts.escalateObligation')[0]?.request).toMatchObject({
      params: { contractId: 1, obligationId: 14705 },
      body: { reason: 'Certificates are three weeks late.' },
    });
  });

  it('validates a new payment milestone before calling the API', async () => {
    const calls = routes();
    const user = userEvent.setup();
    renderPage(<ContractOverviewPage />, {
      ...OPTIONS,
      permissions: ['contract.view', 'contract.manage'],
    });
    await user.click(await screen.findByRole('button', { name: 'Add obligation' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(
      await within(dialog).findByText('Enter a title of at least 3 characters.'),
    ).toBeInTheDocument();
    expect(callsTo(calls, 'buyer.contracts.createObligation')).toHaveLength(0);
  });
});
