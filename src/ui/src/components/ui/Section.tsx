/**
 * A page section of the buyer workspace (docs/plan/design1): a 22-24px heading with an optional count beside it,
 * an optional trailing link ("View all →") or actions, and the content below, separated by whitespace rather than a
 * frame. The heading level defaults to h2 (one H1 per page is the PageHeader's).
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { Icon } from './Icon';

export interface SectionProps {
  readonly title: ReactNode;
  /** A count shown beside the title ("Up next  3 items"). */
  readonly count?: ReactNode;
  /** A link at the end of the heading row. */
  readonly link?: { readonly to: string; readonly label: string };
  readonly actions?: ReactNode;
  readonly headingLevel?: 2 | 3;
  readonly id?: string;
  readonly className?: string;
  readonly children: ReactNode;
}

export function Section({
  title,
  count,
  link,
  actions,
  headingLevel = 2,
  id,
  className,
  children,
}: SectionProps) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3';
  return (
    <section
      className={className === undefined ? 'tiq-section' : `tiq-section ${className}`}
      id={id}
    >
      <div className="tiq-section-head">
        <Heading className="tiq-section-title">
          <span>{title}</span>
          {count !== undefined && <span className="tiq-section-count">{count}</span>}
        </Heading>
        {(link !== undefined || actions !== undefined) && (
          <div className="tiq-inline">
            {actions}
            {link !== undefined && (
              <Link to={link.to} className="tiq-section-link">
                {link.label}
                <Icon name="arrowRight" />
              </Link>
            )}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}
