import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { navGroupsFor } from '../../../app/featureRegistry';
import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import {
  ORG_ADMIN_PERMISSIONS,
  buyerAdminSession,
  committeeDetail,
  delegationRow,
  departmentRow,
  legalEntityRow,
  limitRow,
  memberRow,
  organizationSettings,
  page,
  sodPolicy,
} from '../../admin-access/test/data';
import AuthorityPage from '../pages/AuthorityPage';
import CommitteePage from '../pages/CommitteePage';
import OrgIndexPage from '../pages/OrgIndexPage';
import OrganizationPage from '../pages/OrganizationPage';
import StructurePage from '../pages/StructurePage';
import { features } from '../routes';

afterEach(() => {
  vi.unstubAllGlobals();
});

const BUYER = '/api/v1/buyer/admin';
const members = () => ({
  body: page([
    memberRow(),
    memberRow({
      userId: 4,
      membershipId: 504,
      fullName: 'Mpho Dikgang',
      email: 'mpho.manager@tenderiq.local',
    }),
  ]),
});

describe('OrganizationPage (ADM-01)', () => {
  it('shows identity, readiness warnings and policy ownership', async () => {
    // Arrange
    installFetch({
      [`GET ${BUYER}/organization`]: () => ({ body: organizationSettings() }),
      [`GET ${BUYER}/users`]: members,
    });

    // Act
    renderWithProviders(<OrganizationPage />, { state: { session: buyerAdminSession() } });

    // Assert
    expect(
      await screen.findByText('Kalahari Water Utilities Corporation', { selector: 'dd' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Nobody is responsible yet.')).toBeInTheDocument();
    expect(screen.getByText('KWU Standard Procurement Policy, version 2')).toBeInTheDocument();
  });

  it('reviews the effects of a change and saves it only after acknowledgement', async () => {
    // Arrange
    const { requests } = installFetch({
      [`GET ${BUYER}/organization`]: () => ({ body: organizationSettings() }),
      [`GET ${BUYER}/users`]: members,
      [`POST ${BUYER}/organization/impact-review`]: () => ({
        body: {
          requiresAcknowledgement: true,
          impacts: [
            {
              area: 'public_notices',
              severity: 'warning',
              description: 'Published notices show the new display name.',
              affectedCount: 1,
              references: ['T-2026-0002'],
            },
          ],
        },
      }),
      [`PUT ${BUYER}/organization`]: () => ({
        body: { organization: organizationSettings(), impacts: [] },
      }),
    });
    renderWithProviders(<OrganizationPage />, { state: { session: buyerAdminSession() } });
    const display = await screen.findByLabelText(/Display name/);
    await userEvent.clear(display);
    await userEvent.type(display, 'Kalahari Water');

    // Act
    await userEvent.click(screen.getByRole('button', { name: /Review changes/ }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('Published notices show the new display name.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save settings' })).toBeDisabled();
    await userEvent.click(
      within(dialog).getByLabelText('I reviewed these effects and accept them.'),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save settings' }));

    // Assert
    await waitFor(() => expect(requests.some((request) => request.method === 'PUT')).toBe(true));
    const body = requests.find((request) => request.method === 'PUT')?.body as {
      brandingDisplayName: string;
      acknowledgeImpact: boolean;
    };
    expect(body.brandingDisplayName).toBe('Kalahari Water');
    expect(body.acknowledgeImpact).toBe(true);
  });

  it('keeps the form read-only for a structure manager without the settings permission', async () => {
    // Arrange
    installFetch({
      [`GET ${BUYER}/organization`]: () => ({ body: organizationSettings() }),
      [`GET ${BUYER}/users`]: members,
    });

    // Act
    renderWithProviders(<OrganizationPage />, {
      state: { session: buyerAdminSession(['org.structure.manage', 'org.users.view']) },
    });

    // Assert
    expect(
      await screen.findByText(/changing them needs the organization settings permission/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Review changes/ })).not.toBeInTheDocument();
  });

  it('lists legal entities in their own tab', async () => {
    // Arrange
    installFetch({
      [`GET ${BUYER}/organization`]: () => ({ body: organizationSettings() }),
      [`GET ${BUYER}/users`]: members,
      [`GET ${BUYER}/legal-entities`]: () => ({ body: page([legalEntityRow()]) }),
    });
    renderWithProviders(<OrganizationPage />, { state: { session: buyerAdminSession() } });

    // Act
    await userEvent.click(await screen.findByRole('tab', { name: 'Legal entities' }));

    // Assert
    expect(await screen.findByText('Plot 1, Gaborone')).toBeInTheDocument();
  });
});

describe('StructurePage (ADM-02)', () => {
  it('deactivates a department and explains why it is refused when values sit below it', async () => {
    // Arrange
    installFetch({
      [`GET ${BUYER}/departments`]: () => ({ body: page([departmentRow()]) }),
      [`POST ${BUYER}/departments/1/deactivate`]: () =>
        problem(409, 'Conflict', { code: 'HAS_ACTIVE_CHILDREN', detail: 'Children.' }),
    });
    renderWithProviders(<StructurePage />, { state: { session: buyerAdminSession() } });
    expect(await screen.findByText('Onalenna Tau')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/4 records keep it/)).toBeInTheDocument();
    await userEvent.type(
      within(dialog).getByLabelText(/Reason/),
      'Merged into Technical Services.',
    );

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    // Assert
    expect(
      await within(dialog).findByText('Deactivate the values below it first.'),
    ).toBeInTheDocument();
  });

  it('validates the code before adding a cost center', async () => {
    // Arrange
    const { requests } = installFetch({
      [`GET ${BUYER}/departments`]: () => ({ body: page([departmentRow()]) }),
      [`GET ${BUYER}/cost-centers`]: () => ({ body: page([]) }),
    });
    renderWithProviders(<StructurePage />, { state: { session: buyerAdminSession() } });
    await userEvent.click(await screen.findByRole('tab', { name: 'Cost centers' }));
    await userEvent.click(await screen.findByRole('button', { name: /Add cost center/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/^Name/), 'Operations depot');
    await userEvent.type(within(dialog).getByLabelText(/^Code/), 'cc 1');

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }));

    // Assert
    expect(
      await within(dialog).findByText('Use capitals, digits and hyphens, such as CC-OPS-100.'),
    ).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
  });
});

