import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { permissionsForTemplates } from '@contracts/permissions';

import { navGroupsFor } from '../../../app/featureRegistry';
import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import SupplierAuthorityPage from '../pages/SupplierAuthorityPage';
import TenderAssignmentsPage from '../pages/TenderAssignmentsPage';
import { features } from '../routes';
import {
  ORG_ADMIN_PERMISSIONS,
  assignableTender,
  memberRow,
  page,
  supplierAdminSession,
  supplierAuthorityRow,
  tenderAssignment,
} from './data';

afterEach(() => {
  vi.unstubAllGlobals();
});

const SUPPLIER = '/api/v1/supplier/admin';

describe('SupplierAuthorityPage (SUP-04, AC-03)', () => {
  it('shows that a contributor can prepare but cannot submit', async () => {
    // Arrange
    installFetch({
      [`GET ${SUPPLIER}/authority`]: () => ({ body: page([supplierAuthorityRow()]) }),
    });

    // Act
    renderWithProviders(<SupplierAuthorityPage />, { state: { session: supplierAdminSession() } });

    // Assert
    expect(await screen.findByText('Ditiro Kebonang')).toBeInTheDocument();
    expect(screen.getByText('Cannot submit')).toBeInTheDocument();
    expect(screen.getByText('Not assigned')).toBeInTheDocument();
  });

  it('grants explicit submission authority for the organization after confirmation', async () => {
    // Arrange
    const { requests } = installFetch({
      [`GET ${SUPPLIER}/authority`]: () => ({ body: page([supplierAuthorityRow()]) }),
      [`PUT ${SUPPLIER}/authority/26/submission`]: () => ({
        body: supplierAuthorityRow({ canSubmit: true, submissionSource: 'organization_role' }),
      }),
    });
    renderWithProviders(<SupplierAuthorityPage />, { state: { session: supplierAdminSession() } });
    await userEvent.click(await screen.findByRole('button', { name: 'Submission' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Bid lead for the meter tender.');

    // Act
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Grant submission authority' }),
    );

    // Assert
    await waitFor(() => expect(requests.some((request) => request.method === 'PUT')).toBe(true));
    expect(requests.find((request) => request.method === 'PUT')?.body).toEqual({
      granted: true,
      scope: { scopeType: 'organization', scopeId: null },
      reason: 'Bid lead for the meter tender.',
    });
    expect(await screen.findByText('For the whole organization')).toBeInTheDocument();
  });

  it('offers no authority change on the administrator’s own row and explains why', async () => {
    // Arrange
    installFetch({
      [`GET ${SUPPLIER}/authority`]: () => ({
        body: page([
          supplierAuthorityRow({
            member: { userId: 24, fullName: 'Tumelo Sekgoma' },
            capacity: 'Supplier Administrator',
            availableActions: [],
            blockedBy: 'self',
          }),
        ]),
      }),
    });

    // Act
    renderWithProviders(<SupplierAuthorityPage />, { state: { session: supplierAdminSession() } });

    // Assert
    const row = (await screen.findByText('Tumelo Sekgoma')).closest('tr');
    if (row === null) throw new Error('Row not rendered.');
    expect(
      within(row).getByText('Your own authority: another administrator must change it.'),
    ).toBeInTheDocument();
    expect(within(row).queryByRole('button')).not.toBeInTheDocument();
  });

  it('disables the signing limit until the member has submission authority', async () => {
    // Arrange
    installFetch({
      [`GET ${SUPPLIER}/authority`]: () => ({ body: page([supplierAuthorityRow()]) }),
    });

    // Act
    renderWithProviders(<SupplierAuthorityPage />, { state: { session: supplierAdminSession() } });

    // Assert
    const limit = await screen.findByRole('button', { name: 'Signing limit' });
    expect(limit).toBeDisabled();
    expect(limit).toHaveAccessibleDescription('Give submission authority first.');
    expect(screen.getByRole('button', { name: 'Submission' })).toBeEnabled();
  });

  it('shows the refusal when the server rejects a signing limit', async () => {
    // Arrange
    installFetch({
      [`GET ${SUPPLIER}/authority`]: () => ({
        body: page([
          supplierAuthorityRow({
            canSubmit: true,
            submissionSource: 'organization_role',
            availableActions: ['changeSubmission', 'setSigningLimit'],
            blockedBy: null,
          }),
        ]),
      }),
      [`PUT ${SUPPLIER}/authority/26/signing-limit`]: () =>
        problem(409, 'Conflict', {
          code: 'SIGNING_LIMIT_REQUIRES_SIGNATORY',
          detail: 'Signatory only.',
        }),
    });
    renderWithProviders(<SupplierAuthorityPage />, { state: { session: supplierAdminSession() } });
    await userEvent.click(await screen.findByRole('button', { name: 'Signing limit' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/^Signing limit/), '100000');
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Small orders.');

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Set signing limit' }));

    // Assert
    expect(
      await within(dialog).findAllByText(
        'A signing limit applies only to an authorized signatory.',
      ),
    ).not.toHaveLength(0);
  });
});

describe('TenderAssignmentsPage (SUP-04)', () => {
  it('assigns a member to a pursuit with the chosen responsibility and sections', async () => {
    // Arrange
    const { requests } = installFetch({
      [`GET ${SUPPLIER}/tender-assignments`]: () => ({ body: page([tenderAssignment()]) }),
      [`GET ${SUPPLIER}/assignable-tenders`]: () => ({ body: { items: [assignableTender()] } }),
      [`GET ${SUPPLIER}/users`]: () => ({
        body: page([
          memberRow({
            userId: 26,
            fullName: 'Ditiro Kebonang',
            email: 'tsodilo.contributor@tenderiq.local',
          }),
        ]),
      }),
      [`POST ${SUPPLIER}/tender-assignments`]: () => ({
        status: 201,
        body: tenderAssignment({ assignmentId: 900 }),
      }),
    });
    renderWithProviders(<TenderAssignmentsPage />, { state: { session: supplierAdminSession() } });
    expect(await screen.findByText('Technical')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Assign member/ }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(within(dialog).getByRole('option', { name: /Ditiro Kebonang/ })).toBeInTheDocument(),
    );
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Member/), '26');
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Tender/), '2');
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Responsibility/), 'contributor');
    await userEvent.type(within(dialog).getByLabelText(/^Sections/), 'Technical, Method statement');

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Assign member' }));

    // Assert
    await waitFor(() => expect(requests.some((request) => request.method === 'POST')).toBe(true));
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      userId: 26,
      tenderId: 2,
      responsibility: 'contributor',
      sectionScope: ['Technical', 'Method statement'],
      dueAt: null,
      canViewPricing: false,
    });
  });
});

