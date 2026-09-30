import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ExclusionRow } from '@contracts/opening';

import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { bidCompliance, check, exclusion, stateFor } from '../test/data';
import BidCompliancePage from './BidCompliancePage';

const PATH = '/buyer/compliance/bids/:bidId';
const ROUTE = '/buyer/compliance/bids/3003';

describe('BidCompliancePage (BUY-21)', () => {
  it('shows no check before the qualification envelope is opened (BR-17)', async () => {
    installFetch({
      'GET /api/v1/buyer/opening/bids/3003/compliance': () => ({
        body: bidCompliance({ contentAvailable: false, checks: [] }),
      }),
    });
    renderWithProviders(<BidCompliancePage />, {
      state: stateFor(['compliance.assess']),
      path: PATH,
      route: ROUTE,
    });

    expect((await screen.findAllByText('Not opened yet')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Record finding' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Propose exclusion' })).not.toBeInTheDocument();
  });

  it('keeps a sealed bid neutral: one blocking "Not opened" item, no ranking chip, no exclusion wording', async () => {
    installFetch({
      'GET /api/v1/buyer/opening/bids/3003/compliance': () => ({
        body: bidCompliance({ contentAvailable: false, checks: [] }),
      }),
    });
    renderWithProviders(<BidCompliancePage />, {
      state: stateFor(['compliance.assess']),
      path: PATH,
      route: ROUTE,
    });

    const readiness = await screen.findByRole('list', { name: 'Readiness to conclude' });
    expect(within(readiness).getAllByRole('listitem')).toHaveLength(1);
    expect(within(readiness).getByText('Not opened')).toBeInTheDocument();
    expect(within(readiness).queryByText('Every check resolved')).not.toBeInTheDocument();
    expect(screen.queryByText('Ranked')).not.toBeInTheDocument();
    expect(screen.queryByText('Not ranked')).not.toBeInTheDocument();
    expect(screen.getByText(/Receipt alone says nothing about compliance/)).toBeInTheDocument();
    expect(screen.queryByText(/unopened commercial envelope stays sealed/)).not.toBeInTheDocument();
  });

  it('explains the sealed commercial envelope only when an exclusion is active (AC-17)', async () => {
    installFetch({
      'GET /api/v1/buyer/opening/bids/3003/compliance': () => ({
        body: bidCompliance({ exclusions: [ExclusionRow.parse(exclusion())] }),
      }),
    });
    renderWithProviders(<BidCompliancePage />, {
      state: stateFor(['compliance.assess']),
      path: PATH,
      route: ROUTE,
    });

    expect(
      await screen.findByText(/this bid’s unopened commercial envelope stays sealed/),
    ).toBeInTheDocument();
  });

  it('requires evidence and a reason for a failed check before sending (FR-13)', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/opening/bids/3003/compliance': () => ({ body: bidCompliance() }),
      'PUT /api/v1/buyer/opening/checks/300305': (request) => ({
        body: check({
          result: 'fail',
          findingClass: 'substantive_noncompliance',
          evidenceRef: 'ISO9001.pdf',
          reason: 'Expired.',
          assessedBy: { userId: 5, fullName: 'Tebogo Molefe' },
          assessedAt: '2026-09-30T08:00:00Z',
          ...(request.body as object),
        }),
      }),
    });
    renderWithProviders(<BidCompliancePage />, {
      state: stateFor(['compliance.assess']),
      path: PATH,
      route: ROUTE,
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Record finding' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('radio', { name: /^Fail/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record finding' }));
    expect(
      await within(dialog).findByText('Cite the evidence for this finding.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Explain the failure.')).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'PUT')).toBe(false);

    await userEvent.type(within(dialog).getByLabelText('Evidence'), 'ISO9001.pdf');
    await userEvent.type(within(dialog).getByLabelText('Reason'), 'Expired.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record finding' }));

    const checklist = await screen.findByRole('table', { name: 'Compliance checklist' });
    expect(await within(checklist).findByText('Fail')).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'PUT')?.body).toEqual({
      result: 'fail',
      findingClass: 'substantive_noncompliance',
      reason: 'Expired.',
      evidenceRef: 'ISO9001.pdf',
    });
  });

  it('shows pending checks as blocking and the API reason when concluding anyway', async () => {
    installFetch({
      'GET /api/v1/buyer/opening/bids/3003/compliance': () => ({ body: bidCompliance() }),
      'POST /api/v1/buyer/opening/bids/3003/compliance-decision': () =>
        problem(409, 'Conflict', { code: 'CHECKS_PENDING', detail: 'Pending.' }),
    });
    renderWithProviders(<BidCompliancePage />, {
      state: stateFor(['compliance.assess']),
      path: PATH,
      route: ROUTE,
    });

    expect(await screen.findByText('1 check is still pending.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Conclude compliance' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record conclusion' }));
    expect(await within(dialog).findByText('Some checks are still pending.')).toBeInTheDocument();
  });

  it('proposes an exclusion only with a failed check to cite', async () => {
    installFetch({
      'GET /api/v1/buyer/opening/bids/3003/compliance': () => ({ body: bidCompliance() }),
    });
    renderWithProviders(<BidCompliancePage />, {
      state: stateFor(['compliance.assess']),
      path: PATH,
      route: ROUTE,
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Propose exclusion' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/No check has failed on this bid/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Propose exclusion' })).toBeDisabled();
  });
});
