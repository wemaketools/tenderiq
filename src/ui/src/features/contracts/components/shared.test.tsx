import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { approval } from '../test/data';
import { ApprovalTitle } from './shared';

describe('ApprovalTitle (CON-02 approval status)', () => {
  it('links to the approval workspace when the viewer can open the request', () => {
    renderWithProviders(<ApprovalTitle approval={approval({ inApprovalWorkspace: true })} />);
    expect(
      screen.getByRole('link', {
        name: 'Review differences between the Lot 1 award and C-2026-0002',
      }),
    ).toHaveAttribute('href', '/me/approvals/42');
  });

  it('renders plain text with the contract-record note when the viewer cannot open the request', () => {
    renderWithProviders(<ApprovalTitle approval={approval({ inApprovalWorkspace: false })} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(
      screen.getByText('Review differences between the Lot 1 award and C-2026-0002'),
    ).toBeInTheDocument();
  });
});
