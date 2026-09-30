import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  authoringOptions,
  renderPage,
  routeCalls,
  templatePage,
  templateSummary,
} from '../test/kit';
import TemplatesPage from './TemplatesPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/buyer/admin/policy/templates', route: '/buyer/admin/policy/templates' };

const rows = [
  templateSummary(),
  templateSummary({
    id: 5,
    kind: 'letter',
    name: 'Regret letter to unsuccessful bidders',
    procedure: null,
    reviewDate: '2026-08-31',
    reviewOverdue: true,
    pendingVersionNo: null,
  }),
  templateSummary({
    id: 9,
    kind: 'contract',
    name: 'Services contract (2024 edition)',
    status: 'retired',
    selectable: false,
    pendingVersionNo: null,
  }),
];

describe('TemplatesPage (ADM-08)', () => {
  it('lists templates with kind, owner, status, version, review date and usage', async () => {
    routeCalls({
      'buyer.policy.listTemplates': () => templatePage(rows),
      'buyer.policy.templateAuthoringOptions': () => authoringOptions(),
    });
    renderPage(<TemplatesPage />, PATH);

    const criteria = await screen.findByRole('row', {
      name: 'Weighted technical and price criteria (70/30)',
    });
    expect(within(criteria).getByText('Criteria set')).toBeInTheDocument();
    expect(within(criteria).getByText('Boitumelo Kgari')).toBeInTheDocument();
    expect(within(criteria).getByText('Revision 2 in progress')).toBeInTheDocument();
    const overdue = screen.getByRole('row', { name: 'Regret letter to unsuccessful bidders' });
    expect(within(overdue).getByText('Overdue')).toBeInTheDocument();
    const retired = screen.getByRole('row', { name: 'Services contract (2024 edition)' });
    expect(within(retired).getByText('Retired')).toBeInTheDocument();
    expect(screen.getByText('Reviews overdue')).toBeInTheDocument();
  });

  it('filters by kind, owner and overdue reviews', async () => {
    const calls = routeCalls({
      'buyer.policy.listTemplates': () => templatePage(rows),
      'buyer.policy.templateAuthoringOptions': () => authoringOptions(),
    });
    renderPage(<TemplatesPage />, PATH);
    await screen.findByRole('row', { name: 'Regret letter to unsuccessful bidders' });
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'letter' } });
    fireEvent.change(await screen.findByLabelText('Owner'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Review overdue only' }));
    await waitFor(() =>
      expect(
        calls.filter((entry) => entry.id === 'buyer.policy.listTemplates').at(-1)?.request,
      ).toEqual({
        query: expect.objectContaining({ kind: ['letter'], ownerUserId: 5, reviewOverdue: true }),
      }),
    );
  });

  it('explains when no template matches the filters', async () => {
    routeCalls({
      'buyer.policy.listTemplates': () => templatePage([]),
      'buyer.policy.templateAuthoringOptions': () => authoringOptions(),
    });
    renderPage(<TemplatesPage />, PATH);
    expect(await screen.findByText('No templates yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New template' })).toBeInTheDocument();
  });
});
