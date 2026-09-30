import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../../test/fetchMock';
import { bidA, referenceCheck, sessionDetail } from '../../testing/data';
import { AUDITOR, OFFICER, renderSelection } from '../../testing/render';
import AssessmentSessionPage from './AssessmentSessionPage';

afterEach(() => vi.unstubAllGlobals());

const PATH = '/buyer/selection/assessments/:sessionId';
const ROUTE = '/buyer/selection/assessments/1';

describe('AssessmentSessionPage', () => {
  it('shows the announced treatment, equal-treatment checks, invitations and next action', async () => {
    installFetch({
      'GET /api/v1/buyer/selection/assessment-sessions/1': () => ({ body: sessionDetail() }),
    });
    renderSelection(<AssessmentSessionPage />, { path: PATH, route: ROUTE });

    expect(await screen.findByText('Announced evaluation treatment')).toBeInTheDocument();
    expect(screen.getByText('Findings feed the announced criterion only.')).toBeInTheDocument();
    expect(screen.getByText('The assessment basis is declared')).toBeInTheDocument();
    expect(screen.getByText('Next: record findings')).toBeInTheDocument();
    const invites = screen.getByRole('table', { name: 'Invitations and participants' });
    expect(within(invites).getByText('Otsile Serowe')).toBeInTheDocument();
  });

  it('confirms equal treatment only after the explicit acknowledgement', async () => {
    const pending = sessionDetail({
      status: 'planned',
      equalTreatmentConfirmed: false,
      equalTreatment: { confirmedBy: null, confirmedAt: null, checks: [] },
      invites: [],
    });
    const { requests } = installFetch({
      'GET /api/v1/buyer/selection/assessment-sessions/1': () => ({ body: pending }),
      'POST /api/v1/buyer/selection/assessment-sessions/1/equal-treatment': () => ({
        body: sessionDetail({ status: 'planned', invites: [] }),
      }),
    });
    renderSelection(<AssessmentSessionPage />, { path: PATH, route: ROUTE, permissions: OFFICER });

    fireEvent.click(await screen.findByRole('button', { name: 'Confirm equal treatment' }));
    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Confirm equal treatment' });
    expect(confirm).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(confirm);

    expect(await screen.findByText('Equal treatment confirmed.')).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'POST')?.body).toMatchObject({
      confirmed: true,
    });
    expect(
      (await screen.findAllByRole('button', { name: 'Issue invitations' })).length,
    ).toBeGreaterThan(0);
  });

  it('offers only the effects the announced basis allows when recording a finding (AC-21)', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/selection/assessment-sessions/1': () => ({ body: sessionDetail() }),
      'POST /api/v1/buyer/selection/assessment-sessions/1/findings': () => ({
        status: 201,
        body: {
          findingId: 9001,
          bid: bidA,
          assessor: { userId: 5, fullName: 'Tebogo Molefe' },
          finding: 'Located all four seeded leaks.',
          effect: 'score_input',
          evidenceDocumentId: null,
          evidenceTitle: null,
          recordedAt: '2026-10-07T12:00:00Z',
        },
      }),
    });
    renderSelection(<AssessmentSessionPage />, { path: PATH, route: ROUTE, permissions: OFFICER });

    fireEvent.click(await screen.findByRole('button', { name: 'Record finding' }));
    const dialog = screen.getByRole('dialog');
    const effect = within(dialog).getByLabelText(/^Effect/);
    expect(
      within(effect)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Select…', 'Score input']);
    fireEvent.change(within(dialog).getByLabelText(/^Candidate/), { target: { value: '907' } });
    fireEvent.change(within(dialog).getByLabelText(/^Finding/), {
      target: { value: 'Located all four seeded leaks.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record finding' }));

    expect(await screen.findByText('Finding recorded.')).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'POST')?.body).toMatchObject({
      bidId: 907,
      effect: 'score_input',
    });
  });

  it('refuses feedback without consent and hides every command for a read-only auditor', async () => {
    installFetch({
      'GET /api/v1/buyer/selection/assessment-sessions/1': () => ({
        body: sessionDetail({
          sessionType: 'reference_check',
          referenceChecks: [referenceCheck({ consentConfirmed: false })],
        }),
      }),
    });
    renderSelection(<AssessmentSessionPage />, { path: PATH, route: ROUTE, permissions: AUDITOR });
    expect(await screen.findByText('No consent')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record feedback' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete session' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record finding' })).not.toBeInTheDocument();
  });
});
