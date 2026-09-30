/**
 * StackedBarChart: categories on the x axis, one stacked bar segment per series (for example tenders by stage per
 * month, or obligations by status per contract). Recharts, token colours.
 */
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { formatCount } from '../../lib/format';
import { t } from '../../lib/i18n';
import { EmptyState } from '../ui/EmptyState';
import { ChartFrame } from './ChartFrame';
import { AXIS_STYLE, GRID_STROKE, TOOLTIP_STYLE, chartColor } from './chartTheme';
import type { TrendPoint, TrendSeries } from './TrendChart';

export interface StackedBarChartProps {
  readonly series: readonly TrendSeries[];
  /** One entry per category (`x` is the category label). */
  readonly points: readonly TrendPoint[];
  readonly label: string;
  readonly height?: number;
  readonly formatValue?: (value: number) => string;
  /** Horizontal bars (categories on the y axis). */
  readonly horizontal?: boolean;
}

export function StackedBarChart({
  series,
  points,
  label,
  height = 260,
  formatValue = formatCount,
  horizontal = false,
}: StackedBarChartProps) {
  if (points.length === 0 || series.length === 0) {
    return <EmptyState compact title={t('charts.empty')} />;
  }
  const data = points.map((point) => ({ x: point.x, ...point.values }));
  return (
    <ChartFrame
      label={label}
      columns={[t('charts.category'), ...series.map((item) => item.label)]}
      rows={points.map((point) => ({
        key: point.x,
        cells: [
          point.x,
          ...series.map((item) => {
            const value = point.values[item.key];
            return value === null || value === undefined ? '—' : formatValue(value);
          }),
        ],
      }))}
    >
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            accessibilityLayer={false}
            data={data}
            layout={horizontal ? 'vertical' : 'horizontal'}
            margin={{ top: 8, right: 24, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              stroke={GRID_STROKE}
              strokeDasharray="3 3"
              vertical={horizontal}
              horizontal={!horizontal}
            />
            {horizontal ? (
              <>
                <XAxis
                  type="number"
                  tick={AXIS_STYLE}
                  stroke={GRID_STROKE}
                  tickFormatter={formatValue}
                />
                <YAxis
                  type="category"
                  dataKey="x"
                  tick={AXIS_STYLE}
                  stroke={GRID_STROKE}
                  width={120}
                />
              </>
            ) : (
              <>
                <XAxis dataKey="x" tick={AXIS_STYLE} stroke={GRID_STROKE} tickLine={false} />
                <YAxis
                  tick={AXIS_STYLE}
                  stroke={GRID_STROKE}
                  tickLine={false}
                  tickFormatter={formatValue}
                />
              </>
            )}
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value) =>
                typeof value === 'number' ? formatValue(value) : String(value ?? '')
              }
            />
            {series.map((item, index) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.label}
                stackId="stack"
                fill={chartColor(item.tone, index)}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="tiq-chart-legend tiq-chart-legend--inline">
        {series.map((item, index) => (
          <li key={item.key}>
            <span
              className="tiq-chart-swatch"
              style={{ background: chartColor(item.tone, index) }}
            />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </ChartFrame>
  );
}
