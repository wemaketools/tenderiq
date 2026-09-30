import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/client';
import { signedInSession } from '../../test/fixtures';
import { renderWithProviders } from '../../test/render';
import { ConfirmActionDialog } from './ConfirmActionDialog';
import { Dialog } from './Dialog';
import { FilterBar, QuickRanges, SearchField } from './FilterBar';
import { Menu } from './Menu';
import { Pagination } from './Pagination';
import { LinkTabs, Tabs, VerticalTabs } from './Tabs';
import { useToast } from './toastContext';

describe('Dialog', () => {
  it('is a labelled modal that closes on Escape and returns the focus', async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            open
          </button>
          <Dialog open={open} title="Confirm" onClose={() => setOpen(false)}>
            <input aria-label="first field" />
          </Dialog>
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'open' });
    await userEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Confirm' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('first field')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('cannot be dismissed while not dismissible', async () => {
    const onClose = vi.fn();
    render(
      <Dialog open title="Busy" onClose={onClose} dismissible={false}>
        <p>working</p>
      </Dialog>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ConfirmActionDialog (COM-02)', () => {
  it('states acting organization, capacity, scope and result, and needs the reason when required', async () => {
    const onConfirm = vi.fn();
    renderWithProviders(
      <ConfirmActionDialog
        open
        title="Submit response"
        scope="T-2026-0003 SCADA telemetry upgrade, all lots"
        consequence="The response is submitted and an official receipt is issued."
        confirmLabel="Submit"
        reason={{ label: 'Reason', required: true }}
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />,
      { state: { session: signedInSession() } },
    );
    const context = screen.getByTestId('confirm-context');
    expect(context).toHaveTextContent('Kalahari Water Utilities (Pilot)');
    expect(context).toHaveTextContent('Procurement Officer');
    expect(context).toHaveTextContent('T-2026-0003 SCADA telemetry upgrade, all lots');
    expect(context).toHaveTextContent('an official receipt is issued');
    const confirm = screen.getByRole('button', { name: 'Submit' });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Reason/), 'Ready for release');
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith({ reason: 'Ready for release' });
  });

  it('uses the row organization for personal actions and shows a failure', () => {
    renderWithProviders(
      <ConfirmActionDialog
        open
        title="Approve"
        scope="PR-2026-0003"
        consequence="Approved"
        confirmLabel="Approve"
        organization={{ name: 'Tsodilo Engineering', capacity: 'Technical Contributor' }}
        acknowledgement="I have read the evidence."
        error={
          new ApiError({ kind: 'conflict', status: 409, title: 'Already decided', endpointId: 'x' })
        }
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
      { state: { session: signedInSession() } },
    );
    expect(screen.getByTestId('confirm-context')).toHaveTextContent('Tsodilo Engineering');
    expect(screen.getByRole('alert')).toHaveTextContent('Already decided');
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
  });
});

describe('Tabs', () => {
  it('moves between tabs with the arrow keys', async () => {
    function Harness() {
      const [selected, setSelected] = useState('a');
      return (
        <Tabs
          label="Sections"
          selected={selected}
          onSelect={setSelected}
          tabs={[
            { id: 'a', label: 'Overview' },
            { id: 'b', label: 'Lots', count: 3 },
            { id: 'c', label: 'Documents' },
          ]}
        >
          <p>panel {selected}</p>
        </Tabs>
      );
    }
    render(<Harness />);
    const first = screen.getByRole('tab', { name: 'Overview' });
    first.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /Lots/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('panel b');
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Documents' })).toHaveFocus();
  });

  it('renders route tabs and vertical settings tabs with the current page marked', () => {
    render(
      <MemoryRouter initialEntries={['/buyer/tenders/3/lots']}>
        <LinkTabs
          label="Tender"
          tabs={[
            { to: '/buyer/tenders/3', label: 'Summary', end: true },
            { to: '/buyer/tenders/3/lots', label: 'Lots' },
          ]}
        />
        <VerticalTabs
          label="Settings"
          title="Settings"
          tabs={[{ to: '/buyer/tenders/3/lots', label: 'Brokers' }]}
        >
          <p>content</p>
        </VerticalTabs>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Lots' })).toHaveClass('tiq-tab--active');
    expect(screen.getByRole('link', { name: 'Summary' })).not.toHaveClass('tiq-tab--active');
    expect(screen.getByRole('link', { name: 'Brokers' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('FilterBar', () => {
  it('offers quick ranges, search and clear filters', async () => {
    const onClear = vi.fn();
    const onSelect = vi.fn();
    const onSubmit = vi.fn();
    function Search() {
      const [value, setValue] = useState('');
      return <SearchField label="Search" value={value} onChange={setValue} onSubmit={onSubmit} />;
    }
    render(
      <FilterBar
        onClear={onClear}
        quickRanges={
          <QuickRanges
            label="Range"
            selected="month"
            onSelect={onSelect}
            options={[
              { id: 'month', label: 'This month' },
              { id: 'quarter', label: 'This quarter' },
            ]}
          />
        }
      >
        <Search />
      </FilterBar>,
    );
    expect(screen.getByRole('button', { name: 'This month' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(screen.getByRole('button', { name: 'This quarter' }));
    expect(onSelect).toHaveBeenCalledWith('quarter');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'pump{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('pump');
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClear).toHaveBeenCalled();
  });
});

describe('Pagination', () => {
  it('shows the range, windows the page numbers and moves between pages', async () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    render(
      <Pagination
        page={5}
        pageSize={25}
        total={500}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />,
    );
    expect(screen.getByText('Showing 101–125 of 500')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Pages' });
    expect(
      within(nav)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['', '1', '4', '5', '6', '20', '']);
    expect(screen.getByRole('button', { name: 'Page 5' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(6);
    await userEvent.selectOptions(screen.getByRole('combobox'), '50');
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });
});

describe('Menu', () => {
  it('opens with the keyboard, runs an action and returns the focus', async () => {
    const onSelect = vi.fn();
    render(
      <MemoryRouter>
        <Menu
          label="Account"
          entries={[
            { kind: 'text', id: 't', label: 'Acting as officer' },
            { id: 'a', label: 'Switch organization', onSelect },
            { kind: 'link', id: 'p', label: 'Profile', to: '/me/profile' },
            { kind: 'separator', id: 's' },
            { id: 'b', label: 'Sign out', onSelect: () => undefined, danger: true },
          ]}
          trigger={(props) => (
            <button type="button" {...props}>
              account
            </button>
          )}
        />
      </MemoryRouter>,
    );
    const trigger = screen.getByRole('button', { name: 'account' });
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menu', { name: 'Account' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Switch organization' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

describe('Toasts', () => {
  it('shows the result of an action in a live region and can be dismissed', async () => {
    function Trigger() {
      const toast = useToast();
      return (
        <button type="button" onClick={() => toast.show('Saved', 'success')}>
          save
        </button>
      );
    }
    renderWithProviders(<Trigger />, { state: { session: signedInSession() } });
    await userEvent.click(screen.getByRole('button', { name: 'save' }));
    const region = screen.getByRole('list', { name: 'Messages' });
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(within(region).getByRole('status')).toHaveTextContent('Saved');
    await userEvent.click(within(region).getByRole('button', { name: 'Dismiss' }));
    expect(within(region).queryByRole('status')).not.toBeInTheDocument();
  });
});
