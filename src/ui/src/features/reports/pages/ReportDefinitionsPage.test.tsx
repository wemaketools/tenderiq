import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { DEFINITIONS } from '../testData';
import { EMPTY_PAGE, buyerState } from '../testSession';
import ReportDefinitionsPage from './ReportDefinitionsPage';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ReportDefinitionsPage (ADM-13)', () => {
  it('lists definitions with audience, scheduled delivery, owner and status', async () => {
    installFetch({ 'GET /api/v1/buyer/report-definitions': () => ({ body: DEFINITIONS }) });
    renderWithProviders(<ReportDefinitionsPage />, {
      state: buyerState(['report.view', 'report.manage', 'export.create']),
    });

    const table = await screen.findByRole('table', { name: 'Report definitions' });
    expect(within(table).getByRole('link', { name: 'Weekly pipeline for ExCo' })).toHaveAttribute(
      'href',
      '/buyer/reports/definitions/1',
    );
    expect(within(table).getByText('Inactive')).toBeInTheDocument();
    expect(within(table).getAllByText('On demand only').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Export history' })).toBeInTheDocument();
  });

  it('sends the family and delivery filters', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/report-definitions': () => ({ body: DEFINITIONS }),
    });
    renderWithProviders(<ReportDefinitionsPage />, {
      state: buyerState(['report.view', 'report.manage']),
    });
    await screen.findByRole('table', { name: 'Report definitions' });

    await userEvent.selectOptions(screen.getByLabelText('Delivery'), 'Scheduled');

    await waitFor(() =>
      expect(requests.some((request) => request.search.includes('scheduled=true'))).toBe(true),
    );
  });

  it('explains when there are no definitions', async () => {
    installFetch({ 'GET /api/v1/buyer/report-definitions': () => ({ body: EMPTY_PAGE }) });
    renderWithProviders(<ReportDefinitionsPage />, { state: buyerState(['report.view']) });
    expect(await screen.findByText('No report definitions yet')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New report definition' })).not.toBeInTheDocument();
  });
});
