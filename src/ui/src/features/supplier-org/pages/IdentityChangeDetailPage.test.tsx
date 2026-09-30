import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { businessError, identityChange, renderPage, routeCalls } from '../test/kit';
import IdentityChangeDetailPage from './IdentityChangeDetailPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/supplier/organization/identity-changes/:changeId',
  route: '/supplier/organization/identity-changes/1',
};

describe('IdentityChangeDetailPage (SUP-03)', () => {
  it('shows the values, evidence, review and effective date of a decided change', async () => {
    routeCalls({ 'supplier.suppliers.identityChanges.get': () => identityChange() });
    renderPage(<IdentityChangeDetailPage />, PATH);
    expect(await screen.findByText('Identity change: Legal name')).toBeInTheDocument();
    expect(screen.getByText('Tsodilo Engineering Services (Pty) Ltd')).toBeInTheDocument();
    expect(screen.getByText('CIPA-change-of-name.pdf')).toBeInTheDocument();
    expect(screen.getByText('Confirmed against CIPA.')).toBeInTheDocument();
    expect(screen.getByText(/applied from the effective date/)).toBeInTheDocument();
    expect(screen.getByText('Historical records keep their identity')).toBeInTheDocument();
  });

  it('marks a change still waiting for review as not yet approved', async () => {
    routeCalls({
      'supplier.suppliers.identityChanges.get': () =>
        identityChange({
          status: 'submitted',
          reviewedBy: null,
          reviewedAt: null,
          effectiveAt: null,
          decisionNote: null,
        }),
    });
    renderPage(<IdentityChangeDetailPage />, PATH);
    expect(
      await screen.findByText(/awaiting the start of the operator review/),
    ).toBeInTheDocument();
  });

  it('reports a change that is not available', async () => {
    routeCalls({
      'supplier.suppliers.identityChanges.get': () => {
        throw businessError('supplier.suppliers.identityChanges.get', 'NOT_FOUND', 404);
      },
    });
    renderPage(<IdentityChangeDetailPage />, PATH);
    expect(await screen.findByText('This could not be loaded')).toBeInTheDocument();
  });
});
