/**
 * DataTable (architecture-plan §7, `leads.png`, docs/technical/09-frontend.md §6):
 * - uppercase headers; sortable headers are buttons with a fixed arrow slot and `aria-sort`;
 * - optional selection column (select all on the page, per-row checkboxes, a bulk-action toolbar);
 * - numeric columns right-aligned with tabular numerals; references use `Reference` (monospace accent);
 * - rows that open a record (`rowHref` or `onRowClick`) end with an "open" cell holding a real link (`rowHref`) or
 *   button (`onRowClick`) named by `rowLabel`, so keyboard and screen reader users get link/button semantics; a click
 *   anywhere else on the row is a mouse convenience (interactive cells keep their own behaviour);
 * - loading skeleton rows, an error state with retry, the restricted state (never a zero, BR-43), and an empty state;
 * - the table scrolls horizontally inside its card (DD-36); pagination below.
 *
 * Sorting and paging are server-side: the table reports the requested sort/page and renders what it is given.
 */
import type { MouseEvent, ReactNode } from 'react';

import type { SortDirection } from '@contracts/common';

import type { ApiError } from '../../api/client';
import { t } from '../../lib/i18n';
import { IconButton, IconLink } from './Button';
import { EmptyState, ErrorState, RestrictedState } from './EmptyState';
import { Pagination } from './Pagination';
import type { PaginationProps } from './Pagination';
import { Skeleton } from './Skeleton';

export interface DataTableColumn<T> {
  readonly id: string;
  readonly header: ReactNode;
  readonly cell: (row: T) => ReactNode;
  /** Sortable by this key (defaults to `id` when `sortable` is true). */
  readonly sortable?: boolean;
  readonly sortKey?: string;
  /** Right-aligned tabular numbers (money, counts, scores). */
  readonly numeric?: boolean;
  /** Header text for screen readers when `header` is not plain text (for example an icon). */
  readonly accessibleHeader?: string;
  readonly width?: string;
}

export interface DataTableSort {
  readonly key: string;
  readonly dir: SortDirection;
}

export interface DataTableSelection {
  readonly selected: ReadonlySet<string>;
  readonly onChange: (selected: ReadonlySet<string>) => void;
  /** Buttons shown in the toolbar while rows are selected. */
  readonly actions?: ReactNode;
}

export interface DataTableProps<T> {
  readonly columns: readonly DataTableColumn<T>[];
  readonly rows: readonly T[] | undefined;
  readonly rowKey: (row: T) => string;
  /** Accessible table name (caption, visually hidden). */
  readonly caption: string;
  readonly sort?: DataTableSort | null;
  readonly onSortChange?: (sort: DataTableSort) => void;
  readonly selection?: DataTableSelection;
  /** Opens a row in place (for example a side panel); rendered as an "open" button per row. */
  readonly onRowClick?: (row: T) => void;
  /** The record a row opens; rendered as an "open" link per row (preferred for navigation). */
  readonly rowHref?: (row: T) => string;
  /**
   * Accessible label of a row for selection and row actions (the name of the row's open link or button). Phrase it
   * as the record ("T-2026-0003 SCADA telemetry upgrade") or as the action ("Open T-2026-0003").
   */
  readonly rowLabel?: (row: T) => string;
  readonly loading?: boolean;
  readonly error?: ApiError | null;
  readonly onRetry?: () => void;
  /** Explain restricted access instead of rendering rows (BR-43). */
  readonly restricted?: boolean | ReactNode;
  readonly empty?: ReactNode;
  readonly pagination?: PaginationProps;
  /** Rows shown while loading. */
  readonly skeletonRows?: number;
}

function SortArrows({ state }: { readonly state: 'ascending' | 'descending' | 'none' }) {
  return (
    <span className="tiq-sort-arrow-slot" aria-hidden="true">
      <svg width="8" height="12" viewBox="0 0 8 12">
        {state !== 'descending' && <path className="tiq-sort-arrow" d="M4 0 L8 5 L0 5 Z" />}
        {state !== 'ascending' && <path className="tiq-sort-arrow" d="M4 12 L8 7 L0 7 Z" />}
      </svg>
    </span>
  );
}

