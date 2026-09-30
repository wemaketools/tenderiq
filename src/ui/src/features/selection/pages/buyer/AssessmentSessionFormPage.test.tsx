import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../../test/fetchMock';
import type { MockHandler } from '../../../../test/fetchMock';
import { page, sessionDetail, tenderRow, tenderSummary } from '../../testing/data';
import { renderSelection } from '../../testing/render';
import AssessmentSessionFormPage from './AssessmentSessionFormPage';

afterEach(() => vi.unstubAllGlobals());

const PATH = '/buyer/selection/assessments/new';

function routes(
  create: MockHandler = () => ({
    status: 201,
    body: sessionDetail({ sessionId: 9001, status: 'planned' }),
  }),
) {
  return {
    'GET /api/v1/buyer/selection/tenders': () => ({ body: page([tenderRow()]) }),
    'GET /api/v1/buyer/selection/tenders/9': () => ({ body: tenderSummary() }),
    'POST /api/v1/buyer/selection/assessment-sessions': create,
  };
}

function fillRequired(): void {
  fireEvent.change(screen.getByLabelText(/Session type/), { target: { value: 'demonstration' } });
  fireEvent.change(screen.getByLabelText(/^Purpose/), {
    target: { value: 'Demonstrate the correlator.' },
  });
  fireEvent.change(screen.getByLabelText(/^Agenda/), { target: { value: '08:00 set-up.' } });
  fireEvent.click(screen.getByRole('radio', { name: /Scored criterion/ }));
  fireEvent.change(screen.getByLabelText(/Instructions for every invitee/), {
    target: { value: 'Same instructions for all.' },
  });
}

describe('AssessmentSessionFormPage', () => {
  it('requires the announced criterion for a scored session before saving', async () => {
    const { requests } = installFetch(routes());
    renderSelection(<AssessmentSessionFormPage />, { path: PATH, route: `${PATH}?tenderId=9` });
    await screen.findByRole('option', { name: /Leak detection/ });
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Save as planned' }));
    expect(
      await screen.findByText('A scored session must name the announced criterion it feeds.'),
    ).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
  });

  it('creates the planned session and opens it', async () => {
    const { requests } = installFetch(routes());
    const { router } = renderSelection(<AssessmentSessionFormPage />, {
      path: PATH,
      route: `${PATH}?tenderId=9`,
    });
    await screen.findByRole('option', { name: /Leak detection/ });
    fillRequired();
    fireEvent.change(await screen.findByLabelText(/Announced criterion/), {
      target: { value: '9505' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save as planned' }));
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe('/buyer/selection/assessments/9001'),
    );
    expect(requests.find((request) => request.method === 'POST')?.body).toMatchObject({
      tenderId: 9,
      assessmentBasis: 'scored_criterion',
      criterionId: 9505,
      preparationDays: 5,
    });
  });

  it('explains a refused session type from the server', async () => {
    installFetch(
      routes(() =>
        problem(409, 'Conflict', {
          code: 'SESSION_TYPE_NOT_PERMITTED',
          detail: 'Not permitted.',
        }),
      ),
    );
    renderSelection(<AssessmentSessionFormPage />, { path: PATH, route: `${PATH}?tenderId=9` });
    await screen.findByRole('option', { name: /Leak detection/ });
    fillRequired();
    fireEvent.change(await screen.findByLabelText(/Announced criterion/), {
      target: { value: '9505' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save as planned' }));
    expect(
      await screen.findByText('The issued conditions do not permit this session type.'),
    ).toBeInTheDocument();
  });
});
