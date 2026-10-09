import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { problem } from '../../../test/fetchMock';
import { LocationProbe, renderWithProviders } from '../../../test/render';
import { data, pageOf, routes, supplierState } from '../../publication/test/kit';
import DiscoveryPage from './DiscoveryPage';
import InvitationPage from './InvitationPage';
import InvitationsPage from './InvitationsPage';
import OpportunityLookupPage from './OpportunityLookupPage';
import OpportunityWorkspacePage from './OpportunityWorkspacePage';
import PursuitPage from './PursuitPage';
import PursuitsPage from './PursuitsPage';

const S = '/api/v1/supplier';

afterEach(() => {
  vi.unstubAllGlobals();
});

function discoveryRoutes() {
  return routes({
    [`GET ${S}/opportunities`]: data.opportunities(),
    [`GET ${S}/opportunity-filters`]: data.opportunityFilters(),
    [`GET ${S}/saved-searches`]: data.savedSearches(),
    [`GET ${S}/watchlist`]: data.watchlist(),
    [`GET ${S}/notice-subscriptions`]: data.subscriptions(),
  });
}

describe('DiscoveryPage (SUP-06)', () => {
  it('lists opportunities and says that a match is only a suggestion', async () => {
    discoveryRoutes();
    renderWithProviders(<DiscoveryPage />, { state: supplierState() });
    const table = await screen.findByRole('table', { name: 'Opportunities' });
    expect(await within(table).findAllByRole('link')).not.toHaveLength(0);
    expect(screen.getByText('Matches are suggestions')).toBeInTheDocument();
    expect(screen.getByText(/never guarantees eligibility/)).toBeInTheDocument();
  });

  it('shows the Watched tile and the Watchlist tab to a member who may read the watchlist', async () => {
    discoveryRoutes();
    renderWithProviders(<DiscoveryPage />, { state: supplierState() });
    expect(await screen.findByRole('tab', { name: /Watchlist/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Watched' })).toBeInTheDocument();
  });

  it('leaves out the Watched tile and the Watchlist tab when the server refuses the watchlist', async () => {
    routes({
      [`GET ${S}/opportunities`]: data.opportunities(),
      [`GET ${S}/opportunity-filters`]: data.opportunityFilters(),
      [`GET ${S}/saved-searches`]: data.savedSearches(),
      [`GET ${S}/watchlist`]: () => problem(403, 'Forbidden', { code: 'FORBIDDEN' }),
      [`GET ${S}/notice-subscriptions`]: data.subscriptions(),
    });
    renderWithProviders(<DiscoveryPage />, {
      state: supplierState(),
      route: '/supplier/opportunities?tab=watchlist',
    });
    expect(await screen.findByRole('table', { name: 'Opportunities' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('tab', { name: /Watchlist/ })).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole('region', { name: 'Watched' })).not.toBeInTheDocument();
  });

  it('does not query the watchlist for a member without opportunity access', async () => {
    const { requests } = discoveryRoutes();
    renderWithProviders(<DiscoveryPage />, { state: supplierState(['supplier.pursuit.manage']) });
    expect(await screen.findByRole('tablist')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Watchlist/ })).not.toBeInTheDocument();
    expect(requests.some((request) => request.path === `${S}/watchlist`)).toBe(false);
  });

  it('watches an opportunity through the API', async () => {
    const { requests } = routes({
      [`GET ${S}/opportunities`]: data.opportunities(),
      [`GET ${S}/opportunity-filters`]: data.opportunityFilters(),
      [`GET ${S}/saved-searches`]: data.savedSearches(),
      [`GET ${S}/watchlist`]: data.watchlist(),
      [`POST ${S}/watchlist`]: (request) => ({
        status: 201,
        body: {
          ...data.watchlist().items[0],
          id: 950,
          tender: data
            .opportunities()
            .items.find(
              (row) => row.tender.tenderId === (request.body as { tenderId: number }).tenderId,
            )?.tender,
        },
      }),
      ...Object.fromEntries(
        data
          .opportunities()
          .items.filter((row) => row.watchlistItemId !== null)
          .map((row) => [
            `DELETE ${S}/watchlist/${row.watchlistItemId ?? 0}`,
            () => ({ status: 204 }),
          ]),
      ),
    });
    renderWithProviders(<DiscoveryPage />, { state: supplierState() });
    const watch = await screen.findAllByRole('button', { name: /^(Watch|Unwatch) T-/ });
    await userEvent.click(watch[0] as HTMLElement);
    await waitFor(() =>
      expect(
        requests.some(
          (request) =>
            (request.method === 'POST' || request.method === 'DELETE') &&
            request.path.startsWith(`${S}/watchlist`),
        ),
      ).toBe(true),
    );
  });

  it('lists a dismissed suggestion again through "Show again"', async () => {
    const listed = data.opportunities();
    const first = listed.items[0];
    if (first === undefined) throw new Error('The recorded discovery list is empty.');
    const tenderId = first.tender.tenderId;
    const { requests } = routes({
      [`GET ${S}/opportunities`]: {
        ...listed,
        items: [{ ...first, dismissed: true, participation: null }],
      },
      [`GET ${S}/opportunity-filters`]: data.opportunityFilters(),
      [`GET ${S}/saved-searches`]: data.savedSearches(),
      [`GET ${S}/watchlist`]: data.watchlist(),
      [`DELETE ${S}/opportunities/${tenderId}/dismiss`]: {
        tenderId,
        dismissed: false,
        restoredAt: '2026-09-30T08:00:00Z',
      },
    });
    renderWithProviders(<DiscoveryPage />, { state: supplierState() });
    await userEvent.click(await screen.findByLabelText('Include dismissed'));
    const restore = await screen.findByRole('button', {
      name: `Show ${first.tender.reference} again`,
    });
    await userEvent.click(restore);
    expect(
      await screen.findByText(`${first.tender.reference} is listed in your suggestions again.`),
    ).toBeInTheDocument();
    expect(
      requests.some(
        (request) =>
          request.method === 'DELETE' && request.path === `${S}/opportunities/${tenderId}/dismiss`,
      ),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: `Dismiss ${first.tender.reference}` }),
    ).toBeInTheDocument();
  });

  it('shows the subscriptions tab from the URL and pauses a subscription', async () => {
    const subscription = data.subscriptions().items[0];
    const { requests } = routes({
      [`GET ${S}/opportunities`]: data.opportunities(),
      [`GET ${S}/opportunity-filters`]: data.opportunityFilters(),
      [`GET ${S}/saved-searches`]: data.savedSearches(),
      [`GET ${S}/watchlist`]: data.watchlist(),
      [`GET ${S}/notice-subscriptions`]: data.subscriptions(),
      [`PUT ${S}/notice-subscriptions/${subscription?.id ?? 0}`]: {
        ...subscription,
        active: false,
      },
    });
    renderWithProviders(<DiscoveryPage />, {
      state: supplierState(),
      route: '/supplier/opportunities?tab=subscriptions',
    });
    const table = await screen.findByRole('table', { name: 'Notice subscriptions' });
    await userEvent.click(
      (await within(table).findAllByRole('button', { name: 'Pause' }))[0] as HTMLElement,
    );
    await waitFor(() =>
      expect(requests.find((request) => request.method === 'PUT')?.body).toEqual({ active: false }),
    );
  });

  it('validates a saved search that has no filter', async () => {
    discoveryRoutes();
    renderWithProviders(<DiscoveryPage />, {
      state: supplierState(),
      route: '/supplier/opportunities?tab=searches',
    });
    await userEvent.click(await screen.findByRole('button', { name: 'New saved search' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/^Name/), 'Pumps');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save search' }));
    expect(
      await within(dialog).findByText('Add at least one keyword or filter.'),
    ).toBeInTheDocument();
  });

  it('shows the empty state', async () => {
    routes({
      [`GET ${S}/opportunities`]: pageOf([]),
      [`GET ${S}/opportunity-filters`]: data.opportunityFilters(),
      [`GET ${S}/saved-searches`]: pageOf([]),
      [`GET ${S}/watchlist`]: pageOf([]),
    });
    renderWithProviders(<DiscoveryPage />, { state: supplierState() });
    expect(await screen.findByText('No opportunity to show')).toBeInTheDocument();
  });
});

describe('InvitationsPage and InvitationPage (SUP-07)', () => {
  it('lists invitations and access requests awaiting an answer', async () => {
    routes({
      [`GET ${S}/invitations`]: data.invitations(),
      [`GET ${S}/opportunity-filters`]: data.opportunityFilters(),
    });
    renderWithProviders(<InvitationsPage />, { state: supplierState() });
    const table = await screen.findByRole('table', { name: 'Invitations and access requests' });
    expect(await within(table).findByText('T-2026-0002')).toBeInTheDocument();
    expect(within(table).getByText('Awaiting response')).toBeInTheDocument();
  });

  it('states the invitation expiry in the buyer’s official time (DD-33)', async () => {
    routes({
      [`GET ${S}/invitations`]: data.invitations(),
      [`GET ${S}/opportunity-filters`]: data.opportunityFilters(),
    });
    renderWithProviders(<InvitationsPage />, { state: supplierState() });
    const table = await screen.findByRole('table', { name: 'Invitations and access requests' });
    expect(
      await within(table).findByText('Expires 9 Oct 2026, 17:00 (UTC+02:00) Africa/Gaborone'),
    ).toBeInTheDocument();
  });

  it('accepts an invitation for the named legal supplier', async () => {
    const detail = data.invitation206();
    const { requests } = routes({
      [`GET ${S}/invitations/206`]: detail,
      [`POST ${S}/invitations/206/accept`]: {
        ...detail,
        invitationStatus: 'accepted',
        awaitingResponse: false,
        capabilities: { canRespond: false, canAcceptConfidentiality: false },
      },
    });
    renderWithProviders(<InvitationPage />, {
      state: supplierState(['supplier.opportunities.view', 'supplier.notices.acknowledge']),
      route: '/supplier/invitations/206',
      path: '/supplier/invitations/:participantId',
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Accept invitation' }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getAllByText(/Makgadikgadi Civil Works \(Pty\) Ltd/).length,
    ).toBeGreaterThan(0);
    await userEvent.click(within(dialog).getByLabelText(/I accept for/));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Accept invitation' }));
    await waitFor(() =>
      expect(requests.find((request) => request.path.endsWith('/accept'))?.body).toEqual({
        confirmLegalSupplier: true,
        acceptConfidentiality: false,
      }),
    );
    expect(await screen.findByText('Invitation for T-2026-0002 accepted.')).toBeInTheDocument();
  });

  it('follows an access request without a link to an event the organization may not see', async () => {
    routes({
      [`GET ${S}/invitations/206`]: {
        ...data.invitation206(),
        kind: 'access_request',
        invitationStatus: 'not_invited',
        accessStatus: 'requested',
        opportunityPath: null,
      },
    });
    renderWithProviders(<InvitationPage />, {
      state: supplierState(['supplier.opportunities.view', 'supplier.notices.acknowledge']),
      route: '/supplier/invitations/206',
      path: '/supplier/invitations/:participantId',
    });
    expect((await screen.findAllByText('T-2026-0002')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Open the opportunity' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'T-2026-0002' })).not.toBeInTheDocument();
  });

  it('declines while sharing a reason only when chosen', async () => {
    const detail = data.invitation206();
    const { requests } = routes({
      [`GET ${S}/invitations/206`]: detail,
      [`POST ${S}/invitations/206/decline`]: {
        ...detail,
        invitationStatus: 'declined',
        awaitingResponse: false,
        sharedNoBidReason: 'No capacity.',
      },
    });
    renderWithProviders(<InvitationPage />, {
      state: supplierState(['supplier.opportunities.view', 'supplier.notices.acknowledge']),
      route: '/supplier/invitations/206',
      path: '/supplier/invitations/:participantId',
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Decline invitation' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText('Share a reason with the buyer'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Decline invitation' }));
    expect(
      await within(dialog).findByText('Enter the reason to share, or untick the option.'),
    ).toBeInTheDocument();
    await userEvent.type(
      within(dialog).getByLabelText(/Reason shared with the buyer/),
      'No capacity.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Decline invitation' }));
    await waitFor(() =>
      expect(requests.find((request) => request.path.endsWith('/decline'))?.body).toEqual({
        shareReasonWithBuyer: true,
        sharedReason: 'No capacity.',
      }),
    );
  });

  it('shows a member without authority to answer neither the answer actions nor a role notice', async () => {
    routes({ [`GET ${S}/invitations/206`]: data.invitation206() });
    renderWithProviders(<InvitationPage />, {
      state: supplierState(['supplier.opportunities.view']),
      route: '/supplier/invitations/206',
      path: '/supplier/invitations/:participantId',
    });
    expect(await screen.findAllByText(data.invitation206().buyer.name)).not.toHaveLength(0);
    expect(screen.queryByText(/representative must answer/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Your role cannot/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept invitation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Decline invitation' })).not.toBeInTheDocument();
  });
});

describe('OpportunityWorkspacePage (SUP-08)', () => {
  function render() {
    return renderWithProviders(<OpportunityWorkspacePage />, {
      state: supplierState(),
      route: '/supplier/opportunities/6',
      path: '/supplier/opportunities/:tenderId',
      routes: [{ path: '/supplier/responses', element: <LocationProbe label="responses" /> }],
    });
  }

  it('shows readiness, documents, sessions and the privacy statement', async () => {
    routes({ [`GET ${S}/opportunities/6`]: data.workspace6() });
    render();
    expect(
      await screen.findByText('Participation readiness', { selector: 'h2' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Your pursuit, drafts and preparation progress are private/),
    ).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Tender documents' })).toBeInTheDocument();
    expect(screen.getAllByText('Mandatory').length).toBeGreaterThan(0);
  });

  it('moves to response preparation when participation is ready', async () => {
    routes({
      [`GET ${S}/opportunities/6`]: data.workspace6(),
      [`POST ${S}/opportunities/6/start-response`]: {
        tenderId: 6,
        participantId: 604,
        readiness: data.workspace6().readiness,
        nextPath: '/supplier/responses?tenderId=6',
      },
    });
    render();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Move to response preparation' }),
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Move to response preparation' }),
    );
    expect(await screen.findByTestId('location-probe')).toHaveTextContent('responses');
  });

  it('shows the blockers when readiness blocks the response', async () => {
    routes({
      [`GET ${S}/opportunities/6`]: data.workspace6(),
      [`POST ${S}/opportunities/6/start-response`]: () =>
        problem(409, 'Conflict', {
          code: 'READINESS_BLOCKED',
          detail: 'Resolve first: Addenda acknowledged.',
        }),
    });
    render();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Move to response preparation' }),
    );
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Move to response preparation',
      }),
    );
    expect(await screen.findByText('Response preparation cannot start yet')).toBeInTheDocument();
    expect(screen.getByText(/Resolve first: Addenda acknowledged./)).toBeInTheDocument();
  });

  function render11() {
    return renderWithProviders(<OpportunityWorkspacePage />, {
      state: supplierState(),
      route: '/supplier/opportunities/11',
      path: '/supplier/opportunities/:tenderId',
    });
  }

  it('selects the eligible lots and saves the selection (T-2026-0011)', async () => {
    const { requests } = routes({
      [`GET ${S}/opportunities/11`]: data.workspace11(),
      [`PUT ${S}/opportunities/11/lots`]: (request) => ({
        body: {
          participantId: 1105,
          selectedLotIds: (request.body as { lotIds: number[] }).lotIds,
          updatedAt: '2026-09-30T08:00:00Z',
        },
      }),
    });
    render11();
    await userEvent.click(await screen.findByLabelText('Select lot 1'));
    await userEvent.click(screen.getByLabelText('Select lot 2'));
    expect(screen.getByText('Unsaved lot selection')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save lot selection' }));

    expect(await screen.findByText('2 lots selected.')).toBeInTheDocument();
    const saved = requests.find((request) => request.path === `${S}/opportunities/11/lots`);
    expect(saved?.body).toEqual({ lotIds: [1101, 1102] });
  });

  it('accepts the confidentiality undertaking of the restricted floor plans', async () => {
    const workspace = data.workspace11();
    const { requests } = routes({
      [`GET ${S}/opportunities/11`]: workspace,
      [`POST ${S}/opportunities/11/confidentiality`]: {
        ...workspace.participation,
        confidentialityAcceptedAt: '2026-09-30T08:00:00Z',
      },
    });
    render11();
    expect(
      (await screen.findAllByText('Accept the confidentiality undertaking to open this document.'))
        .length,
    ).toBeGreaterThan(0);
    await userEvent.click(
      (await screen.findAllByRole('button', { name: 'Accept confidentiality' }))[0] as HTMLElement,
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText(/I accept this undertaking/));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Accept confidentiality' }));

    expect(await screen.findByText('Confidentiality undertaking accepted.')).toBeInTheDocument();
    expect(requests.some((request) => request.path.endsWith('/11/confidentiality'))).toBe(true);
  });

  it('states the session registration cut-off in official time (DD-33)', async () => {
    routes({ [`GET ${S}/opportunities/11`]: data.workspace11() });
    render11();
    const cutOff = await screen.findByText(
      (_content, element) =>
        element?.classList.contains('tiq-cell-sub') === true &&
        (element.textContent ?? '').startsWith(
          'Register by 13 Oct 2026, 15:00 (UTC+02:00) Africa/Gaborone',
        ),
    );
    expect(within(cutOff).getByTestId('official-deadline')).toBeInTheDocument();
  });

  it('links questions and briefings only when the organization takes part in the clarification channel', async () => {
    routes({ [`GET ${S}/opportunities/6`]: data.workspace6() });
    render();
    expect(
      await screen.findByRole('link', { name: 'Questions and clarifications' }),
    ).toHaveAttribute('href', '/supplier/clarifications/tenders/6');
    expect(screen.queryByText('Questions and briefings')).not.toBeInTheDocument();
  });

  it('shows the restricted note instead of dead question and briefing links for a non-member', async () => {
    const workspace = data.workspace11();
    routes({ [`GET ${S}/opportunities/11`]: workspace });
    render11();
    expect(await screen.findByText('Questions and briefings')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Questions and clarifications' }),
    ).not.toBeInTheDocument();
    for (const session of workspace.sessions) {
      expect(screen.getByText(session.title)).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: session.title })).not.toBeInTheDocument();
    }
  });

  it('answers an unavailable opportunity with the not-found state', async () => {
    routes({
      [`GET ${S}/opportunities/6`]: () =>
        problem(404, 'Not Found', { code: 'OPPORTUNITY_NOT_FOUND' }),
    });
    render();
    expect(await screen.findAllByText('Opportunity not found')).not.toHaveLength(0);
  });
});

