import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { businessError, profileDetail, renderPage, routeCalls, versionDetail } from '../test/kit';
import PolicyProfilePage from './PolicyProfilePage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/buyer/admin/policy/profiles/:profileId',
  route: '/buyer/admin/policy/profiles/1',
};

describe('PolicyProfilePage (ADM-06)', () => {
  it('shows the version history with the current version, usage and the next action', async () => {
    routeCalls({ 'buyer.policy.getProfile': () => profileDetail() });
    renderPage(<PolicyProfilePage />, PATH);

    const current = await screen.findByRole('row', { name: 'Version 2' });
    expect(within(current).getByText('Current')).toBeInTheDocument();
    expect(within(current).getByText('Approved')).toBeInTheDocument();
    expect(within(current).getByText('4')).toBeInTheDocument();
    expect(screen.getByText('An approver decides version 3.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Draft new version' })).not.toBeInTheDocument();
  });

  it('drafts a new version from a chosen base and opens it', async () => {
    const drafted = versionDetail({ id: 900, versionNo: 4, status: 'draft' });
    const calls = routeCalls({
      'buyer.policy.getProfile': () =>
        profileDetail({
          pendingVersion: null,
          capabilities: { canDraftVersion: true, canRetire: true },
        }),
      'buyer.policy.createVersion': () => drafted,
    });
    const { router } = renderPage(<PolicyProfilePage />, PATH);

    fireEvent.click(await screen.findByRole('button', { name: 'Draft new version' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Kalahari Water Utilities (Pilot)')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Start from/), { target: { value: '2' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create draft' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/buyer/admin/policy/profiles/1/versions/900'),
    );
    expect(calls.find((entry) => entry.id === 'buyer.policy.createVersion')?.request).toEqual({
      params: { profileId: 1 },
      body: { fromVersionId: 2 },
    });
  });

  it('requires a reason to retire and explains a refusal', async () => {
    routeCalls({
      'buyer.policy.getProfile': () =>
        profileDetail({ capabilities: { canDraftVersion: false, canRetire: true } }),
      'buyer.policy.retireProfile': () => {
        throw businessError('buyer.policy.retireProfile', 'POLICY_REVIEW_IN_PROGRESS');
      },
    });
    renderPage(<PolicyProfilePage />, PATH);

    fireEvent.click(await screen.findByRole('button', { name: 'Retire profile' }));
    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Retire profile' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Superseded.' } });
    fireEvent.click(confirm);

    expect(
      await within(dialog).findByText(
        'A version of this profile is in review. Decide or return it before retiring the profile.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the retirement once the profile is retired', async () => {
    routeCalls({
      'buyer.policy.getProfile': () =>
        profileDetail({
          status: 'retired',
          pendingVersion: null,
          retiredAt: '2026-09-29T08:00:00Z',
          retirementReason: 'Replaced by the 2027 rules.',
        }),
    });
    renderPage(<PolicyProfilePage />, PATH);
    expect(await screen.findByText('This profile is retired')).toBeInTheDocument();
    expect(screen.getByText('Replaced by the 2027 rules.')).toBeInTheDocument();
  });

  it('explains a profile that does not exist', async () => {
    routeCalls({});
    renderPage(<PolicyProfilePage />, PATH);
    expect(
      await screen.findByText('This record does not exist or is not available to you.'),
    ).toBeInTheDocument();
  });
});
