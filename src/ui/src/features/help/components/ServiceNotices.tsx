/**
 * Service notices (COM-09): product announcements and platform incident notices, with the incident severity and
 * recovery status. Signed-in users also see which of their organizations an incident affected; public notices carry
 * no customer detail. Formal tender notices are never shown here.
 */
import type { ServiceNotice, ServiceNoticeList } from '@contracts/operations';

import { Banner, Card, EmptyState, StatusChip, Timeline } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { OpsChip } from '../../ops/components/OpsChip';

function noticeMeta(notice: ServiceNotice, timeZone: string) {
  return (
    <span className="tiq-inline">
      <OpsChip kind="noticeKind" value={notice.kind} size="sm" />
      {notice.severity !== null && <OpsChip kind="severity" value={notice.severity} size="sm" />}
      {notice.incidentStatus !== null && (
        <StatusChip enum="service_incidents.status" value={notice.incidentStatus} size="sm" />
      )}
      <span>{formatDateTime(notice.publishedAt, timeZone)}</span>
      {notice.resolvedAt !== null && (
        <span>
          {t('help.notices.recovered', { at: formatDateTime(notice.resolvedAt, timeZone) })}
        </span>
      )}
    </span>
  );
}

export function ServiceNotices({
  list,
  timeZone,
  title,
}: {
  readonly list: ServiceNoticeList;
  readonly timeZone: string;
  readonly title: string;
}) {
  const sorted = [...list.items].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return (
    <Card title={title} subtitle={list.distinctionNote}>
      {sorted.length === 0 ? (
        <EmptyState compact icon="megaphone" title={t('help.notices.empty')} />
      ) : (
        <Timeline
          label={title}
          items={sorted.map((notice) => ({
            id: notice.id,
            icon: notice.kind === 'incident' ? 'alertOctagon' : 'megaphone',
            tone:
              notice.kind === 'announcement'
                ? 'accent'
                : notice.incidentStatus === 'resolved'
                  ? 'success'
                  : 'warning',
            title: notice.title,
            meta: noticeMeta(notice, timeZone),
            detail: (
              <>
                <p>{notice.body}</p>
                {notice.affectedOrganizations.length > 0 && (
                  <Banner tone="warning" title={t('help.notices.affected')}>
                    <p>
                      {notice.affectedOrganizations
                        .map((organization) => organization.tenantName)
                        .join(', ')}
                    </p>
                  </Banner>
                )}
              </>
            ),
          }))}
        />
      )}
    </Card>
  );
}
