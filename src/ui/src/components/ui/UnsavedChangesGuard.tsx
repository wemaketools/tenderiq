/**
 * UnsavedChangesGuard (PRD §19 "warn before a user abandons unsaved work"): while `when` is true, in-app navigation
 * asks for confirmation and closing or reloading the tab triggers the browser's own prompt.
 */
import { useEffect } from 'react';
import { useBlocker } from 'react-router';

import { t } from '../../lib/i18n';
import { Button } from './Button';
import { Dialog } from './Dialog';

export interface UnsavedChangesGuardProps {
  /** True while the form has unsaved changes. */
  readonly when: boolean;
  readonly message?: string;
}

export function UnsavedChangesGuard({ when, message }: UnsavedChangesGuardProps) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );

  useEffect(() => {
    if (!when) {
      return undefined;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [when]);

  return (
    <Dialog
      open={blocker.state === 'blocked'}
      title={t('ui.unsaved.title')}
      onClose={() => blocker.reset?.()}
      size="sm"
      footer={
        <>
          <Button variant="primary" data-autofocus onClick={() => blocker.reset?.()}>
            {t('ui.unsaved.stay')}
          </Button>
          <Button variant="danger" onClick={() => blocker.proceed?.()}>
            {t('ui.unsaved.leave')}
          </Button>
        </>
      }
    >
      <p>{message ?? t('ui.unsaved.message')}</p>
    </Dialog>
  );
}
