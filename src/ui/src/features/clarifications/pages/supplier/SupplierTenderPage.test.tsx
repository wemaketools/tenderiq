import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PermissionCode } from '@contracts/permissions';

import { installFetch, problem } from '../../../../test/fetchMock';
import { renderWithProviders } from '../../../../test/render';
import {
  SUPPLIER_ALL,
  pageOf,
  publicEditionBody,
  supplierAddendum,
  supplierContext,
  supplierQuestion,
  supplierState,
} from '../../testData';
import SupplierTenderPage from './SupplierTenderPage';

const S = '/api/v1/supplier/clarifications';

function render(
  context = supplierContext(),
  extra: Parameters<typeof installFetch>[0] = {},
  permissions: readonly PermissionCode[] = SUPPLIER_ALL,
) {
  const fetch = installFetch({
    [`GET ${S}/tenders/2`]: () => ({ body: context }),
    [`GET ${S}/questions`]: () => ({ body: pageOf([supplierQuestion()]) }),
    [`GET ${S}/tenders/2/answers`]: () => ({ body: pageOf(publicEditionBody().questions) }),
    [`GET ${S}/addenda`]: () => ({ body: pageOf([supplierAddendum()]) }),
    ...extra,
  });
  renderWithProviders(<SupplierTenderPage />, {
    state: supplierState(permissions),
    route: '/supplier/clarifications/tenders/2',
    path: '/supplier/clarifications/tenders/:tenderId',
  });
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SupplierTenderPage (SUP-10)', () => {
  it('opens on the addenda needing action and shows the official deadlines', async () => {
    render();

    expect(await screen.findByRole('tab', { name: /Addenda/, selected: true })).toBeInTheDocument();
    expect(screen.getAllByTestId('official-deadline').length).toBeGreaterThanOrEqual(3);
    expect(
      screen.getByText(/Supplement your submission for Addendum 1 before/),
    ).toBeInTheDocument();
  });

  it('keeps an acknowledged addendum as the next action while its supplement is outstanding (AC-10)', async () => {
    const acknowledged = supplierAddendum({
      acknowledgedAt: '2026-10-08T10:00:00Z',
      acknowledgedBy: { userId: 37, fullName: 'Kagiso Metsi' },
      requiredActionCompleted: false,
      actionOutstanding: true,
    });
    render(
      supplierContext({
        addendaToAcknowledge: 0,
        addendaActionOutstanding: 1,
        nextAddendumAction: {
          addendumId: 21,
          number: 1,
          requiredAction: 'supplement',
          acknowledgmentOutstanding: false,
          submissionActionOutstanding: true,
          dueBy: { at: '2026-10-21T10:00:00Z', timeZone: 'Africa/Gaborone' },
        },
      }),
      { [`GET ${S}/addenda`]: () => ({ body: pageOf([acknowledged]) }) },
    );

    expect(await screen.findByRole('tab', { name: /Addenda/, selected: true })).toBeInTheDocument();
    expect(
      screen.getByText(/Supplement your submission for Addendum 1 before/),
    ).toBeInTheDocument();
    // The due date is the official deadline of 21 Oct (the header shows the tender's own dates).
    expect(
      screen
        .getAllByTestId('official-deadline')
        .some((node) =>
          node.textContent?.includes('21 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone'),
        ),
    ).toBe(true);
    expect(screen.getByText('1 addendum needs your acknowledgment or action')).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Addenda' });
    expect(await within(table).findByText('Required action outstanding')).toBeInTheDocument();
    expect(
      screen.queryByText('Ask questions before the question deadline'),
    ).not.toBeInTheDocument();
  });

  it('asks for the acknowledgment when only the acknowledgment is outstanding', async () => {
    render(
      supplierContext({
        addendaToAcknowledge: 1,
        addendaActionOutstanding: 1,
        nextAddendumAction: {
          addendumId: 21,
          number: 1,
          requiredAction: 'acknowledge',
          acknowledgmentOutstanding: true,
          submissionActionOutstanding: false,
          dueBy: { at: '2026-10-21T10:00:00Z', timeZone: 'Africa/Gaborone' },
        },
      }),
    );
    expect(await screen.findByText(/Acknowledge Addendum 1 before/)).toBeInTheDocument();
  });

  it('invites questions once no addendum action is outstanding', async () => {
    render(
      supplierContext({
        addendaToAcknowledge: 0,
        addendaActionOutstanding: 0,
        nextAddendumAction: null,
      }),
    );
    expect(
      await screen.findByRole('tab', { name: /My questions/, selected: true }),
    ).toBeInTheDocument();
    expect(screen.getByText('Ask questions before the question deadline')).toBeInTheDocument();
  });

  it('shows the published answers every participant sees, without identities', async () => {
    render();
    await userEvent.click(await screen.findByRole('tab', { name: /Published answers/ }));

    expect(await screen.findByText('Are prepaid meters in scope?')).toBeInTheDocument();
    expect(
      screen.queryByText('Gaborone Metering Co.', { selector: 'li *' }),
    ).not.toBeInTheDocument();
  });

  it('asks a question against a requirement after confirmation', async () => {
    const { requests } = render(supplierContext({ addendaToAcknowledge: 0 }), {
      [`POST ${S}/questions`]: () => ({ status: 201, body: supplierQuestion({ id: 900 }) }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Ask a question' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText('Requirement'), '501');
    await userEvent.type(within(dialog).getByLabelText(/^Question/), 'Is a copy acceptable?');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send question' }));

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
        tenderId: 2,
        lotId: null,
        requirementId: 501,
        documentId: null,
        questionText: 'Is a copy acceptable?',
      }),
    );
    expect(await screen.findByText('Question sent to the buyer.')).toBeInTheDocument();
  });

  it('explains when the tender no longer accepts questions', async () => {
    render(supplierContext({ addendaToAcknowledge: 0 }), {
      [`POST ${S}/questions`]: () =>
        problem(409, 'Conflict', { code: 'TENDER_NOT_ACCEPTING_QUESTIONS' }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Ask a question' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/^Question/), 'Late one');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send question' }));
    expect(
      await within(dialog).findByText('This tender is not accepting questions.'),
    ).toBeInTheDocument();
  });

  it('hides asking from a member who may only view', async () => {
    render(supplierContext(), {}, ['supplier.opportunities.view']);
    await screen.findByRole('tab', { name: /Addenda/ });
    expect(screen.queryByRole('button', { name: 'Ask a question' })).not.toBeInTheDocument();
  });
});
