import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { liveLineTotal } from '../lib/pricing';
import {
  BID_MANAGER,
  CONTRIBUTOR,
  bidDetail,
  pricing,
  readiness,
  routeCalls,
  supplierState,
} from '../test/data';
import PricingPage from './PricingPage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  call: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const renderPage = (permissions = BID_MANAGER) =>
  renderWithProviders(<PricingPage />, {
    state: supplierState(permissions),
    route: '/supplier/responses/14/pricing',
    path: '/supplier/responses/:bidId/pricing',
  });

describe('PricingPage (SUP-13)', () => {
  it('restricts prices for a contributor and shows only whether pricing is complete', async () => {
    // Arrange
    const calls = routeCalls({
      'supplier.bids.get': () =>
        bidDetail({
          viewer: {
            canEditResponse: true,
            canViewPricing: false,
            canEditPricing: false,
            canAssign: false,
            canComment: true,
            canApprove: false,
            canSubmit: false,
          },
        }),
      'supplier.bids.readiness': () =>
        readiness({
          items: [
            {
              id: 'pricing-1',
              category: 'pricing',
              severity: 'blocking',
              code: 'PRICING_INCOMPLETE',
              count: 2,
              subject: null,
              requirementIds: [],
              link: '/supplier/responses/14/pricing',
            },
          ],
        }),
    });

    // Act
    renderPage(CONTRIBUTOR);

    // Assert
    expect(await screen.findByText('Pricing is restricted')).toBeInTheDocument();
    expect(await screen.findByText('2 price lines are not entered')).toBeInTheDocument();
    expect(calls.some((entry) => entry.id === 'supplier.bids.pricing')).toBe(false);
  });

  it('shows decimal totals and keeps "not entered" distinct from a zero price', async () => {
    // Arrange
    routeCalls({
      'supplier.bids.get': () => bidDetail(),
      'supplier.bids.pricing': () => pricing(),
    });

    // Act
    renderPage();

    // Assert
    const table = await screen.findByRole('table', { name: 'Price schedule' });
    const missing = await within(table).findByRole('row', { name: /P-02/ });
    expect(within(missing).getByText('Not entered', { selector: 'span' })).toBeInTheDocument();
    expect(within(table).getByText('BWP 50,000')).toBeInTheDocument();
    expect(screen.getAllByText('BWP 57,000').length).toBeGreaterThan(0);
  });

  it('saves an included item without a price, never as zero', async () => {
    // Arrange
    const user = userEvent.setup();
    const calls = routeCalls({
      'supplier.bids.get': () => bidDetail(),
      'supplier.bids.pricing': () => pricing(),
      'supplier.bids.savePricing': () => ({
        pricing: pricing(),
        contentHash: 'c'.repeat(64),
        invalidatedApprovalIds: [],
      }),
    });
    renderPage();

    // Act
    await user.selectOptions(await screen.findByLabelText('Offer status for P-02'), 'included');
    await user.click(screen.getByRole('button', { name: 'Save pricing' }));

    // Assert
    const save = calls.find((entry) => entry.id === 'supplier.bids.savePricing');
    const body = save?.request.body as { lines: Array<Record<string, unknown>> };
    expect(body.lines).toContainEqual(
      expect.objectContaining({ pricingItemId: 612, priceStatus: 'included', unitPrice: null }),
    );
    expect(await screen.findByText(/Pricing saved/)).toBeInTheDocument();
  });

  it('computes a live line total from decimal strings only when the line is priced', () => {
    // Arrange
    const line = {
      priceStatus: 'priced',
      unitPrice: '0.10',
      quantity: '3',
      discountAmount: '0.05',
    };

    // Act
    const total = liveLineTotal(line);

    // Assert
    expect(total).toBe('0.25');
    expect(liveLineTotal({ ...line, priceStatus: 'included' })).toBeNull();
  });
});
