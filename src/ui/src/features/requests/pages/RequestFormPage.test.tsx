import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RequestDetail } from '@contracts/requests';

import { installFetch } from '../../../test/fetchMock';
import { options, request } from '../testing/data';
import { OFFICER, renderPage } from '../testing/render';
import RequestFormPage from './RequestFormPage';

const approved: RequestDetail = { ...request, status: 'approved', allowedActions: ['edit'] };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RequestFormPage (BUY-03 form)', () => {
  it('blocks saving and explains the title rule when the title is too short', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/request-options': () => ({ body: options }),
    });
    renderPage(<RequestFormPage />, {
      route: '/buyer/requests/new',
      path: '/buyer/requests/new',
      permissions: OFFICER,
    });

    await userEvent.type(await screen.findByLabelText(/^Title/), 'PP');
    await userEvent.click(screen.getAllByRole('button', { name: 'Save draft' })[0] as HTMLElement);

    expect(await screen.findByText('Enter a title of at least 3 characters.')).toBeInTheDocument();
    expect(requests.some((item) => item.method === 'POST')).toBe(false);
  });

  it('creates a draft that is saved but not submitted when the form is valid', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/request-options': () => ({ body: options }),
      'POST /api/v1/buyer/requests': () => ({
        status: 201,
        body: { ...request, id: 900, reference: 'PR-2026-0900', status: 'draft' },
      }),
    });
    renderPage(<RequestFormPage />, {
      route: '/buyer/requests/new',
      path: '/buyer/requests/new',
      permissions: OFFICER,
    });

    await userEvent.type(await screen.findByLabelText(/^Title/), 'Chlorine dosing pumps');
    await userEvent.click(screen.getByRole('radio', { name: /Indicative/ }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Save draft' })[0] as HTMLElement);

    await waitFor(() => expect(requests.find((item) => item.method === 'POST')).toBeDefined());
    const body = requests.find((item) => item.method === 'POST')?.body as Record<string, unknown>;
    expect(body.title).toBe('Chlorine dosing pumps');
    expect(body.fundingStatus).toBe('indicative');
    expect(body.needType).toBe('new_expenditure');
    expect(await screen.findByText('PR-2026-0900 is saved as a draft')).toBeInTheDocument();
  });

  it('sends the organization’s additional fields with the saved draft', async () => {
    const form = {
      entityType: 'procurement_request',
      coreConditionSources: ['category_code', 'value_band'],
      fields: [
        {
          id: 1,
          entityType: 'procurement_request',
          key: 'funding_vote_code',
          label: 'Funding vote code',
          purpose: 'The budget vote that funds the request.',
          fieldType: 'text',
          allowedValues: [],
          requiredMode: 'required',
          requiredConditionField: null,
          requiredConditionValue: null,
          audience: 'buyer_internal',
          sortOrder: 10,
        },
      ],
    };
    const { requests } = installFetch({
      'GET /api/v1/buyer/request-options': () => ({ body: options }),
      'GET /api/v1/buyer/policy/form-definitions/procurement_request': () => ({ body: form }),
      'POST /api/v1/buyer/requests': () => ({
        status: 201,
        body: { ...request, id: 900, reference: 'PR-2026-0900', status: 'draft' },
      }),
    });
    renderPage(<RequestFormPage />, {
      route: '/buyer/requests/new',
      path: '/buyer/requests/new',
      permissions: OFFICER,
    });

    await userEvent.type(await screen.findByLabelText(/^Title/), 'Chlorine dosing pumps');
    await userEvent.type(await screen.findByLabelText(/^Funding vote code/), 'OPS-2026-0522');
    await userEvent.click(screen.getAllByRole('button', { name: 'Save draft' })[0] as HTMLElement);

    await waitFor(() => expect(requests.find((item) => item.method === 'POST')).toBeDefined());
    const body = requests.find((item) => item.method === 'POST')?.body as Record<string, unknown>;
    expect(body.customFields).toEqual({ funding_vote_code: 'OPS-2026-0522' });
  });

  it('requires the replaced contract when the need replaces an existing contract', async () => {
    installFetch({ 'GET /api/v1/buyer/request-options': () => ({ body: options }) });
    renderPage(<RequestFormPage />, {
      route: '/buyer/requests/new',
      path: '/buyer/requests/new',
      permissions: OFFICER,
    });

    await userEvent.type(await screen.findByLabelText(/^Title/), 'Fleet maintenance');
    await userEvent.click(screen.getByRole('radio', { name: 'Replacement' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Save draft' })[0] as HTMLElement);

    expect(
      await screen.findByText('Name the contract this request replaces or extends.'),
    ).toBeInTheDocument();
  });

  it('shows that re-approval is required after a material change to an approved request', async () => {
    installFetch({
      'GET /api/v1/buyer/request-options': () => ({ body: options }),
      'GET /api/v1/buyer/requests/3': () => ({ body: approved }),
      'PUT /api/v1/buyer/requests/3': () => ({
        body: {
          request: { ...approved, status: 'under_review', revision: 2, reapprovalRequired: true },
          changeAssessment: {
            revision: 2,
            changedFields: ['estimatedValue'],
            material: true,
            reapprovalRequired: true,
            message: 'The estimate changed after approval: re-approval is required.',
          },
        },
      }),
    });
    renderPage(<RequestFormPage />, {
      route: '/buyer/requests/3/edit',
      path: '/buyer/requests/:requestId/edit',
      permissions: OFFICER,
    });

    expect(await screen.findByText('Approved request')).toBeInTheDocument();
    const estimate = screen.getByLabelText(/^Estimated value/);
    await userEvent.clear(estimate);
    await userEvent.type(estimate, '5200000');
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Save changes' })[0] as HTMLElement,
    );

    expect(await screen.findByText('Saved: re-approval required')).toBeInTheDocument();
    expect(screen.getByText('Changed: Estimated value')).toBeInTheDocument();
  });
});
