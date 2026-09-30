import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PermissionCode } from '@contracts/permissions';

import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { CREATED_DEFINITION, DEFINITION, FAMILIES, PREVIEW, RECIPIENTS } from '../testData';
import { buyerState } from '../testSession';
import DefinitionPage from './DefinitionPage';

const MANAGER: PermissionCode[] = ['report.view', 'report.manage', 'export.create'];

function routes(overrides: Record<string, () => { status?: number; body?: unknown }> = {}) {
  return installFetch({
    'GET /api/v1/buyer/reports': () => ({ body: FAMILIES }),
    'GET /api/v1/buyer/report-recipients': () => ({ body: RECIPIENTS }),
    'GET /api/v1/buyer/report-definitions/1': () => ({ body: DEFINITION }),
    'POST /api/v1/buyer/report-definitions/preview': () => ({ body: PREVIEW }),
    'POST /api/v1/buyer/report-definitions': () => ({ status: 201, body: CREATED_DEFINITION }),
    'POST /api/v1/buyer/report-definitions/1/activation': () => ({
      body: { ...DEFINITION, active: false },
    }),
    ...overrides,
  });
}

function renderNew(permissions = MANAGER) {
  renderWithProviders(<DefinitionPage />, {
    state: buyerState(permissions),
    route: '/buyer/reports/definitions/new?family=participation',
    path: '/buyer/reports/definitions/new',
  });
}

function renderExisting(permissions = MANAGER) {
  renderWithProviders(<DefinitionPage />, {
    state: buyerState(permissions),
    route: '/buyer/reports/definitions/1',
    path: '/buyer/reports/definitions/:definitionId',
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DefinitionPage (REP-02)', () => {
  it('requires a preview of the current settings before the definition can be saved', async () => {
    routes();
    renderNew();

    const save = await screen.findByRole('button', { name: 'Save definition' });
    expect(save).toBeDisabled();
    expect(screen.getByText('Preview the current settings before saving.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Report family/)).toHaveValue('participation');
  });

  it('validates the name before previewing', async () => {
    const { requests } = routes();
    renderNew();

    await userEvent.click(await screen.findByRole('button', { name: 'Preview scope' }));

    expect(await screen.findByText('Use at least 3 characters.')).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
  });

  it('previews scope and redactions, then saves and shows the saved definition', async () => {
    const { requests } = routes();
    renderNew();

    await userEvent.type(await screen.findByLabelText(/Definition name/), 'Participation review');
    await userEvent.click(screen.getByRole('button', { name: 'Preview scope' }));

    const preview = await screen.findByRole('region', { name: 'Scope preview' });
    expect(within(preview).getByRole('table', { name: 'Sample rows' })).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Save definition' });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);

    expect(await screen.findByText('Definition saved')).toBeInTheDocument();
    const created = requests.find(
      (request) => request.method === 'POST' && request.path === '/api/v1/buyer/report-definitions',
    );
    expect(created?.body).toMatchObject({ name: 'Participation review', family: 'participation' });
  });

  it('binds a duplicate name to the name field', async () => {
    routes({
      'POST /api/v1/buyer/report-definitions': () =>
        problem(409, 'Conflict', {
          code: 'DUPLICATE_REPORT_NAME',
          detail: 'A report definition with this name already exists.',
        }),
    });
    renderNew();

    await userEvent.type(
      await screen.findByLabelText(/Definition name/),
      'Weekly pipeline for ExCo',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Preview scope' }));
    await screen.findByRole('region', { name: 'Scope preview' });
    await userEvent.click(screen.getByRole('button', { name: 'Save definition' }));

    expect(
      await screen.findByText(
        'A report definition with this name already exists. Choose another name.',
      ),
    ).toBeInTheDocument();
  });

  it('shows an existing definition with its audience, recipients, schedule and run history', async () => {
    routes();
    renderExisting();

    expect(await screen.findByRole('table', { name: 'Run history' })).toBeInTheDocument();
    expect(screen.getByText(/Excluded: Gaone Letsholo/)).toBeInTheDocument();
    expect(screen.getByText('Report viewers (report.view)')).toBeInTheDocument();
    expect(screen.getAllByText('Authorized').length).toBeGreaterThan(0);
  });

  it('links a run’s export only when the viewer may open it, and names another user’s export without a link', async () => {
    routes();
    renderExisting();

    expect(
      await screen.findByRole('link', { name: 'pipeline-2026-09-28.csv' }),
    ).toBeInTheDocument();
    expect(screen.getByText('pipeline-2026-09-21.csv')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /pipeline-2026-09-21\.csv/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'Requested by another user; only its requester and report managers can open it',
      ),
    ).toBeInTheDocument();
  });

  it('deactivates a definition after confirmation with a reason', async () => {
    const { requests } = routes();
    renderExisting();

    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    const dialog = await screen.findByRole('dialog', { name: 'Deactivate report definition' });
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Replaced by the monthly pack');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByText('This definition is inactive')).toBeInTheDocument();
    const activation = requests.find((request) => request.path.endsWith('/activation'));
    expect(activation?.body).toEqual({ active: false, reason: 'Replaced by the monthly pack' });
  });

  it('shows a report viewer the definition without management actions', async () => {
    routes();
    renderExisting(['report.view']);
    await screen.findByRole('table', { name: 'Run history' });
    expect(screen.queryByRole('button', { name: 'Run now' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });
});
