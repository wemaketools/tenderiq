/**
 * Shared chart frame: a figure with an accessible data table (visually hidden) so every chart's numbers are
 * available to assistive technology and to tests, whatever Recharts renders.
 */
import type { ReactNode } from 'react';

export interface ChartTableRow {
  readonly key: string;
  readonly cells: readonly ReactNode[];
}

export interface ChartFrameProps {
  /** Accessible name of the chart. */
  readonly label: string;
  readonly columns: readonly string[];
  readonly rows: readonly ChartTableRow[];
  readonly children: ReactNode;
}

export function ChartFrame({ label, columns, rows, children }: ChartFrameProps) {
  return (
    <figure className="tiq-chart" aria-label={label}>
      <div aria-hidden="true">{children}</div>
      {/* A table ignores the 1px box of the visually hidden pattern, so a wrapper clips it (inside the positioned
          figure) and it can never widen the page. */}
      <div className="tiq-visually-hidden">
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                {row.cells.map((cell, index) =>
                  index === 0 ? (
                    <th key={index} scope="row">
                      {cell}
                    </th>
                  ) : (
                    <td key={index}>{cell}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
