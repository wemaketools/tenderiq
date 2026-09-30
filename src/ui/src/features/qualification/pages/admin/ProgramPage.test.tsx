import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ASSESSOR, MANAGER, options, programDetail, renderPage, routeCalls } from '../../test/kit';
import ProgramPage from './ProgramPage';

vi.mock('../../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/buyer/admin/qualification/:programId',
  route: '/buyer/admin/qualification/11',
};

describe('ProgramPage (ADM-09)', () => {
  it('shows scope, authority, monitoring triggers, versions and criteria per area', async () => {
    routeCalls({
      'buyer.qualification.programs.get': () => programDetail(),
      'buyer.qualification.options': () => options(),
    });
    renderPage(<ProgramPage />, { ...PATH, permissions: ASSESSOR });
    expect(await screen.findByText('Procurement manager')).toBeInTheDocument();
    expect(
      screen.getAllByText('Water Infrastructure Suppliers — Category A').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Evidence expiry, Insurance expired')).toBeInTheDocument();
    expect(screen.getByText('Proposed: ISO 45001.')).toBeInTheDocument();
    expect(screen.getByText('A current certificate')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Approve version/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Question/)).not.toBeInTheDocument();
  });

  it('edits and saves the criteria of the draft version, requiring evidence types for documents', async () => {
    const calls = routeCalls({
      'buyer.qualification.programs.get': () => programDetail(),
      'buyer.qualification.options': () => options(),
      'buyer.qualification.programs.saveCriteria': () => programDetail(),
    });
    renderPage(<ProgramPage />, { ...PATH, permissions: MANAGER });
    fireEvent.click(await screen.findByRole('button', { name: 'Add criterion' }));
    const fieldset = screen.getByRole('group', { name: 'Criterion 2' });
    fireEvent.change(within(fieldset).getByLabelText(/^Question/), {
      target: { value: 'ISO 45001 certificate' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save criteria' }));
    expect(
      await screen.findByText('A document criterion names the evidence types it accepts.'),
    ).toBeInTheDocument();

    fireEvent.click(within(fieldset).getByLabelText('Certificate'));
    fireEvent.click(screen.getByRole('button', { name: 'Save criteria' }));
    expect(await screen.findByText('Criteria saved to the draft version.')).toBeInTheDocument();
    const body = calls.find(
      (item) => item.id === 'buyer.qualification.programs.saveCriteria',
    )?.request;
    expect(body).toEqual({
      params: { programId: 11, versionId: 113 },
      body: {
        criteria: [
          expect.objectContaining({
            question: 'ISO 9001 quality management certificate',
            sortOrder: 0,
          }),
          expect.objectContaining({
            question: 'ISO 45001 certificate',
            evidenceTypes: ['certificate'],
            sortOrder: 1,
          }),
        ],
      },
    });
  });

  it('approves the draft version after confirmation', async () => {
    const calls = routeCalls({
      'buyer.qualification.programs.get': () => programDetail(),
      'buyer.qualification.options': () => options(),
      'buyer.qualification.programs.approveVersion': () => programDetail(),
    });
    renderPage(<ProgramPage />, { ...PATH, permissions: MANAGER });
    fireEvent.click(await screen.findByRole('button', { name: 'Approve version 3' }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/Applications already submitted keep the version they cite/),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve version 3' }));
    expect(await screen.findByText('Version 3 approved.')).toBeInTheDocument();
    expect(
      calls.find((item) => item.id === 'buyer.qualification.programs.approveVersion')?.request,
    ).toEqual({
      params: { programId: 11, versionId: 113 },
      body: { note: null },
    });
  });

  it('retires the program only with a reason', async () => {
    const calls = routeCalls({
      'buyer.qualification.programs.get': () => programDetail(),
      'buyer.qualification.options': () => options(),
      'buyer.qualification.programs.retire': () => programDetail({ status: 'retired' }),
    });
    renderPage(<ProgramPage />, { ...PATH, permissions: MANAGER });
    fireEvent.click(await screen.findByRole('button', { name: 'Retire program' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Retire program' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/^Reason/), {
      target: { value: 'Merged into category B.' },
    });
    fireEvent.click(confirm);
    expect(await screen.findByText('Program retired.')).toBeInTheDocument();
    expect(screen.getByText(/This program is retired/)).toBeInTheDocument();
    await waitFor(() =>
      expect(
        calls.find((item) => item.id === 'buyer.qualification.programs.retire')?.request,
      ).toEqual({
        params: { programId: 11 },
        body: { reason: 'Merged into category B.' },
      }),
    );
  });

  it('explains an unknown program', async () => {
    routeCalls({ 'buyer.qualification.options': () => options() });
    renderPage(<ProgramPage />, { ...PATH, permissions: MANAGER });
    expect((await screen.findAllByText('Program not found')).length).toBeGreaterThan(0);
  });
});
