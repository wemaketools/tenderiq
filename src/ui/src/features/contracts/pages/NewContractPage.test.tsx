import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ClientModule from '../../../api/client';

import { assignees, awardSources, contractRow } from '../test/data';
import { callsTo, renderPage, routeCalls } from '../test/harness';
import NewContractPage from './NewContractPage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof ClientModule>()),
  call: vi.fn(),
}));

const OPTIONS = {
  route: '/buyer/contracts/new',
  path: '/buyer/contracts/new',
  permissions: ['contract.view', 'contract.prepare'],
} as const;

async function chooseLot(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(await screen.findByLabelText(/^Tender/), '1');
  await user.selectOptions(screen.getByLabelText(/^Supplier legal party/), '4');
  await user.selectOptions(screen.getByLabelText(/^Contracting legal entity/), '1');
  await user.click(screen.getByLabelText('Include lot 1'));
}

describe('NewContractPage (CON-02 prepare)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('blocks an allocation above the unallocated award before calling the API (BR-33)', async () => {
    const calls = routeCalls({
      'buyer.contracts.awardSources': awardSources(),
      'buyer.contracts.assignees': assignees(),
    });
    const user = userEvent.setup();
    renderPage(<NewContractPage />, OPTIONS);
    await chooseLot(user);
    await user.type(screen.getByLabelText(/^Allocation of lot 1/), '70000.00');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(
      await screen.findByText('Lot 1: the allocation exceeds the unallocated award of BWP 60,000.'),
    ).toBeInTheDocument();
    expect(callsTo(calls, 'buyer.contracts.create')).toHaveLength(0);
  });

  it('flags a value that differs from the allocated award and requires an explanation (AC-28)', async () => {
    const calls = routeCalls({
      'buyer.contracts.awardSources': awardSources(),
      'buyer.contracts.assignees': assignees(),
    });
    const user = userEvent.setup();
    renderPage(<NewContractPage />, OPTIONS);
    await chooseLot(user);
    await user.type(screen.getByLabelText(/^Allocation of lot 1/), '60000.00');
    await user.type(screen.getByLabelText(/^Contract value/), '65000.00');

    expect(screen.getByText('This contract differs from the approved award')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Contract title/), 'Lot 1 remaining spares');
    await user.type(screen.getByLabelText(/^Scope/), 'Remaining spares');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(
      await screen.findByText('Explain why the contract differs from the award.'),
    ).toBeInTheDocument();
    expect(callsTo(calls, 'buyer.contracts.create')).toHaveLength(0);
  });

  it('saves a reconciling draft and states that it is not submitted', async () => {
    const calls = routeCalls({
      'buyer.contracts.awardSources': awardSources(),
      'buyer.contracts.assignees': assignees(),
      'buyer.contracts.create': contractRow({ id: 900, reference: 'C-2026-0900', status: 'draft' }),
    });
    const user = userEvent.setup();
    renderPage(<NewContractPage />, OPTIONS);
    await chooseLot(user);
    await user.type(screen.getByLabelText(/^Allocation of lot 1/), '60000.00');
    await user.type(screen.getByLabelText(/^Contract value/), '60000.00');
    await user.type(screen.getByLabelText(/^Contract title/), 'Lot 1 remaining spares');
    await user.type(screen.getByLabelText(/^Scope/), 'Remaining spares');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByText('Saved as a draft')).toBeInTheDocument();
    expect(screen.getByText('C-2026-0900')).toBeInTheDocument();
    expect(callsTo(calls, 'buyer.contracts.create')[0]?.request).toMatchObject({
      body: {
        tenderId: 1,
        supplierTenantId: 4,
        legalEntityId: 1,
        allocations: [
          { lotOutcomeId: 14011, allocatedValue: { amount: '60000.00', currency: 'BWP' } },
        ],
        value: { amount: '60000.00', currency: 'BWP' },
      },
    });
  });

  it('lists a lot still under assessment as having no outcome and not available for a contract', async () => {
    const sources = awardSources();
    const [lotOne] = sources.lotOutcomes;
    if (lotOne === undefined) throw new Error('The award sources need lot 1.');
    routeCalls({
      'buyer.contracts.awardSources': {
        ...sources,
        lotOutcomes: [
          lotOne,
          {
            ...lotOne,
            lotOutcomeId: 14013,
            lotNumber: 3,
            lotTitle: 'Pump controls and telemetry panels',
            supplier: null,
            outcome: null,
            status: null,
            awardedValue: null,
            allocatedValue: { amount: '0.00', currency: 'BWP' },
            remainingValue: null,
            contracts: [],
            finalAwardedAt: null,
            availableForContract: false,
            unavailableReason: 'Lot 3 is still under assessment.',
          },
        ],
      },
      'buyer.contracts.assignees': assignees(),
    });
    const user = userEvent.setup();
    renderPage(<NewContractPage />, OPTIONS);
    await user.selectOptions(await screen.findByLabelText(/^Tender/), '1');
    await user.selectOptions(screen.getByLabelText(/^Supplier legal party/), '4');

    expect(
      await screen.findByText(
        /Under assessment, no outcome yet · Lot 3 is still under assessment\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Include lot 3')).toBeDisabled();
  });
});
