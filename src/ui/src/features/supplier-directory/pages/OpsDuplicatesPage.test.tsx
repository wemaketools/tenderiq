import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  OPERATOR,
  duplicateCandidate,
  page,
  renderPage,
  routeCalls,
} from '../../supplier-org/test/kit';
import OpsDuplicatesPage from './OpsDuplicatesPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/ops/supplier-duplicates',
  route: '/ops/supplier-duplicates',
  kind: 'operator' as const,
  permissions: OPERATOR,
};

describe('OpsDuplicatesPage (BR-44)', () => {
  it('lists candidates with both records, the reason, who raised them and the status', async () => {
    routeCalls({
      'ops.suppliers.duplicates.list': () =>
        page([
          duplicateCandidate(),
          duplicateCandidate({
            id: 2,
            status: 'not_duplicate',
            raisedBy: { tenantId: 3, tenantName: 'Okavango District Council', tenantKind: 'buyer' },
          }),
        ]),
    });
    renderPage(<OpsDuplicatesPage />, PATH);
    const rows = await screen.findAllByRole('row', { name: /Tsodilo Engineering \(Pty\) Ltd/ });
    expect(within(rows[0] as HTMLElement).getByText('Detected automatically')).toBeInTheDocument();
    expect(screen.getByText('Okavango District Council')).toBeInTheDocument();
    expect(screen.getAllByText('Similar name').length).toBeGreaterThan(0);
  });

  it('filters by status and opens a candidate', async () => {
    const calls = routeCalls({
      'ops.suppliers.duplicates.list': () => page([duplicateCandidate()]),
    });
    const { router } = renderPage(<OpsDuplicatesPage />, PATH);
    await screen.findAllByRole('row', { name: /Tsodilo Engineering/ });
    fireEvent.change(screen.getAllByLabelText('Status')[0] as HTMLElement, {
      target: { value: 'open' },
    });
    await waitFor(() =>
      expect(calls.filter((c) => c.id === 'ops.suppliers.duplicates.list').at(-1)?.request).toEqual(
        {
          query: expect.objectContaining({ status: ['open'] }),
        },
      ),
    );
    fireEvent.click(screen.getByText('Tsodilo Engineering (Pty) Ltd'));
    expect(router.state.location.pathname).toBe('/ops/supplier-duplicates/1');
  });

  it('shows the empty state', async () => {
    routeCalls({ 'ops.suppliers.duplicates.list': () => page([]) });
    renderPage(<OpsDuplicatesPage />, PATH);
    expect(await screen.findByText('No possible duplicates.')).toBeInTheDocument();
  });
});
