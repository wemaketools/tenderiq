import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../../test/fetchMock';
import { supplierNegotiationDetail } from '../../testing/data';
import { renderSelection } from '../../testing/render';
import SupplierNegotiationPage from './SupplierNegotiationPage';

afterEach(() => vi.unstubAllGlobals());

const PATH = '/supplier/negotiations/:negotiationId';
const ROUTE = '/supplier/negotiations/2';

describe('SupplierNegotiationPage', () => {
  it('sends an internally approved response to the open round', async () => {
    const detail = supplierNegotiationDetail();
    const { requests } = installFetch({
      'GET /api/v1/supplier/selection/negotiations/2': () => ({ body: detail }),
      'POST /api/v1/supplier/selection/negotiations/2/rounds/12/respond': () => ({
        body: {
          ...detail.rounds[0],
          supplierProposal: 'Credits capped at 6%.',
          supplierResponseAt: '2026-10-06T12:00:00Z',
          awaitingResponse: false,
        },
      }),
    });
    renderSelection(<SupplierNegotiationPage />, { path: PATH, route: ROUTE, supplier: true });

    expect(await screen.findByText(/other suppliers’ records stay hidden/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Respond to round' })[0] as HTMLElement);
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Your proposal/), {
      target: { value: 'Credits capped at 6%.' },
    });
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Respond to round' }));

    expect(await screen.findByText('Response sent.')).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      supplierProposal: 'Credits capped at 6%.',
      concessions: null,
      internalApprovalConfirmed: true,
    });
  });

  it('links an issued final-offer round to the response workspace', async () => {
    installFetch({
      'GET /api/v1/supplier/selection/negotiations/2': () => ({
        body: supplierNegotiationDetail(),
      }),
    });
    renderSelection(<SupplierNegotiationPage />, { path: PATH, route: ROUTE, supplier: true });
    expect(await screen.findByRole('link', { name: 'Open response workspace' })).toHaveAttribute(
      'href',
      '/supplier/responses/908',
    );
  });

  it('shows no respond action and no role hint when the member may only read', async () => {
    installFetch({
      'GET /api/v1/supplier/selection/negotiations/2': () => ({
        body: supplierNegotiationDetail(),
      }),
    });
    renderSelection(<SupplierNegotiationPage />, {
      path: PATH,
      route: ROUTE,
      supplier: true,
      permissions: ['supplier.pricing.edit'],
    });
    expect(await screen.findByText(/other suppliers’ records stay hidden/)).toBeInTheDocument();
    expect(screen.queryByText(/authorized approver/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Respond to round' })).not.toBeInTheDocument();
  });

  it('withholds the round response from a bid manager who may acknowledge notices but lacks submission authority', async () => {
    installFetch({
      'GET /api/v1/supplier/selection/negotiations/2': () => ({
        body: supplierNegotiationDetail(),
      }),
    });
    renderSelection(<SupplierNegotiationPage />, {
      path: PATH,
      route: ROUTE,
      supplier: true,
      permissions: [
        'supplier.outcomes.view',
        'supplier.notices.acknowledge',
        'supplier.pricing.edit',
      ],
    });
    expect(await screen.findByText(/other suppliers’ records stay hidden/)).toBeInTheDocument();
    expect(screen.queryByText(/authorized approver/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Respond to round' })).not.toBeInTheDocument();
  });
});
