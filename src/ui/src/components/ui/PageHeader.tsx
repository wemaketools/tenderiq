/**
 * PageHeader (architecture-plan §7, docs/technical/09-frontend.md §6). Inside the app shell the page TITLE renders
 * into the top bar (as in the reference screenshots). Everything else renders in the page-local head: a first row with
 * the back link and subtitle on the left and the actions on the right (secondary actions, then the page's ONE primary
 * action, accent), and below it the record meta across the full width (reference, stage chip, official deadline, next
 * action; PRD §19). Keeping the meta out of the button row means a long meta line never pushes the buttons down, and
 * the number of buttons never changes how the meta wraps, so a record's tabs line up (DD-46). Actions stay in the
 * content area because they belong to this page or record; an action for the whole sidebar destination is a section
 * action, shown by the top bar. Outside the shell (public pages) the title renders in the first row too. It also sets
 * the document title.
 */
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';

import { t } from '../../lib/i18n';
import { Icon } from './Icon';
import { usePageSlots } from './pageSlots';

export interface PageHeaderProps {
  /** The page title (plain text: it is also the document title). */
  readonly title: string;
  readonly subtitle?: ReactNode;
  /** Record context: reference, status chip, official deadline, next required action. */
  readonly meta?: ReactNode;
  /** The ONE primary action (accent) of this page, shown last in the head row. */
  readonly primaryAction?: ReactNode;
  /** Secondary actions, shown in the head row before the primary action. */
  readonly actions?: ReactNode;
  readonly back?: { readonly to: string; readonly label: string };
}

export function PageHeader({
  title,
  subtitle,
  meta,
  primaryAction,
  actions,
  back,
}: PageHeaderProps) {
  const slots = usePageSlots();

  useEffect(() => {
    document.title = t('shell.documentTitle', { title });
  }, [title]);

  const inShell = slots !== null && slots.title !== null;
  const hasActions = actions !== undefined || primaryAction !== undefined;
  const hasHeadRow =
    !inShell || hasActions || subtitle !== undefined || meta !== undefined || back !== undefined;

  return (
    <>
      {inShell && slots.title !== null && createPortal(title, slots.title)}
      {hasHeadRow && (
        <div className="tiq-page-head">
          <div className="tiq-page-head-main">
            <div className="tiq-page-head-text">
              {back !== undefined && (
                <Link to={back.to} className="tiq-back-link">
                  <Icon name="arrowLeft" />
                  {back.label}
                </Link>
              )}
              {!inShell && <h1 className="tiq-topbar-title">{title}</h1>}
              {subtitle !== undefined && <p className="tiq-page-intro">{subtitle}</p>}
            </div>
            {hasActions && (
              <div className="tiq-page-actions">
                {actions}
                {primaryAction}
              </div>
            )}
          </div>
          {meta !== undefined && <div className="tiq-page-meta">{meta}</div>}
        </div>
      )}
    </>
  );
}
