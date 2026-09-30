import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ClientModule from '../../../../api/client';

import { supplierDetail, supplierRow } from '../../test/data';
import { businessError, callsTo, renderPage, routeCalls } from '../../test/harness';
import SupplierContractPage from './SupplierContractPage';
import SupplierContractsPage from './SupplierContractsPage';

vi.mock('../../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof ClientModule>()),
  call: vi.fn(),
}));

const page = (items = [supplierRow()]) => ({ items, total: items.length, page: 1, pageSize: 25 });
const PARTICIPATE = ['supplier.contract.participate'] as const;

describe('SupplierContractsPage (SUP-23)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists the supplier’s own contracts with signature, obligation and change status', async () => {
    routeCalls({ 'supplier.contracts.list': page() });
    renderPage(<SupplierContractsPage />, {
      route: '/supplier/contracts',
      path: '/supplier/contracts',
      kind: 'supplier',
      permissions: PARTICIPATE,
    });
    const row = (await screen.findByText('C-2026-0002')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Kalahari Water Utilities (Pilot)')).toBeInTheDocument();
    expect(within(row).getByText('Your signature')).toBeInTheDocument();
    expect(within(row).getByText('2 open')).toBeInTheDocument();
  });

  it('spaces the filters and the table as one page', async () => {
    routeCalls({ 'supplier.contracts.list': page() });
    const { container } = renderPage(<SupplierContractsPage />, {
      route: '/supplier/contracts',
      path: '/supplier/contracts',
      kind: 'supplier',
      permissions: PARTICIPATE,
    });
    await screen.findByText('C-2026-0002');
    const root = container.querySelector('.tiq-page');
    expect(root).not.toBeNull();
    expect(root?.querySelector('table')).not.toBeNull();
  });

  it('shows the empty state for a supplier without contracts and filters by action required', async () => {
    const calls = routeCalls({ 'supplier.contracts.list': page([]) });
    const user = userEvent.setup();
    renderPage(<SupplierContractsPage />, {
      route: '/supplier/contracts',
      path: '/supplier/contracts',
      kind: 'supplier',
      permissions: PARTICIPATE,
    });
    expect(await screen.findByText('No contracts yet')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Action'), 'yes');
    await waitFor(() =>
      expect(
        callsTo(calls, 'supplier.contracts.list').some((item) =>
          JSON.stringify(item.request).includes('"actionRequired":true'),
        ),
      ).toBe(true),
    );
  });
});

describe('SupplierContractPage (SUP-23)', () => {
  beforeEach(() => vi.clearAllMocks());

  const OPTIONS = {
    route: '/supplier/contracts/2',
    path: '/supplier/contracts/:contractId',
    kind: 'supplier',
  } as const;

  it('never shows buyer-internal records and explains a blocked signature', async () => {
    routeCalls({
      'supplier.contracts.get': supplierDetail({
        signatureBlockedReason: 'The buyer is still approving changes to the agreed terms.',
      }),
    });
    const user = userEvent.setup();
    renderPage(<SupplierContractPage />, { ...OPTIONS, permissions: PARTICIPATE });

    expect(await screen.findByText('Your signature is requested')).toBeInTheDocument();
    expect(screen.queryByText(/Renewal/)).not.toBeInTheDocument();
    expect(screen.queryByText(/handover/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /Signature/ }));
    expect(screen.getByRole('button', { name: 'Sign' })).toBeDisabled();
  });

  it('refuses to sign with a reason', async () => {
    const calls = routeCalls({
      'supplier.contracts.get': supplierDetail(),
      'supplier.contracts.refuseSignature': businessError(
        'CONTRACT_NOT_AWAITING_SIGNATURE',
        409,
        'The contract is not awaiting signature.',
      ),
    });
    const user = userEvent.setup();
    renderPage(<SupplierContractPage />, { ...OPTIONS, permissions: PARTICIPATE });

    await user.click(await screen.findByRole('tab', { name: /Signature/ }));
    await user.click(screen.getByRole('button', { name: 'Refuse' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Reason/), 'Delivery period is unrealistic.');
    await user.click(within(dialog).getByRole('button', { name: 'Refuse' }));
    expect(
      await within(dialog).findByText('The contract is not awaiting signature.'),
    ).toBeInTheDocument();
    expect(callsTo(calls, 'supplier.contracts.refuseSignature')[0]?.request).toMatchObject({
      params: { contractId: 2, signatoryId: 8 },
      body: { reason: 'Delivery period is unrealistic.' },
    });
  });

  it('responds to a shared review and disputes the assessment', async () => {
    const calls = routeCalls({
      'supplier.contracts.get': supplierDetail(),
      'supplier.contracts.respondReview': {
        ...supplierDetail().reviews[0],
        status: 'supplier_responded',
      },
    });
    const user = userEvent.setup();
    renderPage(<SupplierContractPage />, { ...OPTIONS, permissions: PARTICIPATE });

    await user.click(await screen.findByRole('tab', { name: 'Performance' }));
    await user.click(screen.getByRole('button', { name: 'Respond' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByLabelText('I dispute this assessment'));
    await user.type(
      within(dialog).getByLabelText(/Your response/),
      'Vehicles were held for parts.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Respond' }));

    expect(await screen.findByText('Response recorded.')).toBeInTheDocument();
    expect(callsTo(calls, 'supplier.contracts.respondReview')[0]?.request).toMatchObject({
      body: { response: 'Vehicles were held for parts.', disputes: true },
    });
  });

  it('shows the contract read-only for a member who only follows outcomes', async () => {
    routeCalls({ 'supplier.contracts.get': supplierDetail() });
    const user = userEvent.setup();
    renderPage(<SupplierContractPage />, { ...OPTIONS, permissions: ['supplier.outcomes.view'] });
    await user.click(await screen.findByRole('tab', { name: /Change requests/ }));
    expect(screen.getByText('CR-0003')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agree' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request a change' })).not.toBeInTheDocument();
  });
});
