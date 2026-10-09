import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { EffectiveAccessCard } from '../components/EffectiveAccessCard';
import AccessIndexPage from '../pages/AccessIndexPage';
import AccessReviewPage from '../pages/AccessReviewPage';
import ConflictDetailPage from '../pages/ConflictDetailPage';
import ConflictsPage from '../pages/ConflictsPage';
import {
  buyerAdminSession,
  conflictDetail,
  effectiveAccess,
  findingPage,
  grantRow,
  memberRow,
  page,
  restrictionRow,
  roleCatalog,
} from './data';

afterEach(() => {
  vi.unstubAllGlobals();
});

const BUYER = '/api/v1/buyer/admin';

describe('AccessReviewPage (ADM-04)', () => {
  it('shows incompatible authority, expiring grants and pending conflict reviews', async () => {
    // Arrange
    installFetch({ [`GET ${BUYER}/access/findings`]: () => ({ body: findingPage() }) });

    // Act
    renderWithProviders(<AccessReviewPage />, { state: { session: buyerAdminSession() } });

    // Assert
    expect(
      await screen.findByText('Can draft and approve the release of the same tender'),
    ).toBeInTheDocument();
    expect(screen.getByText('Conflict declaration awaiting review').closest('a')).toHaveAttribute(
      'href',
      '/buyer/admin/access/conflicts/7',
    );
  });

  it('explains that nobody grants a permission they do not hold', async () => {
    // Arrange
    installFetch({
      [`GET ${BUYER}/access/findings`]: () => ({ body: findingPage() }),
      [`GET ${BUYER}/access-grants`]: () => ({ body: page([grantRow()]) }),
      [`GET ${BUYER}/users`]: () => ({
        body: page([
          memberRow(),
          memberRow({
            userId: 4,
            membershipId: 504,
            fullName: 'Mpho Dikgang',
            email: 'mpho.manager@tenderiq.local',
          }),
        ]),
      }),
      [`GET ${BUYER}/role-catalog`]: () => ({ body: roleCatalog() }),
      [`POST ${BUYER}/access-grants`]: () =>
        problem(403, 'Forbidden', { code: 'GRANT_NOT_HELD', detail: 'Not held.' }),
    });
    renderWithProviders(<AccessReviewPage />, { state: { session: buyerAdminSession() } });
    await userEvent.click(await screen.findByRole('tab', { name: 'Direct grants' }));
    expect(await screen.findByText('Cover for the tender register review.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Grant access/ }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(
        within(dialog).getAllByRole('option', { name: /Tebogo Molefe/ }).length,
      ).toBeGreaterThan(0),
    );
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Person/), '5');
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Owner/), '4');
    await userEvent.selectOptions(
      within(dialog).getByLabelText(/^Permission/),
      'tender.release_approve',
    );
    const expiry = within(dialog).getByRole('group', { name: /Expires/ });
    fireEvent.change(within(expiry).getByLabelText('Date'), { target: { value: '2026-12-01' } });
    fireEvent.change(within(expiry).getByLabelText('Time'), { target: { value: '12:00' } });
    await userEvent.type(within(dialog).getByLabelText(/Business reason/), 'Release cover.');

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grant access' }));

    // Assert
    expect(
      await within(dialog).findByText('You can only grant a permission you hold yourself.'),
    ).toBeInTheDocument();
  });

  it('shows the effective access of a member with its segregation-of-duties breach', async () => {
    // Arrange
    installFetch({
      [`GET ${BUYER}/access/findings`]: () => ({ body: findingPage() }),
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
      [`GET ${BUYER}/access/users/4`]: () => ({ body: effectiveAccess() }),
    });
    renderWithProviders(<AccessReviewPage />, { state: { session: buyerAdminSession() } });
    await userEvent.click(await screen.findByRole('tab', { name: 'Effective access' }));
    await waitFor(() =>
      expect(screen.getByRole('option', { name: /Mpho Dikgang/ })).toBeInTheDocument(),
    );

    // Act
    await userEvent.selectOptions(screen.getByLabelText('Member'), '4');

    // Assert
    expect(await screen.findByText('Incompatible authority')).toBeInTheDocument();
    expect(screen.getByText('Procurement manager')).toBeInTheDocument();
  });

  it('flags a permission restricted on one tender while it stays effective elsewhere', async () => {
    // Arrange: sam.dual at KWU, with the conflict restriction on T-2026-0003 (AC-02).
    const conflict = {
      restrictionId: 1,
      restrictionType: 'conflict' as const,
      scopeLabel: 'T-2026-0003 SCADA telemetry upgrade',
      reason:
        'Conflict declaration pending review: bid-preparation involvement with Tsodilo Engineering.',
    };
    const base = effectiveAccess();
    const role = base.permissions[0]?.sources ?? [];
    installFetch({
      [`GET ${BUYER}/access/users/42`]: () => ({
        body: {
          ...base,
          user: { userId: 42, fullName: 'Sam Keitumetse' },
          sodBreaches: [],
          permissions: [
            {
              code: 'evaluation.score',
              category: 'Evaluation',
              description: 'Score bids',
              effective: true,
              sources: role,
              restrictedBy: [conflict],
            },
            {
              code: 'dashboard.view',
              category: 'General',
              description: 'View the dashboard',
              effective: true,
              sources: role,
              restrictedBy: [],
            },
          ],
        },
      }),
    });
    renderWithProviders(<EffectiveAccessCard userId={42} />, {
      state: { session: buyerAdminSession() },
    });
    const scoped = (await screen.findByText('evaluation.score')).closest('tr');
    if (scoped === null) throw new Error('Row not rendered.');

    // Act
    await userEvent.selectOptions(screen.getByLabelText('Show'), 'restricted');

    // Assert
    expect(within(scoped).getByText('Restricted in scope')).toBeInTheDocument();
    expect(
      within(scoped).getByText(
        /T-2026-0003 SCADA telemetry upgrade: Conflict declaration pending review/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('evaluation.score')).toBeInTheDocument();
    expect(screen.queryByText('dashboard.view')).not.toBeInTheDocument();
  });

  it('keeps a conflict restriction for the conflict review instead of offering lift', async () => {
    // Arrange
    installFetch({
      [`GET ${BUYER}/access/findings`]: () => ({ body: findingPage() }),
      [`GET ${BUYER}/access-restrictions`]: () => ({ body: page([restrictionRow()]) }),
    });
    renderWithProviders(<AccessReviewPage />, { state: { session: buyerAdminSession() } });

    // Act
    await userEvent.click(await screen.findByRole('tab', { name: 'Restrictions' }));

    // Assert
    expect(await screen.findByText('Lifted by the conflict review')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lift' })).not.toBeInTheDocument();
  });

  it('leaves out the findings tab and opens on grants when the viewer only manages roles', async () => {
    // Arrange
    installFetch({ [`GET ${BUYER}/access-grants`]: () => ({ body: page([]) }) });

    // Act
    renderWithProviders(<AccessReviewPage />, {
      state: { session: buyerAdminSession(['org.roles.manage']) },
    });

    // Assert
    expect(await screen.findByRole('tab', { name: 'Direct grants' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.queryByRole('tab', { name: 'Findings' })).not.toBeInTheDocument();
  });

  it('shows the findings tab first when the viewer holds the access review permission', async () => {
    // Arrange
    installFetch({ [`GET ${BUYER}/access/findings`]: () => ({ body: findingPage() }) });

    // Act
    renderWithProviders(<AccessReviewPage />, { state: { session: buyerAdminSession() } });

    // Assert
    expect(await screen.findByRole('tab', { name: 'Findings' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});

describe('ConflictsPage and ConflictDetailPage (ADM-04, AC-02)', () => {
  it('flags declarants who also belong to supplier organizations', async () => {
    // Arrange
    installFetch({
      [`GET ${BUYER}/conflict-declarations`]: () => ({ body: page([conflictDetail()]) }),
    });

    // Act
    renderWithProviders(<ConflictsPage />, { state: { session: buyerAdminSession() } });

    // Assert
    expect(await screen.findByText('Sam Keitumetse')).toBeInTheDocument();
    expect(screen.getByText('Supplier member')).toBeInTheDocument();
    expect(screen.getAllByText('Blocked').length).toBeGreaterThan(0);
  });

  it('records a recusal with a review note after confirmation', async () => {
    // Arrange
    const { requests } = installFetch({
      [`GET ${BUYER}/conflict-declarations/7`]: () => ({ body: conflictDetail() }),
      [`POST ${BUYER}/conflict-declarations/7/decide`]: () => ({
        body: conflictDetail({
          disposition: 'recused',
          allowedDispositions: [],
          reviewNote: 'Recused.',
        }),
      }),
    });
    renderWithProviders(<ConflictDetailPage />, {
      state: { session: buyerAdminSession() },
      route: '/buyer/admin/access/conflicts/7',
      path: '/buyer/admin/access/conflicts/:declarationId',
    });
    expect(await screen.findByText('Tsodilo Engineering', { selector: 'td' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Record disposition/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText(/Recused/));
    await userEvent.type(
      within(dialog).getByLabelText(/Review note/),
      'Prior employment with a bidder.',
    );

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record disposition' }));

    // Assert
    await waitFor(() =>
      expect(requests.some((request) => request.path.endsWith('/decide'))).toBe(true),
    );
    expect(requests.find((request) => request.path.endsWith('/decide'))?.body).toEqual({
      disposition: 'recused',
      reviewNote: 'Prior employment with a bidder.',
      reassignToUserId: null,
    });
  });
});

describe('AccessIndexPage', () => {
  it('opens the access review for an auditor who cannot see the directory', async () => {
    // Arrange
    installFetch({});

    // Act
    const { router } = renderWithProviders(<AccessIndexPage />, {
      state: { session: buyerAdminSession(['org.access.review']) },
      route: '/buyer/admin/access',
      path: '/buyer/admin/access',
      routes: [{ path: '/buyer/admin/access/roles', element: <p>roles</p> }],
    });

    // Assert
    await waitFor(() => expect(router.state.location.pathname).toBe('/buyer/admin/access/roles'));
  });

  it('explains the forbidden page with its heading when the membership holds no access permission', () => {
    // Arrange
    installFetch({});

    // Act
    renderWithProviders(<AccessIndexPage />, {
      state: { session: buyerAdminSession(['org.settings.manage']) },
    });

    // Assert
    expect(
      screen.getByRole('heading', { level: 1, name: 'Not available in your role' }),
    ).toBeInTheDocument();
  });
});
