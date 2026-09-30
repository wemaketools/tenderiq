import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { buyerState, data, routes } from '../test/kit';
import ParticipantPage from './ParticipantPage';

const PATH = '/api/v1/buyer/tenders/6/participants/605';

function render(permissions?: Parameters<typeof buyerState>[0]) {
  return renderWithProviders(<ParticipantPage />, {
    state: buyerState(permissions),
    route: '/buyer/tenders/6/participants/605',
    path: '/buyer/tenders/:tenderId/participants/:participantId',
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ParticipantPage (BUY-15 record)', () => {
  it('shows the legal supplier, deliveries and the history of a corrected contact', async () => {
    routes({ [`GET ${PATH}`]: data.participant605() });
    render();

    expect(await screen.findAllByText('Chobe Pipe & Valve Supplies (Pty) Ltd')).not.toHaveLength(0);
    expect(
      screen.getByText('Correcting the contact never changes the invited legal supplier.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: 'Formal notices sent to this participant' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Contact corrected')).toBeInTheDocument();
    expect(screen.getByText('Delivery failed')).toBeInTheDocument();
  });

  it('corrects the contact with a reason and keeps the legal supplier', async () => {
    const detail = data.participant605();
    const { requests } = routes({
      [`GET ${PATH}`]: detail,
      [`POST ${PATH}/contact`]: {
        ...data.participants2().items[0],
        id: 605,
        tenderId: 6,
        supplier: detail.supplier,
        invitedContactName: 'Gorata Mphoeng',
        invitedContactEmail: 'gorata@example.com',
      },
    });
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Correct contact' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Contact name/), 'Gorata Mphoeng');
    await userEvent.type(within(dialog).getByLabelText(/Contact e-mail/), 'gorata@example.com');
    await userEvent.type(
      within(dialog).getByLabelText(/Reason for the correction/),
      'New bid manager.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Correct contact' }));

    await waitFor(() =>
      expect(requests.find((request) => request.path.endsWith('/contact'))?.body).toMatchObject({
        contactName: 'Gorata Mphoeng',
        reason: 'New bid manager.',
      }),
    );
    expect(await screen.findByText(/Gorata Mphoeng · gorata@example.com/)).toBeInTheDocument();
  });

  it('shows the business message when nothing is outstanding for a reminder', async () => {
    const detail = {
      ...data.participant605(),
      capabilities: {
        canReplaceContact: true,
        canDecideAccess: false,
        canResendInvitation: false,
        canSendReminder: true,
      },
    };
    routes({
      [`GET ${PATH}`]: detail,
      [`POST ${PATH}/reminders`]: () => problem(409, 'Conflict', { code: 'NOTHING_OUTSTANDING' }),
    });
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Send reminder' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send reminder' }));
    expect(
      await within(dialog).findByText('Nothing is outstanding for this participant.'),
    ).toBeInTheDocument();
  });

  it('offers no commands to a read-only viewer', async () => {
    routes({ [`GET ${PATH}`]: data.participant605() });
    render(['tender.view']);
    await screen.findAllByText('Chobe Pipe & Valve Supplies (Pty) Ltd');
    expect(screen.queryByRole('button', { name: 'Correct contact' })).not.toBeInTheDocument();
  });

  it('answers an unknown participant with the not-found state', async () => {
    routes({ [`GET ${PATH}`]: () => problem(404, 'Not Found', { code: 'PARTICIPANT_NOT_FOUND' }) });
    render();
    expect(await screen.findAllByText('Participant not found')).not.toHaveLength(0);
  });
});
