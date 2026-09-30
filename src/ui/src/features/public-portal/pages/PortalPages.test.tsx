import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { data, pageOf, routes, supplierState } from '../../publication/test/kit';
import BuyerPortalPage from './BuyerPortalPage';
import GuidanceArticlePage from './GuidanceArticlePage';
import GuidancePage from './GuidancePage';
import NoticePage from './NoticePage';
import OpportunitySearchPage from './OpportunitySearchPage';
import PortalHomePage from './PortalHomePage';

const P = '/api/v1/public';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PortalHomePage (PUB-01)', () => {
  it('shows buyers, open opportunities, future notices, outcomes and guidance without an account', async () => {
    routes({ [`GET ${P}/portal`]: data.portalHome() });
    renderWithProviders(<PortalHomePage />);

    expect(await screen.findByText('Smart water meter supply')).toBeInTheDocument();
    expect(
      screen.getByText('Okavango District Council', { selector: 'h3 *, h3' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Forecasts may change and are not invitations to submit a bid.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Reservoir rehabilitation works')).toBeInTheDocument();
    expect(screen.getByLabelText('Portal language')).toHaveValue('en');
    expect(screen.getAllByRole('link', { name: /Register your organization/ })).not.toHaveLength(0);
  });

  it('labels an intention to award and collected information as such, not as award decisions', async () => {
    routes({ [`GET ${P}/portal`]: data.portalHome() });
    renderWithProviders(<PortalHomePage />);
    expect(
      await screen.findByText(
        'Kalahari Water Utilities (Pilot) · intention to award issued 25 Sep 2026',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Kalahari Water Utilities (Pilot) · information collected 30 Jun 2026'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Kalahari Water Utilities (Pilot) · decided 12 Jun 2026'),
    ).toBeInTheDocument();
    expect(screen.getByText('Released outcomes')).toBeInTheDocument();
    expect(screen.queryByText('Released award decisions')).not.toBeInTheDocument();
  });

  it('never lists the invitation-only tender (AC-01)', async () => {
    routes({ [`GET ${P}/portal`]: data.portalHome() });
    renderWithProviders(<PortalHomePage />);
    await screen.findByText('Smart water meter supply');
    expect(screen.queryByText(/T-2026-0006/)).not.toBeInTheDocument();
    expect(screen.queryByText('Chlorine dosing equipment')).not.toBeInTheDocument();
  });

  it('shows an error state when the portal cannot be loaded', async () => {
    routes({ [`GET ${P}/portal`]: () => problem(500, 'Internal Server Error') });
    renderWithProviders(<PortalHomePage />);
    expect(await screen.findByText('The portal could not be loaded')).toBeInTheDocument();
  });
});

describe('BuyerPortalPage (PUB-01 buyer home)', () => {
  it('shows the buyer identity, its open notices and its participation guidance', async () => {
    routes({ [`GET ${P}/buyers/kwu`]: data.buyerPortal() });
    renderWithProviders(<BuyerPortalPage />, { route: '/b/kwu', path: '/b/:buyerSlug' });
    expect(await screen.findByText('Kalahari Water Utilities Corporation')).toBeInTheDocument();
    expect(screen.getByText('Taking part in a KWU procurement')).toBeInTheDocument();
    expect(screen.getByText('Smart water meter supply')).toBeInTheDocument();
  });

  it('explains an unavailable portal', async () => {
    routes({
      [`GET ${P}/buyers/nobody`]: () => problem(404, 'Not Found', { code: 'PORTAL_NOT_AVAILABLE' }),
    });
    renderWithProviders(<BuyerPortalPage />, { route: '/b/nobody', path: '/b/:buyerSlug' });
    expect(await screen.findAllByText('Portal not available')).not.toHaveLength(0);
  });
});

describe('OpportunitySearchPage (PUB-02)', () => {
  it('labels closed notices explicitly and counts only public notices in the filters', async () => {
    routes({
      [`GET ${P}/opportunities`]: data.publicSearch(),
      [`GET ${P}/opportunity-filters`]: data.publicFilters(),
    });
    renderWithProviders(<OpportunitySearchPage />);

    const table = await screen.findByRole('table', { name: 'Public notices' });
    expect(await within(table).findByText('T-2026-0008')).toBeInTheDocument();
    expect(within(table).getAllByText('Closed: not accepting responses').length).toBeGreaterThan(0);
    expect(within(table).queryByText('T-2026-0006')).not.toBeInTheDocument();
    expect(screen.getByText('8 notices')).toBeInTheDocument();
  });

  it('sends the chosen filter and keeps it in the URL', async () => {
    const { requests } = routes({
      [`GET ${P}/opportunities`]: data.publicSearch(),
      [`GET ${P}/opportunity-filters`]: data.publicFilters(),
    });
    const { router } = renderWithProviders(<OpportunitySearchPage />);
    await screen.findByRole('table', { name: 'Public notices' });
    const buyer = screen.getByLabelText('Buyer');
    await waitFor(() => expect(within(buyer).getAllByRole('option').length).toBeGreaterThan(1));
    await userEvent.selectOptions(buyer, 'odc');
    await waitFor(() =>
      expect(requests.some((request) => request.search.includes('buyer=odc'))).toBe(true),
    );
    expect(router.state.location.search).toContain('buyer=odc');
  });

  it('routes a signed-in supplier to its subscriptions', async () => {
    routes({
      [`GET ${P}/opportunities`]: pageOf([]),
      [`GET ${P}/opportunity-filters`]: data.publicFilters(),
    });
    renderWithProviders(<OpportunitySearchPage />, { state: supplierState() });
    expect(await screen.findByText('No public notice yet')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Manage subscriptions for Tsodilo Engineering/ }),
    ).toHaveAttribute('href', '/supplier/opportunities?tab=subscriptions');
  });
});

