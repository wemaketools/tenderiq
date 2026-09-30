import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  authoringOptions,
  businessError,
  renderPage,
  routeCalls,
  templateDetail,
} from '../test/kit';
import TemplatePage from './TemplatePage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/buyer/admin/policy/templates/:templateId',
  route: '/buyer/admin/policy/templates/3',
};

const idleCaps = {
  canEdit: true,
  canDraftVersion: true,
  canSubmit: false,
  canApprove: false,
  canReturn: false,
  canRetire: true,
  approvalBlockedReason: null,
  alternativeOversightNote: null,
};

describe('TemplatePage (ADM-08)', () => {
  it('shows the content, revision history, adopting records and governance', async () => {
    routeCalls({ 'buyer.policy.getTemplate': () => templateDetail() });
    renderPage(<TemplatePage />, PATH);

    expect(await screen.findByRole('heading', { name: 'Evaluation criteria' })).toBeInTheDocument();
    expect(screen.getByText('Technical approach')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'T-2026-0003' })).toBeInTheDocument();
    expect(screen.getByText('Approve revision 2 or return it with a reason.')).toBeInTheDocument();
    expect(screen.getByText('Selectable for new work')).toBeInTheDocument();
  });

  it('approves the revision in review', async () => {
    const calls = routeCalls({
      'buyer.policy.getTemplate': () => templateDetail(),
      'buyer.policy.approveTemplateVersion': () =>
        templateDetail({ pendingVersionNo: null, capabilities: idleCaps }),
    });
    renderPage(<TemplatePage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve revision' }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve revision' }),
    );
    expect(await screen.findByRole('button', { name: 'New revision' })).toBeInTheDocument();
    expect(
      calls.find((entry) => entry.id === 'buyer.policy.approveTemplateVersion')?.request,
    ).toEqual({
      params: { templateId: 3, versionId: 6 },
      body: {},
    });
  });

  it('drafts a revision with an explained change while the approved version stays in use', async () => {
    const calls = routeCalls({
      'buyer.policy.getTemplate': () => templateDetail({ capabilities: idleCaps }),
      'buyer.policy.createTemplateVersion': () => templateDetail(),
    });
    renderPage(<TemplatePage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'New revision' }));
    expect(
      screen.getByText('The approved version stays in use until the revision is approved.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save revision draft' }));
    expect(await screen.findByText('Explain what changes.')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /What changes in this revision/ }), {
      target: { value: 'Raises the price weight.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save revision draft' }));
    await waitFor(() =>
      expect(
        calls.find((entry) => entry.id === 'buyer.policy.createTemplateVersion')?.request,
      ).toMatchObject({
        params: { templateId: 3 },
        body: { changeNote: 'Raises the price weight.' },
      }),
    );
  });

  it('edits the governance details and explains an owner who is not a member', async () => {
    routeCalls({
      'buyer.policy.getTemplate': () => templateDetail(),
      'buyer.policy.templateAuthoringOptions': () => authoringOptions(),
      'buyer.policy.updateTemplate': () => {
        throw businessError('buyer.policy.updateTemplate', 'OWNER_NOT_MEMBER', 422);
      },
    });
    renderPage(<TemplatePage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit details' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(await within(dialog).findByLabelText(/^Owner/), { target: { value: '5' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save details' }));
    expect(
      await within(dialog).findByText('The owner must be an active member of this organization.'),
    ).toBeInTheDocument();
  });

  it('retires the template with a reason and shows it cannot be selected', async () => {
    routeCalls({
      'buyer.policy.getTemplate': () => templateDetail({ capabilities: idleCaps }),
      'buyer.policy.retireTemplate': () =>
        templateDetail({
          status: 'retired',
          selectable: false,
          retiredAt: '2026-09-30T08:00:00Z',
          retirementReason: 'Replaced.',
          capabilities: { ...idleCaps, canEdit: false, canDraftVersion: false, canRetire: false },
        }),
    });
    renderPage(<TemplatePage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Retire template' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Replaced.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retire template' }));
    expect(await screen.findByText('This template is retired')).toBeInTheDocument();
    expect(screen.getAllByText('Not selectable').length).toBeGreaterThan(0);
  });

  it('tells the submitter that another approver must decide', async () => {
    routeCalls({
      'buyer.policy.getTemplate': () =>
        templateDetail({
          capabilities: {
            ...idleCaps,
            canDraftVersion: false,
            canReturn: true,
            approvalBlockedReason:
              'You submitted this version, so another approver must decide it (BR-07).',
          },
        }),
    });
    renderPage(<TemplatePage />, PATH);
    expect(
      await screen.findByText(
        'You submitted this version, so another approver must decide it (BR-07).',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve revision' })).not.toBeInTheDocument();
  });

  it('shows the documented alternative oversight when the sole approver decides their own revision', async () => {
    routeCalls({
      'buyer.policy.getTemplate': () =>
        templateDetail({
          capabilities: {
            ...idleCaps,
            canDraftVersion: false,
            canApprove: true,
            canReturn: true,
            alternativeOversightNote:
              'The Organization Administrator is the only holder of policy approval. Internal Audit reviews every self-approved change.',
          },
        }),
    });
    renderPage(<TemplatePage />, PATH);
    expect(
      await screen.findByText('Approval under documented alternative oversight'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'The Organization Administrator is the only holder of policy approval. Internal Audit reviews every self-approved change.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Another approver must decide')).not.toBeInTheDocument();
  });
});
