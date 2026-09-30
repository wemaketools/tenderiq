import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  ASSESSOR,
  MANAGER,
  options,
  page,
  programRow,
  renderPage,
  routeCalls,
} from '../../test/kit';
import ProgramsPage from './ProgramsPage';

vi.mock('../../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/buyer/admin/qualification', route: '/buyer/admin/qualification' };

describe('ProgramsPage (ADM-09)', () => {
  it('lists programs with scope, versions, validity, applications and status', async () => {
    routeCalls({
      'buyer.qualification.programs.list': () => page([programRow()]),
      'buyer.qualification.options': () => options(),
    });
    renderPage(<ProgramsPage />, { ...PATH, permissions: MANAGER });
    const row = await screen.findByRole('row', { name: /Water Infrastructure Suppliers/ });
    expect(within(row).getByText('WTR-INFRA Water infrastructure')).toBeInTheDocument();
    expect(within(row).getByText('Draft version 3')).toBeInTheDocument();
    expect(within(row).getByText('24 months')).toBeInTheDocument();
    expect(within(row).getByText('Renewal notice 60 days')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New program' })).toBeInTheDocument();
  });

  it('sends the status and owner filters', async () => {
    const calls = routeCalls({
      'buyer.qualification.programs.list': () => page([programRow()]),
      'buyer.qualification.options': () => options(),
    });
    renderPage(<ProgramsPage />, { ...PATH, permissions: MANAGER });
    await screen.findByRole('row', { name: /Water Infrastructure Suppliers/ });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'draft' } });
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Mpho Dikgang' })).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText('Owner'), { target: { value: '4' } });
    await waitFor(() =>
      expect(
        calls.filter((item) => item.id === 'buyer.qualification.programs.list').at(-1)?.request,
      ).toEqual({
        query: expect.objectContaining({ status: ['draft'], ownerUserId: 4, page: 1 }),
      }),
    );
  });

  it('opens a program and hides creation from assessors', async () => {
    routeCalls({
      'buyer.qualification.programs.list': () => page([programRow()]),
      'buyer.qualification.options': () => options(),
    });
    const { router } = renderPage(<ProgramsPage />, { ...PATH, permissions: ASSESSOR });
    fireEvent.click(await screen.findByText('Water Infrastructure Suppliers — Category A'));
    expect(router.state.location.pathname).toBe('/buyer/admin/qualification/11');
    expect(screen.queryByRole('link', { name: 'New program' })).not.toBeInTheDocument();
  });

  it('explains an empty register', async () => {
    routeCalls({
      'buyer.qualification.programs.list': () => page([]),
      'buyer.qualification.options': () => options(),
    });
    renderPage(<ProgramsPage />, { ...PATH, permissions: MANAGER });
    expect(await screen.findByText('No qualification program yet')).toBeInTheDocument();
  });
});
