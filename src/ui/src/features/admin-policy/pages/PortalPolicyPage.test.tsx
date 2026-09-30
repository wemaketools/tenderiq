import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { businessError, portalPolicy, publicPortal, renderPage, routeCalls } from '../test/kit';
import PortalPolicyPage from './PortalPolicyPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/buyer/admin/policy/portal', route: '/buyer/admin/policy/portal' };

const idle = {
  proposal: null,
  capabilities: {
    canPropose: true,
    canSubmit: false,
    canApprove: false,
    canReturn: false,
    canWithdraw: false,
    approvalBlockedReason: null,
    alternativeOversightNote: null,
  },
};

const inReviewCaps = {
  canPropose: false,
  canSubmit: false,
  canApprove: true,
  canReturn: true,
  canWithdraw: true,
  approvalBlockedReason: null,
  alternativeOversightNote: null,
};

describe('PortalPolicyPage (ADM-11)', () => {
  it('compares the approved settings with the proposal and shows what the public sees', async () => {
    routeCalls({
      'buyer.policy.getPortal': () => portalPolicy(),
      'public.policy.portal': () => publicPortal(),
    });
    renderPage(<PortalPolicyPage />, PATH);

    expect(await screen.findByText('A proposed change is in review')).toBeInTheDocument();
    expect(screen.getByText('Approved settings (in force)')).toBeInTheDocument();
    expect(screen.getByText('Proposed settings')).toBeInTheDocument();
    expect(screen.getByText('Bidder identities')).toBeInTheDocument();
    expect(await screen.findByText('Online as “Kalahari Water Utilities”')).toBeInTheDocument();
    expect(screen.getByText(/^Portal launched\./)).toBeInTheDocument();
    expect(screen.getByText(/Proposed by Lorato Kgosi; Lorato Kgosi on/)).toBeInTheDocument();
    expect(
      screen.getByText(
        'Portal launched. (Self-approval under the documented alternative oversight.)',
      ),
    ).toBeInTheDocument();
  });

  it('blocks approving one’s own proposal and says why (BR-07)', async () => {
    routeCalls({
      'buyer.policy.getPortal': () =>
        portalPolicy({
          capabilities: {
            ...inReviewCaps,
            canApprove: false,
            approvalBlockedReason:
              'You submitted this proposal, so another approver must decide it (BR-07).',
          },
        }),
      'public.policy.portal': () => publicPortal(),
    });
    renderPage(<PortalPolicyPage />, PATH);
    expect(await screen.findByText('Another approver must decide')).toBeInTheDocument();
    expect(
      screen.getByText('You submitted this proposal, so another approver must decide it (BR-07).'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Approve disclosure settings' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return to draft' })).toBeInTheDocument();
  });

  it('shows the documented alternative oversight before the sole approver decides', async () => {
    routeCalls({
      'buyer.policy.getPortal': () =>
        portalPolicy({
          capabilities: {
            ...inReviewCaps,
            alternativeOversightNote:
              'The Organization Administrator is the only holder of policy approval. Internal Audit reviews every self-approved change.',
          },
        }),
      'public.policy.portal': () => publicPortal(),
    });
    renderPage(<PortalPolicyPage />, PATH);
    expect(
      await screen.findByText('Approval under documented alternative oversight'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'The Organization Administrator is the only holder of policy approval. Internal Audit reviews every self-approved change.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve disclosure settings' })).toBeInTheDocument();
  });

  it('approves only after the disclosure review is confirmed', async () => {
    const calls = routeCalls({
      'buyer.policy.getPortal': () => portalPolicy(),
      'public.policy.portal': () => publicPortal(),
      'buyer.policy.approvePortalProposal': () => portalPolicy(idle),
    });
    renderPage(<PortalPolicyPage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve disclosure settings' }));
    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Approve disclosure settings' });
    expect(confirm).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(confirm);
    expect(await screen.findByRole('button', { name: 'Propose a change' })).toBeInTheDocument();
    expect(
      calls.find((entry) => entry.id === 'buyer.policy.approvePortalProposal')?.request,
    ).toEqual({ body: { disclosureReviewed: true } });
  });

  it('keeps mandatory notice fields and the portal channel locked on while proposing', async () => {
    const calls = routeCalls({
      'buyer.policy.getPortal': () => portalPolicy(idle),
      'public.policy.portal': () => publicPortal(),
      'buyer.policy.savePortalProposal': () => portalPolicy(),
    });
    renderPage(<PortalPolicyPage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Propose a change' }));

    const reference = screen.getByRole('checkbox', { name: 'Reference (mandatory)' });
    expect(reference).toBeChecked();
    expect(reference).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Portal (mandatory)' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Save proposal' }));
    expect(await screen.findByText('Explain the change.')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: /Why the settings change/ }), {
      target: { value: 'Publish lot details.' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Lots' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save proposal' }));
    await waitFor(() =>
      expect(
        calls.find((entry) => entry.id === 'buyer.policy.savePortalProposal')?.request,
      ).toMatchObject({
        body: {
          changeNote: 'Publish lot details.',
          settings: expect.objectContaining({
            visibleNoticeFields: expect.arrayContaining(['reference', 'lots']),
            channels: ['portal'],
          }),
        },
      }),
    );
  });

  it('explains a proposal that changes nothing', async () => {
    routeCalls({
      'buyer.policy.getPortal': () => portalPolicy(idle),
      'public.policy.portal': () => publicPortal(),
      'buyer.policy.savePortalProposal': () => {
        throw businessError('buyer.policy.savePortalProposal', 'PORTAL_PROPOSAL_UNCHANGED', 422);
      },
    });
    renderPage(<PortalPolicyPage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Propose a change' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Why the settings change/ }), {
      target: { value: 'No change.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save proposal' }));
    expect(
      await screen.findByText('The proposal does not change any approved setting.'),
    ).toBeInTheDocument();
  });

  it('withdraws the proposal and keeps the approved settings', async () => {
    routeCalls({
      'buyer.policy.getPortal': () => portalPolicy(),
      'public.policy.portal': () => publicPortal(),
      'buyer.policy.withdrawPortalProposal': () => portalPolicy(idle),
    });
    renderPage(<PortalPolicyPage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw proposal' }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Withdraw proposal' }),
    );
    await waitFor(() =>
      expect(screen.queryByText('A proposed change is in review')).not.toBeInTheDocument(),
    );
  });

  it('is read-only for a publisher without portal management', async () => {
    routeCalls({
      'buyer.policy.getPortal': () =>
        portalPolicy({
          proposal: null,
          capabilities: {
            canPropose: false,
            canSubmit: false,
            canApprove: false,
            canReturn: false,
            canWithdraw: false,
            approvalBlockedReason: null,
            alternativeOversightNote: null,
          },
        }),
      'public.policy.portal': () => publicPortal(),
    });
    renderPage(<PortalPolicyPage />, { ...PATH, permissions: ['tender.publish'] });
    expect(await screen.findByText('No change pending.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Propose a change' })).not.toBeInTheDocument();
  });
});
