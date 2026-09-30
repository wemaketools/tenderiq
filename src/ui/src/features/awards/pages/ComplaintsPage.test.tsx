import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import { complaint, complaintPage, evidenceDocument, ownerCandidates } from '../test/data';
import { renderBuyer } from '../test/render';
import ComplaintPage from './ComplaintPage';
import ComplaintsPage from './ComplaintsPage';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ComplaintsPage (BUY-29)', () => {
  it('lists complaints with the hold shown separately from the case status', async () => {
    installFetch({ 'GET /api/v1/buyer/complaints': () => ({ body: complaintPage() }) });
    renderBuyer(<ComplaintsPage />, {
      route: '/buyer/award-cases/complaints',
      path: '/buyer/award-cases/complaints',
    });

    expect((await screen.findAllByText('CMP-2026-0002')).length).toBeGreaterThan(0);
    expect(screen.getByText('Hold active')).toBeInTheDocument();
    expect(screen.getAllByText('Unassigned').length).toBeGreaterThan(0);
  });

  it('lays the filters, KPIs and table out in a spaced page', async () => {
    installFetch({ 'GET /api/v1/buyer/complaints': () => ({ body: complaintPage() }) });
    renderBuyer(<ComplaintsPage />, {
      route: '/buyer/award-cases/complaints',
      path: '/buyer/award-cases/complaints',
    });

    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading.closest('.tiq-page')).not.toBeNull();
  });
});

describe('ComplaintPage (BUY-29)', () => {
  const OPTIONS = {
    route: '/buyer/award-cases/complaints/92',
    path: '/buyer/award-cases/complaints/:complaintId',
  };
  const GET = 'GET /api/v1/buyer/complaints/92';

  it('acknowledges a received complaint with the standing and timeliness assessment', async () => {
    const { requests } = installFetch({
      [GET]: () => ({ body: complaint() }),
      'POST /api/v1/buyer/complaints/92/acknowledge': () => ({
        body: complaint({ status: 'acknowledged', acknowledgedAt: '2026-09-25T12:00:00Z' }),
      }),
    });
    renderBuyer(<ComplaintPage />, OPTIONS);

    expect(await screen.findByText('A procurement hold is active')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Acknowledge' })[0] as HTMLElement);
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /has standing/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Acknowledge' }));

    expect(await screen.findByText('Complaint acknowledged.')).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      standingConfirmed: true,
      withinWindow: true,
    });
  });

  it('offers only independent owners and shows the refusal for a challenged owner', async () => {
    installFetch({
      [GET]: () => ({ body: complaint({ status: 'acknowledged' }) }),
      'GET /api/v1/buyer/complaints/92/owner-candidates': () => ({ body: ownerCandidates() }),
      'POST /api/v1/buyer/complaints/92/owner': () =>
        problem(409, 'Conflict', { code: 'OWNER_NOT_INDEPENDENT', detail: 'Not independent.' }),
    });
    renderBuyer(<ComplaintPage />, OPTIONS);

    await userEvent.click(await screen.findByRole('button', { name: 'Assign case owner' }));
    const dialog = screen.getByRole('dialog');
    const select = await within(dialog).findByLabelText(/^Case owner/);
    const option = await within(dialog).findByRole('option', { name: /Mpho Dikgang/ });
    expect(option).toBeDisabled();
    expect(
      within(dialog).getByText(
        'Mpho Dikgang: Approved the release of the challenged tender terms.',
      ),
    ).toBeInTheDocument();
    await userEvent.selectOptions(select, '17');
    await userEvent.click(within(dialog).getByRole('checkbox'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Assign case owner' }));

    expect(
      await within(dialog).findByText(
        'This person’s conduct is challenged; choose an independent owner.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the case read-only to an auditor, with the evidence documents of the complaint', async () => {
    const { requests } = installFetch({
      [GET]: () => ({ body: complaint() }),
      'GET /api/v1/buyer/documents': () => ({
        body: { items: [evidenceDocument()], total: 1, page: 1, pageSize: 25 },
      }),
    });
    renderBuyer(<ComplaintPage />, { ...OPTIONS, permissions: ['audit.view'] });

    expect(await screen.findByText('Complaint letter.pdf')).toBeInTheDocument();
    const list = requests.find((request) => request.path === '/api/v1/buyer/documents');
    expect(list?.search).toContain('relatedType=complaint');
    expect(list?.search).toContain('relatedId=92');
    expect(screen.queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Release hold' })).not.toBeInTheDocument();
  });
});