describe('NoticePage (PUB-03)', () => {
  const NOTICE = `${P}/opportunities/kwu/T-2026-0002`;

  function render() {
    return renderWithProviders(<NoticePage />, {
      route: '/opportunities/kwu/T-2026-0002',
      path: '/opportunities/:buyerSlug/:ref',
    });
  }

  it('shows scope, official deadlines, documents and the amendment history prominently', async () => {
    routes({ [`GET ${NOTICE}`]: data.publicNotice() });
    render();
    expect(await screen.findByText('Amended by 1 addendum')).toBeInTheDocument();
    expect(screen.getByText('Amendment history (1 addendum)')).toBeInTheDocument();
    expect(screen.getAllByTestId('official-deadline').length).toBeGreaterThan(1);
    expect(screen.getByRole('table', { name: 'Tender documents' })).toBeInTheDocument();
    expect(
      screen.getByText('2 further documents are available after access is granted.'),
    ).toBeInTheDocument();
  });

  it('offers restricted access on a notice with an eligibility review and lists its lots (T-2026-0011)', async () => {
    const notice = data.publicNotice11();
    routes({ [`GET ${P}/opportunities/odc/T-2026-0011`]: notice });
    renderWithProviders(<NoticePage />, {
      route: '/opportunities/odc/T-2026-0011',
      path: '/opportunities/:buyerSlug/:ref',
    });
    expect(
      await screen.findByRole('link', { name: 'Sign in to request restricted access' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Council headquarters, Maun')).toBeInTheDocument();
    expect(screen.getByText('District clinics')).toBeInTheDocument();
    expect(screen.getByText('Amendment history (1 addendum)')).toBeInTheDocument();
    expect(
      screen.getByText('1 further document is available after access is granted.'),
    ).toBeInTheDocument();
  });

  it('registers interest without an account and shows the next step', async () => {
    const { requests } = routes({
      [`GET ${NOTICE}`]: data.publicNotice(),
      [`POST ${NOTICE}/interest`]: () => ({
        status: 201,
        body: {
          reference: 'T-2026-0002',
          buyer: data.publicNotice().buyer,
          receivedAt: '2026-09-30T08:00:00Z',
          nextStep: 'register',
          nextStepPath: '/register',
        },
      }),
    });
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Register interest' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Your name/), 'Neo Kgari');
    await userEvent.type(within(dialog).getByLabelText(/E-mail address/), 'neo@example.com');
    await userEvent.type(within(dialog).getByLabelText(/Legal name/), 'Kgari Meters (Pty) Ltd');
    await userEvent.click(within(dialog).getByLabelText(/may contact me/));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Register interest' }));

    expect(await within(dialog).findByText('Interest registered')).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'POST')?.body).toMatchObject({
      consentToContact: true,
      organizationName: 'Kgari Meters (Pty) Ltd',
    });
  });

  it('requires consent before registering interest', async () => {
    routes({ [`GET ${NOTICE}`]: data.publicNotice() });
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Register interest' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Register interest' }));
    expect(
      await within(dialog).findByText('Confirm that the buyer may contact you.'),
    ).toBeInTheDocument();
  });

  it('explains a download that needs registration', async () => {
    const notice = data.publicNotice();
    const document = notice.documents[0];
    routes({
      [`GET ${NOTICE}`]: notice,
      [`GET ${NOTICE}/documents/${document?.documentId ?? 0}/download`]: () =>
        problem(403, 'Forbidden', { code: 'DOCUMENT_REQUIRES_REGISTRATION' }),
    });
    render();
    await userEvent.click(
      await screen.findByRole('button', { name: `Download ${document?.title ?? ''}` }),
    );
    expect(
      await screen.findByText(/available to registered suppliers only. Register or sign in/),
    ).toBeInTheDocument();
  });

  it('answers a non-public reference exactly like an unknown one (AC-01)', async () => {
    routes({
      [`GET ${P}/opportunities/kwu/T-2026-0006`]: () =>
        problem(404, 'Not Found', { code: 'NOTICE_NOT_FOUND' }),
    });
    renderWithProviders(<NoticePage />, {
      route: '/opportunities/kwu/T-2026-0006',
      path: '/opportunities/:buyerSlug/:ref',
    });
    expect(await screen.findAllByText('Notice not found')).not.toHaveLength(0);
  });
});