function isInteractiveTarget(target: EventTarget | null, container: HTMLElement): boolean {
  let node = target instanceof Element ? target : null;
  while (node !== null && node !== container) {
    if (node.matches('a, button, input, select, textarea, label, [role="menuitem"]')) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  sort,
  onSortChange,
  selection,
  onRowClick,
  rowHref,
  rowLabel,
  loading = false,
  error = null,
  onRetry,
  restricted = false,
  empty,
  pagination,
  skeletonRows = 5,
}: DataTableProps<T>) {
  const opens = onRowClick !== undefined || rowHref !== undefined;
  const columnCount = columns.length + (selection === undefined ? 0 : 1) + (opens ? 1 : 0);
  const visibleRows = rows ?? [];
  const pageKeys = visibleRows.map(rowKey);
  const allSelected =
    selection !== undefined &&
    pageKeys.length > 0 &&
    pageKeys.every((key) => selection.selected.has(key));
  const someSelected =
    selection !== undefined && pageKeys.some((key) => selection.selected.has(key));

  const toggleAll = (checked: boolean): void => {
    if (selection === undefined) return;
    const next = new Set(selection.selected);
    for (const key of pageKeys) {
      if (checked) next.add(key);
      else next.delete(key);
    }
    selection.onChange(next);
  };

  const toggleRow = (key: string, checked: boolean): void => {
    if (selection === undefined) return;
    const next = new Set(selection.selected);
    if (checked) next.add(key);
    else next.delete(key);
    selection.onChange(next);
  };

  const onHeaderSort = (column: DataTableColumn<T>): void => {
    if (onSortChange === undefined) return;
    const key = column.sortKey ?? column.id;
    const dir: SortDirection = sort?.key === key && sort.dir === 'asc' ? 'desc' : 'asc';
    onSortChange({ key, dir });
  };

  const showBody = !restricted && error === null && !(loading && rows === undefined);
  let stateContent: ReactNode = null;
  if (restricted !== false) {
    stateContent = restricted === true ? <RestrictedState compact /> : restricted;
  } else if (error !== null && rows === undefined) {
    stateContent = <ErrorState error={error} onRetry={onRetry} />;
  } else if (!loading && rows !== undefined && rows.length === 0) {
    stateContent = empty ?? <EmptyState compact title={t('ui.table.empty')} />;
  }

  return (
    <div>
      {selection !== undefined && selection.selected.size > 0 && (
        <div className="tiq-table-toolbar" role="status">
          <span>{t('ui.table.selected', { count: selection.selected.size })}</span>
          {selection.actions}
        </div>
      )}
      {error !== null && rows !== undefined && (
        <div className="tiq-table-state">
          <ErrorState error={error} onRetry={onRetry} />
        </div>
      )}
      <div className="tiq-table-wrap" role="region" aria-label={caption} tabIndex={0}>
        <table aria-busy={loading || undefined}>
          <caption className="tiq-visually-hidden">{caption}</caption>
          <thead>
            <tr>
              {selection !== undefined && (
                <th className="tiq-table-select" scope="col">
                  <input
                    type="checkbox"
                    aria-label={t('ui.table.selectAll')}
                    checked={allSelected}
                    ref={(element) => {
                      if (element !== null) element.indeterminate = someSelected && !allSelected;
                    }}
                    disabled={!showBody || visibleRows.length === 0}
                    onChange={(event) => toggleAll(event.target.checked)}
                  />
                </th>
              )}
              {columns.map((column) => {
                const key = column.sortKey ?? column.id;
                const sortable = column.sortable === true && onSortChange !== undefined;
                const state =
                  sort?.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
                return (
                  <th
                    key={column.id}
                    scope="col"
                    className={column.numeric === true ? 'tiq-num' : undefined}
                    style={
                      column.width === undefined
                        ? undefined
                        : { width: column.width, minWidth: column.width }
                    }
                    aria-sort={sortable ? state : undefined}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        className="tiq-th-sort"
                        onClick={() => onHeaderSort(column)}
                      >
                        {column.header}
                        <SortArrows state={state} />
                      </button>
                    ) : (
                      column.header
                    )}
                    {column.accessibleHeader !== undefined && (
                      <span className="tiq-visually-hidden">{column.accessibleHeader}</span>
                    )}
                  </th>
                );
              })}
              {opens && (
                <th scope="col" className="tiq-table-open">
                  <span className="tiq-visually-hidden">{t('ui.table.openColumn')}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading &&
              rows === undefined &&
              Array.from({ length: skeletonRows }, (_, index) => (
                <tr key={`skeleton-${index}`} aria-hidden="true">
                  {Array.from({ length: columnCount }, (_unused, cell) => (
                    <td key={cell}>
                      <Skeleton />
                    </td>
                  ))}
                </tr>
              ))}
            {showBody &&
              visibleRows.map((row, index) => {
                const key = rowKey(row);
                const selected = selection?.selected.has(key) === true;
                const label = rowLabel?.(row);
                const openLabel = label ?? t('ui.table.openRowNumber', { number: index + 1 });
                const href = rowHref?.(row);
                const onClick = opens
                  ? (event: MouseEvent<HTMLTableRowElement>) => {
                      if (isInteractiveTarget(event.target, event.currentTarget)) return;
                      if (onRowClick !== undefined) onRowClick(row);
                      else event.currentTarget.querySelector<HTMLElement>('.tiq-row-open')?.click();
                    }
                  : undefined;
                return (
                  <tr
                    key={key}
                    className={opens ? 'tiq-row-clickable' : undefined}
                    aria-selected={selection === undefined ? undefined : selected}
                    aria-label={opens ? label : undefined}
                    onClick={onClick}
                  >
                    {selection !== undefined && (
                      <td className="tiq-table-select">
                        <input
                          type="checkbox"
                          aria-label={t('ui.table.selectRow', { row: label ?? key })}
                          checked={selected}
                          onChange={(event) => toggleRow(key, event.target.checked)}
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={column.numeric === true ? 'tiq-num' : undefined}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                    {opens && (
                      <td className="tiq-table-open">
                        {href !== undefined ? (
                          <IconLink
                            to={href}
                            icon="chevronRight"
                            label={openLabel}
                            className="tiq-icon-btn--ghost tiq-icon-btn--sm tiq-row-open"
                          />
                        ) : (
                          <IconButton
                            icon="chevronRight"
                            label={openLabel}
                            variant="ghost"
                            size="sm"
                            className="tiq-row-open"
                            onClick={() => onRowClick?.(row)}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
          </tbody>
        </table>
        {stateContent !== null && <div className="tiq-table-state">{stateContent}</div>}
      </div>
      {pagination !== undefined && showBody && visibleRows.length > 0 && (
        <Pagination {...pagination} />
      )}
    </div>
  );
}
