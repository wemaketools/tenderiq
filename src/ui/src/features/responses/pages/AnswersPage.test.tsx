import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import {
  BID_MANAGER,
  answerPage,
  bidDetail,
  readiness,
  routeCalls,
  supplierState,
} from '../test/data';
import AnswersPage from './AnswersPage';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  call: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const renderPage = () =>
  renderWithProviders(<AnswersPage />, {
    state: supplierState(BID_MANAGER),
    route: '/supplier/responses/14/answers',
    path: '/supplier/responses/:bidId/answers',
  });

describe('AnswersPage (SUP-12)', () => {
  it('shows the record context, the answers and readiness with blocking errors apart from warnings', async () => {
    // Arrange
    routeCalls({
      'supplier.bids.get': () => bidDetail(),
      'supplier.bids.answers': () => answerPage(),
      'supplier.bids.readiness': () => readiness(),
    });

    // Act
    renderPage();

    // Assert
    expect(
      await screen.findByText('Legal party: Tsodilo Engineering (Pty) Ltd'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Complete the answers' })).toHaveAttribute(
      'href',
      '/supplier/responses/14/answers',
    );
    const table = await screen.findByRole('table', { name: 'Requirements and answers' });
    expect(
      await within(table).findByText('Describe the dosing control approach.'),
    ).toBeInTheDocument();
    const findings = await screen.findByRole('list', { name: 'Readiness findings' });
    const blocking = within(findings)
      .getAllByRole('listitem')
      .find((item) => item.getAttribute('data-status') === 'blocking');
    expect(blocking).toHaveTextContent('Expired evidence: Tax clearance certificate');
    const warning = within(findings)
      .getAllByRole('listitem')
      .find((item) => item.getAttribute('data-status') === 'warning');
    expect(warning).toHaveTextContent('1 reused answer awaits review');
  });

  it('saves the offered lots against the working revision when the selection changes', async () => {
    // Arrange
    const user = userEvent.setup();
    const detail = bidDetail({
      lotOptions: [
        ...bidDetail().lotOptions,
        {
          lotId: 602,
          lotNo: 2,
          title: 'Chlorinators',
          description: null,
          stage: 'open',
          deadline: bidDetail().deadline,
          selected: false,
          eligible: true,
          ineligibleReason: null,
        },
      ],
    });
    const calls = routeCalls({
      'supplier.bids.get': () => detail,
      'supplier.bids.answers': () => answerPage(),
      'supplier.bids.readiness': () => readiness(),
      'supplier.bids.updateLots': () => detail,
    });
    renderPage();

    // Act
    await user.click(await screen.findByRole('checkbox', { name: 'Lot 2: Chlorinators' }));
    await user.click(screen.getByRole('button', { name: 'Save lot selection' }));

    // Assert
    const save = calls.find((entry) => entry.id === 'supplier.bids.updateLots');
    expect(save?.request.body).toEqual({ revisionId: 1401, lotIds: [601, 602] });
    expect(
      await screen.findByText('Lot selection saved. The draft is not submitted.'),
    ).toBeInTheDocument();
  });

  it('shows a not-found state when the response belongs to another supplier', async () => {
    // Arrange
    routeCalls({});

    // Act
    renderPage();

    // Assert
    expect(await screen.findByText('Response not found')).toBeInTheDocument();
  });
});
