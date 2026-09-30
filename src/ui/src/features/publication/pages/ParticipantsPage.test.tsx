import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { buyerState, data, pageOf, routes } from '../test/kit';
import ParticipantsPage from './ParticipantsPage';

const BASE = '/api/v1/buyer/tenders/2';

function render(permissions?: Parameters<typeof buyerState>[0]) {
  return renderWithProviders(<ParticipantsPage />, {
    state: buyerState(permissions),
    route: '/buyer/tenders/2/participants',
    path: '/buyer/tenders/:tenderId/participants',
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ParticipantsPage (BUY-15)', () => {
  it('shows participants with invitation, access, conditions, acknowledgments and delivery', async () => {
    routes({
      [`GET ${BASE}/participant-summary`]: data.summary2(),
      [`GET ${BASE}/participants`]: data.participants2(),
    });
    render();

    const table = await screen.findByRole('table', { name: 'Participants of the tender' });
    expect(await within(table).findByText('Makgadikgadi Civil Works')).toBeInTheDocument();
    expect(within(table).getAllByText('Delivered').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Supplier drafts, pursuits and private notes are never visible/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Addendum 1/)).toBeInTheDocument();
    expect(screen.getByText('3 of 5')).toBeInTheDocument();
  });

  it('invites an approved supplier with its intended contact', async () => {
    const participant = data.participants2().items[0];
    const { requests } = routes({
      [`GET ${BASE}/participant-summary`]: data.summary2(),
      [`GET ${BASE}/participants`]: data.participants2(),
      [`GET ${BASE}/invitation-candidates`]: data.candidates2(),
      [`POST ${BASE}/participants`]: () => ({
        status: 201,
        body: { ...participant, id: 901, invitationStatus: 'invited' },
      }),
    });
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Invite supplier' }));
    const dialog = await screen.findByRole('dialog');
    const select = await within(dialog).findByLabelText(/Legal supplier/);
    const option = within(select)
      .getAllByRole('option')
      .find(
        (item) => !(item as HTMLOptionElement).disabled && (item as HTMLOptionElement).value !== '',
      );
    await userEvent.selectOptions(select, (option as HTMLOptionElement).value);
    const name = within(dialog).getByLabelText(/Contact name/);
    await userEvent.clear(name);
    await userEvent.type(name, 'Palesa Gabo');
    const email = within(dialog).getByLabelText(/Contact e-mail/);
    await userEvent.clear(email);
    await userEvent.type(email, 'palesa@example.com');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Invite' }));

    await waitFor(() =>
      expect(
        requests.some(
          (request) => request.method === 'POST' && request.path.endsWith('/participants'),
        ),
      ).toBe(true),
    );
    const post = requests.find((request) => request.method === 'POST');
    expect(post?.body).toMatchObject({
      contactName: 'Palesa Gabo',
      contactEmail: 'palesa@example.com',
    });
  });

  it('validates the contact before inviting', async () => {
    routes({
      [`GET ${BASE}/participant-summary`]: data.summary2(),
      [`GET ${BASE}/participants`]: data.participants2(),
      [`GET ${BASE}/invitation-candidates`]: pageOf([]),
    });
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Invite supplier' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Invite' }));
    expect(await within(dialog).findByText('Enter the contact name.')).toBeInTheDocument();
    expect(within(dialog).getByText('No supplier matches')).toBeInTheDocument();
  });

  it('hides the invitation action without tender.participants.manage', async () => {
    routes({
      [`GET ${BASE}/participant-summary`]: data.summary2(),
      [`GET ${BASE}/participants`]: data.participants2(),
    });
    render(['tender.view']);
    await screen.findByRole('table', { name: 'Participants of the tender' });
    expect(screen.queryByRole('button', { name: 'Invite supplier' })).not.toBeInTheDocument();
  });

  it('shows the filtered empty state', async () => {
    routes({
      [`GET ${BASE}/participant-summary`]: data.summary2(),
      [`GET ${BASE}/participants`]: pageOf([]),
    });
    render();
    expect(await screen.findByText('No participants yet')).toBeInTheDocument();
  });

  it('shows the restricted state on a 403', async () => {
    routes({
      [`GET ${BASE}/participant-summary`]: () => problem(403, 'Forbidden', { code: 'FORBIDDEN' }),
    });
    render();
    expect(
      await screen.findByText('Your role cannot view the participants of this tender.'),
    ).toBeInTheDocument();
  });
});
