import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  ASSESSOR,
  applicationRow,
  businessError,
  options,
  page,
  programRow,
  renderPage,
  routeCalls,
  summary,
} from '../../test/kit';
import QueuePage from './QueuePage';

vi.mock('../../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/buyer/qualification', route: '/buyer/qualification' };
const LIST = 'buyer.qualification.applications.list';

function standardRoutes(rows = [applicationRow()]) {
  return {
    [LIST]: () => page(rows),
    'buyer.qualification.summary': () => summary(),
    'buyer.qualification.options': () => options(),
    'buyer.qualification.programs.list': () => page([programRow()]),
  };
}

describe('QueuePage (BUY-33)', () => {
  it('lists each application with category, risk, completeness, assessors, due date and renewal status', async () => {
    routeCalls(standardRoutes());
    renderPage(<QueuePage />, { ...PATH, permissions: ASSESSOR });

    const row = await screen.findByRole('row', { name: /QA-2026-0006/ });
    expect(within(row).getByText('Makgadikgadi Civil Works')).toBeInTheDocument();
    expect(within(row).getByText('WTR-PUMP')).toBeInTheDocument();
    expect(within(row).getByText('12 of 13 answered')).toBeInTheDocument();
    expect(within(row).getByText('1 mandatory evidence missing')).toBeInTheDocument();
    expect(within(row).getByText('Financial: Lesego Seretse')).toBeInTheDocument();
    expect(within(row).getAllByText(/Africa\/Gaborone/).length).toBeGreaterThan(0);
    expect(within(row).getByText('New application')).toBeInTheDocument();
    expect(screen.getByText('In the queue')).toBeInTheDocument();
  });

  it('asks for the open statuses by default and sends status chips, filters and sort', async () => {
    const calls = routeCalls(standardRoutes());
    renderPage(<QueuePage />, { ...PATH, permissions: ASSESSOR });
    await screen.findByRole('row', { name: /QA-2026-0006/ });
    expect(calls.find((item) => item.id === LIST)?.request).toEqual({
      query: expect.objectContaining({
        status: ['submitted', 'under_review', 'more_info_required', 'decision_pending'],
      }),
    });

    fireEvent.click(screen.getByRole('button', { name: /Decision pending \(1\)/ }));
    fireEvent.click(screen.getByLabelText('Overdue only'));
    fireEvent.change(screen.getByLabelText('Risk'), { target: { value: 'high' } });

    await waitFor(() =>
      expect(calls.filter((item) => item.id === LIST).at(-1)?.request).toEqual({
        query: expect.objectContaining({
          status: ['decision_pending'],
          overdue: true,
          riskLevel: ['high'],
          sort: 'dueAt',
          page: 1,
        }),
      }),
    );
  });

  it('assigns an assessor and financial reviewer with a due date and names the assignee', async () => {
    const unassigned = applicationRow({
      id: 506,
      reference: 'QA-2026-0008',
      assessor: null,
      financialReviewer: null,
      status: 'submitted',
      dueAt: null,
    });
    const calls = routeCalls({
      ...standardRoutes([unassigned]),
      'buyer.qualification.applications.assign': () =>
        applicationRow({ id: 506, reference: 'QA-2026-0008', status: 'submitted' }),
    });
    renderPage(<QueuePage />, { ...PATH, permissions: ASSESSOR });
    const row = await screen.findByRole('row', { name: /QA-2026-0008/ });
    fireEvent.click(within(row).getByRole('button', { name: 'Assign' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Assign review' }));
    expect((await within(dialog).findAllByText('This field is required.')).length).toBeGreaterThan(
      0,
    );
    expect(calls.some((item) => item.id === 'buyer.qualification.applications.assign')).toBe(false);

    await waitFor(() =>
      expect(within(dialog).getByRole('option', { name: /Neo Mothibi/ })).toBeInTheDocument(),
    );
    fireEvent.change(within(dialog).getByLabelText(/^Assessor/), { target: { value: '8' } });
    fireEvent.change(within(dialog).getByLabelText(/^Specialist financial reviewer/), {
      target: { value: '9' },
    });
    const date = dialog.querySelector('input[type="date"]');
    const time = dialog.querySelector('input[type="time"]');
    if (date === null || time === null) throw new Error('due inputs missing');
    fireEvent.change(date, { target: { value: '2026-10-20' } });
    fireEvent.change(time, { target: { value: '17:00' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Assign review' }));

    await waitFor(() =>
      expect(
        calls.find((item) => item.id === 'buyer.qualification.applications.assign')?.request,
      ).toEqual({
        params: { applicationId: 506 },
        body: expect.objectContaining({
          assessorUserId: 8,
          financialReviewerUserId: 9,
          dueAt: '2026-10-20T15:00:00Z',
        }),
      }),
    );
    expect(await screen.findByText('QA-2026-0008 assigned to Neo Mothibi.')).toBeInTheDocument();
  });

  it('requests missing material from the supplier', async () => {
    const calls = routeCalls({
      ...standardRoutes(),
      'buyer.qualification.applications.requestInfo': () => ({
        infoRequest: {
          id: 900,
          applicationId: 503,
          criterionId: null,
          criterionQuestion: null,
          area: null,
          question: 'Send the ISO 9001 audit plan.',
          requestedBy: { userId: 8, fullName: 'Neo Mothibi' },
          requestedAt: '2026-09-30T08:00:00Z',
          dueAt: { at: '2026-10-10T15:00:00Z', timeZone: 'Africa/Gaborone' },
          status: 'open',
          responseText: null,
          respondedBy: null,
          respondedAt: null,
          responseEvidence: [],
        },
        applicationStatus: 'more_info_required',
      }),
    });
    renderPage(<QueuePage />, { ...PATH, permissions: ASSESSOR });
    const row = await screen.findByRole('row', { name: /QA-2026-0006/ });
    fireEvent.click(within(row).getByRole('button', { name: 'Request information' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Question to the supplier/), {
      target: { value: 'Send the ISO 9001 audit plan.' },
    });
    const date = dialog.querySelector('input[type="date"]');
    const time = dialog.querySelector('input[type="time"]');
    if (date === null || time === null) throw new Error('due inputs missing');
    fireEvent.change(date, { target: { value: '2026-10-10' } });
    fireEvent.change(time, { target: { value: '17:00' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send request' }));

    expect(await screen.findByText(/Request sent for QA-2026-0006/)).toBeInTheDocument();
    expect(
      calls.find((item) => item.id === 'buyer.qualification.applications.requestInfo')?.request,
    ).toEqual({
      params: { applicationId: 503 },
      body: {
        criterionId: null,
        question: 'Send the ISO 9001 audit plan.',
        dueAt: '2026-10-10T15:00:00Z',
      },
    });
  });

  it('explains an empty queue', async () => {
    routeCalls(standardRoutes([]));
    renderPage(<QueuePage />, { ...PATH, permissions: ASSESSOR });
    expect(await screen.findByText('The queue is empty')).toBeInTheDocument();
  });

  it('shows the restricted state when the API refuses access', async () => {
    routeCalls({
      ...standardRoutes(),
      [LIST]: () => {
        throw businessError(LIST, 'FORBIDDEN', 403);
      },
    });
    renderPage(<QueuePage />, { ...PATH, permissions: ASSESSOR });
    expect((await screen.findAllByText('Restricted')).length).toBeGreaterThan(0);
  });

  it('hides assignment from a financial reviewer who can only request information', async () => {
    routeCalls(standardRoutes());
    renderPage(<QueuePage />, { ...PATH, permissions: ['qualification.financial_review'] });
    const row = await screen.findByRole('row', { name: /QA-2026-0006/ });
    expect(within(row).queryByRole('button', { name: /Assign/ })).not.toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Request information' })).toBeInTheDocument();
  });
});
