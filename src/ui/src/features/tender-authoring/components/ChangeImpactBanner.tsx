/**
 * What the last command did to the package (BR-10, AC-06): the change is SAVED as a new draft revision (not
 * submitted, not approved); a material change invalidates the release approval and resets release checks.
 */
import type { ChangeImpact } from '@contracts/tenders';

import { Banner, Button } from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';

export function ChangeImpactBanner({
  change,
  onDismiss,
}: {
  readonly change: ChangeImpact;
  readonly onDismiss: () => void;
}) {
  const invalidated = change.invalidatedApproval;
  return (
    <Banner
      tone={invalidated === null ? 'success' : 'warning'}
      title={
        change.material
          ? t('tender-authoring.change.savedMaterial', { revision: change.draftRevision })
          : t('tender-authoring.change.saved', { revision: change.draftRevision })
      }
      actions={
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          {t('tender-authoring.change.dismiss')}
        </Button>
      }
    >
      <p>{t('tender-authoring.change.notSubmitted')}</p>
      {invalidated !== null && (
        <p data-testid="approval-invalidated">
          {t('tender-authoring.change.invalidated', {
            id: invalidated.approvalId,
            revision: invalidated.subjectVersion,
          })}
        </p>
      )}
      {change.releaseChecksReset.length > 0 && (
        <p>
          {t('tender-authoring.change.checksReset', {
            areas: change.releaseChecksReset
              .map((area) => tEnum('release_checks.check_area', area))
              .join(', '),
          })}
        </p>
      )}
    </Banner>
  );
}
