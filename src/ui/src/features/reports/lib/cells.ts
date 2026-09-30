/** Plain-text rendering of report cells (accessible names, summaries). */
import type { ReportCell } from '@contracts/reporting';

import {
  formatCalendarDate,
  formatCount,
  formatDecimalString,
  formatPercent,
} from '../../../lib/format';
import { t } from '../../../lib/i18n';

/** Plain text of a cell (for CSV-like summaries and accessible names). */
export function cellText(cell: ReportCell | undefined): string {
  if (cell === undefined) return '';
  switch (cell.kind) {
    case 'text':
      return cell.value;
    case 'count':
      return formatCount(cell.value);
    case 'money':
      return `${cell.value.currency} ${formatDecimalString(cell.value.amount, 2)}`;
    case 'decimal':
      return formatDecimalString(cell.value);
    case 'percent':
      return formatPercent(cell.value);
    case 'days':
      return t('reports.cell.days', { value: formatDecimalString(cell.value, 1) });
    case 'date':
      return formatCalendarDate(cell.value);
    case 'status':
      return cell.value.value;
    case 'reference':
      return cell.value;
    case 'missing':
      return t('reports.cell.missing');
    case 'restricted':
      return t('reports.cell.restricted');
  }
}
