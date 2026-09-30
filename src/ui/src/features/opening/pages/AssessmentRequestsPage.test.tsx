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
    const entry = within(table).getByRole('row', { name: /CL-4109/ });
    expect(within(entry).getByText('Kalahari Water Utilities (Pilot)')).toBeInTheDocument();
    expect(within(entry).getByText('Issued')).toBeInTheDocument();
    expect(within(entry).getByText(/\(UTC\+02:00\) Africa\/Gaborone/)).toBeInTheDocument();
    expect(screen.getByText('A clarification never changes the offer')).toBeInTheDocument();
  });

  it('shows each request’s own reference in the Reference column and the tender in the Tender column', async () => {
    const second = { ...row(), id: 4114, reference: 'CL-4114', source: 'reference' as const };
    installFetch({
      'GET /api/v1/supplier/assessment-requests': () => ({ body: page([row(), second]) }),
    });
    renderWithProviders(<AssessmentRequestsPage />, {
      state: stateFor(['supplier.response.edit'], 29, 'supplier'),
    });

    const table = await screen.findByRole('table', { name: 'Assessment requests' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent ?? '');
    const referenceIndex = headers.findIndex((text) => text.startsWith('Reference'));
    const tenderIndex = headers.findIndex((text) => text.startsWith('Tender'));
    for (const [id, reference] of [
      [4109, 'CL-4109'],
      [4114, 'CL-4114'],
    ] as const) {
      const entry = within(table).getByRole('row', { name: new RegExp(reference) });
      const cells = within(entry).getAllByRole('cell');
      const referenceCell = cells[referenceIndex];
      const tenderCell = cells[tenderIndex];
      if (referenceCell === undefined || tenderCell === undefined) {
        throw new Error('The Reference and Tender columns are missing.');
      }
      expect(within(referenceCell).getByRole('link', { name: reference })).toHaveAttribute(
        'href',
        `/supplier/assessment-requests/${String(id)}`,
      );
      expect(referenceCell).not.toHaveTextContent('T-2026-0001');
      expect(tenderCell).toHaveTextContent('T-2026-0001');
      expect(tenderCell).toHaveTextContent('Kalahari Water Utilities (Pilot)');
    }
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
