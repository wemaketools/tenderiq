import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  CHOBE,
  MANAGER,
  PIPE,
  businessError,
  decision,
  options,
  page,
  programRow,
  renderPage,
  routeCalls,
  screening,
  statusRow,
  summary,
  trigger,
} from '../../test/kit';
import MonitoringPage from './MonitoringPage';

vi.mock('../../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/buyer/qualification/monitoring', route: '/buyer/qualification/monitoring' };

function routes(extra: Record<string, (request: Record<string, unknown>) => unknown> = {}) {
  return routeCalls({
    'buyer.qualification.summary': () => summary(),
    'buyer.qualification.options': () => options(),
    'buyer.qualification.programs.list': () => page([programRow()]),
    'buyer.qualification.statuses.list': () =>
      page([
        statusRow(),
        statusRow({
          supplier: CHOBE,
          effectiveStatus: 'qualified_with_conditions',
          decisionId: 702,
          outcome: 'qualified_with_conditions',
          scopeCategory: PIPE,
          scopeMaxValue: { amount: '5000000.00', currency: 'BWP' },
          effectiveFrom: '2026-05-04',
          effectiveTo: '2028-05-03',
          reassessmentDate: '2026-10-08',
          conditions: 'Renew insurance.',
          blockedGate: 'award',
          expiresInDays: 580,
          openTriggerCount: 1,
          applicationInProgress: null,
        }),
      ]),
    'buyer.qualification.decisions.list': () => page([decision()]),
    'buyer.qualification.triggers.list': () => page([trigger()]),
    'buyer.qualification.screenings.list': () => page([screening()]),
    ...extra,
  });
}

