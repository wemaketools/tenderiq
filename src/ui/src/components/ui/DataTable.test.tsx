import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/client';
import { DataTable } from './DataTable';
import type { DataTableColumn, DataTableSort } from './DataTable';
import { MoneyText } from './Values';

interface Row {
  readonly id: string;
  readonly title: string;
  readonly value: string;
}

const rows: Row[] = [
  { id: 'T-2026-0003', title: 'SCADA telemetry upgrade', value: '1500000.00' },
  { id: 'T-2026-0002', title: 'Smart water meter supply', value: '786000.00' },
];

const columns: DataTableColumn<Row>[] = [
  { id: 'ref', header: 'Reference', sortable: true, cell: (row) => row.id },
  { id: 'title', header: 'Title', cell: (row) => <a href={`/t/${row.id}`}>{row.title}</a> },
  {
    id: 'value',
    header: 'Estimate',
    numeric: true,
    sortable: true,
    cell: (row) => <MoneyText value={{ amount: row.value, currency: 'BWP' }} />,
  },
];

describe('DataTable', () => {
  it('renders uppercase-styled headers, right-aligned numbers and sort state', async () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        caption="Tenders"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        sort={{ key: 'ref', dir: 'asc' }}
        onSortChange={onSortChange}
      />,
    );
    const table = screen.getByRole('table', { name: 'Tenders' });
    expect(within(table).getByRole('columnheader', { name: /Reference/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    expect(within(table).getByRole('columnheader', { name: /Estimate/ })).toHaveAttribute(
      'aria-sort',
      'none',
    );
    expect(screen.getByText('BWP 1,500,000').closest('td')).toHaveClass('tiq-num');
    await userEvent.click(screen.getByRole('button', { name: /Reference/ }));
    expect(onSortChange).toHaveBeenCalledWith({ key: 'ref', dir: 'desc' });
    await userEvent.click(screen.getByRole('button', { name: /Estimate/ }));
    expect(onSortChange).toHaveBeenCalledWith({ key: 'value', dir: 'asc' });
    expect(screen.getByRole('region', { name: 'Tenders' })).toHaveAttribute('tabindex', '0');
  });

  it('selects rows and the page, and shows the bulk toolbar', async () => {
    function Harness() {
      const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
      return (
        <DataTable
          caption="Tenders"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          rowLabel={(row) => row.id}
          selection={{
            selected,
            onChange: setSelected,
            actions: <button type="button">Export</button>,
          }}
        />
      );
    }
    render(<Harness />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select T-2026-0002' }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all rows on this page' }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(
      screen.getAllByRole('row').filter((row) => row.getAttribute('aria-selected') === 'true'),
    ).toHaveLength(2);
  });

  it('opens a row through a named open button (keyboard) or a row click, leaving links in the row alone', async () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        caption="Tenders"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        rowLabel={(row) => `Open ${row.id}`}
        onRowClick={onRowClick}
      />,
    );
    const row = screen.getByRole('row', { name: 'Open T-2026-0003' });
    expect(row).not.toHaveAttribute('tabindex');
    expect(screen.getByRole('columnheader', { name: 'Open' })).toBeInTheDocument();
    const open = within(row).getByRole('button', { name: 'Open T-2026-0003' });
    open.focus();
    await userEvent.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
    await userEvent.click(within(row).getByText('SCADA telemetry upgrade'));
    expect(onRowClick).toHaveBeenCalledTimes(1);
    await userEvent.click(within(row).getByText('T-2026-0003'));
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });

  it('renders a real link to the record when rowHref is given, and names it by position without a rowLabel', async () => {
    render(
      <MemoryRouter initialEntries={['/tenders']}>
        <Routes>
          <Route
            path="/tenders"
            element={
              <DataTable
                caption="Tenders"
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                rowHref={(row) => `/tenders/${row.id}`}
              />
            }
          />
          <Route path="/tenders/:id" element={<p>record page</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Open row 1' })).toHaveAttribute(
      'href',
      '/tenders/T-2026-0003',
    );
    await userEvent.click(screen.getByText('T-2026-0002'));
    expect(screen.getByText('record page')).toBeInTheDocument();
  });

  it('shows loading, empty, restricted and error states', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <DataTable
        caption="Tenders"
        columns={columns}
        rows={undefined}
        rowKey={(row) => row.id}
        loading
      />,
    );
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
    rerender(<DataTable caption="Tenders" columns={columns} rows={[]} rowKey={(row) => row.id} />);
    expect(screen.getByText('Nothing to show yet.')).toBeInTheDocument();
    rerender(
      <DataTable
        caption="Tenders"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        restricted
      />,
    );
    expect(screen.getByText('Restricted')).toBeInTheDocument();
    expect(screen.queryByText('SCADA telemetry upgrade')).not.toBeInTheDocument();
    rerender(
      <DataTable
        caption="Tenders"
        columns={columns}
        rows={undefined}
        rowKey={(row) => row.id}
        onRetry={onRetry}
        error={new ApiError({ kind: 'network', status: 0, title: 'x', endpointId: 'x' })}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('paginates below the rows', async () => {
    const onPageChange = vi.fn();
    function Harness() {
      const [sort, setSort] = useState<DataTableSort>({ key: 'ref', dir: 'asc' });
      return (
        <DataTable
          caption="Tenders"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          sort={sort}
          onSortChange={setSort}
          pagination={{ page: 1, pageSize: 2, total: 5, onPageChange }}
        />
      );
    }
    render(<Harness />);
    expect(screen.getByText('Showing 1–2 of 5')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Page 2' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
