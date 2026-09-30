import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { BarList } from './BarList';
import { chartColor } from './chartTheme';
import { DonutChart } from './DonutChart';
import { StackedBarChart } from './StackedBarChart';
import { TrendChart } from './TrendChart';

describe('chart colours', () => {
  it('come from design tokens only', () => {
    expect(chartColor('danger', 0)).toBe('var(--tiq-chart-6)');
    expect(chartColor(undefined, 1)).toBe('var(--tiq-chart-2)');
    expect(chartColor(undefined, 7)).toBe('var(--tiq-chart-2)');
  });
});

describe('BarList', () => {
  it('shows each value with its share and links to the list behind it', () => {
    render(
      <MemoryRouter>
        <BarList
          label="Tenders by stage"
          items={[
            { id: 'open', label: 'Open', value: 3, to: '/buyer/tenders?status=open' },
            { id: 'closed', label: 'Closed', value: 1 },
          ]}
        />
      </MemoryRouter>,
    );
    const list = screen.getByRole('list', { name: 'Tenders by stage' });
    expect(within(list).getByRole('link')).toHaveAttribute('href', '/buyer/tenders?status=open');
    expect(list).toHaveTextContent('Open375%');
    expect(list).toHaveTextContent('Closed125%');
  });

  it('shows the empty state without items', () => {
    render(<BarList label="x" items={[]} />);
    expect(screen.getByText('No data for this period.')).toBeInTheDocument();
  });
});

describe('Recharts wrappers', () => {
  it('give the donut an accessible data table with values and shares', () => {
    render(
      <DonutChart
        label="Open tenders by days to close"
        caption="Open tenders"
        segments={[
          { id: 'a', label: '0-3 days', value: 1 },
          { id: 'b', label: '15+ days', value: 3, tone: 'danger' },
        ]}
      />,
    );
    const table = screen.getByRole('table', { name: 'Open tenders by days to close' });
    expect(within(table).getByRole('row', { name: '15+ days 3 75%' })).toBeInTheDocument();
    expect(screen.getByText('Open tenders')).toBeInTheDocument();
  });

  it('give line and stacked bar charts a data table with formatted values', () => {
    const series = [
      { key: 'won', label: 'Awarded' },
      { key: 'lost', label: 'Cancelled', dashed: true },
    ];
    const points = [
      { x: 'Aug', values: { won: 2_000_000, lost: null } },
      { x: 'Sep', values: { won: 100_000, lost: 50_000 } },
    ];
    render(
      <>
        <TrendChart
          label="Trend"
          series={series}
          points={points}
          formatValue={(v) => `BWP ${v / 1000}K`}
        />
        <StackedBarChart label="Stacked" series={series} points={points} horizontal />
      </>,
    );
    expect(
      within(screen.getByRole('table', { name: 'Trend' })).getByRole('row', {
        name: 'Aug BWP 2000K —',
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('table', { name: 'Stacked' })).getByRole('row', {
        name: 'Sep 100,000 50,000',
      }),
    ).toBeInTheDocument();
  });

  it('show the empty state without data', () => {
    render(<TrendChart label="Trend" series={[]} points={[]} />);
    expect(screen.getByText('No data for this period.')).toBeInTheDocument();
  });
});