describe('PursuitPage and PursuitsPage (SUP-09)', () => {
  function render(permissions?: Parameters<typeof supplierState>[0]) {
    return renderWithProviders(<PursuitPage />, {
      state: supplierState(permissions),
      route: '/supplier/opportunities/6/pursuit',
      path: '/supplier/opportunities/:tenderId/pursuit',
    });
  }

  it('separates the private assessment and decision from what the buyer sees', async () => {
    routes({
      [`GET ${S}/opportunities/6/pursuit`]: data.pursuit6(),
      [`GET ${S}/pursuit-team-candidates`]: data.teamCandidates(),
    });
    render();
    expect(await screen.findByText('Assessment (private)')).toBeInTheDocument();
    // A decision is recorded (bid): the assessment is not labelled "not decided".
    expect(screen.getByText('Saved; decision recorded')).toBeInTheDocument();
    expect(screen.queryByText('Saved, not decided')).not.toBeInTheDocument();
    expect(screen.getByText('Decision (private)')).toBeInTheDocument();
    expect(screen.getByText('Shared with the buyer')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Pursuit team' })).toBeInTheDocument();
  });

  it('labels an undecided assessment as saved but not decided', async () => {
    const view = data.pursuit6();
    routes({
      [`GET ${S}/opportunities/6/pursuit`]: {
        ...view,
        pursuit:
          view.pursuit === null
            ? null
            : { ...view.pursuit, decision: 'undecided', decidedAt: null, decidedBy: null },
      },
      [`GET ${S}/pursuit-team-candidates`]: data.teamCandidates(),
    });
    render();
    expect(await screen.findByText('Saved, not decided')).toBeInTheDocument();
    expect(screen.queryByText('Saved; decision recorded')).not.toBeInTheDocument();
  });

  it('changes the buyer-visible intent only through "Tell the buyer" (DD-41)', async () => {
    const { requests } = routes({
      [`GET ${S}/opportunities/6/pursuit`]: data.pursuit6(),
      [`GET ${S}/pursuit-team-candidates`]: data.teamCandidates(),
      [`POST ${S}/opportunities/6/pursuit/notify-buyer`]: {
        participantId: 604,
        bidIntent: 'no_bid',
        sharedNoBidReason: 'Capacity committed elsewhere.',
        intentChangedAt: '2026-09-30T08:00:00Z',
      },
    });
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Tell the buyer' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText(/^no.?bid$/i));
    await userEvent.click(within(dialog).getByLabelText('Share a no-bid reason'));
    await userEvent.type(
      within(dialog).getByLabelText(/Reason shared with the buyer/),
      'Capacity committed elsewhere.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tell the buyer' }));
    await waitFor(() =>
      expect(requests.find((request) => request.path.endsWith('/notify-buyer'))?.body).toEqual({
        bidIntent: 'no_bid',
        sharedNoBidReason: 'Capacity committed elsewhere.',
      }),
    );
    expect(await screen.findByText('Capacity committed elsewhere.')).toBeInTheDocument();
  });

  it('saves the assessment privately', async () => {
    const pursuit = data.pursuit6();
    const { requests } = routes({
      [`GET ${S}/opportunities/6/pursuit`]: pursuit,
      [`GET ${S}/pursuit-team-candidates`]: data.teamCandidates(),
      [`PUT ${S}/opportunities/6/pursuit`]: { ...pursuit.pursuit, risks: 'Updated risks.' },
    });
    render();
    const risks = await screen.findByLabelText('Internal risks');
    await userEvent.clear(risks);
    await userEvent.type(risks, 'Updated risks.');
    await userEvent.click(screen.getByRole('button', { name: 'Save assessment' }));
    await waitFor(() =>
      expect(requests.find((request) => request.method === 'PUT')?.body).toMatchObject({
        risks: 'Updated risks.',
      }),
    );
    expect(await screen.findByText('Pursuit assessment saved (private).')).toBeInTheDocument();
  });

  it('shows no change actions and no role notice without supplier.pursuit.manage', async () => {
    routes({ [`GET ${S}/opportunities/6/pursuit`]: data.pursuit6() });
    render(['supplier.opportunities.view']);
    expect(await screen.findByText('Private to your organization')).toBeInTheDocument();
    expect(screen.queryByText(/Your role can read/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tell the buyer' })).not.toBeInTheDocument();
  });

  it('lists pursuits with the private decision and the shared intent', async () => {
    routes({ [`GET ${S}/pursuits`]: data.pursuits() });
    renderWithProviders(<PursuitsPage />, { state: supplierState() });
    const table = await screen.findByRole('table', { name: 'Pursuits' });
    expect(await within(table).findAllByText('Bid')).not.toHaveLength(0);
  });

  it('shows the pursuits empty state', async () => {
    routes({ [`GET ${S}/pursuits`]: pageOf([]) });
    renderWithProviders(<PursuitsPage />, { state: supplierState() });
    expect(await screen.findByText('No pursuit yet')).toBeInTheDocument();
  });
});

describe('OpportunityLookupPage', () => {
  it('continues from a public notice to the supplier workspace', async () => {
    routes({ [`GET ${S}/opportunities`]: data.opportunities() });
    const first = data.opportunities().items[0];
    renderWithProviders(<OpportunityLookupPage />, {
      state: supplierState(),
      route: `/supplier/opportunities/find/${first?.buyer.slug ?? ''}/${first?.tender.reference ?? ''}`,
      path: '/supplier/opportunities/find/:buyerSlug/:ref',
      routes: [
        { path: '/supplier/opportunities/:tenderId', element: <LocationProbe label="workspace" /> },
      ],
    });
    expect(await screen.findByTestId('location-probe')).toHaveTextContent('workspace');
  });

  it('explains a notice that is not available to the organization', async () => {
    routes({ [`GET ${S}/opportunities`]: pageOf([]) });
    renderWithProviders(<OpportunityLookupPage />, {
      state: supplierState(),
      route: '/supplier/opportunities/find/kwu/T-2026-0099',
      path: '/supplier/opportunities/find/:buyerSlug/:ref',
    });
    expect(
      await screen.findByText('This notice is not available to your organization'),
    ).toBeInTheDocument();
  });
});
