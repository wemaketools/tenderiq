import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  businessError,
  comparison,
  profileDetail,
  renderPage,
  routeCalls,
  versionDetail,
} from '../test/kit';
import PolicyVersionPage from './PolicyVersionPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/buyer/admin/policy/profiles/:profileId/versions/:versionId',
  route: '/buyer/admin/policy/profiles/1/versions/3',
};

const draftCaps = {
  canEdit: true,
  canSubmit: true,
  canApprove: false,
  canReturn: false,
  canRetire: false,
  approvalBlockedReason: null,
  alternativeOversightNote: null,
};

describe('PolicyVersionPage (ADM-06)', () => {
  it('shows the rules sections, the lifecycle and the next action of a version in review', async () => {
    routeCalls({ 'buyer.policy.getVersion': () => versionDetail() });
    renderPage(<PolicyVersionPage />, PATH);

    expect(await screen.findByText('Procedures')).toBeInTheDocument();
    for (const section of [
      'Value thresholds',
      'Gates and approvals',
      'Exceptions',
      'Publication',
      'Opening',
      'Waiting periods',
      'Complaint rules',
    ]) {
      expect(screen.getAllByText(section).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole('list', { name: 'Version lifecycle' })).toBeInTheDocument();
    expect(screen.getByText('Approve the version or return it with a reason.')).toBeInTheDocument();
  });

  it('lists the tenders that froze the version and those that only propose it', async () => {
    routeCalls({ 'buyer.policy.getVersion': () => versionDetail() });
    renderPage(<PolicyVersionPage />, PATH);
    fireEvent.click(await screen.findByRole('tab', { name: /Events using this version/ }));

    const frozen = screen.getByRole('link', { name: 'T-2026-0003' }).closest('tr');
    const proposed = screen.getByRole('link', { name: 'T-2026-0005' }).closest('tr');
    expect(within(frozen as HTMLElement).getByText('Frozen at release')).toBeInTheDocument();
    expect(within(proposed as HTMLElement).getByText('Proposed')).toBeInTheDocument();
  });

  it('approves only after the acknowledgement and shows the approved result', async () => {
    const calls = routeCalls({
      'buyer.policy.getVersion': () => versionDetail(),
      'buyer.policy.approveVersion': () =>
        versionDetail({
          status: 'approved',
          isCurrent: true,
          effectiveFrom: '2026-10-01T00:00:00Z',
          capabilities: { ...draftCaps, canEdit: false, canSubmit: false },
        }),
    });
    renderPage(<PolicyVersionPage />, PATH);

    fireEvent.click(await screen.findByRole('button', { name: 'Approve version' }));
    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Approve version' });
    expect(confirm).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(confirm);

    expect(await screen.findByText('Approved versions cannot be changed')).toBeInTheDocument();
    expect(calls.find((entry) => entry.id === 'buyer.policy.approveVersion')?.request).toEqual({
      params: { profileId: 1, versionId: 3 },
      body: {},
    });
  });

  it('tells the submitter that another approver must decide', async () => {
    routeCalls({
      'buyer.policy.getVersion': () =>
        versionDetail({
          capabilities: {
            ...draftCaps,
            canEdit: false,
            canSubmit: false,
            canReturn: true,
            approvalBlockedReason:
              'You submitted this version, so another approver must decide it (BR-07).',
          },
        }),
    });
    renderPage(<PolicyVersionPage />, PATH);
    expect(await screen.findByText('Another approver must decide')).toBeInTheDocument();
    expect(
      screen.getByText('You submitted this version, so another approver must decide it (BR-07).'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve version' })).not.toBeInTheDocument();
  });

  it('shows the documented alternative oversight when the sole approver decides their own version', async () => {
    routeCalls({
      'buyer.policy.getVersion': () =>
        versionDetail({
          capabilities: {
            ...draftCaps,
            canEdit: false,
            canSubmit: false,
            canApprove: true,
            canReturn: true,
            alternativeOversightNote:
              'The Organization Administrator is the only holder of policy approval. Internal Audit reviews every self-approved change.',
          },
        }),
    });
    renderPage(<PolicyVersionPage />, PATH);
    expect(
      await screen.findByText('Approval under documented alternative oversight'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'The Organization Administrator is the only holder of policy approval. Internal Audit reviews every self-approved change.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve version' })).toBeInTheDocument();
  });

  it('edits and saves a draft, keeping it unsubmitted', async () => {
    const draft = versionDetail({
      status: 'draft',
      submittedBy: null,
      submittedAt: null,
      capabilities: draftCaps,
    });
    const calls = routeCalls({
      'buyer.policy.getVersion': () => draft,
      'buyer.policy.updateVersion': () => draft,
    });
    renderPage(<PolicyVersionPage />, PATH);

    expect(await screen.findByLabelText('Before you submit')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit rules' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Minimum response period/ }), {
      target: { value: '30' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() =>
      expect(
        calls.find((entry) => entry.id === 'buyer.policy.updateVersion')?.request,
      ).toMatchObject({
        body: { rules: expect.objectContaining({ minResponseDays: 30 }) },
      }),
    );
    expect(await screen.findByRole('button', { name: 'Submit for review' })).toBeInTheDocument();
  });

  it('shows the contract rule when the draft is incoherent', async () => {
    routeCalls({
      'buyer.policy.getVersion': () => versionDetail({ status: 'draft', capabilities: draftCaps }),
    });
    renderPage(<PolicyVersionPage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit rules' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Opening quorum/ }), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(
      await screen.findByText('A second-person opening needs a quorum of at least 2.'),
    ).toBeInTheDocument();
  });

  it('submits a draft for review and explains a refusal', async () => {
    routeCalls({
      'buyer.policy.getVersion': () => versionDetail({ status: 'draft', capabilities: draftCaps }),
      'buyer.policy.submitVersion': () => {
        throw businessError('buyer.policy.submitVersion', 'POLICY_PROFILE_RETIRED');
      },
    });
    renderPage(<PolicyVersionPage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Submit for review' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Submit for review' }));
    expect(
      await within(dialog).findByText(
        'The profile is retired: no new version can be drafted or submitted.',
      ),
    ).toBeInTheDocument();
  });

  it('compares the version with the current one', async () => {
    routeCalls({
      'buyer.policy.getVersion': () => versionDetail(),
      'buyer.policy.getProfile': () => profileDetail(),
      'buyer.policy.compareVersions': () => comparison(),
    });
    renderPage(<PolicyVersionPage />, PATH);
    fireEvent.click(await screen.findByRole('tab', { name: 'Changes' }));
    expect(await screen.findByText('Minimum response period (days)')).toBeInTheDocument();
    expect(screen.getByText('Version 2 → version 3')).toBeInTheDocument();
  });
});
