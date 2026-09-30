import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  OPERATOR,
  opsChange,
  opsChangeDetail,
  renderPage,
  routeCalls,
} from '../../supplier-org/test/kit';
import OpsIdentityChangeDetailPage from './OpsIdentityChangeDetailPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/ops/supplier-identity-changes/:changeId',
  route: '/ops/supplier-identity-changes/2',
  kind: 'operator' as const,
  permissions: OPERATOR,
};

describe('OpsIdentityChangeDetailPage (FR-02)', () => {
  it('shows the change, its evidence, consequence and the submissions that keep the current identity', async () => {
    routeCalls({ 'ops.suppliers.identityChanges.get': () => opsChangeDetail() });
    renderPage(<OpsIdentityChangeDetailPage />, PATH);
    expect(
      await screen.findByText(
        'Approval changes the ownership declaration from the effective date.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/3 formal submissions were made under the current identity/),
    ).toBeInTheDocument();
    expect(screen.getByText('CIPA-change-of-name.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start review' })).toBeInTheDocument();
  });

  it('starts the review, then approves with an effective date and a note', async () => {
    const calls = routeCalls({
      'ops.suppliers.identityChanges.get': () => opsChangeDetail(),
      'ops.suppliers.identityChanges.startReview': () => opsChange({ status: 'under_review' }),
      'ops.suppliers.identityChanges.decide': () =>
        opsChange({
          status: 'approved',
          reviewedBy: { userId: 1, fullName: 'Naledi Sebego' },
          reviewedAt: '2026-09-30T08:00:00Z',
          effectiveAt: '2026-10-01T00:00:00Z',
          decisionNote: 'Share register checked.',
        }),
    });
    renderPage(<OpsIdentityChangeDetailPage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Start review' }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Start review' }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Decide' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Decision note/), {
      target: { value: 'Share register checked.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
    expect(
      await within(dialog).findByText('Enter the date from which the change applies.'),
    ).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Effective date/), {
      target: { value: '2026-10-01' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
    expect((await screen.findAllByText('Identity change Approved.')).length).toBeGreaterThan(0);
    expect(calls.find((c) => c.id === 'ops.suppliers.identityChanges.decide')?.request).toEqual({
      params: { changeId: 2 },
      body: {
        decision: 'approved',
        decisionNote: 'Share register checked.',
        effectiveDate: '2026-10-01',
      },
    });
  });
});