describe('users-and-access navigation', () => {
  it('shows the buyer entry to an organization administrator and hides it from a procurement officer', () => {
    // Arrange
    const admin = navGroupsFor(features, {
      tenantKind: 'buyer',
      permissions: ORG_ADMIN_PERMISSIONS,
    });
    const officer = navGroupsFor(features, { tenantKind: 'buyer', permissions: ['tender.view'] });

    // Act
    const adminItems = admin.flatMap((group) => group.items.map((item) => item.to));
    const officerItems = officer.flatMap((group) => group.items.map((item) => item.to));

    // Assert
    expect(adminItems).toEqual(['/buyer/admin/access']);
    expect(officerItems).toEqual([]);
  });

  it('shows the supplier entry only to the supplier administrator, never to a contributor', () => {
    // Arrange
    const admin = navGroupsFor(features, {
      tenantKind: 'supplier',
      permissions: ['supplier.users.manage'],
    });
    const contributor = navGroupsFor(features, {
      tenantKind: 'supplier',
      permissions: permissionsForTemplates(['contributor']),
    });

    // Act
    const adminItems = admin.flatMap((group) => group.items.map((item) => item.to));

    // Assert
    expect(adminItems).toEqual(['/supplier/admin/access']);
    expect(contributor).toEqual([]);
  });
});
