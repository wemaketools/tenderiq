import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { BID_MANAGER, bidDetail, declarations, routeCalls, supplierState } from '../test/data';
import DeclarationsPage from './DeclarationsPage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  call: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const renderPage = () =>
  renderWithProviders(<DeclarationsPage />, {
    state: supplierState(BID_MANAGER),
    route: '/supplier/responses/14/declarations',
    path: '/supplier/responses/:bidId/declarations',
  });

describe('DeclarationsPage (SUP-14)', () => {
  it('distinguishes the supplier statement from the buyer verification of each evidence snapshot', async () => {
    // Arrange
    routeCalls({
      'supplier.bids.get': () => bidDetail(),
      'supplier.bids.declarations': () => declarations(),
    });

    // Act
    renderPage();

    // Assert
    expect(await screen.findByText('Supplier statements')).toBeInTheDocument();
    const evidence = screen.getByRole('table', { name: 'Tender-specific evidence' });
    const row = within(evidence).getByRole('row', { name: /Tax clearance certificate/ });
    expect(within(row).getByText('Expired')).toBeInTheDocument();
    expect(within(row).getByText('Supplier provided')).toBeInTheDocument();
  });

  it('requires an explanation for a declaration that cannot be confirmed, then saves it', async () => {
    // Arrange
    const user = userEvent.setup();
    const calls = routeCalls({
      'supplier.bids.get': () => bidDetail(),
      'supplier.bids.declarations': () => declarations(),
      'supplier.bids.saveDeclarations': () => ({
        declarations: declarations(),
        contentHash: 'c'.repeat(64),
        invalidatedApprovalIds: [],
      }),
    });
    renderPage();

    // Act
    await user.click(await screen.findByRole('radio', { name: 'Cannot confirm' }));

    // Assert
    expect(
      screen.getByText('Explain why the declaration cannot be confirmed.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save declarations' })).toBeDisabled();

    // Act
    await user.type(screen.getByLabelText(/^Explanation/), 'A director sits on the buyer board.');
    await user.click(screen.getByRole('button', { name: 'Save declarations' }));

    // Assert
    const save = calls.find((entry) => entry.id === 'supplier.bids.saveDeclarations');
    expect(save?.request.body).toEqual({
      revisionId: 1401,
      declarations: [
        {
          declarationType: 'no_conflict',
          accepted: false,
          explanation: 'A director sits on the buyer board.',
        },
      ],
    });
  });

  it('blocks saving a consortium without exactly one lead member', async () => {
    // Arrange
    const user = userEvent.setup();
    const calls = routeCalls({
      'supplier.bids.get': () => bidDetail(),
      'supplier.bids.declarations': () => declarations(),
    });
    renderPage();

    // Act
    await user.click(await screen.findByRole('checkbox', { name: /We bid as a consortium/ }));
    await user.click(screen.getByRole('button', { name: 'Add member' }));
    await user.click(screen.getByRole('button', { name: 'Add member' }));
    const names = screen.getAllByLabelText(/^Member name/);
    await user.type(names[0] as HTMLElement, 'Tsodilo Engineering');
    await user.type(names[1] as HTMLElement, 'Okavango Pumps');
    const consortium = screen.getByRole('heading', { name: 'Consortium' }).closest('section');
    await user.click(within(consortium as HTMLElement).getByRole('button', { name: 'Save' }));

    // Assert
    expect(await screen.findByText('Mark exactly one lead member.')).toBeInTheDocument();
    expect(calls.some((entry) => entry.id === 'supplier.bids.saveConsortium')).toBe(false);
  });
});
