import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ClientModule from '../../../api/client';

import { contractDetail, financials, obligationList } from '../test/data';
import { businessError, callsTo, renderPage, routeCalls } from '../test/harness';
import FinancialsPage from './FinancialsPage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof ClientModule>()),
  call: vi.fn(),
}));

const OPTIONS = {
  route: '/buyer/contracts/1/financials',
  path: '/buyer/contracts/:contractId/financials',
} as const;

describe('FinancialsPage (CON-08)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('labels each figure with its source and as-of time and flags estimates', async () => {
    routeCalls({
      'buyer.contracts.get': contractDetail(),
      'buyer.contracts.financials': financials(),
    });
    renderPage(<FinancialsPage />, {
      ...OPTIONS,
      permissions: ['contract.view', 'contract.financials.view'],
    });

    expect(await screen.findByText('Pending changes (exposure)')).toBeInTheDocument();
    expect(screen.getAllByText(/Change register · As of .* · Estimate/).length).toBe(1);
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('TSO-INV-0931')).toBeInTheDocument();
    expect(screen.getByText('Invoiced, not accepted')).toBeInTheDocument();
    expect(
      screen.getByText('The Q3 invoice is not accepted because its milestone was rejected.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record invoice' })).not.toBeInTheDocument();
  });

  it('disputes an invoice with a reason and shows a refusal from the server', async () => {
    const calls = routeCalls({
      'buyer.contracts.get': contractDetail(),
      'buyer.contracts.financials': financials(),
      'buyer.contracts.obligations': obligationList(),
      'buyer.contracts.disputeInvoice': businessError(
        'INVOICE_ALREADY_PAID',
        409,
        'The invoice is already paid.',
      ),
    });
    const user = userEvent.setup();
    renderPage(<FinancialsPage />, {
      ...OPTIONS,
      permissions: ['contract.view', 'contract.financials.view', 'contract.manage'],
    });

    await user.click(await screen.findByRole('button', { name: 'Dispute invoice TSO-INV-0931' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Reason/), 'Milestone rejected.');
    await user.click(within(dialog).getByRole('button', { name: 'Dispute' }));
    expect(await within(dialog).findByText('The invoice is already paid.')).toBeInTheDocument();
    expect(callsTo(calls, 'buyer.contracts.disputeInvoice')[0]?.request).toMatchObject({
      params: { contractId: 1, invoiceId: 1 },
      body: { reason: 'Milestone rejected.' },
    });
  });

  it('records a locally entered invoice', async () => {
    const calls = routeCalls({
      'buyer.contracts.get': contractDetail(),
      'buyer.contracts.financials': financials(),
      'buyer.contracts.obligations': obligationList(),
      'buyer.contracts.recordInvoice': {
        ...financials().invoices[0],
        id: 900,
        invoiceRef: 'TSO-INV-0999',
        source: 'local_entry',
      },
    });
    const user = userEvent.setup();
    renderPage(<FinancialsPage />, {
      ...OPTIONS,
      permissions: ['contract.view', 'contract.financials.view', 'contract.manage'],
    });

    await user.click(await screen.findByRole('button', { name: 'Record invoice' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Invoice reference/), 'TSO-INV-0999');
    await user.type(within(dialog).getByLabelText(/Invoice date/), '2026-09-30');
    await user.type(within(dialog).getByLabelText(/^Amount/), '5000.00');
    await user.click(within(dialog).getByRole('button', { name: 'Record' }));

    expect(await screen.findByText('Invoice TSO-INV-0999 recorded.')).toBeInTheDocument();
    expect(callsTo(calls, 'buyer.contracts.recordInvoice')[0]?.request).toMatchObject({
      body: {
        invoiceRef: 'TSO-INV-0999',
        invoiceDate: '2026-09-30',
        amount: { amount: '5000.00', currency: 'BWP' },
      },
    });
  });
});
