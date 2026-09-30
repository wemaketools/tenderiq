import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { navGroupsFor } from '../../../app/featureRegistry';
import { initialSessionState } from '../../../app/slices/session';
import { installFetch, problem } from '../../../test/fetchMock';
import { makeUser, signedInSession } from '../../../test/fixtures';
import { renderWithProviders, stubAuth } from '../../../test/render';
import {
  invitationPreview,
  myAccess,
  myMembership,
  myMembershipPage,
  myProfile,
  notificationPreferences,
} from '../../admin-access/test/data';
import InvitationPage from '../pages/InvitationPage';
import MembershipsPage from '../pages/MembershipsPage';
import ProfilePage from '../pages/ProfilePage';
import { features } from '../routes';

afterEach(() => {
  vi.unstubAllGlobals();
});

const TOKEN = 'odc-inv-dineo-masire-3b9e7a12';
const inviteRoute = { route: `/invite/${TOKEN}`, path: '/invite/:token' };

describe('InvitationPage (COM-01)', () => {
  it('asks a signed-out person to sign in with the invited address', async () => {
    // Arrange
    installFetch({
      [`GET /api/v1/public/invitations/${TOKEN}`]: () => ({ body: invitationPreview() }),
    });

    // Act
    renderWithProviders(<InvitationPage />, {
      state: { session: { ...initialSessionState, authStatus: 'signedOut' } },
      ...inviteRoute,
    });

    // Assert
    expect(await screen.findByText('Join Okavango District Council')).toBeInTheDocument();
    expect(screen.getByText('d***@tenderiq.local')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sign in to accept/ })).toHaveAttribute(
      'href',
      '/signin',
    );
  });

  it('accepts the invitation after the person confirms the organization and capacity', async () => {
    // Arrange
    const auth = stubAuth();
    const { requests } = installFetch({
      [`GET /api/v1/public/invitations/${TOKEN}`]: () => ({ body: invitationPreview() }),
      [`POST /api/v1/me/invitations/${TOKEN}/accept`]: () => ({
        body: {
          invitationId: 10,
          userActivated: false,
          membership: myMembership({
            membershipId: 514,
            organization: {
              tenantId: 3,
              tenantName: 'Okavango District Council',
              tenantKind: 'buyer',
            },
            organizationSlug: 'odc',
            capacity: 'Legal Adviser (shared service)',
          }),
        },
      }),
    });
    renderWithProviders(<InvitationPage />, {
      state: {
        session: signedInSession({ user: makeUser({ email: 'dineo.legal@tenderiq.local' }) }),
      },
      auth,
      ...inviteRoute,
    });
    await userEvent.click(await screen.findByLabelText(/I will act for Okavango District Council/));
    await userEvent.click(screen.getByRole('button', { name: /Accept invitation/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Okavango District Council')).toBeInTheDocument();

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Accept invitation' }));

    // Assert
    expect(await screen.findByText('You joined Okavango District Council')).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      confirmCapacity: true,
    });
    expect(auth.reloadContext).toHaveBeenCalled();
  });

  it('explains an expired invitation without offering acceptance', async () => {
    // Arrange
    installFetch({
      [`GET /api/v1/public/invitations/${TOKEN}`]: () => ({
        body: invitationPreview({ status: 'expired' }),
      }),
    });

    // Act
    renderWithProviders(<InvitationPage />, {
      state: { session: signedInSession() },
      ...inviteRoute,
    });

    // Assert
    expect(await screen.findByText('This invitation has expired')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Accept invitation/ })).not.toBeInTheDocument();
  });

  it('explains an e-mail mismatch returned by the API', async () => {
    // Arrange
    installFetch({
      [`GET /api/v1/public/invitations/${TOKEN}`]: () => ({ body: invitationPreview() }),
      [`POST /api/v1/me/invitations/${TOKEN}/accept`]: () =>
        problem(409, 'Conflict', { code: 'INVITATION_EMAIL_MISMATCH', detail: 'Mismatch.' }),
    });
    renderWithProviders(<InvitationPage />, {
      state: { session: signedInSession() },
      ...inviteRoute,
    });
    await userEvent.click(await screen.findByLabelText(/I will act for/));
    await userEvent.click(screen.getByRole('button', { name: /Accept invitation/ }));
    const dialog = await screen.findByRole('dialog');

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Accept invitation' }));

    // Assert
    expect(
      (await screen.findAllByText(/This invitation is addressed to another e-mail address/)).length,
    ).toBeGreaterThan(0);
  });

  it('shows an invalid link without calling the API when the token is malformed', async () => {
    // Arrange
    const { requests } = installFetch({});

    // Act
    renderWithProviders(<InvitationPage />, {
      state: { session: signedInSession() },
      route: '/invite/x',
      path: '/invite/:token',
    });

    // Assert
    expect(await screen.findByText('This invitation link is not valid')).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });
});

