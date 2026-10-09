import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PermissionCode } from '@contracts/permissions';

import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { EXPORTS, FAMILIES } from '../testData';
import { buyerState } from '../testSession';
import ReportsPage from './ReportsPage';

const MANAGER: PermissionCode[] = ['report.view', 'report.manage', 'export.create'];

function routes(families = FAMILIES) {
  return installFetch({
    'GET /api/v1/buyer/reports': () => ({ body: families }),
    'GET /api/v1/buyer/exports': () => ({ body: EXPORTS }),
    'POST /api/v1/buyer/exports': () =>
      problem(403, 'Forbidden', {
        code: 'REPORT_FAMILY_RESTRICTED',
        detail: 'Your role may not run this report family.',
      }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ReportsPage (REP-01)', () => {
  it('lists every report family with its questions, dimensions and actions', async () => {
    routes();
    renderWithProviders(<ReportsPage />, { state: buyerState(MANAGER) });

    const card = await screen.findByRole('region', { name: 'Competition and participation' });
    expect(
      within(card).getByRole('link', { name: 'Open report Competition and participation' }),
    ).toHaveAttribute('href', '/buyer/reports/participation');
    expect(within(card).getByText('No-bid reason')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^Open report / })).toHaveLength(10);
    expect(await screen.findByRole('table', { name: 'Recent report exports' })).toBeInTheDocument();
  });

  it('leaves out a family the role may not run, with no card or explanation in its place', async () => {
    routes({
      ...FAMILIES,
      families: FAMILIES.families.map((family) =>
        family.family === 'audit_records'
          ? { ...family, restricted: true, restrictionReason: 'Requires audit.view.' }
          : family,
      ),
    });
    renderWithProviders(<ReportsPage />, { state: buyerState(MANAGER) });

    expect(
      await screen.findByRole('region', { name: 'Competition and participation' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Audit and records' })).not.toBeInTheDocument();
    expect(screen.queryByText('Requires audit.view.')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^Open report / })).toHaveLength(9);
  });

  it('shows the empty catalog when the role may run none of the families', async () => {
    routes({
      ...FAMILIES,
      families: FAMILIES.families.map((family) => ({ ...family, restricted: true })),
    });
    renderWithProviders(<ReportsPage />, { state: buyerState(MANAGER) });

    expect(await screen.findByText('No report families are available')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Open report / })).not.toBeInTheDocument();
  });

  it('confirms a CSV export with its purpose and shows a business error', async () => {
    const { requests } = routes();
    renderWithProviders(<ReportsPage />, { state: buyerState(MANAGER) });

    await userEvent.click(
      await screen.findByRole('button', { name: 'Export Procurement pipeline as CSV' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Export report' });
    expect(within(dialog).getByText('Kalahari Water Utilities (Pilot)')).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: 'Create export' });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/Purpose of the export/), 'Board pack');
    await userEvent.click(confirm);

    await waitFor(() => {
      const post = requests.find((request) => request.method === 'POST');
      expect(post?.body).toMatchObject({ format: 'csv', purpose: 'Board pack' });
    });
    expect(await within(dialog).findByText('Forbidden')).toBeInTheDocument();
  });

  it('hides exports from a report viewer', async () => {
    routes();
    renderWithProviders(<ReportsPage />, { state: buyerState(['report.view']) });
    await screen.findByRole('region', { name: 'Procurement pipeline' });
    expect(screen.queryByRole('button', { name: /as CSV/ })).not.toBeInTheDocument();
  });
});
