/**
 * The two decisive states of COM-05:
 * - AC-05 / BR-06: "Exceeds the authority of X — routed to Y", with both limits, so the correct route is visible and
 *   documented.
 * - AC-06 / BR-10: "Invalidated by a change", with what changed between the approved and the changed version, and
 *   the approval that replaces it (or that one is still needed).
 */
import type { ApprovalDetail, ApprovalRouting } from '@contracts/approvals';

import { Banner, ButtonLink, DataTable, DetailList } from '../../../components/ui';
import { formatMoney, formatOfficialTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { INBOX_PATHS } from '../../tasks/lib/paths';

function personLine(
  person: { readonly fullName: string } | null,
  capacity: string | null,
  fallback: string,
): string {
  if (person === null) return fallback;
  return capacity === null
    ? person.fullName
    : t('approvals.routing.person', { name: person.fullName, capacity });
}

export function RoutingNotice({
  routing,
  timeZone,
}: {
  readonly routing: ApprovalRouting;
  readonly timeZone: string;
}) {
  const skipped = routing.skipped?.fullName ?? t('approvals.routing.unknownPerson');
  const routedTo = routing.routedTo?.fullName ?? t('approvals.routing.unassigned');
  return (
    <Banner tone="warning" title={t(`approvals.routing.${routing.reason}`, { skipped, routedTo })}>
      <DetailList
        items={[
          {
            key: 'skipped',
            label: t('approvals.routing.skipped'),
            value: (
              <span className="tiq-stack">
                <span>
                  {personLine(
                    routing.skipped,
                    routing.skippedCapacity,
                    t('approvals.routing.unknownPerson'),
                  )}
                </span>
                <span className="tiq-text-muted">
                  {routing.skippedLimit === null
                    ? t('approvals.routing.noLimit')
                    : t('approvals.routing.limit', { amount: formatMoney(routing.skippedLimit) })}
                </span>
              </span>
            ),
          },
          {
            key: 'routedTo',
            label: t('approvals.routing.routedTo'),
            value: (
              <span className="tiq-stack">
                <span>
                  {personLine(
                    routing.routedTo,
                    routing.routedToCapacity,
                    t('approvals.routing.unassigned'),
                  )}
                </span>
                <span className="tiq-text-muted">
                  {routing.routedToLimit === null
                    ? t('approvals.routing.noLimit')
                    : t('approvals.routing.limit', { amount: formatMoney(routing.routedToLimit) })}
                </span>
              </span>
            ),
          },
        ]}
      />
      <p>
        {t('approvals.routing.routedAt', { time: formatOfficialTime(routing.routedAt, timeZone) })}
        {routing.note !== null && ` ${routing.note}`}
      </p>
    </Banner>
  );
}

export function InvalidationNotice({
  approval,
  timeZone,
}: {
  readonly approval: ApprovalDetail;
  readonly timeZone: string;
}) {
  const invalidation = approval.invalidation;
  if (invalidation === null || invalidation === undefined) {
    return approval.status === 'invalidated' ? (
      <Banner tone="error" title={t('approvals.invalidation.title')}>
        {approval.invalidatedReason}
      </Banner>
    ) : null;
  }
  return (
    <Banner
      tone="error"
      title={t('approvals.invalidation.title')}
      actions={
        <>
          {approval.subjectLinkPath !== null && (
            <ButtonLink to={approval.subjectLinkPath} size="sm" icon="externalLink">
              {t('approvals.invalidation.openRecord')}
            </ButtonLink>
          )}
          {invalidation.replacementApprovalId !== null && (
            <ButtonLink
              to={INBOX_PATHS.approval(invalidation.replacementApprovalId)}
              size="sm"
              icon="arrowRight"
            >
              {t('approvals.invalidation.replacement', { version: invalidation.toVersion })}
            </ButtonLink>
          )}
        </>
      }
    >
      <p>
        {t('approvals.invalidation.body', {
          from: invalidation.fromVersion,
          to: invalidation.toVersion,
          time: formatOfficialTime(invalidation.changedAt, timeZone),
          name: invalidation.changedBy?.fullName ?? t('approvals.invalidation.unknownPerson'),
        })}
      </p>
      {approval.invalidatedReason !== null && <p>{approval.invalidatedReason}</p>}
      <DataTable
        caption={t('approvals.invalidation.caption')}
        rows={invalidation.changes}
        rowKey={(row) => row.key}
        columns={[
          { id: 'field', header: t('approvals.invalidation.field'), cell: (row) => row.label },
          {
            id: 'before',
            header: t('approvals.invalidation.before'),
            cell: (row) => row.before ?? '—',
          },
          {
            id: 'after',
            header: t('approvals.invalidation.after'),
            cell: (row) => <strong>{row.after ?? '—'}</strong>,
          },
        ]}
      />
      {invalidation.replacementApprovalId === null && (
        <p>{t('approvals.invalidation.noReplacement', { version: invalidation.toVersion })}</p>
      )}
    </Banner>
  );
}
