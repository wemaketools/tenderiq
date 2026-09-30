import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import { readiness5, team5, tender5 } from '../test/data';
import { API, EVALUATOR, renderPage } from '../test/helpers';
import TenderOverviewPage from './TenderOverviewPage';

const PATH = '/buyer/tenders/:tenderId';

function routes() {
  return {
    [`GET ${API}/5`]: () => ({ body: tender5 }),
    [`GET ${API}/5/team`]: () => ({ body: team5 }),
    [`GET ${API}/5/readiness`]: () => ({ body: readiness5 }),
  };
}

describe('TenderOverviewPage (BUY-08)', () => {
  it('shows the record context, the invalidated approval (AC-06) and the lots when loaded', async () => {
    installFetch(routes());

    renderPage(<TenderOverviewPage />, { route: '/buyer/tenders/5', path: PATH });

    const meta = await screen.findByTestId('tender-meta');
    expect(within(meta).getByText('T-2026-0005')).toBeInTheDocument();
    expect(within(meta).getByText('Draft revision 3')).toBeInTheDocument();
    expect(
      screen.getByText('Release approval #31 (revision 2) was invalidated by a material change'),
    ).toBeInTheDocument();
    expect(screen.getByText('Polyelectrolyte flocculant')).toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: 'Outstanding decisions before release' }),
    ).toBeInTheDocument();
  });

  it('distinguishes the blocked publication from the readiness warnings when loaded', async () => {
    installFetch(routes());

    renderPage(<TenderOverviewPage />, { route: '/buyer/tenders/5', path: PATH });

    expect(await screen.findByText('Publication is blocked')).toBeInTheDocument();
    expect(screen.getByText('No release approval covers revision 3.')).toBeInTheDocument();
    expect(screen.getByText('0 blocking')).toBeInTheDocument();
  });

  it('removes a team member only with a reason through the confirmation dialog', async () => {
    const member = team5.members.find((row) => row.teamRole !== 'owner');
    expect(member).toBeDefined();
    const { requests } = installFetch({
      ...routes(),
      [`POST ${API}/5/team/${member?.id}/remove`]: () => ({
        body: {
          member: { ...member, removedAt: '2026-09-30T08:00:00Z', removalReason: 'Moved' },
          newOwner: null,
        },
      }),
    });
    renderPage(<TenderOverviewPage />, { route: '/buyer/tenders/5', path: PATH });
    const table = await screen.findByRole('table', { name: 'Tender team' });
    const name = await within(table).findByText(member?.user.fullName ?? '');
    const row = name.closest('tr') as HTMLElement;

    await userEvent.click(within(row).getByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Remove' });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Moved to another project');
    await userEvent.click(confirm);

    const post = requests.find((request) => request.method === 'POST');
    expect(post?.body).toEqual({ reason: 'Moved to another project' });
  });

  it('hides the authoring actions from an evaluator', async () => {
    installFetch(routes());

    renderPage(<TenderOverviewPage />, {
      route: '/buyer/tenders/5',
      path: PATH,
      permissions: EVALUATOR,
    });

    await screen.findByTestId('tender-meta');
    expect(screen.queryByRole('button', { name: 'Edit details' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Assign' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save as template' })).not.toBeInTheDocument();
  });

  it('shows the not-found state when the tender belongs to no visible register', async () => {
    installFetch({ [`GET ${API}/77`]: () => problem(404, 'Not Found', { code: 'NOT_FOUND' }) });

    renderPage(<TenderOverviewPage />, { route: '/buyer/tenders/77', path: PATH });

    expect(
      await screen.findByText(
        'This tender does not exist in your organization or is not available to you.',
      ),
    ).toBeInTheDocument();
  });
});