describe('AuthorityPage (ADM-05)', () => {
  it('lists authority limits with their holder, decision and maximum', async () => {
    // Arrange
    installFetch({ [`GET ${BUYER}/authority-limits`]: () => ({ body: page([limitRow()]) }) });

    // Act
    renderWithProviders(<AuthorityPage />, { state: { session: buyerAdminSession() } });

    // Assert
    expect(await screen.findByText('Mpho Dikgang')).toBeInTheDocument();
    expect(screen.getByText('BWP 2,000,000')).toBeInTheDocument();
  });

  it('refuses a delegation beyond the delegator’s own limit (BR-06)', async () => {
    // Arrange
    installFetch({
      [`GET ${BUYER}/authority-limits`]: () => ({ body: page([limitRow()]) }),
      [`GET ${BUYER}/delegations`]: () => ({ body: page([delegationRow()]) }),
      [`GET ${BUYER}/users`]: members,
      [`GET ${BUYER}/legal-entities`]: () => ({ body: page([]) }),
      [`GET ${BUYER}/categories`]: () => ({ body: page([]) }),
      [`POST ${BUYER}/delegations`]: () =>
        problem(422, 'Unprocessable', { code: 'DELEGATION_EXCEEDS_LIMIT', detail: 'Exceeds.' }),
    });
    renderWithProviders(<AuthorityPage />, { state: { session: buyerAdminSession() } });
    await userEvent.click(await screen.findByRole('tab', { name: 'Delegations' }));
    expect(await screen.findByText('Leave cover.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Add delegation/ }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(
        within(dialog).getAllByRole('option', { name: /Mpho Dikgang/ }).length,
      ).toBeGreaterThan(0),
    );
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Delegator/), '4');
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Delegate/), '5');
    await userEvent.click(within(dialog).getByLabelText('Release approval'));
    expect(
      await within(dialog).findByText(/Delegator’s limits: Release approval: BWP 2,000,000/),
    ).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/^Maximum amount/), '3000000');
    const ends = within(dialog).getByRole('group', { name: /^Ends/ });
    fireEvent.change(within(ends).getByLabelText('Date'), { target: { value: '2026-12-01' } });
    fireEvent.change(within(ends).getByLabelText('Time'), { target: { value: '12:00' } });
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Leave cover.');

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add delegation' }));

    // Assert
    expect(
      await within(dialog).findByText('A delegation cannot exceed the delegator’s own limit.'),
    ).toBeInTheDocument();
  });

  it('requires a documented note before adopting alternative oversight', async () => {
    // Arrange
    const { requests } = installFetch({
      [`GET ${BUYER}/authority-limits`]: () => ({ body: page([]) }),
      [`GET ${BUYER}/sod-policies`]: () => ({ body: { items: [sodPolicy()] } }),
    });
    renderWithProviders(<AuthorityPage />, { state: { session: buyerAdminSession() } });
    await userEvent.click(await screen.findByRole('tab', { name: 'Incompatibilities' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Change' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText(/Alternative oversight/));
    await userEvent.type(within(dialog).getByLabelText(/^Reason/), 'Small team.');

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save rule' }));

    // Assert
    expect(
      await within(dialog).findByText(
        'Describe the alternative oversight (at least 20 characters).',
      ),
    ).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'PUT')).toBe(false);
  });
});

