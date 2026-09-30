import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../../test/fetchMock';
import { page, sessionRow, tenderRow } from '../../testing/data';
import { EVALUATOR, OFFICER, renderSelection } from '../../testing/render';
import AssessmentsPage from './AssessmentsPage';

afterEach(() => vi.unstubAllGlobals());

const PATH = '/buyer/selection/assessments';

describe('AssessmentsPage', () => {
  it('lists sessions with basis, equal-treatment state and the plan action for an organizer', async () => {
    installFetch({
      'GET /api/v1/buyer/selection/assessment-sessions': () => ({
        body: page([
          sessionRow(),
          sessionRow({ sessionId: 2, equalTreatmentConfirmed: false, status: 'planned' }),
        ]),
      }),
      'GET /api/v1/buyer/selection/tenders': () => ({ body: page([tenderRow()]) }),
    });
    renderSelection(<AssessmentsPage />, { path: PATH, route: PATH, permissions: OFFICER });

    const table = await screen.findByRole('table', { name: 'Assessment sessions' });
    expect(within(table).getAllByText('Scored criterion')).toHaveLength(2);
    expect(within(table).getByText('Not confirmed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Plan session' })).toHaveAttribute(
      'href',
      '/buyer/selection/assessments/new',
    );
  });

  it('applies a tender link from the tender workspace as the tender filter', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/selection/assessment-sessions': () => ({ body: page([]) }),
      'GET /api/v1/buyer/selection/tenders': () => ({ body: page([tenderRow()]) }),
    });
    renderSelection(<AssessmentsPage />, { path: PATH, route: `${PATH}?tenderId=9` });
    expect(await screen.findByText('No records match these filters.')).toBeInTheDocument();
    expect(requests.some((request) => request.search.includes('tenderId=9'))).toBe(true);
  });

  it('omits the tender filter and the plan action for an evaluator without selection access and never requests the register', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/selection/assessment-sessions': () => ({ body: page([sessionRow()]) }),
      'GET /api/v1/buyer/selection/tenders': () => problem(403, 'Forbidden', { code: 'FORBIDDEN' }),
    });
    renderSelection(<AssessmentsPage />, { path: PATH, route: PATH, permissions: EVALUATOR });
    await screen.findByRole('table', { name: 'Assessment sessions' });
    expect(screen.queryByRole('link', { name: 'Plan session' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Tender')).not.toBeInTheDocument();
    expect(requests.some((request) => request.path === '/api/v1/buyer/selection/tenders')).toBe(
      false,
    );
  });
});
