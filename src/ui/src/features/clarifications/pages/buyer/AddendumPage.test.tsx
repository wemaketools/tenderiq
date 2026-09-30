import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PermissionCode } from '@contracts/permissions';

import { installFetch, problem } from '../../../../test/fetchMock';
import { renderWithProviders } from '../../../../test/render';
import { BUYER_ALL, addendumDetail, buyerState, tenderContext } from '../../testData';
import AddendumPage from './AddendumPage';

const B = '/api/v1/buyer/clarifications';

function render(
  addendum = addendumDetail(),
  extra: Parameters<typeof installFetch>[0] = {},
  permissions: readonly PermissionCode[] = BUYER_ALL,
) {
  const fetch = installFetch({
    [`GET ${B}/addenda/${addendum.id}`]: () => ({ body: addendum }),
    [`GET ${B}/tenders/2`]: () => ({ body: tenderContext() }),
    ...extra,
  });
  renderWithProviders(<AddendumPage />, {
    state: buyerState(permissions),
    route: `/buyer/clarifications/addenda/${addendum.id}`,
    path: '/buyer/clarifications/addenda/:addendumId',
  });
  return fetch;
}

const approved = () =>
  addendumDetail({
    status: 'approved',
    issuedAt: null,
    resultingVersionNo: null,
    acknowledgments: null,
    recipients: [],
    notice: null,
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AddendumPage (BUY-17, AC-10)', () => {
  it('shows the change before and after, the dates and that prior receipts stay intact', async () => {
    render();

    expect(await screen.findByText('Provide a class B accuracy certificate.')).toBeInTheDocument();
    expect(screen.getByText('Current submission deadline')).toBeInTheDocument();
    expect(screen.getAllByText('RCPT-2026-0002-001').length).toBeGreaterThan(0);
    expect(screen.getByText('Receipt unchanged')).toBeInTheDocument();
    expect(screen.getByText('Required action outstanding')).toBeInTheDocument();
    expect(
      screen.getByText('Follow up outstanding acknowledgments and actions'),
    ).toBeInTheDocument();
  });

  it('issues an approved addendum after confirming the recipients', async () => {
    const { requests } = render(approved(), {
      [`POST ${B}/addenda/21/issue`]: () => ({ body: addendumDetail() }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Issue addendum' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Gaborone Metering Co\./)).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: 'Issue addendum' });
    expect(confirm).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('checkbox'));
    await userEvent.click(confirm);

    await waitFor(() =>
      expect(requests.find((request) => request.path.endsWith('/issue'))?.body).toEqual({
        confirmed: true,
      }),
    );
    expect(await screen.findByText('Addendum issued.')).toBeInTheDocument();
  });

  it('hides the issue action without the publish permission', async () => {
    render(approved(), {}, ['tender.clarifications.manage']);
    await screen.findByText('Provide a class B accuracy certificate.');
    expect(screen.queryByRole('button', { name: 'Issue addendum' })).not.toBeInTheDocument();
  });

  it('distinguishes blocking checks from warnings and blocks submission', async () => {
    render(
      addendumDetail({
        status: 'draft',
        issuedAt: null,
        resultingVersionNo: null,
        acknowledgments: null,
        recipients: [],
        notice: null,
        approvalRequestId: null,
        approvalStatus: null,
        existingSubmissionAction: 'none',
        blockingIssues: ['RESPONSE_TIME_ASSESSMENT_REQUIRED'],
      }),
    );

    expect(
      await screen.findByText(
        'A material change needs an assessment of whether participants need more time.',
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText(/1 supplier has already submitted/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeDisabled();
  });

  it('shows one pending approval row and truthful wording for a non-material correction', async () => {
    render(
      addendumDetail({
        status: 'awaiting_approval',
        materiality: 'non_material',
        changesScope: false,
        changesTerms: false,
        changesSubmission: false,
        changesEvaluation: false,
        newSubmissionDeadline: null,
        issuedAt: null,
        resultingVersionNo: null,
        acknowledgments: null,
        recipients: [],
        notice: null,
        approvalRequestId: 44,
        approvalStatus: 'pending',
        blockingIssues: ['APPROVAL_PENDING'],
      }),
    );

    const checklist = await screen.findAllByRole('list', { name: 'Readiness' });
    const items = within(checklist[0] as HTMLElement);
    expect(items.getAllByText('Approval')).toHaveLength(1);
    expect(items.queryByText('Approval before issue')).not.toBeInTheDocument();
    expect(items.getByText('The approval decision is pending.')).toBeInTheDocument();
    expect(items.getByText('Not required for a non-material correction.')).toBeInTheDocument();
    expect(items.queryByText('Change areas identified.')).not.toBeInTheDocument();
    expect(items.getByText('No deadline change.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open approval request' })).toHaveAttribute(
      'href',
      '/me/approvals/44',
    );
  });

  it('shows the approval as given once the addendum is issued', async () => {
    render();
    const checklist = await screen.findAllByRole('list', { name: 'Readiness' });
    expect(
      within(checklist[0] as HTMLElement).getByText('Approved before issue.'),
    ).toBeInTheDocument();
  });

  it('explains a declared error code when reminding recipients', async () => {
    render(addendumDetail(), {
      [`POST ${B}/addenda/21/reminders`]: () =>
        problem(409, 'Conflict', { code: 'NO_OUTSTANDING_ACKNOWLEDGMENTS' }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Remind recipients' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remind recipients' }));
    expect(
      await within(dialog).findByText('Every recipient has acknowledged and acted.'),
    ).toBeInTheDocument();
  });
});
