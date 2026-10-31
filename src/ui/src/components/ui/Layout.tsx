/**
 * Layout pieces of the buyer workspace (docs/plan/design1): a main column with a narrower side column, the split
 * inbox / record layout, a soft callout surface, and a hairline rule.
 */
import type { ReactNode } from 'react';

export function Columns({ main, side }: { readonly main: ReactNode; readonly side: ReactNode }) {
  return (
    <div className="tiq-cols">
      <div className="tiq-cols-main">{main}</div>
      <div className="tiq-cols-side">{side}</div>
    </div>
  );
}

export interface SplitProps {
  readonly list: ReactNode;
  readonly detail: ReactNode;
  readonly listLabel: string;
  /** Below the tablet width only one side shows: which one. */
  readonly narrowShows: 'list' | 'detail';
  readonly narrow: boolean;
}

export function Split({ list, detail, listLabel, narrowShows, narrow }: SplitProps) {
  return (
    <div className="tiq-split">
      {(!narrow || narrowShows === 'list') && (
        <div className="tiq-split-list" aria-label={listLabel}>
          {list}
        </div>
      )}
      {(!narrow || narrowShows === 'detail') && <div className="tiq-split-detail">{detail}</div>}
    </div>
  );
}

export interface CalloutProps {
  readonly lead?: ReactNode;
  readonly title: ReactNode;
  readonly children?: ReactNode;
  readonly actions?: ReactNode;
}

export function Callout({ lead, title, children, actions }: CalloutProps) {
  return (
    <section className="tiq-callout">
      {lead}
      <h2 className="tiq-callout-title">{title}</h2>
      {children !== undefined && <div className="tiq-callout-text">{children}</div>}
      {actions}
    </section>
  );
}

export function Rule() {
  return <hr className="tiq-hr" />;
}
