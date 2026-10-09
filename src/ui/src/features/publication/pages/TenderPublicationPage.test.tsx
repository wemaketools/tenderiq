import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { BUYER_ALL, buyerState, data, routes } from '../test/kit';
import TenderPublicationPage from './TenderPublicationPage';

const T2 = '/api/v1/buyer/tenders/2/publication';

function render(permissions = BUYER_ALL) {
  return renderWithProviders(<TenderPublicationPage />, {
    state: buyerState(permissions),
    route: '/buyer/tenders/2/publication',
    path: '/buyer/tenders/:tenderId/publication',
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TenderPublicationPage (BUY-14)', () => {
  it('shows a failed external notice as not advertised with its open exception (AC-33)', async () => {
    routes({ [`GET ${T2}`]: data.overview2() });
    render();

    expect(
      await screen.findByText('Not advertised: an external notice is unconfirmed'),
    ).toBeInTheDocument();
    expect(screen.getByText('Exception #901')).toBeInTheDocument();
    // The inbox has no per-task route: the exception task is opened from the task inbox (no dead link).
    expect(screen.getByRole('link', { name: 'Open in task inbox' })).toHaveAttribute(
      'href',
      '/me/tasks',
    );
    expect(screen.getByText('0 of 1 confirmed')).toBeInTheDocument();
    expect(screen.getByText('Reconcile the external notice')).toBeInTheDocument();
    expect(screen.getAllByTestId('official-deadline').length).toBeGreaterThan(0);
    expect(screen.getByText('Approval #202')).toBeInTheDocument();
  });

  it('reconciles the external notice and then counts the event as advertised', async () => {
    const { requests } = routes({
      [`GET ${T2}`]: data.overview2(),
      'POST /api/v1/buyer/publications/222/reconcile': (request) => {
        const failed = data.overview2().publications.find((row) => row.id === 222);
        return {
          body: {
            ...failed,
            status: 'confirmed',
            reconciled: true,
            externalReference: (request.body as { externalReference: string }).externalReference,
            confirmationReceivedAt: '2026-09-25T08:00:00Z',
            exception: failed?.exception
              ? { ...failed.exception, status: 'reconciled', resolvedAt: '2026-09-25T08:00:00Z' }
              : null,
          },
        };
      },
    });
    render();
    await screen.findByText('Exception #901');

    await userEvent.click(screen.getAllByRole('button', { name: 'Reconcile' })[0] as HTMLElement);
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/External reference/), 'BGG-2026-10-0101');
    const date = within(dialog).getAllByLabelText('Date')[0] as HTMLElement;
    await userEvent.type(date, '2026-09-25');
    await userEvent.type(within(dialog).getAllByLabelText('Time')[0] as HTMLElement, '10:00');
    await userEvent.type(within(dialog).getByLabelText(/Resolution/), 'Lodged again in two files.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reconcile' }));

    await waitFor(() =>
      expect(requests.some((request) => request.path.endsWith('/222/reconcile'))).toBe(true),
    );
    const body = requests.find((request) => request.path.endsWith('/222/reconcile'))?.body;
    expect(body).toMatchObject({ outcome: 'confirmed', externalReference: 'BGG-2026-10-0101' });
    expect(await screen.findByText('Advertised')).toBeInTheDocument();
  });

  it('publishes a ready tender after the COM-02 confirmation', async () => {
    const overview = data.overview13();
    const { requests } = routes({
      'GET /api/v1/buyer/tenders/13/publication': overview,
      'POST /api/v1/buyer/tenders/13/publication/publish': {
        tenderId: 13,
        tenderStatus: 'ready',
        scheduledReleaseAt: '2026-10-20T06:00:00Z',
        releasedAt: null,
        publications: overview.publications,
        message: 'Release scheduled for 20 Oct 2026, 08:00 (UTC+02:00) Africa/Gaborone.',
      },
    });
    renderWithProviders(<TenderPublicationPage />, {
      state: buyerState(),
      route: '/buyer/tenders/13/publication',
      path: '/buyer/tenders/:tenderId/publication',
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Publish or schedule' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('confirm-context')).toHaveTextContent(
      'Kalahari Water Utilities (Pilot)',
    );
    await userEvent.click(within(dialog).getByLabelText(/I confirm this is the approved release/));
    await userEvent.click(
      within(dialog).getByRole('button', { name: /Schedule release|Publish now/ }),
    );

    expect(await screen.findByText('Publication recorded')).toBeInTheDocument();
    const publish = requests.find((request) => request.path.endsWith('/publish'));
    expect(publish?.body).toMatchObject({ channels: ['portal', 'external_notice'] });
  });

  it('replaces the scheduled rows when a scheduled tender is published now (one row per channel)', async () => {
    const overview = data.overview13();
    const now = '2026-09-30T08:00:00Z';
    // Rows of the same version and channel replace the scheduled ones, whatever their ids (DD-07).
    const published = overview.publications.map((row, index) =>
      row.channel === 'portal'
        ? {
            ...row,
            id: 900 + index,
            status: 'published' as const,
            scheduledAt: null,
            publishedAt: now,
            reconciled: true,
          }
        : {
            ...row,
            id: 900 + index,
            status: 'awaiting_confirmation' as const,
            scheduledAt: null,
            publishedAt: now,
          },
    );
    routes({
      'GET /api/v1/buyer/tenders/13/publication': overview,
      'POST /api/v1/buyer/tenders/13/publication/publish': {
        tenderId: 13,
        tenderStatus: 'open',
        scheduledReleaseAt: null,
        releasedAt: now,
        publications: published,
        message: 'T-2026-0013 is published.',
      },
    });
    renderWithProviders(<TenderPublicationPage />, {
      state: buyerState(),
      route: '/buyer/tenders/13/publication',
      path: '/buyer/tenders/:tenderId/publication',
    });
    expect(await screen.findAllByText('Scheduled')).toHaveLength(2);

    await userEvent.click(await screen.findByRole('button', { name: 'Publish or schedule' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText('Publish now'));
    await userEvent.click(within(dialog).getByLabelText(/I confirm this is the approved release/));
    await userEvent.click(within(dialog).getByRole('button', { name: /Publish now/ }));

    expect(await screen.findByText('Publication recorded')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByText('Published')).toBeInTheDocument();
    expect(within(table).getByText('Awaiting confirmation')).toBeInTheDocument();
    expect(within(table).queryByText('Scheduled')).not.toBeInTheDocument();
    expect(screen.getByText('0 of 1 confirmed')).toBeInTheDocument();
    expect(screen.getAllByText('Open').length).toBeGreaterThan(0);
    expect(screen.queryByText('Ready')).not.toBeInTheDocument();
  });

  it('shows the business error of a refused publication inside the dialog', async () => {
    routes({
      'GET /api/v1/buyer/tenders/13/publication': data.overview13(),
      'POST /api/v1/buyer/tenders/13/publication/publish': () =>
        problem(409, 'Conflict', { code: 'SCHEDULE_IN_PAST', detail: 'raw' }),
    });
    renderWithProviders(<TenderPublicationPage />, {
      state: buyerState(),
      route: '/buyer/tenders/13/publication',
      path: '/buyer/tenders/:tenderId/publication',
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Publish or schedule' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText(/I confirm this is the approved release/));
    await userEvent.click(
      within(dialog).getByRole('button', { name: /Schedule release|Publish now/ }),
    );
    expect(
      await within(dialog).findByText('The release time must be in the future.'),
    ).toBeInTheDocument();
  });

  it('hides publication commands from a viewer without tender.publish', async () => {
    routes({ [`GET ${T2}`]: data.overview2() });
    render(['tender.view']);
    await screen.findByText('Exception #901');
    expect(screen.queryByRole('button', { name: 'Reconcile' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('leaves out the Participants tab for a membership that cannot read participants', async () => {
    routes({ [`GET ${T2}`]: data.overview2() });
    render(['tender.publish']);
    await screen.findByText('Exception #901');
    const tabs = screen.getByRole('navigation', { name: 'Publication sections' });
    expect(
      within(tabs).queryByRole('link', { name: /Participants and access/ }),
    ).not.toBeInTheDocument();
    expect(
      within(tabs).getByRole('link', { name: 'Publication and distribution' }),
    ).toBeInTheDocument();
  });

  it('shows the Participants tab to a membership that can read participants', async () => {
    routes({ [`GET ${T2}`]: data.overview2() });
    render();
    await screen.findByText('Exception #901');
    const tabs = screen.getByRole('navigation', { name: 'Publication sections' });
    expect(within(tabs).getByRole('link', { name: /Participants and access/ })).toBeInTheDocument();
  });

  it('answers an unknown tender with the not-found state', async () => {
    routes({ [`GET ${T2}`]: () => problem(404, 'Not Found', { code: 'TENDER_NOT_FOUND' }) });
    render();
    expect(await screen.findAllByText('Tender not found')).not.toHaveLength(0);
  });

  it('shows the restricted state on a 403', async () => {
    routes({ [`GET ${T2}`]: () => problem(403, 'Forbidden', { code: 'FORBIDDEN' }) });
    render();
    expect(
      await screen.findByText('Your role cannot view the publication of this tender.'),
    ).toBeInTheDocument();
  });
});