describe('MonitoringPage (BUY-35)', () => {
  it('shows every supplier status, including "registered — not qualified", with scope, dates and triggers', async () => {
    routes();
    renderPage(<MonitoringPage />, { ...PATH, permissions: MANAGER });
    const notQualified = await screen.findByRole('row', { name: /Makgadikgadi Civil Works/ });
    expect(
      within(notQualified).getByText('Registered — not qualified for WTR-INFRA'),
    ).toBeInTheDocument();
    const chobe = screen.getByRole('row', { name: /Chobe Pipe & Valve Supplies/ });
    expect(
      within(chobe).getByText('Award blocked until the conditions are met'),
    ).toBeInTheDocument();
    expect(within(chobe).getByText('1 open trigger')).toBeInTheDocument();
    expect(screen.getByText('Decisions pending')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decide (1 pending)' })).toBeInTheDocument();
  });

  it('lists decisions and sends outcome and superseded filters', async () => {
    const calls = routes();
    renderPage(<MonitoringPage />, { ...PATH, permissions: MANAGER });
    fireEvent.click(await screen.findByRole('tab', { name: 'Decisions' }));
    expect(await screen.findByText('Decision 702')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Include superseded'));
    fireEvent.change(screen.getByLabelText('Outcome'), { target: { value: 'suspended' } });
    await waitFor(() =>
      expect(
        calls.filter((item) => item.id === 'buyer.qualification.decisions.list').at(-1)?.request,
      ).toEqual({
        query: expect.objectContaining({ includeSuperseded: true, outcome: ['suspended'] }),
      }),
    );
  });

  it('flags decisions with an open reconsideration or updated evidence and counts them in the summary', async () => {
    // Arrange
    routes({
      'buyer.qualification.summary': () => summary({ openReconsiderations: 1 }),
      'buyer.qualification.decisions.list': () =>
        page([decision({ id: 706, openReconsideration: true, evidenceUpdateCount: 1 })]),
    });
    renderPage(<MonitoringPage />, { ...PATH, permissions: MANAGER });
    expect(await screen.findByText('Reconsideration requests')).toBeInTheDocument();

    // Act
    fireEvent.click(await screen.findByRole('tab', { name: /^Decisions/ }));

    // Assert
    const row = (await screen.findByText('Decision 706')).closest('tr');
    if (row === null) throw new Error('decision row missing');
    expect(within(row).getByText('Reconsideration requested')).toBeInTheDocument();
    expect(within(row).getByText('1 evidence update')).toBeInTheDocument();
  });

  it('lists open triggers with their active-event impacts', async () => {
    routes();
    renderPage(<MonitoringPage />, { ...PATH, permissions: MANAGER });
    fireEvent.click(await screen.findByRole('tab', { name: /Triggers/ }));
    const row = await screen.findByRole('row', { name: /Chobe Pipe/ });
    expect(within(row).getByText('2 active bids')).toBeInTheDocument();
    expect(within(row).getByText('8 Oct 2026')).toBeInTheDocument();
  });

  it('reviews a screening flag as a human decision (BR-48)', async () => {
    routes({
      'buyer.qualification.screenings.review': () =>
        screening({
          reviewedBy: { userId: 8, fullName: 'Neo Mothibi' },
          reviewedAt: '2026-09-30T08:00:00Z',
          disposition: 'Different person.',
          effect: 'None.',
        }),
    });
    renderPage(<MonitoringPage />, { ...PATH, permissions: [...MANAGER, 'qualification.review'] });
    fireEvent.click(await screen.findByRole('tab', { name: /Screenings/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Review flag' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('A match only prompts review')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/^Disposition/), {
      target: { value: 'Different person.' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Effect/), { target: { value: 'None.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record review' }));
    expect(await screen.findByText('Screening review recorded.')).toBeInTheDocument();
    expect(screen.getByText('Different person.')).toBeInTheDocument();
  });

  it('checks the eligibility gate and says "Registered — not qualified" for a missing category (AC-07)', async () => {
    const calls = routes({
      'buyer.qualification.eligibility': () => ({
        supplier: {
          supplierTenantId: 6,
          name: 'Makgadikgadi Civil Works',
          legalName: 'Makgadikgadi Civil Works (Pty) Ltd',
          slug: 'makgadikgadi',
        },
        category: {
          categoryId: 32,
          code: 'WTR-PUMP',
          name: 'Pumps and mechanical equipment',
          parentId: 30,
        },
        gate: 'not_met',
        effectiveStatus: 'not_assessed',
        decisionId: null,
        program: { programId: 11, programName: 'Water Infrastructure Suppliers — Category A' },
        blockedGate: null,
        explanation: 'Registered on the platform but not qualified for WTR-PUMP.',
        evaluatedAt: '2026-09-30',
      }),
    });
    renderPage(<MonitoringPage />, { ...PATH, permissions: MANAGER });
    fireEvent.click(await screen.findByRole('tab', { name: 'Eligibility check' }));
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Makgadikgadi Civil Works' })).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText(/^Supplier/), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText(/^Category/), { target: { value: '32' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check eligibility' }));
    expect(await screen.findByText('Registered — not qualified for WTR-PUMP')).toBeInTheDocument();
    expect(calls.find((item) => item.id === 'buyer.qualification.eligibility')?.request).toEqual({
      query: { supplierTenantId: 6, categoryId: 32 },
    });
  });

  it('renders no restricted table when the statuses are refused', async () => {
    routes({
      'buyer.qualification.statuses.list': () => {
        throw businessError('buyer.qualification.statuses.list', 'FORBIDDEN', 403);
      },
    });
    renderPage(<MonitoringPage />, { ...PATH, permissions: MANAGER });
    expect(await screen.findByText('Decisions pending')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('table')).not.toBeInTheDocument());
    expect(screen.queryByText('Restricted')).not.toBeInTheDocument();
  });

  it('shows only the eligibility tab, without tiles or summary, to a directory viewer', async () => {
    const calls = routes();
    renderPage(<MonitoringPage />, { ...PATH, permissions: ['supplier.directory.view'] });
    expect(await screen.findByRole('tab', { name: 'Eligibility check' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.queryByText('Decisions pending')).not.toBeInTheDocument();
    expect(calls.some((item) => item.id === 'buyer.qualification.summary')).toBe(false);
    expect(calls.some((item) => item.id === 'buyer.qualification.statuses.list')).toBe(false);
  });

  it('leaves out the screening actions column for a membership that cannot review flags', async () => {
    routes();
    renderPage(<MonitoringPage />, { ...PATH, permissions: MANAGER });
    fireEvent.click(await screen.findByRole('tab', { name: /Screenings/ }));
    expect(await screen.findByText('Makgadikgadi Civil Works')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument();
  });
});
