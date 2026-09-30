import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  BUYER_ASSESSOR,
  BUYER_OFFICER,
  directoryPage,
  directoryRow,
  relationshipRecord,
  renderPage,
  routeCalls,
} from '../../supplier-org/test/kit';
import SupplierRecordPage from './SupplierRecordPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/buyer/suppliers/:supplierTenantId',
  route: '/buyer/suppliers/5',
  kind: 'buyer' as const,
  permissions: BUYER_OFFICER,
};

describe('SupplierRecordPage (BUY-32)', () => {
  it('states the BR-45 boundary and shows this buyer’s qualification next to registration and verification', async () => {
    routeCalls({ 'buyer.suppliers.directory.get': () => relationshipRecord() });
    renderPage(<SupplierRecordPage />, PATH);
    expect(await screen.findByText('Your organization’s view only')).toBeInTheDocument();
    expect(screen.getByText(/Other buyers’ assessments are never shown/)).toBeInTheDocument();
    expect(screen.getByText('Your qualification decisions')).toBeInTheDocument();
    expect(screen.getAllByText('Registration is not qualification').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Update relationship' })).toBeInTheDocument();
  });

  it('shows shared evidence with restricted financial rows withheld', async () => {
    routeCalls({ 'buyer.suppliers.directory.get': () => relationshipRecord() });
    renderPage(<SupplierRecordPage />, { ...PATH, route: '/buyer/suppliers/5?tab=evidence' });
    expect(await screen.findByText('Some financial evidence is withheld')).toBeInTheDocument();
    expect(
      screen.getByText('Financial evidence (restricted to financial reviewers)'),
    ).toBeInTheDocument();
    expect(screen.getByText('Public-liability.pdf')).toBeInTheDocument();
  });

  it('requires a restriction note before restricting the relationship, then saves it', async () => {
    const calls = routeCalls({
      'buyer.suppliers.directory.get': () => relationshipRecord(),
      'buyer.suppliers.relationship.update': () => ({
        id: 2,
        status: 'restricted',
        riskRating: 'high',
        owner: { userId: 5, fullName: 'Tebogo Molefe' },
        restrictionNote: 'No awards above BWP 500,000.',
        internalNotes: 'Chase the insurance renewal.',
        firstEngagedAt: '2026-02-18T09:00:00Z',
        updatedAt: '2026-09-30T08:00:00Z',
      }),
    });
    renderPage(<SupplierRecordPage />, { ...PATH, route: '/buyer/suppliers/5?tab=relationship' });
    fireEvent.click(await screen.findByRole('button', { name: 'Update relationship' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Relationship status/), {
      target: { value: 'restricted' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Reason for the change/), {
      target: { value: 'Insurance lapsed.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save relationship' }));
    expect(
      await within(dialog).findByText('State what is restricted and why.'),
    ).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/^Restriction/), {
      target: { value: 'No awards above BWP 500,000.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save relationship' }));
    await waitFor(() =>
      expect(screen.getByText('No awards above BWP 500,000.')).toBeInTheDocument(),
    );
    expect(calls.find((c) => c.id === 'buyer.suppliers.relationship.update')?.request).toEqual({
      params: { supplierTenantId: 5 },
      body: expect.objectContaining({ status: 'restricted', changeReason: 'Insurance lapsed.' }),
    });
  });

  it('adds a relationship contact', async () => {
    const calls = routeCalls({
      'buyer.suppliers.directory.get': () => relationshipRecord(),
      'buyer.suppliers.contacts.create': () => ({
        id: 900,
        name: 'Thabo Maano',
        email: 'thabo@chobe.example',
        phone: null,
        roleLabel: 'Estimator',
        isPrimary: false,
        active: true,
      }),
    });
    renderPage(<SupplierRecordPage />, { ...PATH, route: '/buyer/suppliers/5?tab=relationship' });
    fireEvent.click(await screen.findByRole('button', { name: 'Add contact' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: 'Thabo Maano' } });
    fireEvent.change(within(dialog).getByLabelText(/^E-mail/), {
      target: { value: 'thabo@chobe.example' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Role/), { target: { value: 'Estimator' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save contact' }));
    expect(await screen.findByText('Contact Thabo Maano saved.')).toBeInTheDocument();
    expect(calls.find((c) => c.id === 'buyer.suppliers.contacts.create')?.request).toEqual({
      params: { supplierTenantId: 5 },
      body: expect.objectContaining({ name: 'Thabo Maano', roleLabel: 'Estimator' }),
    });
  });

  it('flags a possible duplicate with another directory record', async () => {
    const calls = routeCalls({
      'buyer.suppliers.directory.get': () => relationshipRecord(),
      'buyer.suppliers.directory.list': () =>
        directoryPage([
          directoryRow(),
          directoryRow({ supplierTenantId: 62, legalName: 'Chobe Pipe and Valve (Kasane)' }),
        ]),
      'buyer.suppliers.duplicates.flag': () => ({
        id: 900,
        status: 'open',
        message: 'The platform operator will review both records.',
        createdAt: '2026-09-30T08:00:00Z',
      }),
    });
    renderPage(<SupplierRecordPage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Flag duplicate' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('option', { name: 'Chobe Pipe and Valve (Kasane)' });
    fireEvent.change(within(dialog).getByLabelText(/The other supplier record/), {
      target: { value: '62' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Explanation/), {
      target: { value: 'Same directors and address.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Flag for review' }));
    expect(
      await screen.findByText('The platform operator will review both records.'),
    ).toBeInTheDocument();
    expect(calls.find((c) => c.id === 'buyer.suppliers.duplicates.flag')?.request).toEqual({
      params: { supplierTenantId: 5 },
      body: {
        otherSupplierTenantId: 62,
        detectedReason: 'similar_name',
        note: 'Same directors and address.',
      },
    });
  });

  it('shows history, contracts and identity changes, and hides commands from a read-only assessor', async () => {
    routeCalls({ 'buyer.suppliers.directory.get': () => relationshipRecord() });
    renderPage(<SupplierRecordPage />, {
      ...PATH,
      route: '/buyer/suppliers/5?tab=history',
      permissions: BUYER_ASSESSOR,
    });
    expect(await screen.findByText('Owner set to Tebogo Molefe.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update relationship' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Contracts/ }));
    expect(await screen.findByText('C-2025-0005')).toBeInTheDocument();
    expect(screen.getByText('Does not meet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Identity changes/ }));
    expect(await screen.findByText('Okavango Industrial 60%')).toBeInTheDocument();
  });

  it('shows no qualification scope for a supplier this buyer has not assessed (AC-07)', async () => {
    routeCalls({
      'buyer.suppliers.directory.get': () =>
        relationshipRecord({
          supplierTenantId: 6,
          legalName: 'Makgadikgadi Civil Works (Pty) Ltd',
          verificationStatus: 'contact_verified',
          qualification: [
            {
              programId: 11,
              programName: 'Water Infrastructure Suppliers — Category A',
              effectiveStatus: 'not_assessed',
              scopeCategory: null,
              scopeMaxValue: null,
              scopeGeography: null,
              effectiveFrom: null,
              effectiveTo: null,
              conditions: null,
            },
          ],
        }),
    });
    renderPage(<SupplierRecordPage />, { ...PATH, route: '/buyer/suppliers/6?tab=qualification' });
    const row = await screen.findByRole('row', { name: /Water Infrastructure Suppliers/ });
    expect(within(row).getByText('Not assessed')).toBeInTheDocument();
    expect(within(row).getByText('No decision yet')).toBeInTheDocument();
    expect(within(row).queryByText('Any category')).not.toBeInTheDocument();
  });

  it('shows the latest performance outcome per contract and flags a disputed review', async () => {
    const base = relationshipRecord();
    routeCalls({
      'buyer.suppliers.directory.get': () =>
        relationshipRecord({
          contracts: [
            ...base.contracts,
            {
              contractId: 1,
              reference: 'C-2026-0001',
              title: 'Fleet vehicle maintenance',
              status: 'active',
              performance: {
                reviewId: 14791,
                periodStart: '2026-04-01',
                periodEnd: '2026-06-30',
                status: 'supplier_responded',
                overallRating: 'partially_meets',
                supplierResponded: true,
                supplierDisputes: true,
                reviewCount: 1,
              },
            },
            {
              contractId: 8,
              reference: 'C-2026-0004',
              title: 'Borehole pumps Lot 1: spare parts and consumables',
              status: 'draft',
              performance: null,
            },
          ],
        }),
    });
    renderPage(<SupplierRecordPage />, { ...PATH, route: '/buyer/suppliers/5?tab=contracts' });
    const fleet = await screen.findByRole('row', { name: /C-2026-0001/ });
    expect(within(fleet).getByText('Disputed by the supplier')).toBeInTheDocument();
    expect(within(fleet).getByRole('link', { name: 'C-2026-0001' })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/1$/),
    );
    const spares = screen.getByRole('row', { name: /C-2026-0004/ });
    expect(within(spares).getByText('No review with an outcome yet')).toBeInTheDocument();
    expect(screen.getByText('2 of 3 with a performance review')).toBeInTheDocument();
    expect(screen.getByText('1 review disputed')).toBeInTheDocument();
  });

  it('shows the claim invitation of a provisional supplier this buyer created, with its link', async () => {
    routeCalls({
      'buyer.suppliers.directory.get': () =>
        relationshipRecord({
          supplierTenantId: 50,
          legalName: 'Kasane Borehole Drilling (Pty) Ltd',
          isProvisional: true,
          createdByThisBuyer: true,
          registrationStatus: 'pending',
          verificationStatus: 'unverified',
          claimInvitation: {
            state: 'pending',
            contactName: 'Onkemetse Dube',
            email: 'onkemetse.dube@kasane-drilling.example',
            sentAt: '2026-09-10T08:15:00Z',
            sentCount: 1,
            expiresAt: '2026-10-10T15:00:00Z',
            claimPath: '/register/claim/clm_K4sBoreh0le7Qx2',
          },
        }),
    });
    renderPage(<SupplierRecordPage />, { ...PATH, route: '/buyer/suppliers/50' });
    expect(await screen.findByText('Claim invitation')).toBeInTheDocument();
    expect(screen.getByText('Waiting to be claimed')).toBeInTheDocument();
    expect(screen.getByText('onkemetse.dube@kasane-drilling.example')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the claim page' })).toHaveAttribute(
      'href',
      '/register/claim/clm_K4sBoreh0le7Qx2',
    );
  });
});
