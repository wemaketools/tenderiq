import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  businessError,
  REFERENCE_HANDLERS,
  registrationResult,
  renderPage,
  routeCalls,
} from '../test/kit';
import RegisterPage from './RegisterPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/register', route: '/register', signedOut: true };

async function fillIdentity(): Promise<void> {
  // The country list comes from the API (reference options); wait for it.
  expect(await screen.findByRole('option', { name: 'Botswana' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Legal name/), {
    target: { value: 'Mahalapye Pumps (Pty) Ltd' },
  });
  fireEvent.change(screen.getByLabelText(/Registration jurisdiction/), {
    target: { value: 'Botswana — CIPA' },
  });
  fireEvent.change(screen.getByLabelText(/Registration number/), {
    target: { value: 'BW00009990001' },
  });
  fireEvent.change(screen.getByLabelText(/Your work e-mail/), {
    target: { value: 'owner@mahalapye.example' },
  });
}

function fillDetails(): void {
  fireEvent.change(screen.getByLabelText(/Your full name/), { target: { value: 'Kabelo Owner' } });
  fireEvent.change(screen.getByLabelText(/Location name/), { target: { value: 'Head office' } });
  fireEvent.change(screen.getByLabelText(/^Address/), { target: { value: 'Plot 1, Mahalapye' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /Water infrastructure › Pumps/ }));
}

describe('RegisterPage (SUP-02)', () => {
  it('shows only that a similar organization exists and sends a membership request without naming it', async () => {
    const calls = routeCalls({
      ...REFERENCE_HANDLERS,
      'public.suppliers.duplicateCheck': () => ({
        outcome: 'possible_duplicate',
        matchToken: 'dup_q7Lm2Xa9Pt4R',
        message: 'An organization with similar details already exists on TenderIQ.',
      }),
      'public.suppliers.requestMembership': () => ({
        status: 'pending',
        message: 'Your request was sent to the organization administrator.',
        submittedAt: '2026-09-30T08:00:00Z',
      }),
    });
    renderPage(<RegisterPage />, PATH);
    await fillIdentity();
    fireEvent.click(screen.getByRole('button', { name: 'Check and continue' }));

    expect(
      await screen.findByText('An organization with similar details exists'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Tsodilo/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Request membership' }));
    fireEvent.change(screen.getByLabelText(/Your full name/), { target: { value: 'Neo Person' } });
    fireEvent.change(screen.getByLabelText(/Message to the administrator/), {
      target: { value: 'I am the new estimator.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

    expect(await screen.findByText('Membership request sent')).toBeInTheDocument();
    expect(calls.find((c) => c.id === 'public.suppliers.requestMembership')?.request).toEqual({
      body: expect.objectContaining({ matchToken: 'dup_q7Lm2Xa9Pt4R', fullName: 'Neo Person' }),
    });
  });

  it('keeps registration, verification, membership and qualification separate after submitting (AC-07)', async () => {
    const calls = routeCalls({
      ...REFERENCE_HANDLERS,
      'public.suppliers.duplicateCheck': () => ({
        outcome: 'no_match',
        matchToken: null,
        message: 'No similar organization found.',
      }),
      'public.suppliers.register': () => registrationResult(),
    });
    renderPage(<RegisterPage />, PATH);
    await fillIdentity();
    fireEvent.click(screen.getByRole('button', { name: 'Check and continue' }));
    await screen.findByText('Organization details');
    fillDetails();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    await screen.findByText('Review and submit');
    fireEvent.click(screen.getByRole('checkbox', { name: /I accept the TenderIQ terms/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit registration' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Registrant')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Submit registration' }));

    expect(await screen.findByText('Mahalapye Pumps (Pty) Ltd is registered')).toBeInTheDocument();
    expect(screen.getByText('Not assessed')).toBeInTheDocument();
    expect(screen.getAllByText('Registration is not qualification').length).toBeGreaterThan(0);
    const body = calls.find((c) => c.id === 'public.suppliers.register')?.request.body as Record<
      string,
      unknown
    >;
    expect(body).toEqual(
      expect.objectContaining({ legalName: 'Mahalapye Pumps (Pty) Ltd', categories: ['WTR-PUMP'] }),
    );
    expect(Object.keys(body)).not.toContain('bankAccount');
  });

  it('refuses to check an incomplete identity and explains each missing field', async () => {
    const calls = routeCalls({ ...REFERENCE_HANDLERS });
    renderPage(<RegisterPage />, PATH);
    fireEvent.click(screen.getByRole('button', { name: 'Check and continue' }));
    expect(await screen.findByText('Enter the legal name.')).toBeInTheDocument();
    expect(screen.getByText('Enter the registration number.')).toBeInTheDocument();
    expect(calls.some((c) => c.id === 'public.suppliers.duplicateCheck')).toBe(false);
  });

  it('returns to the identity step with a clear message when the e-mail is already registered', async () => {
    routeCalls({
      ...REFERENCE_HANDLERS,
      'public.suppliers.duplicateCheck': () => ({
        outcome: 'no_match',
        matchToken: null,
        message: 'No similar organization found.',
      }),
      'public.suppliers.register': () => {
        throw businessError('public.suppliers.register', 'EMAIL_ALREADY_REGISTERED', 409);
      },
    });
    renderPage(<RegisterPage />, PATH);
    await fillIdentity();
    fireEvent.click(screen.getByRole('button', { name: 'Check and continue' }));
    await screen.findByText('Organization details');
    fillDetails();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    await screen.findByText('Review and submit');
    fireEvent.click(screen.getByRole('checkbox', { name: /I accept the TenderIQ terms/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit registration' }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Submit registration',
      }),
    );
    await waitFor(() =>
      expect(
        screen.getAllByText(/This e-mail address already has an account/).length,
      ).toBeGreaterThan(0),
    );
    expect(screen.getByText('Legal identity')).toBeInTheDocument();
  });
});

describe('RegisterPage country choices (reference data from the API)', () => {
  it('offers the countries served by the API and defaults to the platform country', async () => {
    const calls = routeCalls({ ...REFERENCE_HANDLERS });
    renderPage(<RegisterPage />, PATH);
    const country = await screen.findByLabelText(/Country of registration/);
    await waitFor(() => expect(country).toHaveValue('BW'));
    expect(within(country).getByRole('option', { name: 'South Africa' })).toBeInTheDocument();
    expect(calls.some((entry) => entry.id === 'public.suppliers.referenceOptions')).toBe(true);
  });
});
