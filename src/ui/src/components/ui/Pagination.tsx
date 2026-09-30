/**
 * Pagination for `Page<T>` lists: "Showing 1–25 of 132", previous/next and numbered pages with ellipses, and an
 * optional page-size selector (1..100, the contract maximum).
 */
import { MAX_PAGE_SIZE } from '@contracts/common';

import { formatCount } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Icon } from './Icon';

export interface PaginationProps {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange?: (pageSize: number) => void;
  readonly pageSizes?: readonly number[];
}

/** Page numbers to show: first, last, the current one and its neighbours, `null` for a gap. */
function pageWindow(page: number, pageCount: number): Array<number | null> {
  const pages = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((a, b) => a - b);
  const result: Array<number | null> = [];
  let previous = 0;
  for (const value of sorted) {
    if (value - previous > 1) {
      result.push(null);
    }
    result.push(value);
    previous = value;
  }
  return result;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizes = [10, 25, 50, 100],
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="tiq-table-footer">
      <span aria-live="polite">
        {t('ui.pagination.showing', {
          from: formatCount(from),
          to: formatCount(to),
          total: formatCount(total),
        })}
      </span>
      <div className="tiq-inline">
        {onPageSizeChange !== undefined && (
          <label className="tiq-inline">
            <span>{t('ui.pagination.pageSize')}</span>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {pageSizes
                .filter((size) => size <= MAX_PAGE_SIZE)
                .map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
            </select>
          </label>
        )}
        <nav aria-label={t('ui.pagination.label')}>
          <ul className="tiq-pagination">
            <li>
              <button
                type="button"
                className="tiq-page-btn"
                aria-label={t('ui.pagination.previous')}
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                <Icon name="chevronLeft" />
              </button>
            </li>
            {pageWindow(page, pageCount).map((value, index) =>
              value === null ? (
                <li key={`gap-${index}`} aria-hidden="true">
                  …
                </li>
              ) : (
                <li key={value}>
                  <button
                    type="button"
                    className="tiq-page-btn"
                    aria-current={value === page ? 'page' : undefined}
                    aria-label={t('ui.pagination.page', { page: value })}
                    onClick={() => onPageChange(value)}
                  >
                    {value}
                  </button>
                </li>
              ),
            )}
            <li>
              <button
                type="button"
                className="tiq-page-btn"
                aria-label={t('ui.pagination.next')}
                disabled={page >= pageCount}
                onClick={() => onPageChange(page + 1)}
              >
                <Icon name="chevronRight" />
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
