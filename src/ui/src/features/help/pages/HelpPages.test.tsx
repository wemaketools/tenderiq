import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { contacts, myArticle, myCase, notices, pageOf, personState } from '../testData';
import HelpArticlePage from './HelpArticlePage';
import HelpCentrePage from './HelpCentrePage';
import MyCasePage from './MyCasePage';
import PublicServicePage from './PublicServicePage';

const M = '/api/v1/me';

function centre(extra: Parameters<typeof installFetch>[0] = {}, route = '/me/help') {
  const fetch = installFetch({
    [`GET ${M}/help-articles`]: () => ({ body: pageOf([myArticle()]) }),
    [`GET ${M}/service-notices`]: () => ({ body: notices() }),
    [`GET ${M}/help-contacts`]: () => ({ body: contacts() }),
    [`GET ${M}/support-cases`]: () => ({ body: pageOf([myCase()]) }),
    ...extra,
  });
  renderWithProviders(<HelpCentrePage />, { state: personState(), route });
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HelpCentrePage (COM-09)', () => {
  it('shows guidance, the not-a-submission-channel statement and the notices affecting my organizations', async () => {
    centre();

    expect(await screen.findByText('Official deadlines and time zones')).toBeInTheDocument();
    expect(screen.getAllByText('Support is not a way to submit a bid').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('tab', { name: 'Service notices' }));
    expect(await screen.findByText('Slow document uploads')).toBeInTheDocument();
    expect(screen.getByText('Affected your organizations')).toBeInTheDocument();
  });

  it('shows terminology and accessibility contacts', async () => {
    centre();
    await userEvent.click(await screen.findByRole('tab', { name: 'Contacts & terms' }));

    expect(
      await screen.findByText('Request an accommodation from the help centre.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Official deadline')).toBeInTheDocument();
  });

  it('opens a case for the chosen organization only after the acknowledgement', async () => {
    // The top bar's "Open a case" section action opens the dialog through ?new=1 (DD-46).
    const { requests } = centre(
      { [`POST ${M}/support-cases`]: () => ({ status: 201, body: myCase() }) },
      '/me/help?new=1',
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Concerns/), 'usage');
    await userEvent.type(within(dialog).getByLabelText(/^Subject/), 'Cannot find the addendum');
    await userEvent.type(
      within(dialog).getByLabelText(/^What do you need help with/),
      'Where is addendum 1?',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Open case' }));
    expect(
      await within(dialog).findByText(/Confirm that you understand support cannot receive bids/),
    ).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'POST')).toBe(false);

    await userEvent.click(
      within(dialog).getByLabelText(/I understand that support cannot receive bids/),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Open case' }));

    await waitFor(() => {
      const post = requests.find((request) => request.method === 'POST');
      expect(post?.headers['x-tenant-id']).toBe('2');
      expect(post?.body).toMatchObject({
        category: 'usage',
        acknowledgesNotSubmissionChannel: true,
      });
    });
  });

  it('requests an accessibility accommodation', async () => {
    const { requests } = centre({
      [`POST ${M}/accommodation-requests`]: () => ({
        status: 201,
        body: myCase({ category: 'accessibility' }),
      }),
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Request accessibility assistance' }),
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(
      within(dialog).getByLabelText(/^Kind of assistance/),
      'large_print',
    );
    await userEvent.type(
      within(dialog).getByLabelText(/^What you need/),
      'Large print tender package.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send request' }));

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
        format: 'large_print',
        need: 'Large print tender package.',
        contactPreference: 'email',
      }),
    );
  });

  it('explains when I have no cases', async () => {
    centre({ [`GET ${M}/support-cases`]: () => ({ body: pageOf([]) }) });
    await userEvent.click(await screen.findByRole('tab', { name: 'My cases' }));

    expect(await screen.findByText('You have no service cases')).toBeInTheDocument();
  });
});

describe('HelpArticlePage (COM-09)', () => {
  it('renders the article with its binding note', async () => {
    installFetch({ [`GET ${M}/help-articles/official-deadlines`]: () => ({ body: myArticle() }) });
    renderWithProviders(<HelpArticlePage />, {
      state: personState(),
      route: '/me/help/articles/official-deadlines',
      path: '/me/help/articles/:articleSlug',
    });

    expect(await screen.findByRole('heading', { name: 'What counts' })).toBeInTheDocument();
    expect(screen.getByText('Submit early')).toBeInTheDocument();
    expect(
      screen.getByText('General guidance never overrides the conditions of a particular notice.'),
    ).toBeInTheDocument();
  });
});

describe('MyCasePage (COM-09)', () => {
  function render(extra: Parameters<typeof installFetch>[0] = {}) {
    const fetch = installFetch({
      [`GET ${M}/support-cases/1`]: () => ({ body: myCase() }),
      ...extra,
    });
    renderWithProviders(<MyCasePage />, {
      state: personState(),
      route: '/me/help/cases/1',
      path: '/me/help/cases/:caseId',
    });
    return fetch;
  }

  it('shows the conversation and the access requests made on my organization’s behalf', async () => {
    render();

    expect(await screen.findByText('Kabo sees the tender but no criteria.')).toBeInTheDocument();
    expect(screen.getByText(/Support is waiting for your reply/)).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Access requests on this case' })).toBeInTheDocument();
  });

  it('refuses a reply that tries to deliver a bid', async () => {
    render({
      [`POST ${M}/support-cases/1/messages`]: () =>
        problem(422, 'Not a submission channel', { code: 'SUPPORT_NOT_SUBMISSION_CHANNEL' }),
    });
    await userEvent.type(
      await screen.findByLabelText('Reply'),
      'Attached is our bid for T-2026-0003.',
    );
    expect(screen.getByText('Support is not a submission channel')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send reply' }));

    expect(
      await screen.findAllByText(/Support cannot receive bids, offers or tender responses/),
    ).not.toHaveLength(0);
  });
});

describe('PublicServicePage (COM-09)', () => {
  it('shows public notices and contacts without customer detail', async () => {
    installFetch({
      'GET /api/v1/public/service-notices': () => ({
        body: {
          ...notices(),
          items: notices().items.map((item) => ({ ...item, affectedOrganizations: [] })),
        },
      }),
      'GET /api/v1/public/help-contacts': () => ({ body: contacts() }),
    });
    renderWithProviders(<PublicServicePage />, { route: '/service-status' });

    expect(await screen.findByText('Slow document uploads')).toBeInTheDocument();
    expect(screen.queryByText('Affected your organizations')).not.toBeInTheDocument();
    expect(await screen.findByText('Support never receives bids.')).toBeInTheDocument();
  });
});
