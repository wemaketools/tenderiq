import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../../test/fetchMock';
import { diligenceDetail, tenderSummary } from '../../testing/data';
import { AUDITOR, OFFICER, renderSelection } from '../../testing/render';
import DiligenceCasePage from './DiligenceCasePage';

afterEach(() => vi.unstubAllGlobals());

const PATH = '/buyer/selection/due-diligence/:caseId';
const ROUTE = '/buyer/selection/due-diligence/2';

function routes(extra: Record<string, () => { status?: number; body?: unknown }> = {}) {
  return {
    'GET /api/v1/buyer/selection/due-diligence-cases/2': () => ({ body: diligenceDetail() }),
    'GET /api/v1/buyer/selection/tenders/9': () => ({ body: tenderSummary() }),
    ...extra,
  };
}

describe('DiligenceCasePage', () => {
  it('shows findings by area, the blocking reasons and the award gate', async () => {
    installFetch(routes());
    renderSelection(<DiligenceCasePage />, { path: PATH, route: ROUTE, permissions: OFFICER });
    expect(await screen.findByText('Readiness cannot be approved yet')).toBeInTheDocument();
    expect(screen.getByText('The award is blocked')).toBeInTheDocument();
    const areas = screen.getByRole('table', { name: 'Areas' });
    expect(within(areas).getByText('Insurance')).toBeInTheDocument();
    expect(screen.getByText('Blocks award')).toBeInTheDocument();
  });

  it('offers only team members holding diligence.manage as finding owners', async () => {
    installFetch(routes());
    renderSelection(<DiligenceCasePage />, { path: PATH, route: ROUTE, permissions: OFFICER });
    fireEvent.click(await screen.findByRole('button', { name: 'Record finding' }));
    const owner = within(screen.getByRole('dialog')).getByLabelText(/^Owner/);
    await vi.waitFor(() =>
      expect(within(owner).getByRole('option', { name: 'Tebogo Molefe' })).toBeInTheDocument(),
    );
    expect(within(owner).queryByRole('option', { name: 'Mpho Dikgang' })).not.toBeInTheDocument();
  });

  it('requires an owner and due date for an unresolved finding', async () => {
    const { requests } = installFetch(routes());
    renderSelection(<DiligenceCasePage />, { path: PATH, route: ROUTE, permissions: OFFICER });
    fireEvent.click(await screen.findByRole('button', { name: 'Record finding' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Area/), { target: { value: 'capacity' } });
    fireEvent.change(within(dialog).getByLabelText(/^Finding/), {
      target: { value: 'Crew size unclear.' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Disposition/), {
      target: { value: 'unresolved' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record finding' }));
    expect(await within(dialog).findByText('An open finding needs an owner.')).toBeInTheDocument();
    expect(within(dialog).getByText('An open finding needs a due date.')).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
  });

  it('rejects readiness when approval is blocked and records the failure (AC-24)', async () => {
    const { requests } = installFetch(
      routes({
        'POST /api/v1/buyer/selection/due-diligence-cases/2/decide': () => ({
          body: diligenceDetail({ status: 'failed', decisionNote: 'Insurance lapsed.' }),
        }),
      }),
    );
    renderSelection(<DiligenceCasePage />, { path: PATH, route: ROUTE, permissions: OFFICER });
    fireEvent.click(await screen.findByRole('button', { name: 'Decide readiness' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('radio', { name: /Approve readiness/ })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Decision note/), {
      target: { value: 'Insurance lapsed.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject readiness' }));
    expect(
      await screen.findAllByText('The case failed: a fallback decision is required'),
    ).not.toHaveLength(0);
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      outcome: 'failed',
      decisionNote: 'Insurance lapsed.',
    });
  });

  it('offers no command to a read-only auditor', async () => {
    installFetch(routes());
    renderSelection(<DiligenceCasePage />, { path: PATH, route: ROUTE, permissions: AUDITOR });
    await screen.findByText('Readiness cannot be approved yet');
    expect(screen.queryByRole('button', { name: 'Decide readiness' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request evidence' })).not.toBeInTheDocument();
  });
});
