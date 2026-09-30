import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  OPERATOR,
  businessError,
  page,
  registrationRow,
  renderPage,
  routeCalls,
} from '../../supplier-org/test/kit';
import OpsRegistrationsPage from './OpsRegistrationsPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/ops/supplier-registrations',
  route: '/ops/supplier-registrations',
  kind: 'operator' as const,
  permissions: OPERATOR,
};

describe('OpsRegistrationsPage (operator registration queue)', () => {
  it('lists pending registrations with registrant, e-mail status and possible duplicates', async () => {
    routeCalls({ 'ops.suppliers.registrations.list': () => page([registrationRow()]) });
    renderPage(<OpsRegistrationsPage />, PATH);
    const row = await screen.findByRole('row', { name: /Tsodilo Engineering Services/ });
    expect(within(row).getByText('Kopano Moeng')).toBeInTheDocument();
    expect(within(row).getByText('Send failed')).toBeInTheDocument();
    expect(within(row).getByText('Sent 1 time')).toBeInTheDocument();
    expect(within(row).getByText('Possible duplicate')).toBeInTheDocument();
    expect(screen.getByText('E-mail failures')).toBeInTheDocument();
  });

  it('verifies the legal identity with the evidence note', async () => {
    const calls = routeCalls({
      'ops.suppliers.registrations.list': () => page([registrationRow()]),
      'ops.suppliers.registrations.verifyIdentity': () =>
        registrationRow({ verificationStatus: 'identity_verified' }),
    });
    renderPage(<OpsRegistrationsPage />, PATH);
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Actions for Tsodilo Engineering Services (Pty) Ltd',
      }),
    );
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Verify identity' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/This is not qualification/)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Evidence/), {
      target: { value: 'CIPA extract BW00007788990 checked.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Verify identity' }));
    expect(
      (await screen.findAllByText('Tsodilo Engineering Services (Pty) Ltd: identity verified.'))
        .length,
    ).toBeGreaterThan(0);
    expect(
      calls.find((c) => c.id === 'ops.suppliers.registrations.verifyIdentity')?.request,
    ).toEqual({
      params: { supplierTenantId: 52 },
      body: { evidenceNote: 'CIPA extract BW00007788990 checked.' },
    });
  });

  it('explains why a registration cannot be verified yet', async () => {
    routeCalls({
      'ops.suppliers.registrations.list': () => page([registrationRow()]),
      'ops.suppliers.registrations.verifyIdentity': () => {
        throw businessError('ops.suppliers.registrations.verifyIdentity', 'CONTACT_NOT_VERIFIED');
      },
    });
    renderPage(<OpsRegistrationsPage />, PATH);
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Actions for Tsodilo Engineering Services (Pty) Ltd',
      }),
    );
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Verify identity' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Evidence/), { target: { value: 'Checked.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Verify identity' }));
    expect(
      await within(dialog).findByText('The registrant has not verified the contact e-mail yet.'),
    ).toBeInTheDocument();
  });

  it('closes an abandoned registration with a reason and filters by e-mail status', async () => {
    const calls = routeCalls({
      'ops.suppliers.registrations.list': () => page([registrationRow()]),
      'ops.suppliers.registrations.close': () => registrationRow({ status: 'closed' }),
    });
    renderPage(<OpsRegistrationsPage />, PATH);
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Actions for Tsodilo Engineering Services (Pty) Ltd',
      }),
    );
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Close' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Reason for closing/), {
      target: { value: 'Abandoned for 30 days.' },
    });
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Close' }).at(-1) as HTMLElement);
    await waitFor(() =>
      expect(calls.some((c) => c.id === 'ops.suppliers.registrations.close')).toBe(true),
    );
    fireEvent.change(screen.getByLabelText('Verification e-mail'), {
      target: { value: 'send_failed' },
    });
    await waitFor(() =>
      expect(
        calls.filter((c) => c.id === 'ops.suppliers.registrations.list').at(-1)?.request,
      ).toEqual({
        query: expect.objectContaining({ verificationEmailStatus: ['send_failed'] }),
      }),
    );
  });

  it('asks for missing identity evidence with the kinds needed, then shows the open request', async () => {
    const calls = routeCalls({
      'ops.suppliers.registrations.list': () => page([registrationRow()]),
      'ops.suppliers.registrations.requestEvidence': () =>
        registrationRow({
          evidenceRequest: {
            id: 900,
            status: 'open',
            reason: 'Upload the certificate of incorporation.',
            evidenceTypes: ['registration'],
            dueDate: '2026-10-20',
            requestedAt: '2026-09-30T08:00:00Z',
            respondedAt: null,
          },
        }),
    });
    renderPage(<OpsRegistrationsPage />, PATH);
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Actions for Tsodilo Engineering Services (Pty) Ltd',
      }),
    );
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Request missing evidence' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/this is not qualification/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Request missing evidence' }));
    expect(
      await within(dialog).findByText('Explain what is missing or unclear.'),
    ).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/What is missing or unclear/), {
      target: { value: 'Upload the certificate of incorporation.' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Answer by/), {
      target: { value: '2026-10-20' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Request missing evidence' }));
    await waitFor(() =>
      expect(
        calls.find((c) => c.id === 'ops.suppliers.registrations.requestEvidence')?.request,
      ).toEqual({
        params: { supplierTenantId: 52 },
        body: {
          reason: 'Upload the certificate of incorporation.',
          evidenceTypes: ['registration'],
          dueDate: '2026-10-20',
        },
      }),
    );
    const row = await screen.findByRole('row', { name: /Tsodilo Engineering Services/ });
    expect(within(row).getByText('Evidence requested')).toBeInTheDocument();
    expect(within(row).getByText(/due 20 Oct 2026/)).toBeInTheDocument();
  });

  it('offers identity verification but no second request for a registered, unverified organization', async () => {
    routeCalls({
      'ops.suppliers.registrations.list': () =>
        page([
          registrationRow({
            tenantId: 6,
            legalName: 'Makgadikgadi Civil Works (Pty) Ltd',
            status: 'active',
            possibleDuplicate: false,
            evidenceRequest: {
              id: 2,
              status: 'open',
              reason: 'Current company extract needed.',
              evidenceTypes: ['registration', 'declaration'],
              dueDate: '2026-10-09',
              requestedAt: '2026-09-21T09:00:00Z',
              respondedAt: null,
            },
          }),
        ]),
    });
    renderPage(<OpsRegistrationsPage />, PATH);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Actions for Makgadikgadi Civil Works (Pty) Ltd' }),
    );
    expect(await screen.findByRole('menuitem', { name: 'Verify identity' })).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Request missing evidence' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Close' })).not.toBeInTheDocument();
  });
});
