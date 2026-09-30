import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import {
  approvalRequested5,
  previewPublic5,
  previewSupplier5,
  release5,
  tender5,
} from '../test/data';
import { API, EVALUATOR, MANAGER, renderPage } from '../test/helpers';
import ReleaseReviewPage from './ReleaseReviewPage';

const PATH = '/buyer/tenders/:tenderId/release';
const ROUTE = '/buyer/tenders/5/release';

function routes() {
  return {
    [`GET ${API}/5`]: () => ({ body: tender5 }),
    [`GET ${API}/5/release-review`]: () => ({ body: release5 }),
    [`GET ${API}/5/preview`]: (request: { search: string }) => ({
      body: request.search.includes('public') ? previewPublic5 : previewSupplier5,
    }),
  };
}

describe('ReleaseReviewPage (BUY-13)', () => {
  it('shows the invalidated approval, its reason and the material changes (AC-06) when loaded', async () => {
    installFetch(routes());

    renderPage(<ReleaseReviewPage />, { route: ROUTE, path: PATH });

    const history = await screen.findByRole('list', { name: 'Approval history' });
    expect(within(history).getByText('Approval #31')).toBeInTheDocument();
    expect(
      within(history).getByText(/Lot 3 \(polyelectrolyte flocculant\) added/),
    ).toBeInTheDocument();
    expect(screen.getByText('Estimated framework value increased.')).toBeInTheDocument();
    expect(screen.getAllByText('Recorded for revision 2').length).toBe(3);
    expect(screen.getByText('Publication is blocked')).toBeInTheDocument();
  });

  it('requests approval of the exact revision and hash with a justification', async () => {
    const { requests } = installFetch({
      ...routes(),
      [`POST ${API}/5/release-approval`]: () => ({ status: 201, body: approvalRequested5 }),
    });
    renderPage(<ReleaseReviewPage />, { route: ROUTE, path: PATH });
    await screen.findByRole('list', { name: 'Approval history' });

    await userEvent.click(screen.getByRole('button', { name: 'Request release approval' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/draft revision 3/)).toBeInTheDocument();
    await userEvent.type(
      within(dialog).getByLabelText(/Justification/),
      'Lot 3 added; approve again.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Request release approval' }));

    expect(await screen.findByText('Release approval #900 is pending')).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'POST')?.body).toMatchObject({
      draftRevision: 3,
      contentHash: tender5.contentHash,
      justification: 'Lot 3 added; approve again.',
    });
  });

  it('shows the approval as pending everywhere once it is requested, never as still to request', async () => {
    // Arrange
    installFetch({
      ...routes(),
      [`POST ${API}/5/release-approval`]: () => ({ status: 201, body: approvalRequested5 }),
    });
    renderPage(<ReleaseReviewPage />, { route: ROUTE, path: PATH });
    await screen.findByRole('list', { name: 'Approval history' });
    expect(screen.getByText('No release approval covers revision 3.')).toBeInTheDocument();
    expect(
      screen.getByText('Release approval can be requested for the current revision.'),
    ).toBeInTheDocument();

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Request release approval' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Justification/), 'Ready.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Request release approval' }));
    await screen.findByText('Release approval #900 is pending');

    // Assert
    expect(
      screen.getByText('Release approval #900 for revision 3 is awaiting a decision.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Release approval #900 for this revision is awaiting a decision.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Release approval: Release approval #900 for revision 3 is pending.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('No release approval covers revision 3.')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Release approval can be requested for the current revision.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/request approval for revision 3/)).not.toBeInTheDocument();
    expect(
      screen.queryByText('Resolve the blocking items before requesting release approval.'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Request release approval' }),
    ).not.toBeInTheDocument();
  });

  it('names accepted languages and missing editions in words, not codes', async () => {
    installFetch(routes());

    renderPage(<ReleaseReviewPage />, { route: ROUTE, path: PATH });

    expect(await screen.findByText('Accepted languages: English, Setswana')).toBeInTheDocument();
    expect(screen.queryByText(/has no tn edition/)).not.toBeInTheDocument();
  });

  it('shows the business message when the package is not ready for approval', async () => {
    installFetch({
      ...routes(),
      [`POST ${API}/5/release-approval`]: () =>
        problem(409, 'Conflict', { code: 'RELEASE_NOT_READY' }),
    });
    renderPage(<ReleaseReviewPage />, { route: ROUTE, path: PATH });
    await screen.findByRole('list', { name: 'Approval history' });

    await userEvent.click(screen.getByRole('button', { name: 'Request release approval' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Justification/), 'Please approve.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Request release approval' }));

    expect(
      await within(dialog).findByText(
        'Resolve the blocking readiness items before requesting release approval.',
      ),
    ).toBeInTheDocument();
  });

  it('records a failed check only with a note and updates the checklist', async () => {
    const scope = release5.checks.find((row) => row.checkArea === 'scope');
    const { requests } = installFetch({
      ...routes(),
      [`PUT ${API}/5/release-checks/scope`]: () => ({
        body: {
          check: {
            ...scope,
            status: 'failed',
            note: 'Lot 3 quantities missing.',
            draftRevision: 3,
            coversCurrentRevision: true,
          },
          summary: release5.summary,
          gate: release5.gate,
        },
      }),
    });
    renderPage(<ReleaseReviewPage />, { route: ROUTE, path: PATH, permissions: MANAGER });
    await screen.findByRole('list', { name: 'Approval history' });

    await userEvent.click(screen.getByRole('button', { name: 'Record the Scope check' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText('Failed'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record check' }));
    expect(
      within(dialog).getByText('Explain a failed or not-applicable check.'),
    ).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/^Note/), 'Lot 3 quantities missing.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record check' }));

    expect(await screen.findByText('Lot 3 quantities missing.')).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'PUT')?.body).toEqual({
      draftRevision: 3,
      status: 'failed',
      note: 'Lot 3 quantities missing.',
    });
  });

  it('labels the notice terms of the supplier preview separately and states the pricing rules', async () => {
    installFetch(routes());

    renderPage(<ReleaseReviewPage />, { route: ROUTE, path: PATH });

    const currency = await screen.findByText('Currencies');
    const preview = within(screen.getByRole('tabpanel'));
    expect(currency.nextElementSibling).toHaveTextContent('BWP only');
    expect(preview.getByText('Procedure').nextElementSibling).toHaveTextContent('Open');
    expect(preview.getByText('Participation').nextElementSibling).toHaveTextContent('Open');
    expect(preview.getByText('Languages').nextElementSibling).toHaveTextContent(
      'English, Setswana',
    );
    expect(preview.queryByText('BWP (BWP)')).not.toBeInTheDocument();
    expect(preview.getAllByText('Discounts accepted').length).toBe(3);
    expect(preview.getAllByRole('list', { name: 'Accepted price entries' }).length).toBe(3);
  });

  it('switches the preview to the public view and lists what is withheld', async () => {
    installFetch(routes());
    renderPage(<ReleaseReviewPage />, { route: ROUTE, path: PATH });
    await screen.findByRole('list', { name: 'Approval history' });

    await userEvent.click(screen.getByRole('tab', { name: 'Public' }));

    const withheld = await screen.findByText(
      'Requirements, pricing schedules, evaluation rules and terms (participating suppliers only)',
    );
    expect(withheld).toBeInTheDocument();
  });

  it('offers no approval request or check recording to an evaluator', async () => {
    installFetch(routes());

    renderPage(<ReleaseReviewPage />, { route: ROUTE, path: PATH, permissions: EVALUATOR });

    await screen.findByRole('list', { name: 'Approval history' });
    expect(
      screen.queryByRole('button', { name: 'Request release approval' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Record the Scope check' }),
    ).not.toBeInTheDocument();
  });
});