describe('CommitteePage (ADM-05)', () => {
  it('counts only the chair and members as voting members, apart from all active seats', async () => {
    // Arrange
    installFetch({
      [`GET ${BUYER}/committees/1`]: () => ({
        body: committeeDetail({ activeMemberCount: 5, votingMemberCount: 3, alternateCount: 1 }),
      }),
    });

    // Act
    renderWithProviders(<CommitteePage />, {
      state: { session: buyerAdminSession() },
      route: '/buyer/admin/organization/committees/1',
      path: '/buyer/admin/organization/committees/:committeeId',
    });

    // Assert
    const voting = await screen.findByText('Voting members');
    expect(voting.nextElementSibling).toHaveTextContent('3');
    expect(
      screen.getByText('Active seats (with alternates and secretary)').nextElementSibling,
    ).toHaveTextContent('5');
  });

  it('explains that ending a membership would break the quorum', async () => {
    // Arrange
    installFetch({
      [`GET ${BUYER}/committees/1`]: () => ({ body: committeeDetail() }),
      [`POST ${BUYER}/committees/1/members/1/end`]: () =>
        problem(409, 'Conflict', { code: 'QUORUM_WOULD_BREAK', detail: 'Quorum.' }),
    });
    renderWithProviders(<CommitteePage />, {
      state: { session: buyerAdminSession() },
      route: '/buyer/admin/organization/committees/1',
      path: '/buyer/admin/organization/committees/:committeeId',
    });
    await userEvent.click(await screen.findByRole('button', { name: 'End membership' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Moved to another role.');

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'End membership' }));

    // Assert
    expect(
      await within(dialog).findByText(
        'Ending this membership would leave the committee without its quorum.',
      ),
    ).toBeInTheDocument();
  });
});

describe('organization navigation', () => {
  it('opens the authority screen for an auditor who only reviews access', async () => {
    // Arrange
    installFetch({});

    // Act
    const { router } = renderWithProviders(<OrgIndexPage />, {
      state: { session: buyerAdminSession(['org.access.review']) },
      route: '/buyer/admin/organization',
      path: '/buyer/admin/organization',
      routes: [{ path: '/buyer/admin/organization/authority', element: <p>authority</p> }],
    });

    // Assert
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/buyer/admin/organization/authority'),
    );
  });

  it('shows the organization entry to administrators only', () => {
    // Arrange
    const admin = navGroupsFor(features, {
      tenantKind: 'buyer',
      permissions: ORG_ADMIN_PERMISSIONS,
    });
    const officer = navGroupsFor(features, { tenantKind: 'buyer', permissions: ['tender.view'] });
    const supplier = navGroupsFor(features, {
      tenantKind: 'supplier',
      permissions: ORG_ADMIN_PERMISSIONS,
    });

    // Act
    const items = admin.flatMap((group) => group.items.map((item) => item.to));

    // Assert
    expect(items).toEqual(['/buyer/admin/organization']);
    expect(officer).toEqual([]);
    expect(supplier).toEqual([]);
  });
});
