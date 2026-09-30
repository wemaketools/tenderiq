import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../../test/fetchMock';
import {
  bidA,
  bidB,
  candidate,
  negotiationDetail,
  page,
  tenderRow,
  tenderSummary,
} from '../../testing/data';
import { renderSelection } from '../../testing/render';
import NegotiationFormPage from './NegotiationFormPage';

afterEach(() => vi.unstubAllGlobals());

const PATH = '/buyer/selection/negotiations/new';

describe('NegotiationFormPage', () => {
  it('blocks the mandate with every reason when negotiation is not permitted (AC-23)', async () => {
    installFetch({
      'GET /api/v1/buyer/selection/tenders': () => ({ body: page([tenderRow()]) }),
      'GET /api/v1/buyer/selection/tenders/9': () => ({
        body: tenderSummary({
          gates: {
            ...tenderSummary().gates,
            negotiation: {
              allowed: false,
              blockers: [
                { code: 'NEGOTIATION_NOT_PERMITTED', message: 'Negotiation is not provided for.' },
              ],
            },
          },
        }),
      }),
    });
    renderSelection(<NegotiationFormPage />, { path: PATH, route: `${PATH}?tenderId=9` });
    expect(await screen.findByText('Negotiation is blocked')).toBeInTheDocument();
    expect(document.querySelector('[data-code="NEGOTIATION_NOT_PERMITTED"]')).not.toBeNull();
    expect(screen.queryByText(/NEGOTIATION_NOT_PERMITTED/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save mandate' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Propose process decision' })).toBeInTheDocument();
  });

  it('opens a negotiation with its mandate where negotiation is permitted', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/selection/tenders': () => ({ body: page([tenderRow()]) }),
      'GET /api/v1/buyer/selection/tenders/9': () => ({ body: tenderSummary() }),
      'POST /api/v1/buyer/selection/negotiations': () => ({
        status: 201,
        body: negotiationDetail({ negotiationId: 9001, status: 'planned' }),
      }),
    });
    const { router } = renderSelection(<NegotiationFormPage />, {
      path: PATH,
      route: `${PATH}?tenderId=9`,
    });
    expect(await screen.findByText('The issued conditions permit negotiation')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Bid/), { target: { value: '908' } });
    fireEvent.change(screen.getByLabelText(/Commercial authority/), {
      target: { value: '2940000' },
    });
    fireEvent.change(screen.getByLabelText(/Authorized topics/), {
      target: { value: 'Service credits' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tebogo Molefe' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save mandate' }));
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe('/buyer/selection/negotiations/9001'),
    );
    expect(requests.find((request) => request.method === 'POST')?.body).toMatchObject({
      bidId: 908,
      allowedTopics: ['Service credits'],
      authorizedNegotiatorIds: [5],
      commercialAuthority: { amount: '2940000', currency: 'BWP' },
    });
  });

  it('offers only team members holding negotiation.conduct as negotiators', async () => {
    installFetch({
      'GET /api/v1/buyer/selection/tenders': () => ({ body: page([tenderRow()]) }),
      'GET /api/v1/buyer/selection/tenders/9': () => ({ body: tenderSummary() }),
    });
    renderSelection(<NegotiationFormPage />, { path: PATH, route: `${PATH}?tenderId=9` });
    expect(await screen.findByRole('checkbox', { name: 'Tebogo Molefe' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Mpho Dikgang' })).not.toBeInTheDocument();
  });

  it('requires a currency code when neither the offers nor the organization provide one', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/selection/tenders': () => ({ body: page([tenderRow()]) }),
      'GET /api/v1/buyer/selection/tenders/9': () => ({
        body: tenderSummary({
          candidates: [
            candidate(bidA, { evaluatedValue: null }),
            candidate(bidB, { evaluatedValue: null }),
          ],
        }),
      }),
      'POST /api/v1/buyer/selection/negotiations': () => ({
        status: 201,
        body: negotiationDetail({ negotiationId: 9001, status: 'planned' }),
      }),
    });
    renderSelection(<NegotiationFormPage />, {
      path: PATH,
      route: `${PATH}?tenderId=9`,
      tenant: { defaultCurrency: null },
    });
    expect(await screen.findByText('The issued conditions permit negotiation')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Bid/), { target: { value: '908' } });
    fireEvent.change(screen.getByLabelText(/Commercial authority/), {
      target: { value: '2940000' },
    });
    fireEvent.change(screen.getByLabelText(/Authorized topics/), {
      target: { value: 'Service credits' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tebogo Molefe' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save mandate' }));
    expect(await screen.findByText('Enter a three-letter currency code.')).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'POST')).toBe(false);

    fireEvent.change(screen.getByLabelText(/^Currency/), { target: { value: 'zar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save mandate' }));
    await vi.waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.body).toMatchObject({
        commercialAuthority: { amount: '2940000', currency: 'ZAR' },
      }),
    );
  });
});
