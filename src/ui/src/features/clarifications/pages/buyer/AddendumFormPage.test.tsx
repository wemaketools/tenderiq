import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { syncServerClock } from '../../../../lib/clock';

import { installFetch, problem } from '../../../../test/fetchMock';
import { LocationProbe, renderWithProviders } from '../../../../test/render';
import {
  BUYER_ALL,
  addendumDetail,
  buyerState,
  buyerTender,
  pageOf,
  tenderContext,
} from '../../testData';
import AddendumFormPage from './AddendumFormPage';

const B = '/api/v1/buyer/clarifications';

const draft = () =>
  addendumDetail({
    id: 23,
    status: 'draft',
    issuedAt: null,
    resultingVersionNo: null,
    acknowledgments: null,
    approvalStatus: null,
    approvalRequestId: null,
    recipients: [],
    notice: null,
  });

function renderNew(extra: Parameters<typeof installFetch>[0] = {}) {
  const fetch = installFetch({
    [`GET ${B}/tenders`]: () => ({ body: pageOf([buyerTender()]) }),
    [`GET ${B}/tenders/2`]: () => ({ body: tenderContext() }),
    ...extra,
  });
  renderWithProviders(<AddendumFormPage />, {
    state: buyerState(BUYER_ALL),
    route: '/buyer/clarifications/addenda/new?tenderId=2&questionId=202',
    path: '/buyer/clarifications/addenda/new',
    routes: [
      {
        path: '/buyer/clarifications/addenda/:addendumId',
        element: <LocationProbe label="addendum page" />,
      },
    ],
  });
  return fetch;
}

async function fillRequired(): Promise<void> {
  await userEvent.type(await screen.findByLabelText(/^Title/), 'Deadline extension');
  await userEvent.type(screen.getByLabelText(/^Description of the change/), 'Moves the deadline.');
  await userEvent.type(screen.getByLabelText(/^Reason/), 'Supplier request.');
}

beforeEach(() => {
  // The application clock at the session's server time, so deadlines are judged on the fixtures' dates, not today's.
  syncServerClock('2026-09-29T08:00:00Z');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AddendumFormPage (BUY-17)', () => {
  it('blocks saving until a change area is selected', async () => {
    const { requests } = renderNew();
    await fillRequired();

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(
      (
        await screen.findAllByText(
          'Select at least one change area: scope, terms, submission or evaluation.',
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
  });

  it('saves a draft with the source question and opens it', async () => {
    const { requests } = renderNew({
      [`POST ${B}/addenda`]: () => ({ status: 201, body: draft() }),
    });
    await fillRequired();
    await userEvent.click(screen.getByLabelText('Evaluation'));
    await userEvent.click(screen.getByLabelText('Lot 1 · Smart meters'));

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'POST')?.body).toMatchObject({
        tenderId: 2,
        title: 'Deadline extension',
        changesEvaluation: true,
        lotIds: [21],
        newSubmissionDeadline: null,
        sourceQuestionIds: [202],
        existingSubmissionAction: 'acknowledge',
      }),
    );
    expect(await screen.findByTestId('location-probe')).toHaveTextContent('addendum page');
  });

  it('binds server field errors to the matching input', async () => {
    renderNew({
      [`POST ${B}/addenda`]: () =>
        problem(422, 'Validation failed', {
          errors: [
            { field: 'title', code: 'TITLE_REQUIRED', message: 'Title rejected by server.' },
          ],
        }),
    });
    await fillRequired();
    await userEvent.click(screen.getByLabelText('Scope'));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByText('Title rejected by server.')).toBeInTheDocument();
  });

  it('asks for a new deadline in the official zone when the deadline changes', async () => {
    renderNew();
    await fillRequired();
    await userEvent.click(screen.getByLabelText(/This addendum changes the submission deadline/));

    expect(screen.getByLabelText('Submission')).toBeChecked();
    expect(screen.getAllByText(/Africa\/Gaborone/).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Enter the new submission deadline.')).toBeInTheDocument();
  });

  it('edits an existing draft with an update request', async () => {
    const { requests } = installFetch({
      [`GET ${B}/addenda/23`]: () => ({ body: draft() }),
      [`GET ${B}/tenders/2`]: () => ({ body: tenderContext() }),
      [`PUT ${B}/addenda/23`]: () => ({ body: draft() }),
    });
    renderWithProviders(<AddendumFormPage />, {
      state: buyerState(BUYER_ALL),
      route: '/buyer/clarifications/addenda/23/edit',
      path: '/buyer/clarifications/addenda/:addendumId/edit',
      routes: [
        {
          path: '/buyer/clarifications/addenda/:addendumId',
          element: <LocationProbe label="addendum page" />,
        },
      ],
    });

    const title = await screen.findByLabelText(/^Title/);
    expect(title).toHaveValue('New mandatory requirement REQ-Q-05 and deadline extension');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(requests.some((request) => request.method === 'PUT')).toBe(true));
  });
});
