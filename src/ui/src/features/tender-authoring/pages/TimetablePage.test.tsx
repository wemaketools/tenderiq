import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { installFetch } from '../../../test/fetchMock';
import { tender12, timetable12 } from '../test/data';
import { API, changeImpact, renderPage } from '../test/helpers';
import TimetablePage from './TimetablePage';

const PATH = '/buyer/tenders/:tenderId/timetable';
const ROUTE = '/buyer/tenders/12/timetable';

function routes() {
  return {
    [`GET ${API}/12`]: () => ({ body: tender12 }),
    [`GET ${API}/12/timetable`]: () => ({ body: timetable12 }),
  };
}

describe('TimetablePage (BUY-12)', () => {
  it('flags holidays and weekends with the next working day in the official zone when loaded', async () => {
    installFetch(routes());

    renderPage(<TimetablePage />, { route: ROUTE, path: PATH });

    const table = await screen.findByRole('table', { name: 'Timetable milestones' });
    expect(
      within(table).getAllByText(/Boxing Day holiday; next working day 29 Dec 2026/).length,
    ).toBeGreaterThan(0);
    expect(within(table).getByText(/Weekend; next working day 14 Dec 2026/)).toBeInTheDocument();
    expect(within(table).getAllByText(/Africa\/Gaborone/).length).toBeGreaterThan(0);
    expect(
      screen.getByText('Suppliers get 19 days to respond; the policy requires at least 21.'),
    ).toBeInTheDocument();
  });

  it('shows envelopes and participation conditions when loaded', async () => {
    installFetch(routes());

    renderPage(<TimetablePage />, { route: ROUTE, path: PATH });

    expect(
      await screen.findByText('Attend the switch-room walk-through at Mmamashia.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/single.stage/i)).toBeInTheDocument();
  });

  it('requires a qualification program for a qualification condition before saving it', async () => {
    const { requests } = installFetch({
      ...routes(),
      [`POST ${API}/12/participation-conditions`]: () => ({
        status: 201,
        body: {
          condition: {
            id: 900,
            conditionType: 'qualification_required',
            description: 'Hold Category A status.',
            qualificationProgram: timetable12.qualificationPrograms[0],
            sessionId: null,
            blocking: true,
          },
          change: changeImpact(false),
        },
      }),
    });
    renderPage(<TimetablePage />, { route: ROUTE, path: PATH });
    await userEvent.click(await screen.findByRole('button', { name: 'Add condition' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(
      within(dialog).getByLabelText(/^Condition/),
      'qualification_required',
    );
    await userEvent.type(within(dialog).getByLabelText(/^Description/), 'Hold Category A status.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save draft' }));
    expect(
      within(dialog).getByText('Name the qualification program suppliers must hold.'),
    ).toBeInTheDocument();

    await userEvent.selectOptions(
      within(dialog).getByLabelText(/^Qualification program/),
      String(timetable12.qualificationPrograms[0]?.id),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByText('Hold Category A status.')).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'POST')?.body).toMatchObject({
      conditionType: 'qualification_required',
      qualificationProgramId: timetable12.qualificationPrograms[0]?.id,
    });
  });

  it('opens the timetable editor with the live coherence checks', async () => {
    installFetch(routes());
    renderPage(<TimetablePage />, { route: ROUTE, path: PATH });

    await userEvent.click(await screen.findByRole('button', { name: 'Edit timetable' }));

    const editor = screen.getByTestId('timetable-editor');
    expect(within(editor).getByRole('list', { name: 'Coherence checks' })).toBeInTheDocument();
    expect(within(editor).getAllByText(/next working day/).length).toBeGreaterThan(0);
  });

  it('offers each milestone once per scope, in the order milestones occur', async () => {
    installFetch(routes());
    renderPage(<TimetablePage />, { route: ROUTE, path: PATH });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit timetable' }));
    const editor = screen.getByTestId('timetable-editor');
    expect(
      within(editor).getByText(/^Dates must follow the order of the tender/),
    ).toBeInTheDocument();

    await userEvent.click(within(editor).getByRole('button', { name: 'Add milestone' }));
    const added = within(editor).getByRole('group', { name: 'Milestone 6' });
    const offered = within(within(added).getByLabelText(/^Milestone/))
      .getAllByRole('option')
      .map((option) => option.textContent)
      .slice(1);

    // Briefing, questions deadline, submission deadline and opening are already set for the whole tender.
    expect(offered).toEqual([
      'Site visit',
      'Clarification deadline',
      'Expected award',
      'Standstill end',
      'Contract start',
    ]);
  });

  it('flags a duplicate milestone at once and hides the lots that already have it', async () => {
    installFetch(routes());
    renderPage(<TimetablePage />, { route: ROUTE, path: PATH });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit timetable' }));
    const editor = screen.getByTestId('timetable-editor');
    const [tenderClose, lotClose] = within(editor).getAllByRole('group', {
      name: 'Submission deadline',
    });
    const lotSelect = within(lotClose as HTMLElement).getByLabelText(/^Lot/);
    const lotWithOwnDeadline = (lotSelect as HTMLSelectElement).value;
    expect(lotWithOwnDeadline).not.toBe('');

    // The whole-tender deadline cannot move to the lot that already has its own deadline.
    const tenderLots = within(within(tenderClose as HTMLElement).getByLabelText(/^Lot/))
      .getAllByRole('option')
      .map((option) => option.getAttribute('value'));
    expect(tenderLots).not.toContain(lotWithOwnDeadline);

    await userEvent.selectOptions(lotSelect, '');
    expect(
      within(lotClose as HTMLElement).getByText(
        'This milestone is already set for the whole tender. Change the other entry instead.',
      ),
    ).toBeInTheDocument();
  });
});
