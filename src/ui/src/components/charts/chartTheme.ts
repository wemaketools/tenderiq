/**
 * Chart colours and styles from the design tokens (charts follow the light/dark theme through CSS variables; no raw
 * colours). Chart geometry needs JS numbers: callers convert decimal strings with `Number()` for plotting ONLY and
 * pass formatted strings (from `lib/format`) for every label and tooltip, so no displayed amount is float-derived.
 */

export type ChartTone = 'accent' | 'info' | 'success' | 'warning' | 'neutral' | 'danger';

const TONE_VARIABLE: Readonly<Record<ChartTone, string>> = {
  accent: 'var(--tiq-chart-1)',
  info: 'var(--tiq-chart-2)',
  success: 'var(--tiq-chart-3)',
  warning: 'var(--tiq-chart-4)',
  neutral: 'var(--tiq-chart-5)',
  danger: 'var(--tiq-chart-6)',
};

export const CHART_SEQUENCE: readonly ChartTone[] = [
  'accent',
  'info',
  'success',
  'warning',
  'neutral',
  'danger',
];

/** The CSS colour of a tone, or of the n-th series when no tone is given. */
export function chartColor(tone: ChartTone | undefined, index: number): string {
  const resolved = tone ?? CHART_SEQUENCE[index % CHART_SEQUENCE.length] ?? 'accent';
  return TONE_VARIABLE[resolved];
}

export const AXIS_STYLE = { fill: 'var(--tiq-chart-axis)', fontSize: 12 } as const;
export const GRID_STROKE = 'var(--tiq-chart-grid)';
export const TOOLTIP_STYLE = {
  background: 'var(--tiq-surface-raised)',
  border: '1px solid var(--tiq-border-subtle)',
  borderRadius: 'var(--tiq-radius-control)',
  boxShadow: 'var(--tiq-shadow-raised)',
  color: 'var(--tiq-text-primary)',
  fontSize: 12,
} as const;
