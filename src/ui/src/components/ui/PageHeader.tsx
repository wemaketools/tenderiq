/**
 * PageHeader (architecture-plan §7, docs/technical/09-frontend.md §6; docs/plan/design1).
 *
 * Default presentation: the page TITLE renders into the top bar (as in the reference screenshots). Everything else
 * renders in the page-local head: a first row with the back link and subtitle on the left and the actions on the
 * right (secondary actions, then the page's ONE primary action, accent), and below it the record meta across the
 * full width (reference, stage chip, official deadline, next action; PRD §19). Keeping the meta out of the button
 * row means a long meta line never pushes the buttons down (DD-46). An action for the whole sidebar destination is a
 * section action, shown by the top bar.
 *
 * Buyer presentation: the heading is content. The plain `title` stays the document title and, when a page gives a
 * friendlier `headline`, the plain label shows as the eyebrow above it, so "Approvals" stays discoverable under "A
 * few things need your say." The subtitle becomes the lede. The section action of the destination (which the buyer
 * utility bar does not show) renders in the head: as the primary action when the page has none of its own, else
 * before it as a secondary action, so no action appears twice. Outside the shell (public pages) the title renders in
 * the first row too. There is always exactly one H1.
 */
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';

import { t } from '../../lib/i18n';
import { ButtonLink } from './Button';
import { Icon } from './Icon';
import { usePageSlots } from './pageSlots';

export interface PageHeaderProps {
  /** The page title (plain text: it is also the document title). */
  readonly title: string;
  /** Buyer presentation: a friendlier headline shown as the H1, with `title` as the eyebrow label above it. */
  readonly headline?: string;
  /** Buyer presentation: a line above the headline (for example today's date), replacing the plain-label eyebrow. */
  readonly eyebrow?: ReactNode;
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
  headline,
  eyebrow,
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

  const buyer = slots?.presentation === 'buyer';
  if (buyer) {
    const sectionAction = slots?.sectionAction ?? null;
    const sectionButton =
      sectionAction === null ? null : (
        <ButtonLink
          to={sectionAction.to}
          variant={primaryAction === undefined ? 'primary' : 'secondary'}
          icon={sectionAction.icon}
          className="tiq-page-section-action"
        >
          {t(sectionAction.label)}
        </ButtonLink>
      );
    // A record header (one with meta) always has an actions row, one button tall, so the meta and the tabs below
    // start at the same height on every tab of the record, with or without buttons (DD-46).
    const hasActions =
      actions !== undefined ||
      primaryAction !== undefined ||
      sectionButton !== null ||
      meta !== undefined;
    return (
      <header className={meta !== undefined ? 'tiq-hero tiq-hero--record' : 'tiq-hero'}>
        <div className="tiq-hero-text">
          {back !== undefined && (
            <Link to={back.to} className="tiq-back-link">
              <Icon name="arrowLeft" />
              {back.label}
            </Link>
          )}
          {eyebrow !== undefined ? (
            <p className="tiq-hero-eyebrow">{eyebrow}</p>
          ) : (
            headline !== undefined && <p className="tiq-hero-eyebrow">{title}</p>
          )}
          <h1 className="tiq-page-title">{headline ?? title}</h1>
          {subtitle !== undefined && <p className="tiq-hero-lede">{subtitle}</p>}
        </div>
        {hasActions && (
          <div className="tiq-hero-actions tiq-page-actions">
            {actions}
            {sectionButton}
            {primaryAction}
          </div>
        )}
        {meta !== undefined && <div className="tiq-hero-meta tiq-page-meta">{meta}</div>}
      </header>
    );
  }

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
