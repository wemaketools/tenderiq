/**
 * HistoryTimeline: the audit trail of one record (buyer side, `audit.view`; ADM-14 and every record workspace). Each
 * entry shows the action, the actor and the capacity they acted in, delegation or support access, the time in the
 * organization's official zone, the reason and the changed fields. Restricted entries are shown as metadata only
 * (DD-31: never sealed content or scores). Without `audit.view` the API answers 403 and the restricted state shows.
 */
import { useState } from 'react';

import { getEntityHistory } from '@contracts/audit';
import type { AuditEntry } from '@contracts/audit';

import { useApiQuery } from '../../api/hooks';
import { useActiveTenant } from '../../app/hooks';
import { formatOfficialTime } from '../../lib/format';
import { hasTranslation, t } from '../../lib/i18n';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { Pagination } from '../ui/Pagination';
import { QueryView } from '../ui/QueryView';
import { Chip } from '../ui/StatusChip';
import { Timeline } from '../ui/Timeline';
import type { TimelineTone } from '../ui/Timeline';

export interface HistoryTimelineProps {
  /** `audit_log.entity_type`, for example `tender`. */
  readonly entityType: string;
  readonly entityId: number;
  readonly title?: string;
  readonly pageSize?: number;
}

/** `tender.published` → the catalog label, or "Tender published". */
function actionLabel(action: string): string {
  const key = `audit.action.${action}`;
  if (hasTranslation(key)) {
    return t(key);
  }
  const text = action.replace(/[._]/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toneOf(action: string): TimelineTone {
  if (/(reject|cancel|withdraw|exclude|suspend|revoke|fail)/.test(action)) return 'danger';
  if (/(approve|award|publish|sign|confirm|complete)/.test(action)) return 'success';
  if (/(invalidat|hold|return|expire)/.test(action)) return 'warning';
  if (/(create|submit|request)/.test(action)) return 'info';
  return 'neutral';
}

function changedFields(entry: AuditEntry): string[] {
  const before = entry.beforeState ?? {};
  const after = entry.afterState ?? {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .sort();
}

export function HistoryTimeline({
  entityType,
  entityId,
  title,
  pageSize = 20,
}: HistoryTimelineProps) {
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const [page, setPage] = useState(1);
  const query = useApiQuery(getEntityHistory, {
    params: { entityType, entityId },
    query: { page, pageSize, sort: 'occurredAt', dir: 'desc' },
  });

  return (
    <Card title={title ?? t('audit.title')}>
      <QueryView
        query={query}
        isEmpty={(data) => data.items.length === 0}
        empty={<EmptyState compact icon="history" title={t('audit.empty')} />}
      >
        {(data) => (
          <>
            <Timeline
              label={title ?? t('audit.title')}
              items={data.items.map((entry) => {
                const fields = entry.redacted ? [] : changedFields(entry);
                return {
                  id: entry.id,
                  title: actionLabel(entry.action),
                  tone: toneOf(entry.action),
                  icon: entry.redacted ? 'lock' : 'history',
                  meta: (
                    <>
                      {entry.actor?.fullName ?? t('audit.system')}
                      {entry.actorCapacity !== null && ` · ${entry.actorCapacity}`}
                      {entry.onBehalfOf !== null &&
                        ` · ${t('audit.onBehalfOf', { name: entry.onBehalfOf.fullName })}`}
                      {entry.supportGrantId !== null && ` · ${t('audit.supportAccess')}`}
                      {` · ${formatOfficialTime(entry.occurredAt, timeZone)}`}
                    </>
                  ),
                  detail: (
                    <>
                      {entry.redacted && (
                        <Chip tone="warning" size="sm" icon="lock">
                          {t('audit.redacted')}
                        </Chip>
                      )}
                      {entry.reason !== null && (
                        <p>{t('audit.reason', { reason: entry.reason })}</p>
                      )}
                      {fields.length > 0 && (
                        <p>{t('audit.changed', { fields: fields.join(', ') })}</p>
                      )}
                      {entry.correlationId !== null && (
                        <p className="tiq-mono tiq-text-muted">
                          {t('audit.correlation', { id: entry.correlationId })}
                        </p>
                      )}
                    </>
                  ),
                };
              })}
            />
            {data.total > data.pageSize && (
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </QueryView>
    </Card>
  );
}