describe('GuidancePage and GuidanceArticlePage (PUB-07)', () => {
  it('lists guidance by topic and separates it from binding tender conditions', async () => {
    const { requests } = routes({ [`GET ${P}/guidance`]: data.guidance() });
    renderWithProviders(<GuidancePage />);
    expect(await screen.findByText('Registering your organization')).toBeInTheDocument();
    expect(screen.getByText('General guidance, not binding conditions')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Topic'), 'complaints');
    await waitFor(() =>
      expect(requests.some((request) => request.search.includes('topic=complaints'))).toBe(true),
    );
  });

  it('shows the empty state when nothing matches', async () => {
    routes({ [`GET ${P}/guidance`]: pageOf([]) });
    renderWithProviders(<GuidancePage />);
    expect(await screen.findByText('No guidance published')).toBeInTheDocument();
  });

  it('renders an article with its related guidance', async () => {
    const article = data.guidanceArticle();
    routes({ [`GET ${P}/guidance/${article.slug}`]: article });
    renderWithProviders(<GuidanceArticlePage />, {
      route: `/guidance/${article.slug}`,
      path: '/guidance/:articleSlug',
    });
    expect(await screen.findAllByText(article.title)).not.toHaveLength(0);
    expect(screen.getByText('Published 2 Mar 2026 · updated 14 Jul 2026')).toBeInTheDocument();
  });

  it('explains a missing article', async () => {
    routes({
      [`GET ${P}/guidance/missing`]: () => problem(404, 'Not Found', { code: 'ARTICLE_NOT_FOUND' }),
    });
    renderWithProviders(<GuidanceArticlePage />, {
      route: '/guidance/missing',
      path: '/guidance/:articleSlug',
    });
    expect(await screen.findAllByText('Article not found')).not.toHaveLength(0);
  });
});
