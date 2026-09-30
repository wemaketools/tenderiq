/**
 * Dialog (`.tiq-scrim` + `.tiq-dialog`): a modal rendered in a portal, labelled by its title, with the focus kept
 * inside while open, Escape to close, and the focus returned on close: to `returnFocusRef` when given, otherwise to
 * the opener; when that element is gone or disabled (a confirmed action replaced or disabled its button), focus
 * goes to the page's main region (`#tiq-main`) instead of being dropped to <body>.
 */
import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';

import { t } from '../../lib/i18n';
import { IconButton } from './Button';
import { restoreFocus } from './focusReturn';

export interface DialogProps {
  readonly open: boolean;
  readonly title: ReactNode;
  /** Called on Escape, the close button and (unless `dismissible` is false) a scrim click. */
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly size?: 'sm' | 'md' | 'lg';
  /** False while a request is running: Escape and the scrim do not close the dialog. */
  readonly dismissible?: boolean;
  readonly description?: ReactNode;
  /** Where focus goes when the dialog closes (default: the element that had focus when it opened). */
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const BODY_FOCUSABLE = FOCUSABLE.split(', ')
  .map((selector) => `.tiq-dialog-body ${selector}`)
  .join(', ');

export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  size = 'md',
  dismissible = true,
  description,
  returnFocusRef,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const first =
      panel?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel?.querySelector<HTMLElement>(BODY_FOCUSABLE) ??
      panel;
    first?.focus();
    return () => {
      // Read at close time: the preferred target (for example a result banner) may render after opening.
      restoreFocus(returnFocusRef, opener);
    };
  }, [open, returnFocusRef]);

  if (!open) {
    return null;
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (dismissible) {
        onClose();
      }
      return;
    }
    if (event.key !== 'Tab' || panelRef.current === null) {
      return;
    }
    const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (first === undefined || last === undefined) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const sizeClass = size === 'md' ? '' : ` tiq-dialog--${size}`;
  return createPortal(
    <div
      className="tiq-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissible) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        className={`tiq-dialog${sizeClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description === undefined ? undefined : descriptionId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className="tiq-dialog-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description !== undefined && (
              <p id={descriptionId} className="tiq-card-sub">
                {description}
              </p>
            )}
          </div>
          <IconButton
            icon="x"
            label={t('ui.action.close')}
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={!dismissible}
          />
        </header>
        <div className="tiq-dialog-body">{children}</div>
        {footer !== undefined && <footer className="tiq-dialog-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
