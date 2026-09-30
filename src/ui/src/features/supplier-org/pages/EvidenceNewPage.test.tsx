import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  evidenceItem,
  REFERENCE_HANDLERS,
  renderPage,
  routeCalls,
  SUPPLIER_FINANCE,
} from '../test/kit';
import EvidenceNewPage from './EvidenceNewPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/supplier/evidence/new', route: '/supplier/evidence/new' };

describe('EvidenceNewPage (SUP-05)', () => {
  it('requires coverage and expiry for insurance, and the document', async () => {
    const calls = routeCalls({ ...REFERENCE_HANDLERS });
    renderPage(<EvidenceNewPage />, PATH);
    fireEvent.change(screen.getByLabelText(/Evidence type/), { target: { value: 'insurance' } });
    fireEvent.change(screen.getAllByLabelText(/^Title/)[0] as HTMLElement, {
      target: { value: 'Contract works insurance' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add to library' }));
    expect(
      await screen.findByText('Insurance needs the coverage amount and the expiry date.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Upload the document first.')).toBeInTheDocument();
    expect(calls.some((c) => c.id === 'supplier.suppliers.evidence.create')).toBe(false);
    expect(screen.getByText('Saved to your library only')).toBeInTheDocument();
  });

  it('offers financial types only to members with the financial evidence right', () => {
    routeCalls({ ...REFERENCE_HANDLERS });
    renderPage(<EvidenceNewPage />, PATH);
    expect(screen.getByRole('option', { name: 'Financial statement' })).toBeDisabled();
  });

  it('adds a financial statement with its reporting period after the upload', async () => {
    const calls = routeCalls({
      ...REFERENCE_HANDLERS,
      'supplier.documents.createUpload': () => ({ version: { id: 78 } }),
      'supplier.documents.confirmUpload': () => ({
        document: { id: 951 },
        version: { fileName: 'afs-2025.pdf' },
      }),
      'supplier.suppliers.evidence.create': () =>
        evidenceItem({ id: 900, evidenceType: 'financial_statement', sensitivity: 'financial' }),
    });
    const { container, router } = renderPage(<EvidenceNewPage />, {
      ...PATH,
      permissions: SUPPLIER_FINANCE,
    });
    fireEvent.change(screen.getByLabelText(/Evidence type/), {
      target: { value: 'financial_statement' },
    });
    fireEvent.change(screen.getByLabelText(/Sensitivity/), { target: { value: 'financial' } });
    fireEvent.change(screen.getAllByLabelText(/^Title/)[0] as HTMLElement, {
      target: { value: 'Audited statements 2025' },
    });
    fireEvent.change(screen.getByLabelText(/Period start/), { target: { value: '2025-01-01' } });
    fireEvent.change(screen.getByLabelText(/Period end/), { target: { value: '2025-12-31' } });
    fireEvent.change(screen.getByLabelText(/Reporting currency/), { target: { value: 'BWP' } });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (input === null) throw new Error('file input missing');
    fireEvent.change(input, {
      target: { files: [new File(['%PDF-1.4 afs'], 'afs-2025.pdf', { type: 'application/pdf' })] },
    });
    await screen.findByText('Document attached');
    fireEvent.click(screen.getByRole('button', { name: 'Add to library' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/supplier/evidence/900'));
    expect(calls.find((c) => c.id === 'supplier.suppliers.evidence.create')?.request).toEqual({
      body: expect.objectContaining({
        evidenceType: 'financial_statement',
        periodStart: '2025-01-01',
        periodEnd: '2025-12-31',
        reportingCurrency: 'BWP',
        documentId: 951,
      }),
    });
  });

  it('starts with the kind of evidence named in the link from a missing-evidence request', async () => {
    routeCalls({ ...REFERENCE_HANDLERS });
    renderPage(<EvidenceNewPage />, { ...PATH, route: '/supplier/evidence/new?type=registration' });
    expect(screen.getByLabelText(/Evidence type/)).toHaveValue('registration');
  });

  it('ignores a financial kind in the link for a member without the financial evidence right', () => {
    routeCalls({ ...REFERENCE_HANDLERS });
    renderPage(<EvidenceNewPage />, {
      ...PATH,
      route: '/supplier/evidence/new?type=financial_statement',
    });
    expect(screen.getByLabelText(/Evidence type/)).toHaveValue('certificate');
  });

  it('offers the currencies served by the API and defaults coverage to the organization currency', async () => {
    const calls = routeCalls({ ...REFERENCE_HANDLERS });
    renderPage(<EvidenceNewPage />, PATH);
    fireEvent.change(screen.getByLabelText(/Evidence type/), { target: { value: 'insurance' } });
    const currency = await screen.findByLabelText('Currency');
    await waitFor(() => expect(screen.getByRole('option', { name: 'ZAR' })).toBeInTheDocument());
    expect(currency).toHaveValue('BWP');
    expect(calls.some((c) => c.id === 'public.suppliers.referenceOptions')).toBe(true);
  });
});
