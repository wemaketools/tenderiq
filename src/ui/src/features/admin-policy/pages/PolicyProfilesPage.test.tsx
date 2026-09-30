import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { businessError, profilePage, profileSummary, renderPage, routeCalls } from '../test/kit';
import PolicyProfilesPage from './PolicyProfilesPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/buyer/admin/policy/profiles', route: '/buyer/admin/policy/profiles' };

describe('PolicyProfilesPage (ADM-06)', () => {
  it('lists each profile with its current and pending version, procedures, usage and status', async () => {
    routeCalls({ 'buyer.policy.listProfiles': () => profilePage() });
    renderPage(<PolicyProfilesPage />, PATH);

    const row = await screen.findByRole('row', { name: 'Standard competitive tendering' });
    expect(within(row).getByText('Version 2')).toBeInTheDocument();
    expect(within(row).getByText('Version 3')).toBeInTheDocument();
    expect(within(row).getByText('In review')).toBeInTheDocument();
    expect(within(row).getByText('Open, Restricted')).toBeInTheDocument();
    expect(within(row).getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Versions in review')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New profile' })).toBeInTheDocument();
  });

  it('sends the chosen filters and sort to the API', async () => {
    const calls = routeCalls({ 'buyer.policy.listProfiles': () => profilePage() });
    renderPage(<PolicyProfilesPage />, PATH);
    await screen.findByRole('row', { name: 'Standard competitive tendering' });

    fireEvent.change(screen.getByLabelText('Version status'), { target: { value: 'in_review' } });
    fireEvent.click(screen.getByRole('button', { name: /Tenders/ }));

    await waitFor(() =>
      expect(calls.at(-1)?.request).toEqual({
        query: expect.objectContaining({
          versionStatus: ['in_review'],
          sort: 'usageCount',
          dir: 'asc',
          page: 1,
        }),
      }),
    );
  });

  it('opens a profile when its row is chosen', async () => {
    routeCalls({ 'buyer.policy.listProfiles': () => profilePage() });
    const { router } = renderPage(<PolicyProfilesPage />, PATH);
    fireEvent.click(await screen.findByText('Standard competitive tendering'));
    expect(router.state.location.pathname).toBe('/buyer/admin/policy/profiles/1');
  });

  it('explains an empty register and hides creation from read-only auditors', async () => {
    routeCalls({ 'buyer.policy.listProfiles': () => profilePage([]) });
    renderPage(<PolicyProfilesPage />, { ...PATH, permissions: ['audit.view'] });
    expect(await screen.findByText('No policy profiles yet.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New profile' })).not.toBeInTheDocument();
  });

  it('shows the restricted state when the API refuses access', async () => {
    routeCalls({
      'buyer.policy.listProfiles': () => {
        throw businessError('buyer.policy.listProfiles', 'FORBIDDEN', 403);
      },
    });
    renderPage(<PolicyProfilesPage />, PATH);
    expect((await screen.findAllByText('Restricted')).length).toBeGreaterThan(0);
  });

  it('marks retired profiles', async () => {
    routeCalls({
      'buyer.policy.listProfiles': () =>
        profilePage([
          profileSummary({
            id: 4,
            name: 'Emergency direct procurement',
            status: 'retired',
            currentVersion: null,
            pendingVersion: null,
            permittedProcedures: ['direct'],
            usageCount: 0,
          }),
        ]),
    });
    renderPage(<PolicyProfilesPage />, PATH);
    const row = await screen.findByRole('row', { name: 'Emergency direct procurement' });
    expect(within(row).getByText('Retired')).toBeInTheDocument();
  });
});
