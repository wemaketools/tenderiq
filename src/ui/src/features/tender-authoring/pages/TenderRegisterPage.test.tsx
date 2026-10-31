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
    expect(table).not.toHaveClass('tiq-card');
    expect(table.closest('.tiq-datatable')).toHaveClass('tiq-datatable--plain');
  });

  it('keeps the exact status of every row, so closed-awaiting-opening and under assessment stay distinct', async () => {
    installFetch({ [`GET ${API}`]: () => ({ body: list }) });
    renderPage(<TenderRegisterPage />, { route: '/buyer/tenders' });

    const table = await screen.findByRole('table', { name: 'Tender register' });
    const labels = [...table.querySelectorAll('.tiq-status')].map(
      (element) =>
        element.querySelector(':scope > span:not(.tiq-status-dot)')?.firstChild?.textContent,
    );
    expect(labels).toEqual(
      expect.arrayContaining([
        'Closed / awaiting opening',
        'Under assessment',
        'Open',
        'Draft',
        'Award decision pending',
      ]),
    );
    expect(table.querySelectorAll('.tiq-status-dot').length).toBe(
      table.querySelectorAll('.tiq-status').length,
    );
  });

  it('shows the whole-register phase counts on the segmented control and the total below the table', async () => {
    installFetch({ [`GET ${API}`]: () => ({ body: list }) });

    renderPage(<TenderRegisterPage />, { route: '/buyer/tenders' });

    await screen.findByRole('table', { name: 'Tender register' });
    const tabs = screen.getByRole('tablist', { name: 'Phase' });
    const preparation = within(tabs).getByRole('tab', { name: /In preparation/ });
    // draft 1 + awaiting_release_approval 1 (+ ready 0) from statusCounts, not from the page.
    expect(preparation).toHaveTextContent(/In preparation\s*2$/);
    expect(within(tabs).getByRole('tab', { name: /^All/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText(`${list.total} tenders`)).toBeInTheDocument();
  });

  it('sends the phase filter to the API when a phase is chosen on the segmented control', async () => {
    const { requests } = installFetch({ [`GET ${API}`]: () => ({ body: list }) });
    renderPage(<TenderRegisterPage />, { route: '/buyer/tenders' });
    await screen.findByRole('table', { name: 'Tender register' });

    await userEvent.click(screen.getByRole('tab', { name: /In preparation/ }));

    expect(requests.some((request) => request.search.includes('phase=preparation'))).toBe(true);
    expect(screen.getByRole('tab', { name: /In preparation/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('keeps the advanced filters behind a disclosure that reports how many are active', async () => {
    const { requests } = installFetch({ [`GET ${API}`]: () => ({ body: list }) });
    renderPage(<TenderRegisterPage />, { route: '/buyer/tenders' });
    await screen.findByRole('table', { name: 'Tender register' });

    expect(screen.queryByLabelText('Procedure')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Owner')).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Filters' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.selectOptions(screen.getByLabelText('Procedure'), 'open');
    expect(requests.some((request) => request.search.includes('procedure=open'))).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Hide filters' }));
    expect(screen.queryByLabelText('Procedure')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filters (1 active)' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('offers stage linking to officers but not to evaluators', async () => {
    installFetch({ [`GET ${API}`]: () => ({ body: list }) });
    const officer = renderPage(<TenderRegisterPage />, {
      route: '/buyer/tenders',
      permissions: OFFICER,
    });
    expect(screen.getByRole('button', { name: 'Link stages' })).toBeInTheDocument();
    officer.unmount();

    renderPage(<TenderRegisterPage />, { route: '/buyer/tenders', permissions: EVALUATOR });
    await screen.findByRole('table', { name: 'Tender register' });
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
