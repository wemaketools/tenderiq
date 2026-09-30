import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  MANAGER,
  businessError,
  options,
  programDetail,
  renderPage,
  routeCalls,
} from '../../test/kit';
import ProgramNewPage from './ProgramNewPage';

vi.mock('../../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/buyer/admin/qualification/new', route: '/buyer/admin/qualification/new' };

async function fill() {
  fireEvent.change(await screen.findByLabelText(/^Program name/), {
    target: { value: 'Borehole drilling' },
  });
  fireEvent.change(screen.getByLabelText(/^Category/), { target: { value: '32' } });
  fireEvent.change(screen.getByLabelText(/^Validity/), { target: { value: '24' } });
  fireEvent.change(screen.getByLabelText(/^Renewal notice/), { target: { value: '60' } });
  fireEvent.change(screen.getByLabelText(/^Deciding role/), {
    target: { value: 'procurement_manager' },
  });
  fireEvent.change(screen.getByRole('combobox', { name: /^Owner/ }), { target: { value: '4' } });
}

describe('ProgramNewPage (ADM-09)', () => {
  it('validates the header before creating a draft program', async () => {
    const calls = routeCalls({ 'buyer.qualification.options': () => options() });
    renderPage(<ProgramNewPage />, { ...PATH, permissions: MANAGER });
    fireEvent.click((await screen.findAllByRole('button', { name: 'Create program' }))[0]!);
    expect(await screen.findByText('At least 3 characters.')).toBeInTheDocument();
    expect(calls.some((item) => item.id === 'buyer.qualification.programs.create')).toBe(false);
  });

  it('creates the program as a draft with an empty version 1', async () => {
    const calls = routeCalls({
      'buyer.qualification.options': () => options(),
      'buyer.qualification.programs.create': () =>
        programDetail({ id: 900, name: 'Borehole drilling', status: 'draft' }),
    });
    renderPage(<ProgramNewPage />, { ...PATH, permissions: MANAGER });
    await fill();
    fireEvent.click(screen.getAllByRole('button', { name: 'Create program' })[0]!);
    expect(await screen.findByText('The draft program is created')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        calls.find((item) => item.id === 'buyer.qualification.programs.create')?.request,
      ).toEqual({
        body: expect.objectContaining({
          name: 'Borehole drilling',
          categoryId: 32,
          validityMonths: 24,
          renewalNoticeDays: 60,
          decisionRoleCode: 'procurement_manager',
          ownerUserId: 4,
          maxContractValue: null,
        }),
      }),
    );
  });

  it('shows a duplicate name refusal', async () => {
    routeCalls({
      'buyer.qualification.options': () => options(),
      'buyer.qualification.programs.create': () => {
        throw businessError('buyer.qualification.programs.create', 'PROGRAM_NAME_DUPLICATE');
      },
    });
    renderPage(<ProgramNewPage />, { ...PATH, permissions: MANAGER });
    await fill();
    fireEvent.click(screen.getAllByRole('button', { name: 'Create program' })[0]!);
    expect(await screen.findByText('Another program already has this name.')).toBeInTheDocument();
  });
});
