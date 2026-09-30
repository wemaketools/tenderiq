/**
 * Options the features asked the design system for: a visually hidden checkbox label, a large confirmation dialog
 * and a column width kept under the automatic table layout.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { signedInSession } from '../../test/fixtures';
import { renderWithProviders } from '../../test/render';
import { ConfirmActionDialog } from './ConfirmActionDialog';
import { DataTable } from './DataTable';
import { Checkbox } from './FormFields';

describe('Checkbox hideLabel', () => {
  it('keeps the full accessible name while hiding the label text visually', () => {
    // Arrange + Act
    render(
      <Checkbox
        label="In the app: Task assigned"
        checked={false}
        onChange={() => undefined}
        hideLabel
      />,
    );

    // Assert
    const box = screen.getByRole('checkbox', { name: 'In the app: Task assigned' });
    expect(box).toBeInTheDocument();
    expect(screen.getByText('In the app: Task assigned')).toHaveClass('tiq-visually-hidden');
  });
});

describe('ConfirmActionDialog size', () => {
  it('opens a large dialog for a form-heavy confirmation', () => {
    renderWithProviders(
      <ConfirmActionDialog
        open
        size="lg"
        title="Replace evidence"
        scope="Public liability insurance certificate"
        consequence="The new edition replaces the current one for every buyer."
        confirmLabel="Replace"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
      { state: { session: signedInSession() } },
    );

    expect(screen.getByRole('dialog')).toHaveClass('tiq-dialog--lg');
  });
});

describe('DataTable column width', () => {
  it('keeps the column width as its minimum width', () => {
    render(
      <DataTable
        caption="Questions"
        rowKey={(row: { id: string; text: string }) => row.id}
        rows={[{ id: '1', text: 'Is the delivery to the Maun depot included?' }]}
        columns={[{ id: 'text', header: 'Question', width: '24rem', cell: (row) => row.text }]}
      />,
    );

    const header = screen.getByRole('columnheader', { name: 'Question' });
    expect(header.style.width).toBe('24rem');
    expect(header.style.minWidth).toBe('24rem');
  });
});
