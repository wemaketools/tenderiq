import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../test/fetchMock';
import { rowOf } from '../lib';
import { options, request, strategy } from '../testing/data';
import { renderPage } from '../testing/render';
import StrategyFormPage from './StrategyFormPage';

const approvedRow = {
  ...rowOf(request),
  id: 5,
  reference: 'PR-2026-0005',
  status: 'approved' as const,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function render() {
  const fetch = installFetch({
    'GET /api/v1/buyer/request-options': () => ({ body: options }),
    'GET /api/v1/buyer/requests': () => ({
      body: { items: [approvedRow], total: 1, page: 1, pageSize: 100 },
    }),
    'POST /api/v1/buyer/strategies': () => ({ status: 201, body: { ...strategy, id: 900 } }),
  });
  renderPage(<StrategyFormPage />, {
    route: '/buyer/strategies/new?requestId=5',
    path: '/buyer/strategies/new',
  });
  return fetch;
}

describe('StrategyFormPage (BUY-06 form)', () => {
  it('never offers a framework call-off and requires exception grounds for a direct procurement', async () => {
    const { requests } = render();

    expect(await screen.findByRole('radio', { name: /^Direct/ })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Framework/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /^Direct/ }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Save draft' })[0] as HTMLElement);

    expect(
      await screen.findAllByText('State the approved exception grounds for a direct procurement.'),
    ).not.toHaveLength(0);
    expect(requests.some((item) => item.method === 'POST')).toBe(false);
  });

  it('refuses an RFI procedure for a tender event', async () => {
    render();

    await userEvent.click(await screen.findByRole('radio', { name: /^RFI/ }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Save draft' })[0] as HTMLElement);

    expect(
      await screen.findAllByText('An RFI uses the RFI procedure, and only an RFI does.'),
    ).not.toHaveLength(0);
  });

  it('creates a draft strategy for the approved request given in the link', async () => {
    const { requests } = render();

    await userEvent.type(await screen.findByLabelText(/^Intended outcome/), 'Replace 22 valves.');
    await userEvent.click(screen.getAllByRole('button', { name: 'Save draft' })[0] as HTMLElement);

    await waitFor(() => expect(requests.find((item) => item.method === 'POST')).toBeDefined());
    const body = requests.find((item) => item.method === 'POST')?.body as Record<string, unknown>;
    expect(body).toMatchObject({
      requestId: 5,
      projectId: null,
      procedure: 'open',
      eventType: 'tender',
    });
    expect(await screen.findByText('Revision 1 saved')).toBeInTheDocument();
  });
});