describe('MembershipsPage (COM-02, AC-02)', () => {
  it('tells a person with buyer and supplier memberships that conflicts are routed for review', async () => {
    // Arrange
    installFetch({ ['GET /api/v1/me/memberships']: () => ({ body: myMembershipPage() }) });

    // Act
    renderWithProviders(<MembershipsPage />, { state: { session: signedInSession() } });

    // Assert
    expect(
      await screen.findByText('You belong to buyer and supplier organizations'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Your request is waiting for the organization’s administrator.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Current/).length).toBeGreaterThan(0);
  });

  it('withdraws a pending membership request in the name of that organization', async () => {
    // Arrange
    const { requests } = installFetch({
      ['GET /api/v1/me/memberships']: () => ({ body: myMembershipPage() }),
      ['POST /api/v1/me/memberships/12/withdraw-request']: () => ({
        body: myMembership({
          membershipId: 12,
          organization: { tenantId: 7, tenantName: 'Serowe ICT Solutions', tenantKind: 'supplier' },
          organizationSlug: 'serowe-ict',
          status: 'revoked',
          joinedAt: null,
          endedAt: '2026-09-30T08:00:00Z',
          canLeave: false,
        }),
      }),
    });
    renderWithProviders(<MembershipsPage />, { state: { session: signedInSession() } });
    await userEvent.click(await screen.findByRole('button', { name: 'Withdraw request' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByText('Serowe ICT Solutions').length).toBeGreaterThan(0);

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Withdraw request' }));

    // Assert
    await waitFor(() => expect(requests.some((request) => request.method === 'POST')).toBe(true));
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({});
  });
});

describe('ProfilePage (COM-03)', () => {
  function profileRoutes() {
    return {
      ['GET /api/v1/me/profile']: () => ({ body: myProfile() }),
      ['GET /api/v1/me/notification-preferences']: () => ({ body: notificationPreferences() }),
      ['GET /api/v1/me/memberships']: () => ({ body: myMembershipPage() }),
      ['GET /api/v1/me/access-summary']: () => ({ body: myAccess() }),
    };
  }

  it('saves the name, language and display time zone', async () => {
    // Arrange
    const { requests } = installFetch({
      ...profileRoutes(),
      ['PUT /api/v1/me/profile']: () => ({ body: { ...myProfile(), fullName: 'Lorato K. Kgosi' } }),
    });
    renderWithProviders(<ProfilePage />, { state: { session: signedInSession() } });
    const name = await screen.findByLabelText(/Full name/);
    await userEvent.clear(name);
    await userEvent.type(name, 'Lorato K. Kgosi');

    // Act
    await userEvent.click(screen.getByRole('button', { name: /Save profile/ }));

    // Assert
    await waitFor(() => expect(requests.some((request) => request.method === 'PUT')).toBe(true));
    expect(requests.find((request) => request.method === 'PUT')?.body).toEqual({
      fullName: 'Lorato K. Kgosi',
      locale: 'en-BW',
      displayTimeZone: null,
    });
  });

  it('asks for confirmation of a new e-mail address and explains an address in use', async () => {
    // Arrange
    installFetch({
      ...profileRoutes(),
      ['POST /api/v1/me/profile/contact-changes']: () =>
        problem(409, 'Conflict', { code: 'EMAIL_IN_USE', detail: 'In use.' }),
    });
    renderWithProviders(<ProfilePage />, { state: { session: signedInSession() } });
    await userEvent.click(await screen.findByRole('button', { name: /Change e-mail/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/New e-mail address/), 'someone@kwu.co.bw');

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send confirmation' }));

    // Assert
    expect(
      await within(dialog).findByText('This e-mail address is used by another account.'),
    ).toBeInTheDocument();
  });

  it('never sends mandatory notices when saving notification choices', async () => {
    // Arrange
    const { requests } = installFetch({
      ...profileRoutes(),
      ['PUT /api/v1/me/notification-preferences']: () => ({ body: notificationPreferences() }),
    });
    renderWithProviders(<ProfilePage />, { state: { session: signedInSession() } });
    await userEvent.click(await screen.findByLabelText('E-mail: Task assigned'));

    // Act
    await userEvent.click(screen.getByRole('button', { name: /Save notification choices/ }));

    // Assert
    await waitFor(() =>
      expect(
        requests.some(
          (request) =>
            request.path.endsWith('notification-preferences') && request.method === 'PUT',
        ),
      ).toBe(true),
    );
    expect(requests.find((request) => request.method === 'PUT')?.body).toEqual({
      items: [{ eventType: 'task_assigned', inApp: true, email: false, digest: 'none' }],
    });
    expect(screen.getByLabelText('In the app: Tender issued')).toBeDisabled();
  });

  it('shows personal access per organization', async () => {
    // Arrange
    installFetch(profileRoutes());

    // Act
    renderWithProviders(<ProfilePage />, { state: { session: signedInSession() } });

    // Assert
    expect(await screen.findByText('My access')).toBeInTheDocument();
    expect(await screen.findByText('Procurement officer')).toBeInTheDocument();
  });
});

describe('account navigation', () => {
  it('offers My organizations to every tenant kind without a permission', () => {
    // Arrange
    const kinds = ['buyer', 'supplier', 'operator'] as const;

    // Act
    const destinations = kinds.map((tenantKind) =>
      navGroupsFor(features, { tenantKind, permissions: [] }).flatMap((group) =>
        group.items.map((item) => item.to),
      ),
    );

    // Assert
    expect(destinations).toEqual([['/me/memberships'], ['/me/memberships'], ['/me/memberships']]);
  });
});
