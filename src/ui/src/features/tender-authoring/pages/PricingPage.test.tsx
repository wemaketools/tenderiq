import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { installFetch } from '../../../test/fetchMock';
import { pricing12, pricing5, tender12, tender5 } from '../test/data';
import { API, EVALUATOR, changeImpact, renderPage } from '../test/helpers';
import PricingPage from './PricingPage';

const PATH = '/buyer/tenders/:tenderId/pricing';
const ROUTE = '/buyer/tenders/5/pricing';

function routes() {
  return {
    [`GET ${API}/5`]: () => ({ body: tender5 }),
    [`GET ${API}/5/pricing`]: () => ({ body: pricing5 }),
  };
}

describe('PricingPage (BUY-10)', () => {
  it('shows schedules with optional and provisional items, terms and affordability when loaded', async () => {
    installFetch(routes());

    renderPage(<PricingPage />, { route: ROUTE, path: PATH });

    const items = await screen.findByRole('table', { name: 'Items of Lot 3 — Polyelectrolyte' });
    expect(within(items).getByText('Provisional')).toBeInTheDocument();
    expect(
      screen.getByText('Payment within 30 days of an undisputed invoice.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Within budget').length).toBeGreaterThan(0);
    expect(screen.getByText('Bid validity')).toBeInTheDocument();
  });

  it('states accepted discounts, their comparison basis and the distinct price entries of each schedule', async () => {
    installFetch(routes());

    renderPage(<PricingPage />, { route: ROUTE, path: PATH });

    await screen.findByRole('table', { name: 'Items of Lot 1 — Aluminium sulphate' });
    expect(screen.getAllByText('Conditional, Package (several lots)').length).toBe(3);
    expect(screen.getAllByText(/Package discounts across lots enter comparison only/).length).toBe(
      3,
    );
    const entries = screen.getAllByRole('list', { name: 'Accepted price entries' })[0];
    expect(entries).toBeDefined();
    const list = within(entries as HTMLElement);
    expect(list.getByText('Included')).toBeInTheDocument();
    expect(
      list.getByText(/the cost of the item is carried in another line of the offer/),
    ).toBeInTheDocument();
    expect(list.getByText('Not offered')).toBeInTheDocument();
    expect(screen.getAllByText('Not accepted: Zero price').length).toBe(3);
  });

  it('warns when a schedule accepts discounts without saying how they enter comparison', async () => {
    installFetch({
      [`GET ${API}/12`]: () => ({ body: tender12 }),
      [`GET ${API}/12/pricing`]: () => ({ body: pricing12 }),
    });

    renderPage(<PricingPage />, { route: '/buyer/tenders/12/pricing', path: PATH });

    expect(
      (await screen.findAllByText(/accepts discounts but does not state how they enter comparison/))
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Not stated')).toBeInTheDocument();
  });

  it('edits the discount rules and price entries of a schedule, requiring the comparison basis', async () => {
    // Arrange
    const schedule = pricing5.schedules[1];
    const { requests } = installFetch({
      ...routes(),
      [`PATCH ${API}/5/pricing-schedules/${schedule?.id}`]: () => ({
        body: {
          schedule: {
            ...schedule,
            discountsAccepted: ['unconditional'],
            discountEvaluationNote: 'Deducted from the evaluated price.',
            priceEntries: ['priced', 'zero'],
          },
          change: changeImpact(false),
        },
      }),
    });
    renderPage(<PricingPage />, { route: ROUTE, path: PATH });
    await screen.findByRole('table', { name: `Items of ${schedule?.name}` });

    // Act
    await userEvent.click(screen.getByRole('button', { name: `Edit ${schedule?.name}` }));
    const dialog = await screen.findByRole('dialog');
    const discounts = within(dialog).getByRole('group', { name: 'Discounts accepted' });
    await userEvent.click(within(discounts).getByLabelText('Conditional'));
    await userEvent.click(within(discounts).getByLabelText('Package (several lots)'));
    await userEvent.click(within(discounts).getByLabelText('Unconditional'));
    await userEvent.clear(within(dialog).getByLabelText(/^How discounts enter comparison/));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save draft' }));
    const blankBasis = within(dialog).getByText('State how accepted discounts enter comparison.');
    await userEvent.type(
      within(dialog).getByLabelText(/^How discounts enter comparison/),
      'Deducted from the evaluated price.',
    );
    const entries = within(dialog).getByRole('group', { name: 'Accepted price entries' });
    expect(within(entries).getByLabelText(/^Priced/)).toBeDisabled();
    await userEvent.click(within(entries).getByLabelText(/^Zero price/));
    await userEvent.click(within(entries).getByLabelText(/^Included/));
    await userEvent.click(within(entries).getByLabelText(/^Not offered/));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save draft' }));

    // Assert
    expect(blankBasis).toBeDefined();
    expect(
      await screen.findByText('Material change saved: the package is now draft revision 4'),
    ).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'PATCH')?.body).toMatchObject({
      discountsAccepted: ['unconditional'],
      discountEvaluationNote: 'Deducted from the evaluated price.',
      priceEntries: ['priced', 'zero'],
    });
  });

  it('adds a recurring item only after its recurrence is chosen', async () => {
    const schedule = pricing5.schedules[0];
    const { requests } = installFetch({
      ...routes(),
      [`POST ${API}/5/pricing-schedules/${schedule?.id}/items`]: () => ({
        status: 201,
        body: {
          scheduleId: schedule?.id,
          item: {
            ...schedule?.items[0],
            id: 900,
            itemCode: 'C1-09',
            chargeType: 'recurring',
            recurrence: 'monthly',
          },
          change: changeImpact(false),
        },
      }),
    });
    renderPage(<PricingPage />, { route: ROUTE, path: PATH });
    await screen.findByRole('table', { name: `Items of ${schedule?.name}` });

    await userEvent.click(screen.getByRole('button', { name: `Add an item to ${schedule?.name}` }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/^Item/), 'C1-09');
    await userEvent.type(within(dialog).getByLabelText(/^Unit/), 'month');
    await userEvent.type(within(dialog).getByLabelText(/^Description/), 'Stock holding');
    await userEvent.type(within(dialog).getByLabelText(/^Quantity/), '36');
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Charge/), 'recurring');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save draft' }));
    expect(
      within(dialog).getByText('A recurring charge needs its recurrence.'),
    ).toBeInTheDocument();

    await userEvent.selectOptions(within(dialog).getByLabelText(/^Recurrence/), 'monthly');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save draft' }));

    expect(
      await screen.findByText('Material change saved: the package is now draft revision 4'),
    ).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'POST')?.body).toMatchObject({
      chargeType: 'recurring',
      recurrence: 'monthly',
      quantity: '36',
    });
  });

  it('offers no pricing edits to an evaluator', async () => {
    installFetch(routes());

    renderPage(<PricingPage />, { route: ROUTE, path: PATH, permissions: EVALUATOR });

    await screen.findByRole('table', { name: 'Items of Lot 3 — Polyelectrolyte' });
    expect(screen.queryByRole('button', { name: 'Add pricing schedule' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });
});
