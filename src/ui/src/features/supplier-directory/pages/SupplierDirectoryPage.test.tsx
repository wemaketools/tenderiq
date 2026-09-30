import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  businessError,
  BUYER_ASSESSOR,
  BUYER_OFFICER,
  directoryPage,
  directoryRow,
  REFERENCE_HANDLERS,
  relationshipRecord,
  renderPage,
  routeCalls,
} from '../../supplier-org/test/kit';
import SupplierDirectoryPage from './SupplierDirectoryPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/buyer/suppliers',
  route: '/buyer/suppliers',
  kind: 'buyer' as const,
  permissions: BUYER_OFFICER,
};

function routes(extra: Record<string, (request: Record<string, unknown>) => unknown> = {}) {
  return {
    ...REFERENCE_HANDLERS,
    'buyer.suppliers.directory.list': () =>
      directoryPage([
        directoryRow(),
        directoryRow({
          supplierTenantId: 58,
          legalName: 'Kasane Borehole Drilling (Pty) Ltd',
          tradingName: null,
          isProvisional: true,
          verificationStatus: 'unverified',
          relationship: null,
          qualification: [],
          evidence: {
            sharedCount: 0,
            expiringSoonCount: 0,
            expiredCount: 0,
            nextExpiry: null,
            worst: null,
          },
        }),
      ]),
    ...extra,
  };
}

describe('SupplierDirectoryPage (BUY-31)', () => {
  it('shows identity, categories, relationship, contact, qualification scope and evidence freshness', async () => {
    routeCalls(routes());
    renderPage(<SupplierDirectoryPage />, PATH);
    const row = await screen.findByRole('row', { name: 'Chobe Pipe & Valve Supplies (Pty) Ltd' });
    expect(within(row).getByText('Pipes, valves and fittings')).toBeInTheDocument();
    expect(within(row).getByText('Owner: Tebogo Molefe')).toBeInTheDocument();
    expect(within(row).getByText(/^Contact: Chedza Ramokate/)).toBeInTheDocument();
    expect(within(row).getByText('0 contracts')).toBeInTheDocument();
    expect(within(row).getByText('Qualified with conditions')).toBeInTheDocument();
    expect(within(row).getByText('Expiring soon')).toBeInTheDocument();
    expect(within(row).getByText('Next expiry 8 Oct 2026')).toBeInTheDocument();
    const provisional = screen.getByRole('row', { name: 'Kasane Borehole Drilling (Pty) Ltd' });
    expect(within(provisional).getByText('Provisional')).toBeInTheDocument();
    expect(within(provisional).getByText('Nothing shared with you')).toBeInTheDocument();
    expect(screen.getByText('Restricted or suspended')).toBeInTheDocument();
  });

  it('sends category, relationship, owner and provisional filters to the API', async () => {
    const calls = routeCalls(routes());
    renderPage(<SupplierDirectoryPage />, PATH);
    await screen.findByRole('row', { name: 'Chobe Pipe & Valve Supplies (Pty) Ltd' });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'WTR-PUMP' } });
    fireEvent.change(screen.getByLabelText('Relationship'), { target: { value: 'none' } });
    fireEvent.change(screen.getByLabelText('Relationship owner'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Provisional records only' }));
    await waitFor(() =>
      expect(
        calls.filter((c) => c.id === 'buyer.suppliers.directory.list').at(-1)?.request,
      ).toEqual({
        query: expect.objectContaining({
          category: ['WTR-PUMP'],
          relationshipStatus: ['none'],
          ownerUserId: 5,
          provisionalOnly: true,
        }),
      }),
    );
  });

  it('invites a supplier through a confirmed provisional record', async () => {
    const calls = routeCalls(
      routes({
        'buyer.suppliers.provisional.create': () => ({
          supplierTenantId: 901,
          legalName: 'Maun Valve Services',
          isProvisional: true,
          registrationStatus: 'pending',
          invitationStatus: 'pending',
          relationship: {
            id: 90,
            status: 'prospective',
            riskRating: 'not_assessed',
            owner: null,
            restrictionNote: null,
            internalNotes: null,
            firstEngagedAt: null,
            updatedAt: '2026-09-30T08:00:00Z',
          },
          message: 'The contact was invited to claim the record.',
        }),
      }),
    );
    renderPage(<SupplierDirectoryPage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Invite supplier' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create and invite' }));
    expect(await within(dialog).findByText('Enter the legal name.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Legal name/), {
      target: { value: 'Maun Valve Services' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Contact name/), {
      target: { value: 'Ati Moyo' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Contact e-mail/), {
      target: { value: 'ati@maun-valves.example' },
    });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Water infrastructure › Pumps/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create and invite' }));
    expect(
      await screen.findByText(/The contact was invited to claim the record/),
    ).toBeInTheDocument();
    expect(calls.find((c) => c.id === 'buyer.suppliers.provisional.create')?.request).toEqual({
      body: expect.objectContaining({ legalName: 'Maun Valve Services', categories: ['WTR-PUMP'] }),
    });
  });

  it('requests qualification from the row menu and explains a refusal', async () => {
    routeCalls(
      routes({
        'buyer.suppliers.directory.get': () => relationshipRecord(),
        'buyer.suppliers.qualificationRequests.create': () => {
          throw businessError(
            'buyer.suppliers.qualificationRequests.create',
            'APPLICATION_IN_PROGRESS',
          );
        },
      }),
    );
    renderPage(<SupplierDirectoryPage />, PATH);
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Actions for Chobe Pipe & Valve Supplies (Pty) Ltd',
      }),
    );
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Request qualification' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('option', { name: 'Metering Equipment Suppliers' });
    fireEvent.change(within(dialog).getByLabelText(/Qualification programme/), {
      target: { value: '13' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send request' }));
    expect(
      await within(dialog).findByText(
        'An application under this programme is already in progress.',
      ),
    ).toBeInTheDocument();
  });

  it('hides inviting and flagging from a read-only assessor and shows the empty state', async () => {
    routeCalls({
      ...REFERENCE_HANDLERS,
      'buyer.suppliers.directory.list': () => directoryPage([]),
    });
    renderPage(<SupplierDirectoryPage />, { ...PATH, permissions: BUYER_ASSESSOR });
    expect(await screen.findByText('No suppliers yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Invite supplier' })).not.toBeInTheDocument();
  });
});
