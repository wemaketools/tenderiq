import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  businessError,
  evidenceDetail,
  evidenceItem,
  REFERENCE_HANDLERS,
  renderPage,
  routeCalls,
  sharingBuyers,
} from '../test/kit';
import EvidenceDetailPage from './EvidenceDetailPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/supplier/evidence/:evidenceId', route: '/supplier/evidence/105' };
const KWU = { tenantId: 2, tenantName: 'Kalahari Water Utilities (Pilot)', tenantKind: 'buyer' };
const ODC = { tenantId: 3, tenantName: 'Okavango District Council', tenantKind: 'buyer' };

describe('EvidenceDetailPage (SUP-05)', () => {
  it('shows where each edition was formally submitted, the sharing audience and the editions', async () => {
    routeCalls({
      ...REFERENCE_HANDLERS,
      'supplier.suppliers.evidence.get': () => evidenceDetail(),
    });
    renderPage(<EvidenceDetailPage />, PATH);
    expect(
      await screen.findByRole('heading', { name: 'Where it was formally submitted' }),
    ).toBeInTheDocument();
    const submission = screen.getByRole('row', { name: /T-2026-0001/ });
    expect(within(submission).getByText('Edition 1')).toBeInTheDocument();
    expect(within(submission).getByText('Bid revision')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Withdraw sharing' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edition 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Renew' })).toBeInTheDocument();
    expect(screen.getByText(/renew before it expires/)).toBeInTheDocument();
  });

  it('withdraws future sharing with one buyer and says earlier submissions stay', async () => {
    const calls = routeCalls({
      ...REFERENCE_HANDLERS,
      'supplier.suppliers.evidence.get': () => evidenceDetail(),
      'supplier.suppliers.evidence.withdrawShare': () => ({
        share: {
          id: 5,
          buyer: KWU,
          sharedAt: '2026-07-15T09:20:00Z',
          sharedBy: { userId: 24, fullName: 'Tumelo Sekgoma' },
          withdrawnAt: '2026-09-30T08:00:00Z',
          withdrawnBy: { userId: 24, fullName: 'Tumelo Sekgoma' },
        },
        retainedSubmissionCount: 1,
        message: 'Sharing withdrawn; 1 formal submission stays in the buyer record.',
      }),
    });
    renderPage(<EvidenceDetailPage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw sharing' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/stays in its record/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Withdraw sharing' }));
    expect(
      await screen.findByText('Sharing withdrawn; 1 formal submission stays in the buyer record.'),
    ).toBeInTheDocument();
    expect(
      calls.find((c) => c.id === 'supplier.suppliers.evidence.withdrawShare')?.request,
    ).toEqual({
      params: { evidenceId: 105, shareId: 5 },
      body: {},
    });
  });

  it('shares the item with another buyer', async () => {
    const calls = routeCalls({
      ...REFERENCE_HANDLERS,
      'supplier.suppliers.evidence.get': () => evidenceDetail(),
      'supplier.suppliers.sharingBuyers': () => sharingBuyers(),
      'supplier.suppliers.evidence.share': () => ({
        id: 900,
        buyer: ODC,
        sharedAt: '2026-09-30T08:00:00Z',
        sharedBy: { userId: 24, fullName: 'Tumelo Sekgoma' },
        withdrawnAt: null,
        withdrawnBy: null,
      }),
    });
    renderPage(<EvidenceDetailPage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Share with a buyer' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('option', { name: 'Okavango District Council' });
    expect(within(dialog).queryByRole('option', { name: /Kalahari/ })).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Buyer/), { target: { value: '3' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Share with a buyer' }));
    expect(
      await screen.findByText('Now shared with Okavango District Council.'),
    ).toBeInTheDocument();
    expect(calls.find((c) => c.id === 'supplier.suppliers.evidence.share')?.request).toEqual({
      params: { evidenceId: 105 },
      body: { buyerTenantId: 3 },
    });
  });

  it('withdraws the item with a reason and reports the retained submissions', async () => {
    routeCalls({
      ...REFERENCE_HANDLERS,
      'supplier.suppliers.evidence.get': () => evidenceDetail(),
      'supplier.suppliers.evidence.withdraw': () => ({
        item: evidenceItem({ status: 'withdrawn', activeShares: [] }),
        endedShareCount: 1,
        retainedSubmissionCount: 1,
      }),
    });
    renderPage(<EvidenceDetailPage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Withdraw' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Why is it withdrawn/), {
      target: { value: 'Policy superseded.' },
    });
    fireEvent.click(confirm);
    expect(
      await screen.findByText(
        /Sharing ended with 1 buyer\(s\); 1 formal submission\(s\) are retained/,
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Renew' })).not.toBeInTheDocument(),
    );
  });

  it('shows a restricted state for financial evidence the member may not see', async () => {
    routeCalls({
      ...REFERENCE_HANDLERS,
      'supplier.suppliers.evidence.get': () => {
        throw businessError(
          'supplier.suppliers.evidence.get',
          'FINANCIAL_EVIDENCE_RESTRICTED',
          403,
        );
      },
    });
    renderPage(<EvidenceDetailPage />, PATH);
    expect(await screen.findByText('Financial evidence')).toBeInTheDocument();
    expect(
      screen.getByText(/visible only to members with the financial evidence right/),
    ).toBeInTheDocument();
  });
});
