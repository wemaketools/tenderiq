import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { installFetch } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { assessmentRequest, page, stateFor } from '../test/data';
import AssessmentRequestsPage from './AssessmentRequestsPage';

function row() {
  const { responseText: _text, attachments: _files, ...rest } = assessmentRequest();
  return rest;
}

describe('AssessmentRequestsPage (SUP-18)', () => {
  it('lists the supplier’s requests with the buyer, type and official deadline', async () => {
    installFetch({
      'GET /api/v1/supplier/assessment-requests': () => ({ body: page([row()]) }),
    });
    renderWithProviders(<AssessmentRequestsPage />, {
      state: stateFor(['supplier.response.edit'], 29, 'supplier'),
    });

    const table = await screen.findByRole('table', { name: 'Assessment requests' });
    const entry = within(table).getByRole('row', { name: /T-2026-0001/ });
    expect(within(entry).getByText('Kalahari Water Utilities (Pilot)')).toBeInTheDocument();
    expect(within(entry).getByText('Issued')).toBeInTheDocument();
    expect(within(entry).getByText(/\(UTC\+02:00\) Africa\/Gaborone/)).toBeInTheDocument();
    expect(screen.getByText('A clarification never changes the offer')).toBeInTheDocument();
  });

  it('links to the assessment appointments where participation in presentations is confirmed', async () => {
    installFetch({ 'GET /api/v1/supplier/assessment-requests': () => ({ body: page([row()]) }) });
    renderWithProviders(<AssessmentRequestsPage />, {
      state: stateFor(['supplier.response.edit'], 29, 'supplier'),
    });

    expect(await screen.findByText('Presentations and demonstrations')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open assessment appointments' })).toHaveAttribute(
      'href',
      '/supplier/assessment-invites',
    );
  });

  it('shows the empty state when there is no request', async () => {
    installFetch({ 'GET /api/v1/supplier/assessment-requests': () => ({ body: page([]) }) });
    renderWithProviders(<AssessmentRequestsPage />, {
      state: stateFor(['supplier.outcomes.view'], 40, 'supplier'),
    });

    expect(await screen.findByText('No assessment request.')).toBeInTheDocument();
  });
});
