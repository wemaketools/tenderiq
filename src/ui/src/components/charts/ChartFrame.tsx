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
      <table className="tiq-visually-hidden">
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
    </figure>
  );
}
