import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  CANDIDATES,
  SUPPLIER_APPLY,
  SUPPLIER_VIEW,
  businessError,
  renderPage,
  routeCalls,
  supplierApplication,
  supplierDecisionDetail,
} from '../../test/kit';
import SupplierDecisionPage from './SupplierDecisionPage';

vi.mock('../../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/supplier/qualification/decisions/:decisionId',
  route: '/supplier/qualification/decisions/702',
  supplier: true,
};

describe('SupplierDecisionPage (SUP-24)', () => {
  it('shows the buyer, conditions, blocked gate, explanation, appeal route and expiring evidence (AC-09)', async () => {
    routeCalls({
      'supplier.qualification.decisions.get': () => supplierDecisionDetail(),
      'supplier.qualification.applications.evidenceCandidates': () => CANDIDATES,
    });
    renderPage(<SupplierDecisionPage />, { ...PATH, permissions: SUPPLIER_APPLY });
    expect(
      await screen.findByText('Decision of Kalahari Water Utilities (Pilot)'),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('Award blocked until the conditions are met').length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText('No award after 8 Oct 2026 until renewed insurance is received.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Request reconsideration within 14 days.')).toBeInTheDocument();
    expect(screen.getByText('1 evidence item expires soon or has expired')).toBeInTheDocument();
    expect(screen.getByText('Public liability insurance certificate')).toBeInTheDocument();
    expect(screen.queryByText('Insurance expiry handled as a condition.')).not.toBeInTheDocument();
  });

  it('supplies renewed insurance evidence after confirmation', async () => {
    const calls = routeCalls({
      'supplier.qualification.decisions.get': () => supplierDecisionDetail(),
      'supplier.qualification.applications.evidenceCandidates': () => CANDIDATES,
      'supplier.qualification.decisions.supplyEvidence': () => ({
        id: 900,
        decisionId: 702,
        evidenceItemId: 778,
        title: 'Renewed public liability insurance 2026/27',
        expiresAt: '2027-10-08',
        note: null,
        submittedAt: '2026-09-30T08:00:00Z',
        submittedBy: { userId: 29, fullName: 'Bakang Chobe' },
      }),
    });
    renderPage(<SupplierDecisionPage />, { ...PATH, permissions: SUPPLIER_APPLY });
    fireEvent.click(await screen.findByRole('button', { name: 'Supply updated evidence' }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(
        within(dialog).getByRole('option', { name: /Renewed public liability insurance/ }),
      ).toBeInTheDocument(),
    );
    fireEvent.change(within(dialog).getByLabelText(/^Evidence item/), { target: { value: '778' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supply updated evidence' }));
    expect(
      await screen.findByText(
        '"Renewed public liability insurance 2026/27" supplied to the buyer.',
      ),
    ).toBeInTheDocument();
    expect(
      calls.find((item) => item.id === 'supplier.qualification.decisions.supplyEvidence')?.request,
    ).toEqual({
      params: { decisionId: 702 },
      body: { evidenceItemId: 778, note: null },
    });
  });

  it('requests reconsideration with grounds and shows a refusal clearly', async () => {
    routeCalls({
      'supplier.qualification.decisions.get': () => supplierDecisionDetail(),
      'supplier.qualification.applications.evidenceCandidates': () => CANDIDATES,
      'supplier.qualification.decisions.requestReconsideration': () => {
        throw businessError(
          'supplier.qualification.decisions.requestReconsideration',
          'RECONSIDERATION_ALREADY_REQUESTED',
        );
      },
    });
    renderPage(<SupplierDecisionPage />, { ...PATH, permissions: SUPPLIER_APPLY });
    fireEvent.click(await screen.findByRole('button', { name: 'Request reconsideration' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Request reconsideration' }));
    expect(await within(dialog).findByText('This text is required.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/^Grounds/), {
      target: { value: 'Insurance renewed.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Request reconsideration' }));
    expect(
      await within(dialog).findByText('Reconsideration was already requested for this decision.'),
    ).toBeInTheDocument();
  });

  it('shows the reconsideration deadline and no request action once the window has closed', async () => {
    routeCalls({
      'supplier.qualification.decisions.get': () =>
        supplierDecisionDetail({ canRequestReconsideration: false }),
      'supplier.qualification.applications.evidenceCandidates': () => CANDIDATES,
    });
    renderPage(<SupplierDecisionPage />, { ...PATH, permissions: SUPPLIER_APPLY });
    expect(await screen.findByText('Reconsideration requests accepted until')).toBeInTheDocument();
    expect(screen.getByText(/18 May 2026, 10:30/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Request reconsideration' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Supply updated evidence' })).toBeInTheDocument();
  });

  it('explains a closed reconsideration window when the buyer refuses the request', async () => {
    routeCalls({
      'supplier.qualification.decisions.get': () => supplierDecisionDetail(),
      'supplier.qualification.applications.evidenceCandidates': () => CANDIDATES,
      'supplier.qualification.decisions.requestReconsideration': () => {
        throw businessError(
          'supplier.qualification.decisions.requestReconsideration',
          'RECONSIDERATION_WINDOW_CLOSED',
        );
      },
    });
    renderPage(<SupplierDecisionPage />, { ...PATH, permissions: SUPPLIER_APPLY });
    fireEvent.click(await screen.findByRole('button', { name: 'Request reconsideration' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Grounds/), {
      target: { value: 'Insurance renewed.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Request reconsideration' }));
    expect(
      await within(dialog).findByText(/The reconsideration window of this decision has closed/),
    ).toBeInTheDocument();
  });

  it('renews a renewable decision as a new draft that cites it', async () => {
    const calls = routeCalls({
      'supplier.qualification.decisions.get': () => supplierDecisionDetail({ canRenew: true }),
      'supplier.qualification.applications.evidenceCandidates': () => CANDIDATES,
      'supplier.qualification.applications.create': () =>
        supplierApplication({ id: 900, renewalOfDecisionId: 702 }),
    });
    const { router } = renderPage(<SupplierDecisionPage />, {
      ...PATH,
      permissions: SUPPLIER_APPLY,
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Renew' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start renewal' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/supplier/qualification/applications/900'),
    );
    expect(
      calls.find((item) => item.id === 'supplier.qualification.applications.create')?.request,
    ).toEqual({
      body: expect.objectContaining({
        programId: 11,
        scopeCategoryId: 33,
        renewalOfDecisionId: 702,
      }),
    });
  });

  it('shows the decision without actions to a contributor who only follows outcomes', async () => {
    routeCalls({ 'supplier.qualification.decisions.get': () => supplierDecisionDetail() });
    renderPage(<SupplierDecisionPage />, { ...PATH, permissions: SUPPLIER_VIEW });
    expect(
      await screen.findByText('Decision of Kalahari Water Utilities (Pilot)'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Supply updated evidence' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Request reconsideration' }),
    ).not.toBeInTheDocument();
  });
});
