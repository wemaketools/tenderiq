import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ClientModule from '../../../api/client';

import { assignees, contractDetail, signature } from '../test/data';
import { businessError, callsTo, renderPage, routeCalls } from '../test/harness';
import SignaturePage from './SignaturePage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof ClientModule>()),
  call: vi.fn(),
}));

const OPTIONS = {
  route: '/buyer/contracts/2/signature',
  path: '/buyer/contracts/:contractId/signature',
} as const;

function routes(extra: Record<string, unknown> = {}) {
  return routeCalls({
    'buyer.contracts.get': contractDetail({
      id: 2,
      reference: 'C-2026-0002',
      status: 'awaiting_signature',
      differsFromAward: true,
    }),
    'buyer.contracts.signature': signature(),
    'buyer.contracts.assignees': assignees(),
    ...extra,
  });
}

describe('SignaturePage (CON-03)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows signatories with authority, the issued version, preconditions and separate milestones', async () => {
    routes();
    renderPage(<SignaturePage />, { ...OPTIONS, permissions: ['contract.view'] });

    expect(await screen.findByText('Keabetswe Nkwe')).toBeInTheDocument();
    expect(screen.getByText('Authority covers the value')).toBeInTheDocument();
    expect(screen.getAllByText('C-2026-0002-v2.pdf').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Signature preconditions' })).toBeInTheDocument();
    expect(screen.getByText('Notice to proceed')).toBeInTheDocument();
    expect(screen.getByText('Delivery start')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign' })).not.toBeInTheDocument();
  });

  it('refuses an in-app signature while the difference approval is pending (AC-28)', async () => {
    const calls = routes({
      'buyer.contracts.sign': businessError('DIFFERENCE_NOT_APPROVED'),
    });
    const user = userEvent.setup();
    renderPage(<SignaturePage />, {
      ...OPTIONS,
      permissions: ['contract.view', 'contract.sign'],
      userId: 18,
    });

    await user.click(await screen.findByRole('button', { name: 'Sign' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('checkbox'));
    await user.click(within(dialog).getByRole('button', { name: 'Sign' }));

    expect(
      await within(dialog).findByText(/must be approved before signature or start \(AC-28\)/),
    ).toBeInTheDocument();
    expect(callsTo(calls, 'buyer.contracts.sign')[0]?.request).toMatchObject({
      params: { contractId: 2, signatoryId: 7 },
      body: { confirm: true },
    });
  });

  it('requires evidence before recording an external signature', async () => {
    const calls = routes();
    const user = userEvent.setup();
    renderPage(<SignaturePage />, {
      ...OPTIONS,
      permissions: ['contract.view', 'contract.prepare'],
    });

    await user.click(
      await screen.findByRole('button', { name: 'Record external signature of Keabetswe Nkwe' }),
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Record external signature' }));

    expect(
      await within(dialog).findByText('Upload the signed copy as evidence.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Explain how the signature was verified.')).toBeInTheDocument();
    expect(callsTo(calls, 'buyer.contracts.recordExternalSignature')).toHaveLength(0);
  });
});
