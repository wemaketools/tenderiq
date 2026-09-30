import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  SUPPLIER_CONTRIBUTOR,
  SUPPLIER_FINANCE,
  evidenceItem,
  evidencePage,
  profile,
  renderPage,
  routeCalls,
  sharingBuyers,
} from '../test/kit';
import EvidenceLibraryPage from './EvidenceLibraryPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/supplier/evidence', route: '/supplier/evidence' };

function routes(list = evidencePage()) {
  return {
    'supplier.suppliers.evidence.list': () => list,
    'supplier.suppliers.sharingBuyers': () => sharingBuyers(),
    'supplier.suppliers.profile.get': () => profile(),
  };
}

describe('EvidenceLibraryPage (SUP-05)', () => {
  it('lists evidence with issuer, cover, expiry freshness, sharing audience and submissions', async () => {
    routeCalls(routes());
    renderPage(<EvidenceLibraryPage />, PATH);
    const row = await screen.findByRole('row', { name: 'Public liability insurance 2025/26' });
    expect(within(row).getByText(/Botswana Insurance Company/)).toBeInTheDocument();
    expect(within(row).getByText('BWP 5,000,000')).toBeInTheDocument();
    expect(within(row).getByText('Expiring soon')).toBeInTheDocument();
    expect(within(row).getByText('Kalahari Water Utilities (Pilot)')).toBeInTheDocument();
    expect(within(row).getByText('Edition 2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add evidence' })).toBeInTheDocument();
  });

  it('says financial evidence is withheld instead of showing it', async () => {
    routeCalls(routes(evidencePage([evidenceItem()], true)));
    renderPage(<EvidenceLibraryPage />, PATH);
    expect(await screen.findByText('Financial evidence is not shown')).toBeInTheDocument();
  });

  it('sends type, buyer and history filters to the API', async () => {
    const calls = routeCalls(routes());
    renderPage(<EvidenceLibraryPage />, PATH);
    await screen.findByRole('row', { name: 'Public liability insurance 2025/26' });
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'insurance' } });
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Okavango District Council' })).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText('Shared with'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include replaced editions' }));
    await waitFor(() =>
      expect(
        calls.filter((c) => c.id === 'supplier.suppliers.evidence.list').at(-1)?.request,
      ).toEqual({
        query: expect.objectContaining({
          evidenceType: ['insurance'],
          sharedWithBuyerId: 3,
          includeHistory: true,
        }),
      }),
    );
  });

  it('opens an item when its row is chosen', async () => {
    routeCalls(routes());
    const { router } = renderPage(<EvidenceLibraryPage />, PATH);
    fireEvent.click(await screen.findByText('Public liability insurance 2025/26'));
    expect(router.state.location.pathname).toBe('/supplier/evidence/105');
  });

  it('shows an empty library and hides adding evidence from members who cannot manage it', async () => {
    routeCalls(routes(evidencePage([])));
    renderPage(<EvidenceLibraryPage />, {
      ...PATH,
      permissions: [...SUPPLIER_CONTRIBUTOR, 'supplier.evidence.share'],
    });
    expect(await screen.findByText('The evidence library is empty.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Add evidence' })).not.toBeInTheDocument();
  });

  it('shows financial statements to a member who holds the financial evidence right (PRD §4.3)', async () => {
    const statement = evidenceItem({
      id: 402,
      evidenceType: 'financial_statement',
      sensitivity: 'financial',
      title: 'Audited financial statements FY2025',
      issuer: 'KPMG Botswana',
      referenceNumber: null,
      periodStart: '2024-07-01',
      periodEnd: '2025-06-30',
      reportingCurrency: 'BWP',
      isConsolidated: false,
      coverage: null,
      validFrom: '2025-09-30',
      expiresAt: null,
      freshness: 'no_expiry',
      editionNo: 2,
      replacesId: 410,
    });
    routeCalls(routes(evidencePage([statement], false)));
    renderPage(<EvidenceLibraryPage />, { ...PATH, permissions: SUPPLIER_FINANCE });
    const row = await screen.findByRole('row', { name: 'Audited financial statements FY2025' });
    expect(within(row).getByText(/KPMG Botswana/)).toBeInTheDocument();
    expect(screen.queryByText('Financial evidence is not shown')).not.toBeInTheDocument();
  });
});
