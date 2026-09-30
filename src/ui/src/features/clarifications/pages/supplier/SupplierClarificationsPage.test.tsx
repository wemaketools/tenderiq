import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../../test/fetchMock';
import { renderWithProviders } from '../../../../test/render';
import {
  SUPPLIER_ALL,
  pageOf,
  supplierAddendum,
  supplierQuestion,
  supplierState,
  supplierTender,
} from '../../testData';
import SupplierClarificationsPage from './SupplierClarificationsPage';

const S = '/api/v1/supplier/clarifications';

function routes(
  questions = [
    supplierQuestion(),
    supplierQuestion({
      id: 203,
      status: 'answered_privately',
      answerAudience: 'private',
      answerText: 'Two batches are acceptable.',
      answeredAt: '2026-10-01T09:00:00Z',
    }),
  ],
) {
  return installFetch({
    [`GET ${S}/tenders`]: () => ({ body: pageOf([supplierTender()]) }),
    [`GET ${S}/addenda`]: () => ({ body: pageOf([supplierAddendum()]) }),
    [`GET ${S}/questions`]: () => ({ body: pageOf(questions) }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SupplierClarificationsPage (SUP-10)', () => {
  it('shows the tenders with official question deadlines and the addenda that need action', async () => {
    routes();
    renderWithProviders(<SupplierClarificationsPage />, { state: supplierState(SUPPLIER_ALL) });

    const tenders = await screen.findByRole('table', { name: 'Your tenders' });
    expect(await within(tenders).findByText('T-2026-0002')).toBeInTheDocument();
    expect(within(tenders).getByText('Accepting questions')).toBeInTheDocument();
    expect(within(tenders).getAllByTestId('official-deadline')).toHaveLength(2);
    const addenda = screen.getByRole('table', { name: 'Addenda requiring your action' });
    expect(within(addenda).getByText('Supplement')).toBeInTheDocument();
    expect(screen.getByText('1 addendum needs your acknowledgment or action')).toBeInTheDocument();
  });

  it('lists an acknowledged addendum whose supplement is still due, and counts it on the tender row (AC-10)', async () => {
    const acknowledged = supplierAddendum({
      acknowledgedAt: '2026-10-08T10:00:00Z',
      acknowledgedBy: { userId: 37, fullName: 'Kagiso Metsi' },
      actionOutstanding: true,
    });
    const { requests } = installFetch({
      [`GET ${S}/tenders`]: () => ({
        body: pageOf([supplierTender({ addendaToAcknowledge: 0, addendaActionOutstanding: 1 })]),
      }),
      [`GET ${S}/addenda`]: () => ({ body: pageOf([acknowledged]) }),
      [`GET ${S}/questions`]: () => ({ body: pageOf([]) }),
    });
    renderWithProviders(<SupplierClarificationsPage />, { state: supplierState(SUPPLIER_ALL) });

    const addenda = await screen.findByRole('table', { name: 'Addenda requiring your action' });
    expect(await within(addenda).findByText('Supplement your submission')).toBeInTheDocument();
    expect(within(addenda).queryByText('Acknowledgment due')).not.toBeInTheDocument();
    expect(within(addenda).getByText(/^Acknowledged /)).toBeInTheDocument();
    const tenders = screen.getByRole('table', { name: 'Your tenders' });
    expect(await within(tenders).findByText('1 requiring action')).toBeInTheDocument();
    expect(
      requests.some(
        (request) =>
          request.path === `${S}/addenda` && request.search.includes('actionOutstanding=true'),
      ),
    ).toBe(true);
  });

  it('says no addendum requires action when every action is complete', async () => {
    installFetch({
      [`GET ${S}/tenders`]: () => ({
        body: pageOf([
          supplierTender({
            addendaToAcknowledge: 0,
            addendaActionOutstanding: 0,
            nextAddendumAction: null,
          }),
        ]),
      }),
      [`GET ${S}/addenda`]: () => ({ body: pageOf([]) }),
      [`GET ${S}/questions`]: () => ({ body: pageOf([]) }),
    });
    renderWithProviders(<SupplierClarificationsPage />, { state: supplierState(SUPPLIER_ALL) });

    expect(
      await screen.findByText('No addendum requires an action from your organization'),
    ).toBeInTheDocument();
    const tenders = screen.getByRole('table', { name: 'Your tenders' });
    expect(await within(tenders).findByText('Up to date')).toBeInTheDocument();
  });

  it('lists only the supplier’s own questions with the buyer’s reply', async () => {
    routes();
    renderWithProviders(<SupplierClarificationsPage />, { state: supplierState(SUPPLIER_ALL) });

    const table = await screen.findByRole('table', { name: 'My questions' });
    expect(await within(table).findByText('Two batches are acceptable.')).toBeInTheDocument();
    expect(within(table).getByText('Private reply to your organization')).toBeInTheDocument();
    expect(within(table).getByText('No reply yet')).toBeInTheDocument();
  });

  it('filters own questions to answered ones', async () => {
    const { requests } = routes();
    renderWithProviders(<SupplierClarificationsPage />, { state: supplierState(SUPPLIER_ALL) });
    await screen.findAllByText('T-2026-0002');

    await userEvent.click(screen.getByLabelText('Answered only'));

    await waitFor(() =>
      expect(
        requests.some(
          (request) =>
            request.path === `${S}/questions` && request.search.includes('answered=true'),
        ),
      ).toBe(true),
    );
  });

  it('explains when the supplier has not asked anything', async () => {
    routes([]);
    renderWithProviders(<SupplierClarificationsPage />, { state: supplierState(SUPPLIER_ALL) });
    expect(await screen.findByText('No questions yet')).toBeInTheDocument();
  });
});
