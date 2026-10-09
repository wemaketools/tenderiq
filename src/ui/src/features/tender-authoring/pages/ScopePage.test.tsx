import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import { lots5, requirements5, tender5 } from '../test/data';
import { API, changeImpact, renderPage } from '../test/helpers';
import ScopePage from './ScopePage';

const PATH = '/buyer/tenders/:tenderId/scope';
const ROUTE = '/buyer/tenders/5/scope';

function routes() {
  return {
    [`GET ${API}/5`]: () => ({ body: tender5 }),
    [`GET ${API}/5/lots`]: () => ({ body: lots5 }),
    [`GET ${API}/5/requirements`]: () => ({ body: requirements5 }),
    [`GET ${API}/5/team-candidates`]: () => ({
      body: { teamRole: 'observer', requiredPermission: 'tender.view', candidates: [] },
    }),
    [`GET ${API}/5/evaluation-plans`]: () => problem(403, 'Forbidden', { code: 'FORBIDDEN' }),
  };
}

describe('ScopePage (BUY-09)', () => {
  it('shows lots, requirement treatment, envelope and the ownership KPIs when loaded', async () => {
    installFetch(routes());

    renderPage(<ScopePage />, { route: ROUTE, path: PATH });

    const table = await screen.findByRole('table', { name: 'Requirements of the tender' });
    expect(await within(table).findByText('REQ-Q-01')).toBeInTheDocument();
    expect(within(table).getAllByText('Mandatory gate').length).toBeGreaterThan(0);
    expect(screen.getByRole('table', { name: 'Lots' })).toBeInTheDocument();
    const missing = screen
      .getByText('Every requirement needs an owner')
      .closest('.tiq-kpi') as HTMLElement;
    expect(within(missing).getByText('0')).toBeInTheDocument();
  });

  it('shows the lot and a real applicability statement under each lot-bound requirement', async () => {
    installFetch(routes());

    renderPage(<ScopePage />, { route: ROUTE, path: PATH });

    const table = await screen.findByRole('table', { name: 'Requirements of the tender' });
    expect(
      await within(table).findByText(
        'Lot 2 · Calcium hypochlorite (HTH granules) · Where the bidder holds stock in Botswana',
      ),
    ).toBeInTheDocument();
    expect(within(table).queryByText(/· Lot \d$/)).not.toBeInTheDocument();
  });

  it('leaves out the lots and requirements panels, without querying them, for a membership that cannot read them', async () => {
    const { requests } = installFetch(routes());

    renderPage(<ScopePage />, { route: ROUTE, path: PATH, permissions: ['tender.edit'] });

    await screen.findByTestId('tender-meta');
    expect(screen.queryByRole('table', { name: 'Lots' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('table', { name: 'Requirements of the tender' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Every requirement needs an owner')).not.toBeInTheDocument();
    expect(requests.some((request) => request.path.endsWith('/lots'))).toBe(false);
    expect(requests.some((request) => request.path.endsWith('/requirements'))).toBe(false);
  });

  it('leaves out the lots panel when the server refuses the lots', async () => {
    installFetch({
      ...routes(),
      [`GET ${API}/5/lots`]: () => problem(403, 'Forbidden', { code: 'FORBIDDEN' }),
    });

    renderPage(<ScopePage />, { route: ROUTE, path: PATH });

    expect(
      await screen.findByRole('table', { name: 'Requirements of the tender' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('table', { name: 'Lots' })).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(/restricted/i)).not.toBeInTheDocument();
  });

  it('filters on contradictions when the issue filter is chosen', async () => {
    const { requests } = installFetch(routes());
    renderPage(<ScopePage />, { route: ROUTE, path: PATH });
    await screen.findByRole('table', { name: 'Requirements of the tender' });

    await userEvent.selectOptions(screen.getByLabelText('Issues'), 'contradiction');

    expect(requests.some((request) => request.search.includes('issue=contradiction'))).toBe(true);
  });

  it('adds a lot and reports the material change and the invalidated approval', async () => {
    const { requests } = installFetch({
      ...routes(),
      [`POST ${API}/5/lots`]: () => ({
        status: 201,
        body: {
          lot: { ...lots5.lots[0], id: 900, lotNo: 4, title: 'Ferric chloride' },
          change: changeImpact(true),
        },
      }),
    });
    renderPage(<ScopePage />, { route: ROUTE, path: PATH });
    await screen.findByRole('table', { name: 'Lots' });

    await userEvent.click(screen.getByRole('button', { name: 'Add lot' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/^Title/), 'Ferric chloride');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save draft' }));

    expect(
      await screen.findByText('Material change saved: the package is now draft revision 4'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('approval-invalidated')).toBeInTheDocument();
    expect(screen.getByText('Ferric chloride')).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'POST')?.body).toMatchObject({
      title: 'Ferric chloride',
    });
  });

  it('shows the contract message when the reference code is already taken', async () => {
    installFetch({
      ...routes(),
      [`POST ${API}/5/requirements`]: () => problem(409, 'Conflict', { code: 'REF_CODE_TAKEN' }),
    });
    renderPage(<ScopePage />, { route: ROUTE, path: PATH });
    await screen.findByRole('table', { name: 'Requirements of the tender' });

    await userEvent.click(
      screen.getAllByRole('button', { name: 'Add requirement' })[0] as HTMLElement,
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/^Reference/), 'REQ-Q-01');
    await userEvent.type(within(dialog).getByLabelText(/^Section/), 'Qualification');
    await userEvent.type(within(dialog).getByLabelText(/^Requirement/), 'Duplicate requirement');
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Response type/), 'text');
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Treatment/), 'information_only');
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Envelope/), 'technical');
    await userEvent.selectOptions(
      within(dialog).getByLabelText(/^If the answer is missing/),
      'warning',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save draft' }));

    expect(
      await within(dialog).findByText('Another requirement already uses this reference.'),
    ).toBeInTheDocument();
  });
});
