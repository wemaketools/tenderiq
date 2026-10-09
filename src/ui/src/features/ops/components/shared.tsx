/**
 * Building blocks shared by the operations screens: activity history, live obligations (the events and contracts
 * that constrain an account change, AC-36), readiness checks, and the people pickers.
 */
import type {
  ActivityEntry,
  LiveContract,
  LiveEvent,
  ReadinessCheck,
  SupportCaseMessage,
} from '@contracts/operations';

import {
  Card,
  Chip,
  DataTable,
  EmptyState,
  OfficialDeadline,
  ReadinessChecklist,
  Reference,
  StatusChip,
  Timeline,
} from '../../../components/ui';
import type { DataTableColumn, TimelineTone } from '../../../components/ui';
import { EMPTY_VALUE, formatCalendarDate, formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';

/** Timeline tone of an activity action code (`grant.revoked`, `status.resolved`…). */
function toneOf(action: string): TimelineTone {
  if (/(revoked|denied|expired|misuse|failed)/.test(action)) return 'danger';
  if (/(resolved|authorized|closed|reconciled|decision)/.test(action)) return 'success';
  if (/(requested|investigating|identified|opened)/.test(action)) return 'warning';
  if (/(viewed|monitoring|notice)/.test(action)) return 'info';
  return 'neutral';
}

export interface ActivityHistoryProps {
  readonly entries: readonly ActivityEntry[];
  readonly timeZone: string;
  readonly label: string;
  readonly emptyText?: string;
}

/** A chronological activity history (support activity, incident timeline, exception history). */
export function ActivityHistory({ entries, timeZone, label, emptyText }: ActivityHistoryProps) {
  if (entries.length === 0) {
    return <EmptyState compact icon="history" title={emptyText ?? t('ops.common.noActivity')} />;
  }
  const sorted = [...entries].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <Timeline
      label={label}
      items={sorted.map((entry) => ({
        id: entry.id,
        title: entry.description,
        tone: toneOf(entry.action),
        meta: `${formatDateTime(entry.at, timeZone)} · ${
          entry.actor === null ? t('ops.common.system') : entry.actor.fullName
        } · ${entry.action}`,
      }))}
    />
  );
}

export interface LiveObligationsProps {
  readonly events: readonly LiveEvent[];
  readonly contracts: readonly LiveContract[];
  /** Card subtitle, for example the continuity rule. */
  readonly subtitle?: string;
}

/**
 * The live events (with official deadlines) and contracts that continue during an account change (AC-36). A title
 * or supplier the operator may not see (PRD §4.3) is simply not shown: the row keeps its reference, status and dates,
 * and the supplier column is left out when no contract names one the operator may see (DD-49).
 */
export function LiveObligations({ events, contracts, subtitle }: LiveObligationsProps) {
  const supplierColumn: DataTableColumn<LiveContract>[] = contracts.some(
    (row) => !row.withheld && row.supplierName !== null,
  )
    ? [
        {
          id: 'supplier',
          header: t('ops.obligations.col.supplier'),
          cell: (row) => (row.withheld ? null : row.supplierName),
        },
      ]
    : [];
  return (
    <div className="tiq-stack">
      <div className="tiq-grid tiq-grid--2">
        <Card
          flush
          title={t('ops.obligations.events', { count: events.length })}
          subtitle={subtitle}
        >
          <DataTable<LiveEvent>
            caption={t('ops.obligations.eventsCaption')}
            rows={events}
            rowKey={(row) => String(row.tenderId)}
            empty={<EmptyState compact title={t('ops.obligations.noEvents')} />}
            columns={[
              {
                id: 'reference',
                header: t('ops.obligations.col.event'),
                cell: (row) => (
                  <>
                    <Reference value={row.reference} />
                    {!row.withheld && <div className="tiq-cell-sub">{row.title}</div>}
                  </>
                ),
              },
              {
                id: 'status',
                header: t('ops.obligations.col.status'),
                cell: (row) => <StatusChip enum="tenders.status" value={row.status} size="sm" />,
              },
              {
                id: 'deadline',
                header: t('ops.obligations.col.deadline'),
                cell: (row) =>
                  row.submissionDeadline === null ? (
                    EMPTY_VALUE
                  ) : (
                    <OfficialDeadline deadline={row.submissionDeadline} showLocal={false} />
                  ),
              },
            ]}
          />
        </Card>
        <Card flush title={t('ops.obligations.contracts', { count: contracts.length })}>
          <DataTable<LiveContract>
            caption={t('ops.obligations.contractsCaption')}
            rows={contracts}
            rowKey={(row) => String(row.contractId)}
            empty={<EmptyState compact title={t('ops.obligations.noContracts')} />}
            columns={[
              {
                id: 'reference',
                header: t('ops.obligations.col.contract'),
                cell: (row) => (
                  <>
                    <Reference value={row.reference} />
                    {!row.withheld && <div className="tiq-cell-sub">{row.title}</div>}
                  </>
                ),
              },
              ...supplierColumn,
              {
                id: 'status',
                header: t('ops.obligations.col.status'),
                cell: (row) => <StatusChip enum="contracts.status" value={row.status} size="sm" />,
              },
              {
                id: 'termEnd',
                header: t('ops.obligations.col.termEnd'),
                cell: (row) => formatCalendarDate(row.termEnd),
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

/** A readiness checklist over contract readiness checks (blocking conditions listed before warnings). */
export function ReadinessPanel({
  checks,
  label,
}: {
  readonly checks: readonly ReadinessCheck[];
  readonly label: string;
}) {
  return (
    <ReadinessChecklist
      label={label}
      items={checks.map((check) => ({
        id: check.id,
        label: check.label,
        detail: check.detail ?? undefined,
        status: check.status,
      }))}
    />
  );
}

/** The messages of a support case, oldest first; internal operator notes are marked (and never sent to customers). */
export function MessageThread({
  messages,
  timeZone,
  label,
}: {
  readonly messages: readonly SupportCaseMessage[];
  readonly timeZone: string;
  readonly label: string;
}) {
  if (messages.length === 0) {
    return <EmptyState compact icon="messageSquare" title={t('ops.case.noMessages')} />;
  }
  return (
    <Timeline
      label={label}
      items={[...messages]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((entry) => ({
          id: entry.id,
          icon: entry.internal ? 'lock' : 'messageSquare',
          tone: entry.internal ? 'warning' : entry.authorSide === 'operator' ? 'accent' : 'neutral',
          title: (
            <span className="tiq-inline">
              {entry.author.fullName}
              <Chip tone={entry.authorSide === 'operator' ? 'accent' : 'neutral'} size="sm">
                {t(`ops.case.side.${entry.authorSide}`)}
              </Chip>
              {entry.internal && (
                <Chip tone="warning" size="sm">
                  {t('ops.case.internal')}
                </Chip>
              )}
            </span>
          ),
          meta: formatDateTime(entry.createdAt, timeZone),
          detail: <p>{entry.body}</p>,
        }))}
    />
  );
}
