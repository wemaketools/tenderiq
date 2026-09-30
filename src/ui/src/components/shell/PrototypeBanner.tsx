/**
 * PrototypeBanner (architecture-plan §0, DD-43): "Prototype — static demo data", shown on every page whenever
 * /me/context reports `environment.mode = 'prototype'` (the mock API always does). It cannot be dismissed, so
 * nobody mistakes fixture data for live data.
 */
import { useIsPrototype } from '../../app/hooks';
import { t } from '../../lib/i18n';
import { Icon } from '../ui/Icon';

export function PrototypeBanner() {
  const prototype = useIsPrototype();
  if (!prototype) {
    return null;
  }
  return (
    <div className="tiq-prototype-banner" role="note" data-testid="prototype-banner">
      <Icon name="info" />
      <span>{t('shell.prototype.banner')}</span>
    </div>
  );
}
