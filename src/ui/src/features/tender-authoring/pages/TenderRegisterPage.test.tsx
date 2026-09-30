import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import { list } from '../test/data';
import { API, EVALUATOR, OFFICER, renderPage } from '../test/helpers';
import TenderRegisterPage from './TenderRegisterPage';

describe('TenderRegisterPage (BUY-07)', () => {
  it('lists tenders with status, value, official deadline and source request when loaded', async () => {
    installFetch({ [`GET ${API}`]: () => ({ body: list }) });

    renderPage(<TenderRegisterPage />, { route: '/buyer/tenders' });

    const table = await screen.findByRole('table', { name: 'Tender register' });
    const row = within(table).getByText('T-2026-0005').closest('tr') as HTMLElement;
    const cells = within(row);
    expect(cells.getByText('Awaiting release approval')).toBeInTheDocument();
    expect(cells.getByText('Release approval: Invalidated by change')).toBeInTheDocument();
    expect(cells.getByText('BWP 1,920,000')).toBeInTheDocument();
    expect(cells.getByText('PR-2026-0009')).toBeInTheDocument();
    expect(cells.getAllByText(/Africa\/Gaborone/).length).toBeGreaterThan(0);
  });

  it('shows the awaiting-approval KPI from the status counts when loaded', async () => {
    installFetch({ [`GET ${API}`]: () => ({ body: list }) });

    renderPage(<TenderRegisterPage />, { route: '/buyer/tenders' });

    await screen.findByRole('table', { name: 'Tender register' });
    const label = screen.getByText('Packages waiting for their release decision');
    const card = label.closest('.tiq-kpi') as HTMLElement;
    expect(within(card).getByText('1')).toBeInTheDocument();
  });

  it('sends the phase filter to the API when a phase is chosen', async () => {
    const { requests } = installFetch({ [`GET ${API}`]: () => ({ body: list }) });
    renderPage(<TenderRegisterPage />, { route: '/buyer/tenders' });
    await screen.findByRole('table', { name: 'Tender register' });

    await userEvent.selectOptions(screen.getByLabelText('Phase'), 'preparation');

    expect(requests.some((request) => request.search.includes('phase=preparation'))).toBe(true);
  });

  it('offers creation and stage linking to officers but not to evaluators', async () => {
    installFetch({ [`GET ${API}`]: () => ({ body: list }) });
    const officer = renderPage(<TenderRegisterPage />, {
      route: '/buyer/tenders',
      permissions: OFFICER,
    });
    expect(await screen.findByRole('link', { name: 'New tender' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Link stages' })).toBeInTheDocument();
    officer.unmount();

    renderPage(<TenderRegisterPage />, { route: '/buyer/tenders', permissions: EVALUATOR });
    await screen.findByRole('table', { name: 'Tender register' });
    expect(screen.queryByRole('link', { name: 'New tender' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Link stages' })).not.toBeInTheDocument();
  });

  it('shows the restricted state instead of rows when the API answers 403', async () => {
    installFetch({ [`GET ${API}`]: () => problem(403, 'Forbidden', { code: 'FORBIDDEN' }) });

    renderPage(<TenderRegisterPage />, { route: '/buyer/tenders' });

    expect((await screen.findAllByText('Restricted')).length).toBeGreaterThan(0);
  });

  it('shows the filtered empty state when no tender matches the search', async () => {
    installFetch({
      [`GET ${API}`]: (request) => ({
        body: request.search.includes('q=') ? { ...list, items: [], total: 0 } : list,
      }),
    });
    renderPage(<TenderRegisterPage />, { route: '/buyer/tenders' });
    await screen.findByRole('table', { name: 'Tender register' });

    await userEvent.type(screen.getByLabelText('Search'), 'zzz');

    expect(await screen.findByText('No tenders match these filters.')).toBeInTheDocument();
  });
});
