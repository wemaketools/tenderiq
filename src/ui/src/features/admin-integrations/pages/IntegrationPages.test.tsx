import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { PEOPLE, buyerState, exceptionDetail, integrationDetail, pageOf } from '../testData';
import ExceptionPage from './ExceptionPage';
import ExceptionsPage from './ExceptionsPage';
import IntegrationPage from './IntegrationPage';
import IntegrationsPage from './IntegrationsPage';

const B = '/api/v1/buyer';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('IntegrationsPage (ADM-15)', () => {
  it('lists connections with owner, status, last confirmation, open exceptions and fallback', async () => {
    installFetch({
      [`GET ${B}/integrations`]: () => ({
        body: pageOf([
          integrationDetail(),
          integrationDetail({
            id: 2,
            name: 'Finance ledger',
            hasManualFallback: false,
            openExceptions: 0,
            lastConfirmedAt: null,
            status: 'planned',
          }),
        ]),
      }),
      [`GET ${B}/operations-people`]: () => ({ body: PEOPLE }),
    });
    renderWithProviders(<IntegrationsPage />, {
      state: buyerState(),
      route: '/buyer/admin/service/integrations',
    });

    const table = await screen.findByRole('table', { name: 'Connections' });
    expect(within(table).getByText('Botswana Government Gazette e-Notices')).toBeInTheDocument();
    expect(within(table).getByText('Never confirmed')).toBeInTheDocument();
    expect(within(table).getByText('Missing')).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Service and integration settings' }),
    ).toBeInTheDocument();
  });

  it('explains when there is no connection', async () => {
    installFetch({
      [`GET ${B}/integrations`]: () => ({ body: pageOf([]) }),
      [`GET ${B}/operations-people`]: () => ({ body: PEOPLE }),
    });
    renderWithProviders(<IntegrationsPage />, {
      state: buyerState(),
      route: '/buyer/admin/service/integrations',
    });

    expect(await screen.findByText('No connections match')).toBeInTheDocument();
  });
});

describe('IntegrationPage (ADM-15)', () => {
  it('shows the agreement, contacts, confirmations and recent exceptions, and explains a refused retirement', async () => {
    installFetch({
      [`GET ${B}/integrations/1`]: () => ({ body: integrationDetail() }),
      [`GET ${B}/operations-people`]: () => ({ body: PEOPLE }),
      [`POST ${B}/integrations/1/status`]: () =>
        problem(409, 'Open exceptions', { code: 'OPEN_EXCEPTIONS_BLOCK_RETIRE' }),
    });
    renderWithProviders(<IntegrationPage />, {
      state: buyerState(),
      route: '/buyer/admin/service/integrations/1',
      path: '/buyer/admin/service/integrations/:connectionId',
    });

    expect(
      await screen.findByText('KWU owns the notice; the Gazette owns the publication reference.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Gazette clerk')).toBeInTheDocument();
    expect(screen.getByText('All notices matched.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Change status' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText(/^New status/), 'retired');
    await userEvent.type(within(dialog).getByLabelText(/^Reason/), 'Replaced.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change status' }));

    expect(
      await within(dialog).findByText(
        'Resolve the open exceptions before retiring the connection.',
      ),
    ).toBeInTheDocument();
  });
});

describe('ExceptionsPage (ADM-15, AC-33)', () => {
  it('shows what stays unconfirmed for a tender owner without integration management', async () => {
    installFetch({
      [`GET ${B}/integration-exceptions`]: () => ({ body: pageOf([exceptionDetail()]) }),
      [`GET ${B}/operations-people`]: () => ({ body: PEOPLE }),
    });
    renderWithProviders(<ExceptionsPage />, {
      state: buyerState(['tender.publish', 'tender.view']),
      route: '/buyer/admin/service/exceptions',
    });

    const table = await screen.findByRole('table', { name: 'Exception queue' });
    expect(
      within(table).getByText('T-2026-0002 is not advertised externally for its current version.'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Connection')).not.toBeInTheDocument();
    const recordTypes = within(screen.getByLabelText('Record type'))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(recordTypes).toEqual(expect.arrayContaining(['Publication', 'Notice']));
    expect(recordTypes).not.toContain('Contract');
    expect(recordTypes).not.toContain('Membership');
    expect(
      screen.getByText(/As tender owner you see publication and notice exceptions/),
    ).toBeInTheDocument();
  });

  it('offers every connection and record type to an integration manager', async () => {
    installFetch({
      [`GET ${B}/integration-exceptions`]: () => ({ body: pageOf([exceptionDetail()]) }),
      [`GET ${B}/integrations`]: () => ({ body: pageOf([integrationDetail()]) }),
      [`GET ${B}/operations-people`]: () => ({ body: PEOPLE }),
    });
    renderWithProviders(<ExceptionsPage />, {
      state: buyerState(),
      route: '/buyer/admin/service/exceptions',
    });

    await screen.findByRole('table', { name: 'Exception queue' });
    expect(screen.getByLabelText('Connection')).toBeInTheDocument();
    const recordTypes = within(screen.getByLabelText('Record type'))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(recordTypes).toEqual(
      expect.arrayContaining(['Publication', 'Contract', 'Membership', 'Notice']),
    );
    expect(screen.queryByText(/As tender owner you see/)).not.toBeInTheDocument();
  });
});

describe('ExceptionPage (ADM-15, AC-33)', () => {
  function render(extra: Parameters<typeof installFetch>[0] = {}) {
    const fetch = installFetch({
      [`GET ${B}/integration-exceptions/901`]: () => ({ body: exceptionDetail() }),
      [`GET ${B}/operations-people`]: () => ({ body: PEOPLE }),
      ...extra,
    });
    renderWithProviders(<ExceptionPage />, {
      state: buyerState(),
      route: '/buyer/admin/service/exceptions/901',
      path: '/buyer/admin/service/exceptions/:exceptionId',
    });
    return fetch;
  }

  it('keeps the publication visibly unconfirmed and requires the external reference to reconcile', async () => {
    const { requests } = render({
      [`POST ${B}/integration-exceptions/901/resolve`]: () => ({
        body: exceptionDetail({
          status: 'reconciled',
          resolvedAt: '2026-09-30T08:00:00Z',
          resolution: 'Republished.',
        }),
      }),
    });
    expect(await screen.findByText('Still unconfirmed')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(
      within(dialog).getByLabelText(/^Resolution/),
      'Republished with a smaller attachment.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Resolve' }));
    expect(
      await within(dialog).findByText(/Enter the external confirmation reference/),
    ).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'POST')).toBe(false);

    await userEvent.type(
      within(dialog).getByLabelText(/^External confirmation reference/),
      'GZ-2026-4471',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Resolve' }));

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
        outcome: 'reconciled',
        resolution: 'Republished with a smaller attachment.',
        externalReference: 'GZ-2026-4471',
      }),
    );
  });

  it('assigns the exception to a member', async () => {
    const { requests } = render({
      [`POST ${B}/integration-exceptions/901/assign`]: () => ({ body: exceptionDetail() }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Assign owner' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Owner/), '3');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Assign owner' }));

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
        ownerUserId: 3,
      }),
    );
  });
});
