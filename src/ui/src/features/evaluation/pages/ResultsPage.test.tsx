import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { overview, ranking } from '../testing/builders';
import { CHAIR, OFFICER, THATO, businessError, renderPage, routeCalls } from '../testing/kit';
import ResultsPage from './ResultsPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/buyer/evaluation/tenders/:tenderId/results',
  route: '/buyer/evaluation/tenders/3/results',
};

function inSignoff() {
  const base = ranking();
  if (base.report === null) throw new Error('fixture');
  return ranking({
    readiness: [
      { id: 'moderation', status: 'passed', label: 'Moderation finalized', detail: null },
    ],
    report: {
      ...base.report,
      status: 'in_signoff',
      summary: 'Supplier B recommended.',
      submittedForSignoffAt: '2026-09-30T08:00:00Z',
    },
  });
}

describe('ResultsPage (EVA-06)', () => {
  it('ranks the PRD §9.2 example: 88.00 for Supplier B first and 86.00 for Supplier A (AC-19)', async () => {
    routeCalls({
      'buyer.evaluation.results.get': () => ranking(),
      'buyer.evaluation.get': () => overview(),
    });
    renderPage(<ResultsPage />, { ...PATH, persona: CHAIR });

    const table = await screen.findByRole('table', { name: 'Ranking' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(
      within(rows[0] as HTMLElement).getByText('Supplier B (Tsodilo Engineering)'),
    ).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText('88.00')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText('31.50')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText('25.00')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText('Exceeds budget')).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText('86.00')).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText('28.00')).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText('BWP 100,000.00')).toBeInTheDocument();
    expect(screen.getByText('Supplier B · 88.00')).toBeInTheDocument();
  });

  it('separates blocking items from warnings and shows the refusal when the report is not ready (AC-18)', async () => {
    routeCalls({
      'buyer.evaluation.results.get': () => ranking(),
      'buyer.evaluation.get': () => overview(),
      'buyer.evaluation.reports.submit': () => {
        throw businessError(
          'buyer.evaluation.reports.submit',
          'REPORT_NOT_READY',
          409,
          'Individual assessment incomplete: Amantle Segwai',
        );
      },
    });
    renderPage(<ResultsPage />, { ...PATH, persona: CHAIR });

    expect(await screen.findByText('1 blocking')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Submit for sign-off' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('1 blocking item must be resolved first.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/^Report summary/), {
      target: { value: 'Supplier B recommended.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Submit for sign-off' }));
    expect(
      await within(dialog).findByText(/The report is not ready for sign-off./),
    ).toBeInTheDocument();
  });

  it('lets a committee member sign the report in sign-off', async () => {
    const calls = routeCalls({
      'buyer.evaluation.results.get': () => inSignoff(),
      'buyer.evaluation.get': () => overview(),
      'buyer.evaluation.reports.signoff': () => {
        const report = inSignoff().report;
        if (report === null) throw new Error('fixture');
        return {
          ...report,
          signoffs: report.signoffs.map((line) =>
            line.signer.userId === 11
              ? { ...line, signoffId: 901, decision: 'signed', decidedAt: '2026-09-30T09:00:00Z' }
              : line,
          ),
        };
      },
    });
    renderPage(<ResultsPage />, { ...PATH, persona: THATO });

    fireEvent.click(await screen.findByRole('button', { name: 'Sign or decline' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign' }));

    await waitFor(() =>
      expect(calls.find((item) => item.id === 'buyer.evaluation.reports.signoff')?.request).toEqual(
        {
          params: { reportId: 3801 },
          body: { decision: 'signed' },
        },
      ),
    );
    expect(
      await screen.findByText('You have already recorded your decision: Signed.'),
    ).toBeInTheDocument();
  });

  it('requires a note to decline', async () => {
    routeCalls({
      'buyer.evaluation.results.get': () => inSignoff(),
      'buyer.evaluation.get': () => overview(),
    });
    renderPage(<ResultsPage />, { ...PATH, persona: THATO });
    fireEvent.click(await screen.findByRole('button', { name: 'Sign or decline' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByLabelText('Decline'));
    expect(within(dialog).getByRole('button', { name: 'Decline' })).toBeDisabled();
  });

  it('queues an export for the award team without offering chair actions', async () => {
    const calls = routeCalls({
      'buyer.evaluation.results.get': () => inSignoff(),
      'buyer.evaluation.get': () => overview(),
      'buyer.evaluation.reports.export': () => ({
        exportId: 905,
        reportId: 3801,
        exportType: 'evaluation_report',
        format: 'xlsx',
        status: 'queued',
        requestedAt: '2026-09-30T09:00:00Z',
        requestedBy: { userId: 5, fullName: 'Tebogo Molefe' },
        scopeDescription: 'T-2026-0003 evaluation report v1',
      }),
    });
    renderPage(<ResultsPage />, { ...PATH, persona: OFFICER });

    expect(await screen.findByRole('table', { name: 'Ranking' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Validate results' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Export report' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Export as XLSX' }));
    expect(await screen.findByText('Export requested')).toBeInTheDocument();
    expect(calls.at(-1)?.request).toEqual({ params: { reportId: 3801 }, body: { format: 'xlsx' } });
  });

  it('asks an evaluator to submit their own assessment before seeing results', async () => {
    routeCalls({
      'buyer.evaluation.get': () => overview(),
      'buyer.evaluation.results.get': () => {
        throw businessError('buyer.evaluation.results.get', 'OWN_ASSESSMENT_NOT_SUBMITTED');
      },
    });
    renderPage(<ResultsPage />, { ...PATH, persona: THATO });
    expect(await screen.findByText('Submit your own assessment first')).toBeInTheDocument();
  });

  it('names a failed gate in plain language and the tie rule by its label, never by code', async () => {
    const base = ranking();
    const [first, second] = base.results;
    if (first === undefined || second === undefined) throw new Error('fixture');
    routeCalls({
      'buyer.evaluation.results.get': () =>
        ranking({
          results: [
            { ...first, tieBreakApplied: 'highest_non_price' },
            {
              ...second,
              rank: null,
              passesGates: false,
              gateFailures: ['MANDATORY_REQUIREMENT_FAILED', 'CRITERION_MINIMUM:C1'],
            },
          ],
        }),
      'buyer.evaluation.get': () => overview(),
    });
    renderPage(<ResultsPage />, { ...PATH, persona: CHAIR });

    const table = await screen.findByRole('table', { name: 'Ranking' });
    expect(within(table).getByText('Failed a mandatory requirement')).toBeInTheDocument();
    expect(
      within(table).getByText(/Below the minimum rating on Solution quality/),
    ).toBeInTheDocument();
    expect(within(table).queryByText('MANDATORY_REQUIREMENT_FAILED')).not.toBeInTheDocument();
    expect(within(table).queryByText('highest_non_price')).not.toBeInTheDocument();
  });

  it('shows a tender-team observer totals only: no criterion points, no readiness and no role notice', async () => {
    const base = ranking();
    routeCalls({
      'buyer.evaluation.results.get': () =>
        ranking({
          detail: 'totals_only',
          readiness: [],
          report: null,
          results: base.results.map((row) => ({ ...row, criterionPoints: [] })),
        }),
      'buyer.evaluation.get': () => overview(),
    });
    renderPage(<ResultsPage />, { ...PATH, persona: OFFICER });

    const table = await screen.findByRole('table', { name: 'Ranking' });
    expect(screen.queryByText('Totals only until sign-off')).not.toBeInTheDocument();
    expect(within(table).getByText('88.00')).toBeInTheDocument();
    expect(within(table).queryByText('31.50')).not.toBeInTheDocument();
    expect(screen.queryByText('Sign-off readiness')).not.toBeInTheDocument();
  });

  it('shows an award approver outside the tender team only the signed-off report versions, without a role notice', async () => {
    const signedOff = ranking().report;
    if (signedOff === null) throw new Error('fixture');
    routeCalls({
      'buyer.evaluation.results.get': () =>
        ranking({
          detail: 'reports_only',
          computedAt: null,
          readiness: [],
          results: [],
          report: null,
          reportHistory: [
            {
              ...signedOff,
              status: 'superseded',
              signedOffAt: '2026-09-04T11:30:00Z',
              handedOffAt: '2026-09-07T07:30:00Z',
            },
          ],
        }),
      'buyer.evaluation.get': () => overview(),
    });
    renderPage(<ResultsPage />, { ...PATH, persona: OFFICER });

    expect(await screen.findByText('Earlier report version')).toBeInTheDocument();
    expect(screen.queryByText('Signed-off reports only')).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Ranking' })).not.toBeInTheDocument();
    expect(
      screen.queryByText('Validate the results to prepare the report.'),
    ).not.toBeInTheDocument();
  });
});
