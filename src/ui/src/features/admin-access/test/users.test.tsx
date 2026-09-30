import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import UserDetailPage from '../pages/UserDetailPage';
import UsersPage from '../pages/UsersPage';
import {
  buyerAdminSession,
  deactivatedRow,
  deactivationReview,
  invitationRow,
  memberDetail,
  memberRow,
  page,
  roleRow,
  supplierAdminSession,
} from './data';

afterEach(() => {
  vi.unstubAllGlobals();
});

const BUYER = '/api/v1/buyer/admin';
const SUPPLIER = '/api/v1/supplier/admin';

function directoryRoutes(base: string) {
  return {
    [`GET ${base}/users`]: () => ({ body: page([memberRow(), deactivatedRow()]) }),
    [`GET ${base}/roles`]: () => ({ body: page([roleRow()]) }),
    [`GET ${base}/groups`]: () => ({ body: page([]) }),
    [`GET ${base}/invitations`]: () => ({ body: page([invitationRow()]) }),
  };
}

describe('UsersPage (ADM-03)', () => {
  it('lists members with capacity, status and open work when the buyer administrator opens the directory', async () => {
    // Arrange
    installFetch(directoryRoutes(BUYER));

    // Act
    renderWithProviders(<UsersPage />, { state: { session: buyerAdminSession() } });

    // Assert
    expect(await screen.findByText('Tebogo Molefe')).toBeInTheDocument();
    expect(screen.getByText('Gaone Letsholo')).toBeInTheDocument();
    expect(screen.getByText('Procurement Officer (departed)')).toBeInTheDocument();
    expect(screen.getByText('Account Deactivated')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Invite person/ })).toBeInTheDocument();
  });

  it('sends the status filter to the API when a membership status is chosen', async () => {
    // Arrange
    const { requests } = installFetch(directoryRoutes(BUYER));
    renderWithProviders(<UsersPage />, { state: { session: buyerAdminSession() } });
    await screen.findByText('Tebogo Molefe');

    // Act
    await userEvent.selectOptions(screen.getByLabelText('Membership'), 'suspended');

    // Assert
    await waitFor(() =>
      expect(
        requests.some(
          (request) =>
            request.path === `${BUYER}/users` && request.search.includes('status=suspended'),
        ),
      ).toBe(true),
    );
  });

  it('reissues an expired invitation without a new identity when the administrator confirms', async () => {
    // Arrange
    const { requests } = installFetch({
      ...directoryRoutes(BUYER),
      [`POST ${BUYER}/invitations/2/reissue`]: () => ({
        body: invitationRow({
          invitationId: 900,
          status: 'pending',
          expiresAt: '2026-10-14T15:00:00Z',
          reissuedFromId: 2,
          canReissue: false,
          canRevoke: true,
        }),
      }),
    });
    renderWithProviders(<UsersPage />, { state: { session: buyerAdminSession() } });
    await userEvent.click(await screen.findByRole('tab', { name: 'Invitations' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Reissue' }));

    // Act
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reissue' }));

    // Assert
    await waitFor(() =>
      expect(requests.some((request) => request.path === `${BUYER}/invitations/2/reissue`)).toBe(
        true,
      ),
    );
    expect(
      requests.find((request) => request.path === `${BUYER}/invitations/2/reissue`)?.body,
    ).toEqual({ expiresInDays: 14 });
  });

  it('explains a business error in the invite dialog when the address already belongs to a member', async () => {
    // Arrange
    installFetch({
      ...directoryRoutes(BUYER),
      [`POST ${BUYER}/invitations`]: () =>
        problem(409, 'Conflict', { code: 'ALREADY_MEMBER', detail: 'Already a member.' }),
    });
    renderWithProviders(<UsersPage />, { state: { session: buyerAdminSession() } });
    await userEvent.click(await screen.findByRole('button', { name: /Invite person/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(
      within(dialog).getByLabelText(/E-mail address/),
      'tebogo.officer@tenderiq.local',
    );
    await userEvent.type(within(dialog).getByLabelText(/Full name/), 'Tebogo Molefe');
    await userEvent.type(within(dialog).getByLabelText(/^Capacity/), 'Procurement Officer');
    await userEvent.click(within(dialog).getByLabelText('Site inspector'));

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }));

    // Assert
    expect(
      await within(dialog).findByText('This person is already a member of the organization.'),
    ).toBeInTheDocument();
  });

  it('uses the supplier endpoints and shows submission authority when a supplier administrator opens SUP-04', async () => {
    // Arrange
    const { requests } = installFetch({
      ...directoryRoutes(SUPPLIER),
      [`GET ${SUPPLIER}/users`]: () => ({
        body: page([
          memberRow({
            userId: 26,
            fullName: 'Ditiro Kebonang',
            email: 'tsodilo.contributor@tenderiq.local',
            capacity: 'Technical Contributor',
            supplierAuthority: {
              canSubmit: false,
              canApprove: false,
              canPrice: false,
              signingLimit: null,
            },
          }),
        ]),
      }),
    });

    // Act
    renderWithProviders(<UsersPage />, { state: { session: supplierAdminSession() } });

    // Assert
    expect(await screen.findByText('Ditiro Kebonang')).toBeInTheDocument();
    expect(requests.every((request) => !request.path.startsWith(BUYER))).toBe(true);
    expect(screen.getByText('Cannot submit')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Users and authority' })).toBeInTheDocument();
  });
});

describe('UserDetailPage (ADM-03, AC-04)', () => {
  const detailRoute = {
    route: '/buyer/admin/access/users/5',
    path: '/buyer/admin/access/users/:userId',
  };

  it('shows roles, direct grants, open work and attributed history of a member', async () => {
    // Arrange
    installFetch({
      [`GET ${BUYER}/users/5`]: () => ({ body: memberDetail() }),
      [`GET ${BUYER}/access/users/5`]: () => problem(403, 'Forbidden', { code: 'FORBIDDEN' }),
    });

    // Act
    renderWithProviders(<UserDetailPage />, {
      state: { session: buyerAdminSession() },
      ...detailRoute,
    });

    // Assert
    expect((await screen.findAllByText('Role assignments'))[0]).toBeInTheDocument();
    expect(screen.getByText('tender.view')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Open work/ }));
    expect(await screen.findByText('Must be reassigned')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Attributed history/ }));
    expect(await screen.findByText(/Published the smart water meter tender/)).toBeInTheDocument();
  });

  it('deactivates a leaver with the formal work reassigned and both confirmations (AC-04)', async () => {
    // Arrange
    const { requests } = installFetch({
      [`GET ${BUYER}/users/5`]: () => ({ body: memberDetail() }),
      [`GET ${BUYER}/access/users/5`]: () => problem(403, 'Forbidden', { code: 'FORBIDDEN' }),
      [`GET ${BUYER}/users/5/deactivation-review`]: () => ({ body: deactivationReview() }),
      [`POST ${BUYER}/users/5/deactivate`]: () => ({
        body: {
          member: memberRow({ membershipStatus: 'revoked', userStatus: 'deactivated' }),
          effects: {
            reassignedWorkItems: 1,
            endedDelegations: 1,
            endedGrants: 1,
            endedRoleAssignments: 1,
            retainedHistoryRecords: 1,
          },
        },
      }),
    });
    renderWithProviders(<UserDetailPage />, {
      state: { session: buyerAdminSession() },
      ...detailRoute,
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(
      await within(dialog).findByLabelText(
        /New owner for Tender owner of Pipeline valves bulk supply/,
      ),
      '4',
    );
    await userEvent.click(
      within(dialog).getByLabelText('I reviewed the delegations this person gave and received.'),
    );
    await userEvent.click(
      within(dialog).getByLabelText(
        'I understand that past actions stay attributed to this person.',
      ),
    );
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Left the utility.');

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    // Assert
    await waitFor(() =>
      expect(requests.some((request) => request.path === `${BUYER}/users/5/deactivate`)).toBe(true),
    );
    expect(
      requests.find((request) => request.path === `${BUYER}/users/5/deactivate`)?.body,
    ).toEqual({
      reason: 'Left the utility.',
      reassignments: [{ workItemId: 31, toUserId: 4 }],
      confirmDelegationsReviewed: true,
      confirmHistoryRetained: true,
    });
    expect(
      await screen.findByText('Tebogo Molefe was deactivated.', { selector: '.tiq-banner-title' }),
    ).toBeInTheDocument();
  });

  it('ends roles and clears the reassign banner once a suspended member is deactivated (AC-04)', async () => {
    // Arrange
    installFetch({
      [`GET ${BUYER}/users/5`]: () => ({
        body: memberDetail({
          membershipStatus: 'suspended',
          availableActions: ['edit', 'activate', 'deactivate', 'reassignWork'],
        }),
      }),
      [`GET ${BUYER}/access/users/5`]: () => problem(403, 'Forbidden', { code: 'FORBIDDEN' }),
      [`GET ${BUYER}/users/5/deactivation-review`]: () => ({ body: deactivationReview() }),
      [`POST ${BUYER}/users/5/deactivate`]: () => ({
        body: {
          member: memberRow({
            membershipStatus: 'revoked',
            userStatus: 'deactivated',
            openWorkCount: 0,
          }),
          effects: {
            reassignedWorkItems: 1,
            endedDelegations: 1,
            endedGrants: 1,
            endedRoleAssignments: 1,
            retainedHistoryRecords: 1,
          },
        },
      }),
    });
    renderWithProviders(<UserDetailPage />, {
      state: { session: buyerAdminSession() },
      ...detailRoute,
    });
    expect(
      await screen.findByText('Reassign the open work this person still holds.'),
    ).toBeInTheDocument();
    const roleRow = screen.getByText('Procurement officer', { selector: 'td *, td' }).closest('tr');
    if (roleRow === null) throw new Error('Role assignment row not rendered.');
    expect(within(roleRow).getByText('Active')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(
      await within(dialog).findByLabelText(
        /New owner for Tender owner of Pipeline valves bulk supply/,
      ),
      '4',
    );
    await userEvent.click(
      within(dialog).getByLabelText('I reviewed the delegations this person gave and received.'),
    );
    await userEvent.click(
      within(dialog).getByLabelText(
        'I understand that past actions stay attributed to this person.',
      ),
    );
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Left the utility.');

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    // Assert
    expect(
      await screen.findByText('Tebogo Molefe was deactivated.', { selector: '.tiq-banner-title' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Reassign the open work this person still holds.'),
    ).not.toBeInTheDocument();
    const ended = screen.getByText('Procurement officer', { selector: 'td *, td' }).closest('tr');
    if (ended === null) throw new Error('Role assignment row not rendered.');
    expect(within(ended).getByText('Ended')).toBeInTheDocument();
    expect(within(ended).queryByText('Active')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Open work/ })).toHaveTextContent('0');
  });

  it('drops reassigned items from the open work and clears the reassign banner (AC-04)', async () => {
    // Arrange
    const { requests } = installFetch({
      [`GET ${BUYER}/users/5`]: () => ({
        body: memberDetail({
          membershipStatus: 'revoked',
          userStatus: 'deactivated',
          availableActions: ['reassignWork'],
        }),
      }),
      [`GET ${BUYER}/access/users/5`]: () => problem(403, 'Forbidden', { code: 'FORBIDDEN' }),
      [`GET ${BUYER}/users`]: () => ({
        body: page([
          memberRow({
            userId: 4,
            membershipId: 504,
            fullName: 'Mpho Dikgang',
            email: 'mpho.manager@tenderiq.local',
          }),
        ]),
      }),
      [`POST ${BUYER}/users/5/reassign-work`]: () => ({
        body: {
          member: memberRow({ membershipStatus: 'revoked', userStatus: 'deactivated' }),
          effects: {
            reassignedWorkItems: 2,
            endedDelegations: 0,
            endedGrants: 0,
            endedRoleAssignments: 0,
            retainedHistoryRecords: 1,
          },
        },
      }),
    });
    renderWithProviders(<UserDetailPage />, {
      state: { session: buyerAdminSession() },
      ...detailRoute,
    });
    expect(
      await screen.findByText('Reassign the open work this person still holds.'),
    ).toBeInTheDocument();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Reassign work' }))[0]!);
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(
      await within(dialog).findByLabelText(
        /New owner for Tender owner of Pipeline valves bulk supply/,
      ),
      '4',
    );
    await userEvent.selectOptions(
      within(dialog).getByLabelText(/New owner for Reminder to review supplier questions/),
      '4',
    );
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Handover to the manager.');

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: /Reassign/ }));

    // Assert
    await waitFor(() =>
      expect(requests.some((request) => request.path === `${BUYER}/users/5/reassign-work`)).toBe(
        true,
      ),
    );
    await waitFor(() =>
      expect(
        screen.queryByText('Reassign the open work this person still holds.'),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByText('Tender owner of Pipeline valves bulk supply'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Open work/ })).toHaveTextContent('0');
  });

  it('shows the self-grant refusal when a role assignment is refused', async () => {
    // Arrange
    installFetch({
      [`GET ${BUYER}/users/5`]: () => ({ body: memberDetail() }),
      [`GET ${BUYER}/access/users/5`]: () => problem(403, 'Forbidden', { code: 'FORBIDDEN' }),
      [`GET ${BUYER}/roles`]: () => ({ body: page([roleRow()]) }),
      [`POST ${BUYER}/users/5/role-assignments`]: () =>
        problem(403, 'Forbidden', { code: 'SELF_GRANT_FORBIDDEN', detail: 'Self grant.' }),
    });
    renderWithProviders(<UserDetailPage />, {
      state: { session: buyerAdminSession() },
      ...detailRoute,
    });
    await userEvent.click(await screen.findByRole('button', { name: /Assign role/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(await within(dialog).findByLabelText(/^Role/), '30');
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Site visits.');

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Assign role' }));

    // Assert
    expect(
      await within(dialog).findByText(
        'Nobody can grant authority to themselves. Ask another administrator.',
      ),
    ).toBeInTheDocument();
  });

  it('hides lifecycle actions when the viewer may only read the directory', async () => {
    // Arrange
    installFetch({ [`GET ${BUYER}/users/5`]: () => ({ body: memberDetail() }) });

    // Act
    renderWithProviders(<UserDetailPage />, {
      state: { session: buyerAdminSession(['org.users.view']) },
      ...detailRoute,
    });

    // Assert
    expect((await screen.findAllByText('Role assignments'))[0]).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Assign role/ })).not.toBeInTheDocument();
  });
});
