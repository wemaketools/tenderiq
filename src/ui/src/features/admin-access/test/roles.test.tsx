import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import GroupDetailPage from '../pages/GroupDetailPage';
import GroupsPage from '../pages/GroupsPage';
import RoleDetailPage from '../pages/RoleDetailPage';
import RolesPage from '../pages/RolesPage';
import {
  buyerAdminSession,
  groupDetail,
  memberRow,
  page,
  roleCatalog,
  roleDetail,
  roleRow,
  supplierAdminSession,
} from './data';

afterEach(() => {
  vi.unstubAllGlobals();
});

const BUYER = '/api/v1/buyer/admin';

describe('RolesPage (ADM-04)', () => {
  it('lists system and custom roles with their holders', async () => {
    // Arrange
    installFetch({
      [`GET ${BUYER}/roles`]: () => ({
        body: page([
          roleRow(),
          roleRow({
            roleId: 5,
            code: 'procurement_officer',
            name: 'Procurement officer',
            isSystem: true,
            templateCode: 'procurement_officer',
            activeAssignmentCount: 3,
          }),
        ]),
      }),
    });

    // Act
    renderWithProviders(<RolesPage />, { state: { session: buyerAdminSession() } });

    // Assert
    expect(await screen.findByText('Site inspector')).toBeInTheDocument();
    expect(screen.getByText('Procurement officer')).toBeInTheDocument();
    expect(screen.getAllByText('System').length).toBeGreaterThan(0);
  });

  it('flags a segregation-of-duties breach and creates the role from the catalog', async () => {
    // Arrange
    const { requests } = installFetch({
      [`GET ${BUYER}/roles`]: () => ({ body: page([roleRow()]) }),
      [`GET ${BUYER}/role-catalog`]: () => ({ body: roleCatalog() }),
      [`POST ${BUYER}/roles`]: () => ({
        status: 201,
        body: roleDetail({ roleId: 900, code: 'tender_editor', name: 'Tender editor' }),
      }),
      [`GET ${BUYER}/roles/900`]: () => ({ body: roleDetail({ roleId: 900 }) }),
    });
    renderWithProviders(<RolesPage />, {
      state: { session: buyerAdminSession() },
      routes: [{ path: '/buyer/admin/access/roles/:roleId', element: <p>role page</p> }],
    });
    await userEvent.click(await screen.findByRole('button', { name: /New role/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/^Code/), 'tender_editor');
    await userEvent.type(within(dialog).getByLabelText(/^Name/), 'Tender editor');
    await userEvent.click(within(dialog).getByLabelText(/tender.edit —/));
    await userEvent.click(within(dialog).getByLabelText(/tender.release_approve —/));
    expect(
      within(dialog).getByText('These permissions breach a segregation-of-duties rule'),
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByLabelText(/tender.release_approve —/));

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create role' }));

    // Assert
    await waitFor(() =>
      expect(
        requests.some((request) => request.method === 'POST' && request.path === `${BUYER}/roles`),
      ).toBe(true),
    );
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      code: 'tender_editor',
      name: 'Tender editor',
      description: null,
      permissionCodes: ['tender.edit'],
    });
    expect(await screen.findByText('role page')).toBeInTheDocument();
  });

  it('hides the new role action when the viewer may only review access', async () => {
    // Arrange
    installFetch({ [`GET ${BUYER}/roles`]: () => ({ body: page([roleRow()]) }) });

    // Act
    renderWithProviders(<RolesPage />, {
      state: { session: buyerAdminSession(['org.access.review']) },
    });

    // Assert
    expect(await screen.findByText('Site inspector')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /New role/ })).not.toBeInTheDocument();
  });
});

describe('RoleDetailPage (ADM-04)', () => {
  const route = {
    route: '/buyer/admin/access/roles/30',
    path: '/buyer/admin/access/roles/:roleId',
  };

  it('explains why a role with holders cannot be deactivated', async () => {
    // Arrange
    installFetch({
      [`GET ${BUYER}/roles/30`]: () => ({ body: roleDetail() }),
      [`POST ${BUYER}/roles/30/deactivate`]: () =>
        problem(409, 'Conflict', { code: 'ROLE_HAS_ACTIVE_ASSIGNMENTS', detail: 'Holders.' }),
    });
    renderWithProviders(<RoleDetailPage />, { state: { session: buyerAdminSession() }, ...route });
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'No longer used.');

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    // Assert
    expect(
      await within(dialog).findByText('People still hold this role. End their assignments first.'),
    ).toBeInTheDocument();
  });

  it('shows a system role as read-only', async () => {
    // Arrange
    installFetch({ [`GET ${BUYER}/roles/30`]: () => ({ body: roleDetail({ isSystem: true }) }) });

    // Act
    renderWithProviders(<RoleDetailPage />, { state: { session: buyerAdminSession() }, ...route });

    // Assert
    expect(await screen.findByText('System role')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit role/ })).not.toBeInTheDocument();
  });
});

describe('GroupsPage and GroupDetailPage (ADM-04, SUP-04)', () => {
  it('lists the supplier groups through the supplier endpoints', async () => {
    // Arrange
    const { requests } = installFetch({
      ['GET /api/v1/supplier/admin/groups']: () => ({ body: page([groupDetail()]) }),
    });

    // Act
    renderWithProviders(<GroupsPage />, { state: { session: supplierAdminSession() } });

    // Assert
    expect(await screen.findByText('Bid opening panel')).toBeInTheDocument();
    expect(requests.every((request) => request.path.startsWith('/api/v1/supplier/'))).toBe(true);
  });

  it('adds a member to a group after confirmation', async () => {
    // Arrange
    const { requests } = installFetch({
      [`GET ${BUYER}/groups/3`]: () => ({ body: groupDetail() }),
      [`GET ${BUYER}/users`]: () => ({ body: page([memberRow()]) }),
      [`POST ${BUYER}/groups/3/members`]: () => ({ body: groupDetail({ memberCount: 2 }) }),
    });
    renderWithProviders(<GroupDetailPage />, {
      state: { session: buyerAdminSession() },
      route: '/buyer/admin/access/groups/3',
      path: '/buyer/admin/access/groups/:groupId',
    });
    await userEvent.click(await screen.findByRole('button', { name: /Add member/ }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(within(dialog).getByRole('option', { name: /Tebogo Molefe/ })).toBeInTheDocument(),
    );
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Person/), '5');

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add member' }));

    // Assert
    await waitFor(() =>
      expect(requests.some((request) => request.path === `${BUYER}/groups/3/members`)).toBe(true),
    );
    expect(requests.find((request) => request.path === `${BUYER}/groups/3/members`)?.body).toEqual({
      userId: 5,
    });
  });
});
