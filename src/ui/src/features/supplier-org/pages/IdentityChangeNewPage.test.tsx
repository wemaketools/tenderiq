import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { identityChange, profile, renderPage, routeCalls } from '../test/kit';
import IdentityChangeNewPage from './IdentityChangeNewPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/supplier/organization/identity-changes/new',
  route: '/supplier/organization/identity-changes/new',
};

function uploadRoutes() {
  return {
    'supplier.documents.createUpload': () => ({ version: { id: 77 } }),
    'supplier.documents.confirmUpload': () => ({
      document: { id: 950 },
      version: { fileName: 'certificate.pdf' },
    }),
  };
}

describe('IdentityChangeNewPage (SUP-03)', () => {
  it('shows the current value and requires evidence before submitting for review', async () => {
    const calls = routeCalls({
      'supplier.suppliers.profile.get': () => profile(),
      ...uploadRoutes(),
    });
    renderPage(<IdentityChangeNewPage />, PATH);
    expect(await screen.findByText('Reviewed, not immediate')).toBeInTheDocument();
    expect(screen.getAllByText('Tsodilo Engineering (Pty) Ltd').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText(/Proposed value/), {
      target: { value: 'Tsodilo Water Engineering (Pty) Ltd' },
    });
    fireEvent.change(screen.getByLabelText(/^Reason/), {
      target: { value: 'Registered name change.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
    expect(
      await screen.findByText('Attach the document that proves the change.'),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.id === 'supplier.suppliers.identityChanges.create')).toBe(false);
  });

  it('uploads the evidence, confirms and opens the submitted change', async () => {
    const calls = routeCalls({
      'supplier.suppliers.profile.get': () => profile(),
      ...uploadRoutes(),
      'supplier.suppliers.identityChanges.create': () =>
        identityChange({
          id: 900,
          status: 'submitted',
          reviewedBy: null,
          reviewedAt: null,
          effectiveAt: null,
          decisionNote: null,
        }),
    });
    const { container, router } = renderPage(<IdentityChangeNewPage />, PATH);
    await screen.findByText('Reviewed, not immediate');
    fireEvent.change(screen.getByLabelText(/Proposed value/), {
      target: { value: 'Tsodilo Water Engineering (Pty) Ltd' },
    });
    fireEvent.change(screen.getByLabelText(/^Reason/), {
      target: { value: 'Registered name change.' },
    });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (input === null) throw new Error('file input missing');
    fireEvent.change(input, {
      target: {
        files: [new File(['%PDF-1.4 test'], 'certificate.pdf', { type: 'application/pdf' })],
      },
    });
    expect(await screen.findByText('Document attached')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Submit for review' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/supplier/organization/identity-changes/900'),
    );
    expect(
      calls.find((c) => c.id === 'supplier.suppliers.identityChanges.create')?.request,
    ).toEqual({
      body: expect.objectContaining({ changeType: 'legal_name', evidenceDocumentId: 950 }),
    });
  });
});
