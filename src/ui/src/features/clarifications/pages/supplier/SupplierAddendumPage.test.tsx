import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PermissionCode } from '@contracts/permissions';

import { installFetch, problem } from '../../../../test/fetchMock';
import { renderWithProviders } from '../../../../test/render';
import { SUPPLIER_ALL, supplierAddendum, supplierState } from '../../testData';
import SupplierAddendumPage from './SupplierAddendumPage';

const S = '/api/v1/supplier/clarifications';

function render(
  addendum = supplierAddendum(),
  extra: Parameters<typeof installFetch>[0] = {},
  permissions: readonly PermissionCode[] = SUPPLIER_ALL,
) {
  const fetch = installFetch({
    [`GET ${S}/addenda/${addendum.id}`]: () => ({ body: addendum }),
    ...extra,
  });
  renderWithProviders(<SupplierAddendumPage />, {
    state: supplierState(permissions),
    route: `/supplier/clarifications/addenda/${addendum.id}`,
    path: '/supplier/clarifications/addenda/:addendumId',
  });
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SupplierAddendumPage (AC-10)', () => {
  it('states the required action, the new deadline and that the prior receipt stays valid', async () => {
    render();

    expect(
      await screen.findByText('Supplement your submission before the deadline', { selector: 'p' }),
    ).toBeInTheDocument();
    expect(screen.getByText('RCPT-2026-0002-001')).toBeInTheDocument();
    expect(screen.getByText('Valid: the addendum did not alter your receipt')).toBeInTheDocument();
    expect(screen.getByText('Previous submission deadline')).toBeInTheDocument();
    expect(screen.getAllByTestId('official-deadline').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Provide a class B accuracy certificate.')).toBeInTheDocument();
  });

  it('keeps delivery, opening and acknowledgment as separate events', async () => {
    render();
    const events = await screen.findByRole('list', { name: 'Notice events' });
    expect(within(events).getByText('Delivered to your organization')).toBeInTheDocument();
    expect(within(events).getByText('Opened')).toBeInTheDocument();
    expect(within(events).getByText('Required')).toBeInTheDocument();
  });

  it('acknowledges the addendum after the confirmation statement', async () => {
    const { requests } = render(supplierAddendum(), {
      [`POST ${S}/addenda/21/acknowledge`]: () => ({
        body: {
          addendumId: 21,
          acknowledgedAt: '2026-10-09T08:00:00Z',
          acknowledgedBy: { userId: 37, fullName: 'Kagiso Metsi' },
          requiredAction: 'supplement',
          requiredActionCompleted: false,
          priorSubmission: {
            receiptNo: 'RCPT-2026-0002-001',
            receivedAt: '2026-10-05T09:00:00Z',
            remainsValid: true,
          },
        },
      }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Acknowledge addendum' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('checkbox'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Acknowledge addendum' }));

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
        confirmed: true,
      }),
    );
    expect(await screen.findByText('Addendum acknowledged.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Acknowledge addendum' })).not.toBeInTheDocument();
  });

  it('explains an acknowledgment already recorded by a colleague', async () => {
    render(supplierAddendum(), {
      [`POST ${S}/addenda/21/acknowledge`]: () =>
        problem(409, 'Conflict', { code: 'ALREADY_ACKNOWLEDGED' }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Acknowledge addendum' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('checkbox'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Acknowledge addendum' }));
    expect(
      await within(dialog).findByText('Your organization has already acknowledged this addendum.'),
    ).toBeInTheDocument();
  });

  it('shows a contributor without the acknowledgment right no acknowledge action and no role hint (DD-49)', async () => {
    render(supplierAddendum(), {}, ['supplier.opportunities.view', 'supplier.response.edit']);
    expect(await screen.findByText('RCPT-2026-0002-001')).toBeInTheDocument();
    expect(screen.queryByText(/Ask your bid manager/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Acknowledge addendum' })).not.toBeInTheDocument();
  });
});
