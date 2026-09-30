import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ClientModule from '../../../api/client';

import { approval, contractDetail, preparation } from '../test/data';
import { businessError, callsTo, renderPage, routeCalls } from '../test/harness';
import ContractPreparationPage from './ContractPreparationPage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof ClientModule>()),
  call: vi.fn(),
}));

const OPTIONS = {
  route: '/buyer/contracts/2/preparation',
  path: '/buyer/contracts/:contractId/preparation',
} as const;

describe('ContractPreparationPage (CON-02)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the differences from the award and that the difference approval blocks signature (AC-28)', async () => {
    routeCalls({
      'buyer.contracts.get': contractDetail({
        id: 2,
        reference: 'C-2026-0002',
        status: 'awaiting_signature',
        differsFromAward: true,
      }),
      'buyer.contracts.preparation': preparation(),
    });
    renderPage(<ContractPreparationPage />, { ...OPTIONS, permissions: ['contract.view'] });

    expect(
      await screen.findByRole('heading', { name: 'Differences from the approved award' }),
    ).toBeInTheDocument();
    expect(screen.getByText('BWP 4,620,000.00')).toBeInTheDocument();
    expect(
      screen.getAllByText('The difference approval must be approved before signature or start')
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Contract agreement')).toBeInTheDocument();
    expect(screen.getByText('Cap at 7.5%')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Approval history' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit terms' })).not.toBeInTheDocument();
  });

  it('submits a draft for review after confirmation and shows the server message', async () => {
    const calls = routeCalls({
      'buyer.contracts.get': contractDetail({ id: 8, reference: 'C-2026-0004', status: 'draft' }),
      'buyer.contracts.preparation': preparation({
        contractId: 8,
        reference: 'C-2026-0004',
        status: 'draft',
        differsFromAward: false,
        differences: [],
      }),
      'buyer.contracts.submitForReview': {
        contractId: 8,
        reference: 'C-2026-0004',
        status: 'under_review',
        differsFromAward: false,
        differenceApprovalRequired: false,
        message: 'C-2026-0004 is submitted for review.',
      },
    });
    const user = userEvent.setup();
    renderPage(<ContractPreparationPage />, {
      ...OPTIONS,
      route: '/buyer/contracts/8/preparation',
      permissions: ['contract.view', 'contract.prepare'],
    });

    await user.click(await screen.findByRole('button', { name: 'Submit for review' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Submit for review' }));

    expect(
      (await screen.findAllByText('C-2026-0004 is submitted for review.')).length,
    ).toBeGreaterThan(0);
    expect(callsTo(calls, 'buyer.contracts.submitForReview')).toHaveLength(1);
  });

  it('shows the translated business error when approval is refused', async () => {
    routeCalls({
      'buyer.contracts.get': contractDetail({
        id: 3,
        reference: 'C-2026-0003',
        status: 'under_review',
      }),
      'buyer.contracts.preparation': preparation({
        contractId: 3,
        reference: 'C-2026-0003',
        status: 'under_review',
      }),
      'buyer.contracts.reviewDecision': businessError('SELF_APPROVAL_BLOCKED'),
    });
    const user = userEvent.setup();
    renderPage(<ContractPreparationPage />, {
      ...OPTIONS,
      route: '/buyer/contracts/3/preparation',
      permissions: ['contract.view', 'contract.approve'],
    });

    await user.click(await screen.findByRole('button', { name: 'Approve final agreement' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Reason/), 'Terms reviewed.');
    await user.click(within(dialog).getByRole('button', { name: 'Approve final agreement' }));
    expect(
      await within(dialog).findByText('You cannot approve a record you prepared or requested.'),
    ).toBeInTheDocument();
  });

  it('links an approval the workspace holds and shows one it does not hold without a link', async () => {
    routeCalls({
      'buyer.contracts.get': contractDetail({ id: 2, reference: 'C-2026-0002' }),
      'buyer.contracts.preparation': preparation({
        approvalHistory: [
          approval(),
          approval({
            approvalId: 14302,
            subjectType: 'contract',
            status: 'approved',
            title: 'Approve final agreement C-2026-0002',
            decidedAt: '2026-09-18T10:05:00Z',
            currentApprover: null,
            inApprovalWorkspace: false,
          }),
        ],
      }),
    });
    renderPage(<ContractPreparationPage />, { ...OPTIONS, permissions: ['contract.view'] });

    const history = await screen.findByRole('table', { name: 'Approval history' });
    expect(
      within(history).getByRole('link', {
        name: 'Review differences between the Lot 1 award and C-2026-0002',
      }),
    ).toHaveAttribute('href', '/me/approvals/42');
    expect(within(history).getByText('Approve final agreement C-2026-0002')).toBeInTheDocument();
    expect(
      within(history).queryByRole('link', { name: 'Approve final agreement C-2026-0002' }),
    ).not.toBeInTheDocument();
    expect(
      within(history).getByText('Kept with the contract record; not in the approval workspace'),
    ).toBeInTheDocument();
  });
});
