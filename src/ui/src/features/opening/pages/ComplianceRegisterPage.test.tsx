import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { installFetch } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { bidRow, overview, page, stateFor } from '../test/data';
import ComplianceRegisterPage from './ComplianceRegisterPage';

describe('ComplianceRegisterPage (BUY-21)', () => {
  it('marks a bid with a pending exclusion as not ranked and keeps its commercial envelope withheld (AC-17)', async () => {
    installFetch({
      'GET /api/v1/buyer/opening/tenders/3': () => ({ body: overview() }),
      'GET /api/v1/buyer/opening/tenders/3/bids': () => ({
        body: page([
          bidRow({
            complianceStatus: 'non_compliant',
            exclusion: { exclusionId: 5101, status: 'awaiting_approval' },
            rankingEligible: false,
            checkSummary: {
              pass: 6,
              fail: 1,
              clarificationRequired: 0,
              pending: 0,
              notApplicable: 3,
            },
          }),
          bidRow({
            bidId: 3002,
            supplier: { tenantId: 4, name: 'Tsodilo Engineering (Pty) Ltd' },
            complianceStatus: 'compliant',
          }),
        ]),
      }),
    });
    renderWithProviders(<ComplianceRegisterPage />, {
      state: stateFor(['compliance.assess']),
      path: '/buyer/compliance/tenders/:tenderId',
      route: '/buyer/compliance/tenders/3',
    });

    const table = await screen.findByRole('table', { name: 'Bids and their compliance' });
    const excluded = within(table).getByRole('row', { name: /Makgadikgadi/ });
    expect(within(excluded).getByText('Not ranked')).toBeInTheDocument();
    expect(within(excluded).getByText('1 fail')).toBeInTheDocument();
    expect(within(excluded).getByText('Commercial: Withheld (stays sealed)')).toBeInTheDocument();
    expect(within(excluded).getByRole('link', { name: 'Awaiting approval' })).toHaveAttribute(
      'href',
      '/buyer/compliance/exclusions/5101',
    );
    const ranked = within(table).getByRole('row', { name: /Tsodilo/ });
    expect(within(ranked).getByText('Ranked')).toBeInTheDocument();
  });

  it('shows the empty state when no bid matches the filters', async () => {
    installFetch({
      'GET /api/v1/buyer/opening/tenders/3': () => ({ body: overview() }),
      'GET /api/v1/buyer/opening/tenders/3/bids': () => ({ body: page([]) }),
    });
    renderWithProviders(<ComplianceRegisterPage />, {
      state: stateFor(['compliance.assess']),
      path: '/buyer/compliance/tenders/:tenderId',
      route: '/buyer/compliance/tenders/3',
    });

    expect(await screen.findByText('No bid matches.')).toBeInTheDocument();
  });
});
