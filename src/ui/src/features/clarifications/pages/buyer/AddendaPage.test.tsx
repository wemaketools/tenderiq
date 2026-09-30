import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../../test/fetchMock';
import { renderWithProviders } from '../../../../test/render';
import { BUYER_ALL, addendumDetail, buyerState, buyerTender, pageOf } from '../../testData';
import AddendaPage from './AddendaPage';

const B = '/api/v1/buyer/clarifications';

const draft = () =>
  addendumDetail({
    id: 23,
    number: 3,
    status: 'draft',
    issuedAt: null,
    resultingVersionNo: null,
    acknowledgments: null,
    approvalStatus: null,
    approvalRequestId: null,
    newSubmissionDeadline: null,
  });

function routes(rows = [addendumDetail(), draft()]) {
  return installFetch({
    [`GET ${B}/tenders`]: () => ({ body: pageOf([buyerTender()]) }),
    [`GET ${B}/addenda`]: () => ({ body: pageOf(rows) }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AddendaPage (BUY-17)', () => {
  it('lists addenda with materiality, new deadline, existing-submission action, approval and acknowledgments', async () => {
    routes();
    renderWithProviders(<AddendaPage />, { state: buyerState(BUYER_ALL) });

    const table = await screen.findByRole('table', { name: 'Addenda' });
    expect(await within(table).findByText('Addendum 1')).toBeInTheDocument();
    expect(within(table).getByText('Addendum 3')).toBeInTheDocument();
    expect(within(table).getAllByTestId('official-deadline')).toHaveLength(1);
    expect(within(table).getByText('No date change')).toBeInTheDocument();
    expect(within(table).getByText('0 of 1')).toBeInTheDocument();
    expect(within(table).getByText('1 action outstanding')).toBeInTheDocument();
    expect(within(table).getByText('Not requested')).toBeInTheDocument();
  });

  it('sends the deadline-change filter to the API', async () => {
    const { requests } = routes();
    renderWithProviders(<AddendaPage />, { state: buyerState(BUYER_ALL) });
    await screen.findByText('Addendum 1');

    await userEvent.click(screen.getByLabelText('Changes a deadline'));

    await waitFor(() =>
      expect(requests.some((request) => request.search.includes('changesDeadline=true'))).toBe(
        true,
      ),
    );
  });

  it('hides the new addendum action from an approver without the clarification permission', async () => {
    routes();
    renderWithProviders(<AddendaPage />, { state: buyerState(['tender.addenda.approve']) });
    await screen.findByText('Addendum 1');
    expect(screen.queryByRole('link', { name: 'New addendum' })).not.toBeInTheDocument();
  });

  it('explains when no addendum matches', async () => {
    routes([]);
    renderWithProviders(<AddendaPage />, { state: buyerState(BUYER_ALL) });
    expect(await screen.findByText('No addenda match these filters')).toBeInTheDocument();
  });
});
