/**
 * Where a tender stands in its authoring lifecycle, for wording that must not describe a released package as a
 * draft awaiting submission (BUY-08, BR-16: after release, changes go through an addendum).
 */
import type { TendersStatus } from '@contracts/enums';
import { TENDER_AUTHORING_STATUSES } from '@contracts/tenders';
import type { ReleaseApprovalState } from '@contracts/tenders';

import { t } from '../../../lib/i18n';
import { formatOfficialTime } from '../../../lib/format';

/** The tender fields the lifecycle wording depends on. */
export interface TenderLifecycle {
  readonly status: TendersStatus;
  readonly releasedAt: string | null;
  readonly officialTimeZone: string;
  readonly draftRevision: number;
  readonly currentVersionNo: number;
}

/** Whether the package is still authored in place (draft, awaiting release approval or ready). */
export function isAuthoringStatus(status: TendersStatus): boolean {
  return (TENDER_AUTHORING_STATUSES as readonly TendersStatus[]).includes(status);
}

/** The version chip of the tender header: the issued version once released, the draft revision before. */
export function versionChipText(tender: TenderLifecycle): string {
  return !isAuthoringStatus(tender.status) && tender.currentVersionNo > 0
    ? t('tender-authoring.workspace.issuedVersion', { version: tender.currentVersionNo })
    : t('tender-authoring.workspace.revision', { revision: tender.draftRevision });
}

/** What revision a release approval covers, phrased against the release once the package was issued. */
export function approvalCoverageText(
  approval: ReleaseApprovalState,
  tender: TenderLifecycle,
): string {
  if (!isAuthoringStatus(tender.status) && tender.releasedAt !== null) {
    return t('tender-authoring.release.approval.coversReleased', {
      revision: approval.subjectVersion,
    });
  }
  return approval.coversCurrentRevision
    ? t('tender-authoring.release.approval.coversCurrent', { revision: approval.subjectVersion })
    : t('tender-authoring.release.approval.coversOld', {
        revision: approval.subjectVersion,
        current: tender.draftRevision,
      });
}

/** The banner shown instead of the publication gate when the tender is no longer authored in place. */
export function closedGateText(
  tender: TenderLifecycle,
): { readonly title: string; readonly detail: string } | null {
  if (isAuthoringStatus(tender.status)) return null;
  if (tender.status === 'cancelled') {
    return {
      title: t('tender-authoring.readiness.cancelledTitle'),
      detail: t('tender-authoring.workspace.locked.cancelled'),
    };
  }
  if (tender.releasedAt === null) {
    return {
      title: t('tender-authoring.readiness.closedTitle'),
      detail: t('tender-authoring.workspace.locked.archived'),
    };
  }
  return {
    title: t('tender-authoring.readiness.releasedTitle'),
    detail: t('tender-authoring.readiness.releasedDetail', {
      date: formatOfficialTime(tender.releasedAt, tender.officialTimeZone),
      version: tender.currentVersionNo,
    }),
  };
}
