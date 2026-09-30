import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  OPERATOR,
  businessError,
  duplicateCandidate,
  duplicateDetail,
  renderPage,
  routeCalls,
} from '../../supplier-org/test/kit';
import OpsDuplicateDetailPage from './OpsDuplicateDetailPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/ops/supplier-duplicates/:candidateId',
  route: '/ops/supplier-duplicates/1',
  kind: 'operator' as const,
  permissions: OPERATOR,
};

describe('OpsDuplicateDetailPage (BR-44)', () => {
  it('compares both records side by side with the review guidance', async () => {
    routeCalls({ 'ops.suppliers.duplicates.get': () => duplicateDetail() });
    renderPage(<OpsDuplicateDetailPage />, PATH);
    expect(await screen.findByText('A similar name is not enough to merge.')).toBeInTheDocument();
    const comparison = screen.getByRole('row', { name: /Registration number/ });
    expect(within(comparison).getByText('Different')).toBeInTheDocument();
    expect(
      within(screen.getByRole('row', { name: /Country/ })).getByText('Same'),
    ).toBeInTheDocument();
  });

  it('merges only after choosing the surviving record and acknowledging the registry check', async () => {
    const calls = routeCalls({
      'ops.suppliers.duplicates.get': () => duplicateDetail(),
      'ops.suppliers.duplicates.decide': () => ({
        candidate: duplicateCandidate({
          status: 'merged',
          reviewedBy: { userId: 1, fullName: 'Naledi Sebego' },
          reviewedAt: '2026-09-30T08:00:00Z',
        }),
        merge: {
          id: 900,
          survivingTenantId: 4,
          mergedTenantId: 52,
          approvedBy: { userId: 1, fullName: 'Naledi Sebego' },
          reason: 'Same CIPA entity.',
          mergedAt: '2026-09-30T08:00:00Z',
        },
        message: 'Merged. Historical records keep their original party.',
      }),
    });
    renderPage(<OpsDuplicateDetailPage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Decide' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('radio', { name: /Merged/ }));
    fireEvent.change(within(dialog).getByLabelText(/^Reason/), {
      target: { value: 'Same CIPA entity.' },
    });
    const confirm = within(dialog).getByRole('button', { name: 'Record decision' });
    expect(confirm).toBeDisabled();
    fireEvent.click(
      within(dialog).getByRole('checkbox', { name: /I confirmed the legal identity/ }),
    );
    fireEvent.click(confirm);
    expect(
      (await screen.findAllByText('Merged. Historical records keep their original party.')).length,
    ).toBeGreaterThan(0);
    expect(calls.find((c) => c.id === 'ops.suppliers.duplicates.decide')?.request).toEqual({
      params: { candidateId: 1 },
      body: { decision: 'merged', survivingTenantId: 4, reason: 'Same CIPA entity.' },
    });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Decide' })).not.toBeInTheDocument(),
    );
  });

  it('explains a candidate that was already decided', async () => {
    routeCalls({
      'ops.suppliers.duplicates.get': () => duplicateDetail(),
      'ops.suppliers.duplicates.decide': () => {
        throw businessError('ops.suppliers.duplicates.decide', 'DUPLICATE_ALREADY_DECIDED');
      },
    });
    renderPage(<OpsDuplicateDetailPage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Decide' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Reason/), { target: { value: 'Separate.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record decision' }));
    expect(
      await within(dialog).findByText('This duplicate candidate has already been decided.'),
    ).toBeInTheDocument();
  });
});
