/**
 * Renders one report cell (PRD §15.2): money with its currency, counts, percentages and durations as tabular numbers,
 * statuses as chips, references as links when the caller may open the record. A missing value is shown as
 * "Missing" with its reason and never as zero; a restricted value is shown as "Restricted" (BR-43).
 */
import type { ReportCell } from '@contracts/reporting';

import { Chip, MoneyText, Reference, StatusChip } from '../../../components/ui';
import {
  formatCalendarDate,
  formatCount,
  formatDecimalString,
  formatPercent,
} from '../../../lib/format';
import { t } from '../../../lib/i18n';

export function ReportCellView({ cell }: { readonly cell: ReportCell | undefined }) {
  if (cell === undefined) {
    return <span className="tiq-text-muted">{t('reports.cell.notApplicable')}</span>;
  }
  switch (cell.kind) {
    case 'text':
      return <span>{cell.value}</span>;
    case 'count':
      return <span className="tiq-num">{formatCount(cell.value)}</span>;
    case 'money':
      return <MoneyText value={cell.value} />;
    case 'decimal':
      return <span className="tiq-num">{formatDecimalString(cell.value)}</span>;
    case 'percent':
      return <span className="tiq-num">{formatPercent(cell.value)}</span>;
    case 'days':
      return (
        <span className="tiq-num">
          {t('reports.cell.days', { value: formatDecimalString(cell.value, 1) })}
        </span>
      );
    case 'date':
      return <span>{formatCalendarDate(cell.value)}</span>;
    case 'status':
      return <StatusChip enum={cell.value.enum} value={cell.value.value} size="sm" />;
    case 'reference':
      return <Reference value={cell.value} to={cell.to} />;
    case 'missing':
      return (
        <Chip tone="warning" size="sm" outlined icon="alertTriangle" title={cell.reason}>
          {t('reports.cell.missing')}
          <span className="tiq-visually-hidden">{`: ${cell.reason}`}</span>
        </Chip>
      );
    case 'restricted':
      return (
        <Chip tone="neutral" size="sm" outlined icon="lock" title={cell.reason}>
          {t('reports.cell.restricted')}
          <span className="tiq-visually-hidden">{`: ${cell.reason}`}</span>
        </Chip>
      );
  }
}
