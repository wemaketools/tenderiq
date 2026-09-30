import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ClientModule from '../../../api/client';

import { assignees, contractDetail, obligationDetail, obligationList } from '../test/data';
import { callsTo, renderPage, routeCalls } from '../test/harness';
import MilestonesPage from './MilestonesPage';
import ObligationPage from './ObligationPage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof ClientModule>()),
  call: vi.fn(),
}));

const DETAIL = {
  route: '/buyer/contracts/1/obligations/14702',
  path: '/buyer/contracts/:contractId/obligations/:obligationId',
} as const;

describe('MilestonesPage (CON-06)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists milestones and deliverables only and states that acceptance is not payment readiness', async () => {
    const calls = routeCalls({
      'buyer.contracts.get': contractDetail(),
      'buyer.contracts.obligations': obligationList(),
      'buyer.contracts.assignees': assignees(),
    });
    renderPage(<MilestonesPage />, {
      route: '/buyer/contracts/1/milestones',
      path: '/buyer/contracts/:contractId/milestones',
      permissions: ['contract.view'],
    });

    expect(await screen.findByText('Q3 service report (July to September)')).toBeInTheDocument();
    expect(screen.getByText('Acceptance is not payment readiness')).toBeInTheDocument();
    expect(callsTo(calls, 'buyer.contracts.obligations')[0]?.request).toMatchObject({
      query: { kind: ['milestone', 'deliverable'] },
    });
  });
});

describe('ObligationPage (CON-06)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows rejected work with reasons, remediation owner and due date, and payment status apart (AC-30)', async () => {
    routeCalls({
      'buyer.contracts.get': contractDetail(),
      'buyer.contracts.obligation': obligationDetail(),
    });
    renderPage(<ObligationPage />, { ...DETAIL, permissions: ['contract.view'] });

    expect(await screen.findByText('Rejected work')).toBeInTheDocument();
    expect(screen.getByText('Availability figures missing for 14 vehicles.')).toBeInTheDocument();
    expect(
      screen.getByText('Remediation: Resubmit with complete availability figures.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Owner: Masego Rakgosi')).toBeInTheDocument();
    expect(screen.getByText('Invoice and payment status')).toBeInTheDocument();
    expect(screen.getByText('TSO-INV-0931')).toBeInTheDocument();
    expect(screen.getByText('Not accepted')).toBeInTheDocument();
  });

  it('requires remediation, owner and due date before rejecting evidence', async () => {
    const calls = routeCalls({
      'buyer.contracts.get': contractDetail(),
      'buyer.contracts.obligation': obligationDetail({ status: 'under_review' }),
      'buyer.contracts.assignees': assignees(),
    });
    const user = userEvent.setup();
    renderPage(<ObligationPage />, {
      ...DETAIL,
      permissions: ['contract.view', 'contract.manage'],
    });

    await user.click(await screen.findByRole('button', { name: 'Accept or reject' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByLabelText('Rejected'));
    await user.type(within(dialog).getByLabelText(/Reasons/), 'Figures incomplete.');
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }));

    expect(
      await within(dialog).findByText('State the remediation the rejection requires.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Name who owns the remediation.')).toBeInTheDocument();
    expect(within(dialog).getByText('Set the remediation due date.')).toBeInTheDocument();
    expect(callsTo(calls, 'buyer.contracts.decideObligation')).toHaveLength(0);
  });

  it('accepts evidence with reasons and reports that payment status is unchanged', async () => {
    const calls = routeCalls({
      'buyer.contracts.get': contractDetail(),
      'buyer.contracts.obligation': obligationDetail({ status: 'under_review' }),
      'buyer.contracts.assignees': assignees(),
      'buyer.contracts.decideObligation': (request: unknown) => ({
        obligation: { ...obligationDetail(), status: 'accepted' },
        decision: {
          ...obligationDetail().decisions[0],
          decision: 'accepted',
          remediationRequired: null,
          remediationOwner: null,
          remediationDueAt: null,
          reasons: (request as { body: { reasons: string } }).body.reasons,
        },
        payment: obligationDetail().payment,
        message: 'Accepted. Invoice and payment status are unchanged.',
      }),
    });
    const user = userEvent.setup();
    renderPage(<ObligationPage />, {
      ...DETAIL,
      permissions: ['contract.view', 'contract.manage'],
    });

    await user.click(await screen.findByRole('button', { name: 'Accept or reject' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Reasons/), 'Meets the criteria.');
    await user.click(within(dialog).getByRole('button', { name: 'Accept' }));

    expect(
      await screen.findByText('Accepted. Invoice and payment status are unchanged.'),
    ).toBeInTheDocument();
    expect(callsTo(calls, 'buyer.contracts.decideObligation')[0]?.request).toMatchObject({
      body: { decision: 'accepted', reasons: 'Meets the criteria.' },
    });
  });
});
