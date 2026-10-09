import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { buyerState, data, pageOf, routes } from '../test/kit';
import PublicationRegisterPage from './PublicationRegisterPage';

const LIST = 'GET /api/v1/buyer/publications';
const TENDERS = 'GET /api/v1/buyer/tenders';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PublicationRegisterPage (BUY-14 register)', () => {
  it('lists publications and flags the failed external notice as needing attention', async () => {
    routes({ [LIST]: data.publications(), [TENDERS]: data.tenders() });
    renderWithProviders(<PublicationRegisterPage />, { state: buyerState() });

    const table = await screen.findByRole('table', {
      name: 'Publications by tender, version and channel',
    });
    expect(await within(table).findAllByText('T-2026-0002')).not.toHaveLength(0);
    expect(within(table).getAllByText('Not advertised')).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Needs attention' })).toHaveTextContent('1');
  });

  it('shows tenders awaiting publication in the release queue', async () => {
    routes({ [LIST]: data.publications(), [TENDERS]: data.tenders() });
    renderWithProviders(<PublicationRegisterPage />, { state: buyerState() });
    const queue = await screen.findByRole('table', { name: 'Tenders awaiting publication' });
    expect(await within(queue).findByText('T-2026-0005')).toBeInTheDocument();
    expect(within(queue).getByText('Awaiting release approval')).toBeInTheDocument();
    expect(
      within(queue).getByText('19 Oct 2026, 09:00 (UTC+02:00) Africa/Gaborone'),
    ).toBeInTheDocument();
  });

  it('sends the needs-attention filter to the API', async () => {
    const { requests } = routes({ [LIST]: data.publications(), [TENDERS]: data.tenders() });
    renderWithProviders(<PublicationRegisterPage />, { state: buyerState() });
    await screen.findByRole('table', { name: 'Publications by tender, version and channel' });

    await userEvent.click(screen.getByLabelText('Needs attention only'));

    await waitFor(() =>
      expect(requests.some((request) => request.search.includes('needsAttention=true'))).toBe(true),
    );
  });

  it('shows the empty state when nothing is published', async () => {
    routes({ [LIST]: pageOf([]), [TENDERS]: { ...pageOf([]), statusCounts: [] } });
    renderWithProviders(<PublicationRegisterPage />, { state: buyerState() });
    expect(await screen.findByText('No publications yet')).toBeInTheDocument();
    expect(await screen.findByText('No tender is waiting for publication')).toBeInTheDocument();
  });

  it('leaves out the publication queue and the tender filter, without querying tenders, for a membership without tender view', async () => {
    const { requests } = routes({ [LIST]: data.publications(), [TENDERS]: data.tenders() });
    renderWithProviders(<PublicationRegisterPage />, { state: buyerState(['tender.publish']) });

    expect(await screen.findAllByText('T-2026-0002')).not.toHaveLength(0);
    expect(screen.queryByText('Release queue')).not.toBeInTheDocument();
    expect(screen.queryByText('Tenders awaiting publication')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Tender')).not.toBeInTheDocument();
    expect(screen.queryByText(/cannot view/i)).not.toBeInTheDocument();
    expect(requests.some((request) => request.path === '/api/v1/buyer/tenders')).toBe(false);
  });

  it('leaves out the publication queue when the server refuses the tender register', async () => {
    routes({
      [LIST]: data.publications(),
      [TENDERS]: () => problem(403, 'Forbidden', { code: 'FORBIDDEN' }),
    });
    renderWithProviders(<PublicationRegisterPage />, { state: buyerState() });

    expect(await screen.findAllByText('T-2026-0002')).not.toHaveLength(0);
    await waitFor(() => expect(screen.queryByText('Release queue')).not.toBeInTheDocument());
    expect(screen.queryByText('Tenders awaiting publication')).not.toBeInTheDocument();
  });
});
