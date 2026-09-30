import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { installFetch } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { exclusion, page, stateFor, tenderRow } from '../test/data';
import CompliancePage from './CompliancePage';

function exclusionRow() {
  const { checks: _checks, approval: _approval, withdrawnReason: _reason, ...row } = exclusion();
  return row;
}

describe('CompliancePage (BUY-21)', () => {
  it('lists opened tenders by default and links each to its register', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/opening/tenders': () => ({
        body: page([
          tenderRow({ tenderId: 3, reference: 'T-2026-0003', progress: 'fully_opened' }),
        ]),
      }),
      'GET /api/v1/buyer/opening/exclusions': () => ({ body: page([exclusionRow()]) }),
      'GET /api/v1/buyer/opening/clarifications': () => ({ body: page([]) }),
    });
    renderWithProviders(<CompliancePage />, { state: stateFor(['compliance.assess']) });

    const table = await screen.findByRole('table', { name: 'Tenders in compliance review' });
    expect(within(table).getByRole('link', { name: 'T-2026-0003' })).toHaveAttribute(
      'href',
      '/buyer/compliance/tenders/3',
    );
    expect(
      requests.some(
        (request) =>
          request.path === '/api/v1/buyer/opening/tenders' &&
          request.search.includes('progress=partially_opened') &&
          request.search.includes('progress=fully_opened'),
      ),
    ).toBe(true);
  });

  it('shows exclusions with approval, notice and the withheld commercial envelope (AC-17)', async () => {
    installFetch({
      'GET /api/v1/buyer/opening/tenders': () => ({ body: page([]) }),
      'GET /api/v1/buyer/opening/exclusions': () => ({ body: page([exclusionRow()]) }),
      'GET /api/v1/buyer/opening/clarifications': () => ({ body: page([]) }),
    });
    renderWithProviders(<CompliancePage />, { state: stateFor(['compliance.assess']) });

    await userEvent.click(await screen.findByRole('tab', { name: 'Exclusions' }));
    const table = await screen.findByRole('table', { name: 'Exclusions' });
    const row = within(table).getByRole('row', { name: /Makgadikgadi/ });
    expect(within(row).getByText('Awaiting approval')).toBeInTheDocument();
    expect(within(row).getByText('Withheld (stays sealed)')).toBeInTheDocument();
  });

  it('hides the exclusions tab from the evaluation chair without exclusion rights', async () => {
    installFetch({
      'GET /api/v1/buyer/opening/tenders': () => ({ body: page([]) }),
      'GET /api/v1/buyer/opening/clarifications': () => ({ body: page([]) }),
    });
    renderWithProviders(<CompliancePage />, { state: stateFor(['evaluation.chair']) });

    await screen.findByRole('tab', { name: 'Tenders' });
    expect(screen.queryByRole('tab', { name: 'Exclusions' })).not.toBeInTheDocument();
  });
});
