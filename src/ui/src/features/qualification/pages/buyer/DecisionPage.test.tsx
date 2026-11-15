import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { syncServerClock } from '../../../../lib/clock';

import {
  ASSESSOR,
  MANAGER,
  businessError,
  decisionDetail,
  options,
  renderPage,
  routeCalls,
  trigger,
} from '../../test/kit';
import DecisionPage from './DecisionPage';

vi.mock('../../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/buyer/qualification/decisions/:decisionId',
  route: '/buyer/qualification/decisions/702',
};

const LIMPOPO_ADMIN = { userId: 61, fullName: 'Kagiso Pule' };

/** A decision the supplier challenged (SUP-24): an open reconsideration and one evidence update. */
function challenged() {
  return decisionDetail({
    openReconsideration: true,
    evidenceUpdateCount: 1,
    triggers: [
      trigger({
        id: 906,
        triggerType: 'manual',
        sourceType: 'evidence_submission',
        sourceId: 971,
        summary: 'Updated evidence supplied against the decision.',
        lapsesOn: null,
      }),
      trigger({
        id: 907,
        triggerType: 'manual',
        sourceType: 'reconsideration_request',
        sourceId: 981,
        summary: 'The supplier asks that the restriction be lifted.',
        lapsesOn: null,
      }),
    ],
    reconsideration: {
      decisionId: 702,
      grounds: 'The renewed policy is bound from 9 Oct 2026.',
      requestedAt: '2026-09-19T08:30:00Z',
      requestedBy: LIMPOPO_ADMIN,
      evidenceItemIds: [809],
      appealRoute: 'Request reconsideration within 14 days.',
      resolvedByDecisionId: null,
    },
    evidenceUpdates: [
      {
        id: 971,
        decisionId: 702,
        evidenceItemId: 809,
        title: 'Insurance renewal cover note',
        expiresAt: '2027-10-08',
        note: 'Cover note from the insurer; the certificate follows.',
        submittedAt: '2026-09-18T14:00:00Z',
        submittedBy: LIMPOPO_ADMIN,
      },
    ],
  });
}

function categoryOptionTexts(container: HTMLElement): string[] {
  const select = within(container).getByLabelText(/^Category/);
  return within(select)
    .getAllByRole('option')
    .map((option) => option.textContent ?? '');
}

beforeEach(() => {
  // The application clock at the session's server time, so dates are judged on the fixtures' dates, not today's.
  syncServerClock('2026-09-29T08:00:00Z');
});

