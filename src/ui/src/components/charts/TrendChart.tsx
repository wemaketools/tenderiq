/**
 * TrendChart (`overview.png` "Won vs Lost Trend"): one or more series over time as lines or filled areas, with token
 * colours, grid and axis styles, a tooltip and an inline legend. Values are numbers for geometry; labels come from
 * the `formatValue` function (for example money from the original decimal strings).
 */
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { t } from '../../lib/i18n';
import { EmptyState } from '../ui/EmptyState';
import { ChartFrame } from './ChartFrame';
import { AXIS_STYLE, GRID_STROKE, TOOLTIP_STYLE, chartColor } from './chartTheme';
import type { ChartTone } from './chartTheme';

export interface TrendSeries {
  readonly key: string;
  readonly label: string;
  readonly tone?: ChartTone;
  /** Dashed line (for example a comparison series). */
  readonly dashed?: boolean;
}

export interface TrendPoint {
  /** The x-axis label (for example `Aug 11`). */
  readonly x: string;
  readonly values: Readonly<Record<string, number | null>>;
}

export interface TrendChartProps {
  readonly series: readonly TrendSeries[];
  readonly points: readonly TrendPoint[];
  readonly label: string;
  readonly variant?: 'line' | 'area';
  readonly height?: number;
  readonly formatValue?: (value: number) => string;
}

export function TrendChart({
  series,
  points,
  label,
  variant = 'line',
  height = 260,
  formatValue = (value) => String(value),
}: TrendChartProps) {
  if (points.length === 0 || series.length === 0) {
    return <EmptyState compact title={t('charts.empty')} />;
  }
  const data = points.map((point) => ({ x: point.x, ...point.values }));
  const axes = (
    <>
      <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="x" tick={AXIS_STYLE} stroke={GRID_STROKE} tickLine={false} />
      <YAxis
        tick={AXIS_STYLE}
        stroke={GRID_STROKE}
        tickLine={false}
        tickFormatter={formatValue}
        width={80}
      />
      <Tooltip
        contentStyle={TOOLTIP_STYLE}
        formatter={(value) =>
          typeof value === 'number' ? formatValue(value) : String(value ?? '')
        }
      />
    </>
  );
  return (
    <ChartFrame
      label={label}
      columns={[t('charts.period'), ...series.map((item) => item.label)]}
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
          {variant === 'area' ? (
            <AreaChart
              accessibilityLayer={false}
              data={data}
              margin={{ top: 8, right: 24, bottom: 0, left: 0 }}
            >
              {axes}
              {series.map((item, index) => (
                <Area
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  name={item.label}
                  stroke={chartColor(item.tone, index)}
                  fill={chartColor(item.tone, index)}
                  fillOpacity={0.15}
                  strokeDasharray={item.dashed === true ? '4 4' : undefined}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          ) : (
            <LineChart
              accessibilityLayer={false}
              data={data}
              margin={{ top: 8, right: 24, bottom: 0, left: 0 }}
            >
              {axes}
              {series.map((item, index) => (
                <Line
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  name={item.label}
                  stroke={chartColor(item.tone, index)}
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray={item.dashed === true ? '4 4' : undefined}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          )}
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
