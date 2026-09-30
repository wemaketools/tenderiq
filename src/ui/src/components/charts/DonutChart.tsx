/**
 * DonutChart (`overview.png` "Open Quotes Aging"): a donut with the total in the centre and a legend with each
 * segment's value and share. Recharts, token colours.
 */
import { Cell, Pie, PieChart } from 'recharts';

import { formatCount } from '../../lib/format';
import { t } from '../../lib/i18n';
import { EmptyState } from '../ui/EmptyState';
import { ChartFrame } from './ChartFrame';
import { chartColor } from './chartTheme';
import type { ChartTone } from './chartTheme';

export interface DonutSegment {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly display?: string;
  readonly tone?: ChartTone;
}

export interface DonutChartProps {
  readonly segments: readonly DonutSegment[];
  readonly label: string;
  /** Centre caption, for example "Open tenders". */
  readonly caption: string;
  readonly centerValue?: string;
  readonly size?: number;
}

export function DonutChart({ segments, label, caption, centerValue, size = 220 }: DonutChartProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (segments.length === 0) {
    return <EmptyState compact title={t('charts.empty')} />;
  }
  const share = (value: number): string =>
    total === 0 ? '0%' : `${Math.round((value / total) * 100)}%`;
  return (
    <ChartFrame
      label={label}
      columns={[t('charts.segment'), t('charts.value'), t('charts.share')]}
      rows={segments.map((segment) => ({
        key: segment.id,
        cells: [segment.label, segment.display ?? formatCount(segment.value), share(segment.value)],
      }))}
    >
      <div className="tiq-donut">
        <div className="tiq-donut-figure" style={{ width: size, height: size }}>
          <PieChart width={size} height={size}>
            <Pie
              data={segments.map((segment) => ({ name: segment.label, value: segment.value }))}
              dataKey="value"
              nameKey="name"
              innerRadius={size * 0.36}
              outerRadius={size * 0.5}
              stroke="var(--tiq-surface-card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {segments.map((segment, index) => (
                <Cell key={segment.id} fill={chartColor(segment.tone, index)} />
              ))}
            </Pie>
          </PieChart>
          <div className="tiq-donut-center">
            <span className="tiq-donut-total">{centerValue ?? formatCount(total)}</span>
            <span className="tiq-donut-caption">{caption}</span>
          </div>
        </div>
        <ul className="tiq-chart-legend">
          {segments.map((segment, index) => (
            <li key={segment.id}>
              <span
                className="tiq-chart-swatch"
                style={{ background: chartColor(segment.tone, index) }}
              />
              <span>{segment.label}</span>
              <span className="tiq-num">{segment.display ?? formatCount(segment.value)}</span>
              <span className="tiq-num tiq-text-muted">{share(segment.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartFrame>
  );
}
