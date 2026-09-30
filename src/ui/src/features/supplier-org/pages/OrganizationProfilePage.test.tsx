import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  SUPPLIER_CONTRIBUTOR,
  businessError,
  evidenceItem,
  evidencePage,
  identityChange,
  membershipRow,
  page,
  profile,
  renderPage,
  routeCalls,
  verificationRequest,
} from '../test/kit';
import OrganizationProfilePage from './OrganizationProfilePage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/supplier/organization', route: '/supplier/organization' };

describe('OrganizationProfilePage (SUP-03)', () => {
  it('shows identity, capacity, ownership, locations and separate registration statuses', async () => {
    routeCalls({ 'supplier.suppliers.profile.get': () => profile() });
    renderPage(<OrganizationProfilePage />, PATH);
    expect(
      await screen.findByText('Registration, verification and qualification'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Tsodilo Engineering (Pty) Ltd').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Qualified by 1 buyer(s); 2 application(s) in progress'),
    ).toBeInTheDocument();
    expect(screen.getByText('Four installation crews.')).toBeInTheDocument();
    expect(screen.getByText('Motsamai Tsodilo 60%, Boago Moremi 40%.')).toBeInTheDocument();
    expect(screen.getByText('Head office')).toBeInTheDocument();
    expect(screen.getByText('Banking details are not collected')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit profile' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request identity change' })).toBeInTheDocument();
  });

  it('hides maintenance actions and membership decisions from members without the rights', async () => {
    routeCalls({ 'supplier.suppliers.profile.get': () => profile() });
    renderPage(<OrganizationProfilePage />, { ...PATH, permissions: SUPPLIER_CONTRIBUTOR });
    await screen.findByText('Registration, verification and qualification');
    expect(screen.queryByRole('link', { name: 'Edit profile' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Membership requests/ })).not.toBeInTheDocument();
  });

  it('lists legal name history and identity changes on the legal identity tab', async () => {
    routeCalls({
      'supplier.suppliers.profile.get': () => profile(),
      'supplier.suppliers.identityChanges.list': () => page([identityChange()]),
    });
    renderPage(<OrganizationProfilePage />, {
      ...PATH,
      route: '/supplier/organization?tab=identity',
    });
    expect(await screen.findByText('Legal name history')).toBeInTheDocument();
    expect(screen.getByText('Tsodilo Engineering Services (Pty) Ltd')).toBeInTheDocument();
    expect(await screen.findByText('Approved')).toBeInTheDocument();
  });

  it('shows buyer-sharing choices', async () => {
    routeCalls({ 'supplier.suppliers.profile.get': () => profile() });
    renderPage(<OrganizationProfilePage />, {
      ...PATH,
      route: '/supplier/organization?tab=sharing',
    });
    expect(await screen.findByText('Kalahari Water Utilities (Pilot)')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('approves a membership request with the capacity the person will act in', async () => {
    const calls = routeCalls({
      'supplier.suppliers.profile.get': () => profile(),
      'supplier.suppliers.membershipRequests.list': () => page([membershipRow()]),
      'supplier.suppliers.membershipRequests.decide': () =>
        membershipRow({
          status: 'approved',
          decidedBy: { userId: 24, fullName: 'Tumelo Sekgoma' },
          decidedAt: '2026-09-30T08:00:00Z',
        }),
    });
    renderPage(<OrganizationProfilePage />, {
      ...PATH,
      route: '/supplier/organization?tab=requests',
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Decide' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
    expect(
      await within(dialog).findByText('Name the capacity the person will act in.'),
    ).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Capacity/), { target: { value: 'Estimator' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
    await waitFor(() =>
      expect(
        calls.find((c) => c.id === 'supplier.suppliers.membershipRequests.decide')?.request,
      ).toEqual({
        params: { requestId: 1 },
        body: { decision: 'approved', capacity: 'Estimator' },
      }),
    );
  });

  it('shows the restricted state when the profile is refused', async () => {
    routeCalls({
      'supplier.suppliers.profile.get': () => {
        throw businessError('supplier.suppliers.profile.get', 'FORBIDDEN', 403);
      },
    });
    renderPage(<OrganizationProfilePage />, PATH);
    expect((await screen.findAllByText('Restricted')).length).toBeGreaterThan(0);
  });

  it('asks a contact-verified organization to resolve missing evidence, with links to add each kind', async () => {
    routeCalls({
      'supplier.suppliers.profile.get': () =>
        profile({
          statuses: {
            registration: 'active',
            verification: 'contact_verified',
            isProvisional: false,
            qualification: {
              qualifiedBuyerCount: 0,
              pendingApplicationCount: 1,
              note: 'Not qualification.',
            },
          },
          verificationRequests: [verificationRequest()],
        }),
    });
    renderPage(<OrganizationProfilePage />, PATH);
    expect(await screen.findByText('Resolve missing evidence')).toBeInTheDocument();
    expect(
      screen.getByText('The certificate of incorporation does not show the current directors.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add registration evidence' })).toHaveAttribute(
      'href',
      '/supplier/evidence/new?type=registration',
    );
    expect(screen.getByRole('link', { name: 'Add declaration evidence' })).toBeInTheDocument();
    expect(
      screen.getByText(/Next: supply the evidence platform operations asked for/),
    ).toBeInTheDocument();
  });

  it('answers the request with current library evidence after confirming, covering every kind requested', async () => {
    const registration = evidenceItem({
      id: 601,
      evidenceType: 'registration',
      title: 'Certificate of incorporation',
      coverage: null,
    });
    const declaration = evidenceItem({
      id: 606,
      evidenceType: 'declaration',
      title: 'Declaration of no exclusion or debarment',
      coverage: null,
    });
    const calls = routeCalls({
      'supplier.suppliers.profile.get': () =>
        profile({ verificationRequests: [verificationRequest()] }),
      'supplier.suppliers.evidence.list': () => evidencePage([registration, declaration]),
      'supplier.suppliers.verificationRequests.respond': () =>
        verificationRequest({
          status: 'answered',
          response: {
            respondedBy: { userId: 24, fullName: 'Tumelo Sekgoma' },
            respondedAt: '2026-09-30T08:00:00Z',
            note: null,
            evidence: [
              {
                evidenceItemId: 601,
                evidenceType: 'registration',
                title: 'Certificate of incorporation',
              },
              {
                evidenceItemId: 606,
                evidenceType: 'declaration',
                title: 'Declaration of no exclusion or debarment',
              },
            ],
          },
        }),
    });
    renderPage(<OrganizationProfilePage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Supply evidence' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(
      await within(dialog).findByRole('checkbox', { name: /Certificate of incorporation/ }),
    );
    expect(within(dialog).getByText('Still needed: Declaration.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supply evidence' }));
    expect(calls.some((c) => c.id === 'supplier.suppliers.verificationRequests.respond')).toBe(
      false,
    );
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Declaration of no exclusion/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supply evidence' }));
    await waitFor(() =>
      expect(
        calls.find((c) => c.id === 'supplier.suppliers.verificationRequests.respond')?.request,
      ).toEqual({ params: { requestId: 2 }, body: { evidenceItemIds: [601, 606], note: null } }),
    );
    expect(await screen.findByText('Answered, awaiting review')).toBeInTheDocument();
  });

  it('shows no missing-evidence panel for an identity-verified organization without requests', async () => {
    routeCalls({ 'supplier.suppliers.profile.get': () => profile() });
    renderPage(<OrganizationProfilePage />, PATH);
    await screen.findByText('Registration, verification and qualification');
    expect(screen.queryByText('Resolve missing evidence')).not.toBeInTheDocument();
  });
});
