import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { authoringOptions, renderPage, routeCalls, templateDetail } from '../test/kit';
import TemplateNewPage from './TemplateNewPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/buyer/admin/policy/templates/new',
  route: '/buyer/admin/policy/templates/new',
};

describe('TemplateNewPage (ADM-08)', () => {
  it('requires a checklist item for a checklist template', async () => {
    const calls = routeCalls({ 'buyer.policy.templateAuthoringOptions': () => authoringOptions() });
    renderPage(<TemplateNewPage />, PATH);
    fireEvent.change(screen.getByRole('textbox', { name: /^Name/ }), {
      target: { value: 'Opening checklist' },
    });
    fireEvent.change(screen.getByLabelText(/^Kind/), { target: { value: 'checklist' } });
    fireEvent.change(await screen.findByLabelText(/^Owner/), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/^Next review date/), {
      target: { value: '2027-06-30' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('A checklist needs at least one item.')).toBeInTheDocument();
    expect(calls.some((entry) => entry.id === 'buyer.policy.createTemplate')).toBe(false);
  });

  it('creates a draft template with its governance metadata and opens it', async () => {
    const calls = routeCalls({
      'buyer.policy.templateAuthoringOptions': () => authoringOptions(),
      'buyer.policy.createTemplate': () => templateDetail({ id: 900 }),
    });
    const { router } = renderPage(<TemplateNewPage />, PATH);
    fireEvent.change(screen.getByRole('textbox', { name: /^Name/ }), {
      target: { value: 'Award letter' },
    });
    fireEvent.change(screen.getByLabelText(/^Kind/), { target: { value: 'letter' } });
    fireEvent.change(await screen.findByLabelText(/^Owner/), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/^Intended category/), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/^Next review date/), {
      target: { value: '2027-06-30' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /^Content/ }), {
      target: { value: 'Dear supplier,' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/buyer/admin/policy/templates/900'),
    );
    expect(
      calls.find((entry) => entry.id === 'buyer.policy.createTemplate')?.request,
    ).toMatchObject({
      body: {
        name: 'Award letter',
        kind: 'letter',
        ownerUserId: 5,
        categoryId: 1,
        reviewDate: '2027-06-30',
        bodyMarkdown: 'Dear supplier,',
      },
    });
  });
});