describe('DecisionPage (BUY-35)', () => {
  it('shows scope, dates, conditions, reasons, history, triggers, impacts and expiring evidence (AC-09)', async () => {
    routeCalls({
      'buyer.qualification.decisions.get': () => decisionDetail(),
      'buyer.qualification.options': () => options(),
    });
    renderPage(<DecisionPage />, { ...PATH, permissions: MANAGER });

    expect(
      await screen.findByText('Decision 702 — Chobe Pipe & Valve Supplies'),
    ).toBeInTheDocument();
    expect(screen.getByText('1 reassessment trigger is open')).toBeInTheDocument();
    expect(
      screen.getAllByText('Award blocked until the conditions are met').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Insurance expiry handled as a condition.')).toBeInTheDocument();
    expect(
      screen.getByText('Public liability insurance expires on 8 Oct 2026.'),
    ).toBeInTheDocument();
    expect(screen.getByText('T-2026-0006')).toBeInTheDocument();
    expect(screen.getByText('T-2026-0008')).toBeInTheDocument();
    expect(screen.getByText('Public liability insurance certificate')).toBeInTheDocument();
    expect(screen.getByText(/Next: assess 1 open trigger/)).toBeInTheDocument();
  });

  it('supersedes with a new decision that answers the open trigger and keeps the earlier one', async () => {
    const calls = routeCalls({
      'buyer.qualification.decisions.get': () => decisionDetail(),
      'buyer.qualification.options': () => options(),
      'buyer.qualification.decisions.supersede': () =>
        decisionDetail({ id: 900, outcome: 'suspended', supersedeReason: 'Insurance lapsed.' }),
    });
    renderPage(<DecisionPage />, { ...PATH, permissions: MANAGER });
    fireEvent.click(await screen.findByRole('button', { name: 'Record new decision' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText('Expired')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByLabelText('Suspended'));
    fireEvent.change(within(dialog).getByLabelText(/^Reason for the new decision/), {
      target: { value: 'Insurance lapsed.' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Reasons \(internal\)/), {
      target: { value: 'Lapsed.' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Explanation to the supplier/), {
      target: { value: 'Suspended until renewed insurance.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Review decision' }));

    const confirm = await screen.findByRole('dialog', { name: 'Record superseding decision' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Record new decision' }));
    expect(await screen.findByText('Decision 900 recorded: Suspended.')).toBeInTheDocument();
    expect(screen.getByText('Superseded decision')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        calls.find((item) => item.id === 'buyer.qualification.decisions.supersede')?.request,
      ).toEqual({
        params: { decisionId: 702 },
        body: expect.objectContaining({
          outcome: 'suspended',
          triggerId: 901,
          blockedGate: 'award',
        }),
      }),
    );
  });

  it('shows the decider the supplier’s open reconsideration and updated evidence with the next action', async () => {
    // Arrange
    routeCalls({
      'buyer.qualification.decisions.get': () => challenged(),
      'buyer.qualification.options': () => options(),
    });

    // Act
    renderPage(<DecisionPage />, { ...PATH, permissions: MANAGER });

    // Assert
    expect(await screen.findByText('The supplier asked for reconsideration')).toBeInTheDocument();
    expect(
      screen.getByText(/Kagiso Pule asked on .*; 1 updated evidence item was supplied/),
    ).toBeInTheDocument();
    expect(screen.getByText('The renewed policy is bound from 9 Oct 2026.')).toBeInTheDocument();
    expect(screen.getByText('Awaiting your decision')).toBeInTheDocument();
    expect(screen.getAllByText('Insurance renewal cover note').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Cover note from the insurer; the certificate follows\./),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Next: answer the supplier’s reconsideration request/),
    ).toBeInTheDocument();
  });

  it('answers the reconsideration with a new decision tied to its trigger, offering only covered categories', async () => {
    // Arrange
    const calls = routeCalls({
      'buyer.qualification.decisions.get': () => challenged(),
      'buyer.qualification.options': () => options(),
      'buyer.qualification.decisions.supersede': () =>
        decisionDetail({ id: 900, outcome: 'qualified', supersedeReason: 'Renewed cover.' }),
    });
    renderPage(<DecisionPage />, { ...PATH, permissions: MANAGER });
    const banner = (await screen.findByText('The supplier asked for reconsideration')).closest(
      '.tiq-banner',
    );
    if (!(banner instanceof HTMLElement)) throw new Error('reconsideration banner missing');

    // Act
    fireEvent.click(within(banner).getByRole('button', { name: 'Record new decision' }));
    const dialog = await screen.findByRole('dialog');
    const texts = categoryOptionTexts(dialog);
    fireEvent.click(within(dialog).getByLabelText('Qualified'));
    fireEvent.change(within(dialog).getByLabelText(/^Reason for the new decision/), {
      target: { value: 'Renewed cover.' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Reasons \(internal\)/), {
      target: { value: 'Cover in place.' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Explanation to the supplier/), {
      target: { value: 'Qualified again.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Review decision' }));
    const confirm = await screen.findByRole('dialog', { name: 'Record superseding decision' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Record new decision' }));

    // Assert
    expect(texts.some((text) => text.includes('WTR-PIPE'))).toBe(true);
    expect(texts.some((text) => text.includes('ICT-SCADA'))).toBe(false);
    expect(await screen.findByText('Answered by decision 900')).toBeInTheDocument();
    expect(screen.queryByText('The supplier asked for reconsideration')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        calls.find((item) => item.id === 'buyer.qualification.decisions.supersede')?.request,
      ).toEqual({
        params: { decisionId: 702 },
        body: expect.objectContaining({ outcome: 'qualified', triggerId: 907 }),
      }),
    );
  });

  it('says so when the supplier neither asked for reconsideration nor supplied evidence', async () => {
    routeCalls({
      'buyer.qualification.decisions.get': () => decisionDetail(),
      'buyer.qualification.options': () => options(),
    });
    renderPage(<DecisionPage />, { ...PATH, permissions: MANAGER });
    expect(
      await screen.findByText('The supplier has not asked for reconsideration.'),
    ).toBeInTheDocument();
    expect(screen.getByText('The supplier has not supplied updated evidence.')).toBeInTheDocument();
  });

  it('requests a renewal and shows its official due time', async () => {
    routeCalls({
      'buyer.qualification.decisions.get': () => decisionDetail(),
      'buyer.qualification.options': () => options(),
      'buyer.qualification.decisions.requestRenewal': () => ({
        decisionId: 702,
        supplier: decisionDetail().supplier,
        requestedAt: '2026-09-30T08:00:00Z',
        dueAt: { at: '2026-11-30T15:00:00Z', timeZone: 'Africa/Gaborone' },
        message: 'Please renew.',
      }),
    });
    renderPage(<DecisionPage />, { ...PATH, permissions: MANAGER });
    fireEvent.click(await screen.findByRole('button', { name: 'Request renewal' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Message to the supplier/), {
      target: { value: 'Please renew.' },
    });
    const date = dialog.querySelector('input[type="date"]');
    const time = dialog.querySelector('input[type="time"]');
    if (date === null || time === null) throw new Error('due inputs missing');
    fireEvent.change(date, { target: { value: '2026-11-30' } });
    fireEvent.change(time, { target: { value: '17:00' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Request renewal' }));
    expect(await screen.findAllByText('Renewal requested from the supplier')).not.toHaveLength(0);
    expect(screen.getAllByText(/30 Nov 2026, 17:00/).length).toBeGreaterThan(0);
  });

  it('initiates a reassessment and shows a business refusal clearly', async () => {
    routeCalls({
      'buyer.qualification.decisions.get': () => decisionDetail(),
      'buyer.qualification.options': () => options(),
      'buyer.qualification.triggers.create': () => {
        throw businessError('buyer.qualification.triggers.create', 'TRIGGER_ALREADY_OPEN');
      },
    });
    renderPage(<DecisionPage />, { ...PATH, permissions: ASSESSOR });
    expect(
      await screen.findByText('Decision 702 — Chobe Pipe & Valve Supplies'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record new decision' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Initiate reassessment' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^What happened/), {
      target: { value: 'Reported change.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Initiate reassessment' }));
    expect(
      await within(dialog).findByText('A trigger of this type is already open for this decision.'),
    ).toBeInTheDocument();
  });

  it('lists a raised trigger after creation', async () => {
    routeCalls({
      'buyer.qualification.decisions.get': () => decisionDetail({ triggers: [] }),
      'buyer.qualification.options': () => options(),
      'buyer.qualification.triggers.create': () =>
        trigger({ id: 900, triggerType: 'manual', summary: 'Reported change.' }),
    });
    renderPage(<DecisionPage />, { ...PATH, permissions: MANAGER });
    fireEvent.click(await screen.findByRole('button', { name: 'Initiate reassessment' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^What happened/), {
      target: { value: 'Reported change.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Initiate reassessment' }));
    expect(await screen.findByText('Reassessment trigger 900 raised.')).toBeInTheDocument();
    expect(screen.getByText('Reported change.')).toBeInTheDocument();
  });

  it('explains an unknown decision', async () => {
    routeCalls({ 'buyer.qualification.options': () => options() });
    renderPage(<DecisionPage />, { ...PATH, permissions: MANAGER });
    expect((await screen.findAllByText('Decision not found')).length).toBeGreaterThan(0);
  });
});
