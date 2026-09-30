/**
 * PageHeader (architecture-plan §7, docs/technical/09-frontend.md §6). Inside the app shell the page TITLE and the
 * one PRIMARY ACTION render into the top bar (as in the reference screenshots); secondary actions, the subtitle, a
 * back link and record meta (reference, stage chip, official deadline, next action; PRD §19) render in the page-local
 * head row. Outside the shell (public pages), and inside it when the top bar has no primary action slot (below
 * 768px), the primary action renders inline in the head row. It also sets the document title.
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
  /** The ONE primary action (accent), shown in the top bar. */
  readonly primaryAction?: ReactNode;
  /** Secondary actions, shown in the page head row. */
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
  const actionInTopbar = inShell && slots.primaryAction !== null;
  const inlinePrimary = actionInTopbar ? undefined : primaryAction;
  const hasHeadRow =
    !inShell ||
    inlinePrimary !== undefined ||
    subtitle !== undefined ||
    meta !== undefined ||
    actions !== undefined ||
    back !== undefined;

  return (
    <>
      {inShell && slots.title !== null && createPortal(title, slots.title)}
      {actionInTopbar &&
        slots.primaryAction !== null &&
        primaryAction !== undefined &&
        createPortal(primaryAction, slots.primaryAction)}
      {hasHeadRow && (
        <div className="tiq-page-head">
          <div className="tiq-page-head-text">
            {back !== undefined && (
              <Link to={back.to} className="tiq-back-link">
                <Icon name="arrowLeft" />
                {back.label}
              </Link>
            )}
            {!inShell && <h1 className="tiq-topbar-title">{title}</h1>}
            {subtitle !== undefined && <p className="tiq-page-intro">{subtitle}</p>}
            {meta !== undefined && <div className="tiq-page-meta">{meta}</div>}
          </div>
          {(actions !== undefined || inlinePrimary !== undefined) && (
            <div className="tiq-page-actions">
              {actions}
              {inlinePrimary}
            </div>
          )}
        </div>
      )}
    </>
  );
}
